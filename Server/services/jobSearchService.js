import { CleanedJobData } from "../models/CleanedJobData.js";
import { JobField } from "../models/jobDataFields.js";
import {
  aggregationSalaryInRange,
  SALARY_MAX_ANNUAL,
  SALARY_MIN_ANNUAL,
} from "../lib/salaryNormalization.js";

const JF = JobField;
const field = (name) => "$" + name;

const excludeDuplicates = { $match: { isDuplicate: { $ne: true } } };

const addNormalizedFields = {
  $addFields: {
    salaryNum: {
      $convert: {
        input: {
          $replaceAll: {
            input: {
              $replaceAll: {
                input: { $ifNull: [field(JF.salary), ""] },
                find: { $literal: "$" },
                replacement: { $literal: "" },
              },
            },
            find: { $literal: "," },
            replacement: { $literal: "" },
          },
        },
        to: "double",
        onError: null,
        onNull: null,
      },
    },
    title: {
      $ifNull: ["$normalizedTitle", field(JF.listingTitle), field(JF.jobTitleFilter)],
    },
    company: {
      $ifNull: ["$canonicalCompany", field(JF.company)],
    },
    city: {
      $ifNull: ["$normalizedCity", field(JF.city)],
    },
    state: {
      $ifNull: ["$normalizedState", field(JF.state)],
    },
    location: {
      $ifNull: [
        field(JF.locationLabel),
        {
          $trim: {
            input: {
              $concat: [
                { $ifNull: ["$normalizedCity", field(JF.city), ""] },
                ", ",
                { $ifNull: ["$normalizedState", field(JF.state), ""] },
              ],
            },
          },
        },
      ],
    },
    postedDate: {
      $toString: { $ifNull: ["$postedAt", field(JF.postDate), ""] },
    },
  },
};

function toArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.flatMap(toArray);
  return String(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function toNumber(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function salaryMatchStage(userMin, userMax) {
  let lo = SALARY_MIN_ANNUAL;
  let hi = SALARY_MAX_ANNUAL;
  if (userMin != null) lo = Math.max(lo, userMin);
  if (userMax != null) hi = Math.min(hi, userMax);
  if (lo > hi) {
    return { $match: { salaryNum: { $lt: 0 } } };
  }
  return { $match: { salaryNum: { $gte: lo, $lte: hi } } };
}

function buildSearchPrefixStages(baseMatch, userMin, userMax) {
  return [
    excludeDuplicates,
    { $match: baseMatch },
    addNormalizedFields,
    salaryMatchStage(userMin, userMax),
  ];
}

// ─── Facets (top-N for filter dropdowns) ────────────────────────────────────

export async function getJobFacets() {
  const TOP_N = 30;

  const [topCities, topCompanies, jobTypeCounts, topSkills, remoteCounts, salaryStats] =
    await Promise.all([
      CleanedJobData.aggregate([
        excludeDuplicates,
        { $match: { normalizedCity: { $nin: [null, ""] } } },
        { $group: { _id: "$normalizedCity", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: TOP_N },
      ]),
      CleanedJobData.aggregate([
        excludeDuplicates,
        { $match: { canonicalCompany: { $nin: [null, ""] } } },
        { $group: { _id: "$canonicalCompany", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: TOP_N },
      ]),
      CleanedJobData.aggregate([
        excludeDuplicates,
        { $group: { _id: "$jobType", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      CleanedJobData.aggregate([
        excludeDuplicates,
        { $unwind: "$skills" },
        { $group: { _id: "$skills", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
      CleanedJobData.aggregate([
        excludeDuplicates,
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            remote: { $sum: { $cond: ["$isRemote", 1, 0] } },
          },
        },
      ]),
      CleanedJobData.aggregate([
        excludeDuplicates,
        addNormalizedFields,
        aggregationSalaryInRange,
        {
          $group: {
            _id: null,
            minSalary: { $min: "$salaryNum" },
            maxSalary: { $max: "$salaryNum" },
          },
        },
      ]),
    ]);

  const stats = salaryStats?.[0] || {};
  const rc = remoteCounts?.[0] || {};
  const minSalary = Number.isFinite(Number(stats.minSalary))
    ? Math.round(Number(stats.minSalary))
    : 40000;
  const maxSalary = Number.isFinite(Number(stats.maxSalary))
    ? Math.round(Number(stats.maxSalary))
    : 200000;

  return {
    cities: topCities.map((c) => ({ name: c._id, count: c.count })),
    companies: topCompanies.map((c) => ({ name: c._id, count: c.count })),
    jobTypes: jobTypeCounts.map((j) => ({ type: j._id || "unknown", count: j.count })),
    skills: topSkills.map((s) => ({ name: s._id, count: s.count })),
    totalCount: rc.total || 0,
    remoteCount: rc.remote || 0,
    salaryRange: [Math.min(minSalary, maxSalary), Math.max(minSalary, maxSalary)],
  };
}

// ─── Facet search (debounced typeahead from frontend) ───────────────────────

export async function searchFacet(type, query, limit = 20) {
  const q = (query || "").trim();
  if (!q) return [];

  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  if (type === "company") {
    const docs = await CleanedJobData.aggregate([
      excludeDuplicates,
      { $match: { canonicalCompany: rx } },
      { $group: { _id: "$canonicalCompany", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);
    return docs.map((d) => ({ name: d._id, count: d.count }));
  }

  if (type === "city") {
    const docs = await CleanedJobData.aggregate([
      excludeDuplicates,
      { $match: { normalizedCity: rx } },
      { $group: { _id: "$normalizedCity", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);
    return docs.map((d) => ({ name: d._id, count: d.count }));
  }

  if (type === "skill") {
    const docs = await CleanedJobData.aggregate([
      excludeDuplicates,
      { $unwind: "$skills" },
      { $match: { skills: rx } },
      { $group: { _id: "$skills", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);
    return docs.map((d) => ({ name: d._id, count: d.count }));
  }

  return [];
}

// ─── Job search ─────────────────────────────────────────────────────────────

export async function searchJobs(filters) {
  const keyword = String(filters.keyword || "").trim();
  const location = String(filters.location || "").trim();
  const cities = toArray(filters.cities);
  const companies = toArray(filters.companies);
  const jobTypes = toArray(filters.jobTypes);
  const skills = toArray(filters.skills);
  const isRemote = filters.isRemote === "true" ? true : filters.isRemote === "false" ? false : null;
  const hasMin = filters.minSalary != null && String(filters.minSalary).trim() !== "";
  const hasMax = filters.maxSalary != null && String(filters.maxSalary).trim() !== "";
  const userMin = hasMin ? toNumber(filters.minSalary, 0) : null;
  const userMax = hasMax ? toNumber(filters.maxSalary, 10_000_000) : null;
  const limit = Math.min(Math.max(toNumber(filters.limit, 5000), 1), 10000);
  const sortField = String(filters.sortField || "postedDate");
  const sortDirection = String(filters.sortDirection || "desc") === "asc" ? 1 : -1;

  const baseMatch = {};

  if (keyword) {
    const rx = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    baseMatch.$or = [
      { normalizedTitle: rx },
      { [JF.listingTitle]: rx },
      { [JF.jobTitleFilter]: rx },
      { canonicalCompany: rx },
      { [JF.company]: rx },
      { skills: rx },
    ];
  }

  if (location) {
    const rx = new RegExp(location.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const clause = {
      $or: [
        { [JF.locationLabel]: rx },
        { normalizedCity: rx },
        { [JF.city]: rx },
        { normalizedState: rx },
        { [JF.state]: rx },
        { normalizedCountry: rx },
        { [JF.country]: rx },
      ],
    };
    if (!baseMatch.$and) baseMatch.$and = [];
    baseMatch.$and.push(clause);
  }

  if (cities.length > 0) {
    if (!baseMatch.$and) baseMatch.$and = [];
    baseMatch.$and.push({
      $or: [
        { normalizedCity: { $in: cities } },
        { [JF.city]: { $in: cities } },
      ],
    });
  }

  if (companies.length > 0) {
    if (!baseMatch.$and) baseMatch.$and = [];
    baseMatch.$and.push({
      $or: [
        { canonicalCompany: { $in: companies } },
        { [JF.company]: { $in: companies } },
      ],
    });
  }

  if (jobTypes.length > 0) {
    if (!baseMatch.$and) baseMatch.$and = [];
    baseMatch.$and.push({ jobType: { $in: jobTypes } });
  }

  if (skills.length > 0) {
    if (!baseMatch.$and) baseMatch.$and = [];
    baseMatch.$and.push({ skills: { $all: skills } });
  }

  if (isRemote !== null) {
    if (!baseMatch.$and) baseMatch.$and = [];
    baseMatch.$and.push({ isRemote });
  }

  const sortSpec =
    sortField === "salary"
      ? { salaryNum: sortDirection, _id: 1 }
      : { postedDate: sortDirection, _id: 1 };

  const prefix = buildSearchPrefixStages(baseMatch, userMin, userMax);

  const listPipeline = [
    ...prefix,
    { $sort: sortSpec },
    { $limit: limit },
    {
      $project: {
        _id: 1,
        title: 1,
        company: 1,
        location: 1,
        state: 1,
        salary: { $round: ["$salaryNum", 0] },
        postedDate: 1,
        jobType: { $ifNull: ["$jobType", "full_time"] },
        skills: { $ifNull: ["$skills", []] },
        isRemote: { $ifNull: ["$isRemote", false] },
        roleSource: { $ifNull: ["$roleSource", null] },
      },
    },
  ];

  const summaryPipeline = [
    ...prefix,
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        minSalary: { $min: "$salaryNum" },
        maxSalary: { $max: "$salaryNum" },
        avgSalary: { $avg: "$salaryNum" },
      },
    },
  ];

  const [docs, summaryRows] = await Promise.all([
    CleanedJobData.aggregate(listPipeline),
    CleanedJobData.aggregate(summaryPipeline),
  ]);

  const items = docs.map((d) => ({
    id: String(d._id),
    title: d.title,
    company: d.company,
    location: d.location || `${d.city || ""}, ${d.state || ""}`.trim(),
    state: d.state ? String(d.state).trim() : "",
    salary: Number(d.salary) || 0,
    postedDate: d.postedDate || "",
    jobType: d.jobType || "full_time",
    skills: d.skills || [],
    isRemote: d.isRemote || false,
    roleSource: d.roleSource || null,
  }));

  const summary = summaryRows?.[0] || {};
  const salaryStats = {
    minSalary: Number.isFinite(Number(summary.minSalary))
      ? Math.round(Number(summary.minSalary))
      : 0,
    maxSalary: Number.isFinite(Number(summary.maxSalary))
      ? Math.round(Number(summary.maxSalary))
      : 0,
    avgSalary: Number.isFinite(Number(summary.avgSalary))
      ? Math.round(Number(summary.avgSalary))
      : 0,
  };

  return {
    items,
    total: Number(summary.total) || items.length,
    salaryStats,
  };
}
