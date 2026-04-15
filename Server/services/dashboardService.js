import { CleanedJobData } from "../models/CleanedJobData.js";
import { JobField } from "../models/jobDataFields.js";
import { aggregationSalaryInRange } from "../lib/salaryNormalization.js";

const JF = JobField;

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const $field = (key) => "$" + key;

const JOB_TYPE_LABELS = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
  freelance: "Freelance",
};

export const addSalaryNumAndDate = {
  $addFields: {
    salaryNum: {
      $convert: {
        input: {
          $replaceAll: {
            input: {
              $replaceAll: {
                input: { $ifNull: [$field(JF.salary), ""] },
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
    postDateParsed: {
      $cond: {
        if: { $eq: [{ $type: $field(JF.postDate) }, "date"] },
        then: $field(JF.postDate),
        else: {
          $dateFromString: {
            dateString: { $toString: { $ifNull: [$field(JF.postDate), ""] } },
            format: "%m/%d/%Y",
            onError: null,
            onNull: null,
          },
        },
      },
    },
  },
};

export const matchValidSalary = aggregationSalaryInRange;

const excludeDuplicates = { $match: { isDuplicate: { $ne: true } } };

function emptyDashboard() {
  return {
    summaryStats: {
      totalJobs: 0,
      uniqueJobs: 0,
      duplicateJobs: 0,
      avgSalary: 0,
      highestPayingRole: "—",
      highestSalary: 0,
      topLocation: "—",
      topLocationJobs: 0,
      remoteCount: 0,
      remotePct: 0,
      topSkill: "—",
      topSkillCount: 0,
    },
    salaryByRole: [],
    salaryTrends: [],
    jobsByCity: [],
    jobsByRole: [],
    salaryDistribution: [],
    jobTypeDistribution: [],
    topSkills: [],
    salaryByJobType: [],
    topJobs: [],
    featuredInsights: [
      { title: "Top Paying Cities", description: "Cities with the highest average salaries", items: [] },
      { title: "Top Roles by Volume", description: "Share of listings by job title", items: [] },
      { title: "Highest Salary Companies", description: "Companies with highest average compensation", items: [] },
    ],
  };
}

const BUCKET_LABEL = {
  0: "0–40K",
  40000: "40–60K",
  60000: "60–80K",
  80000: "80–100K",
  100000: "100–120K",
  120000: "120–140K",
  140000: "140–160K",
  160000: "160K+",
  Other: "200K+",
};
const BUCKET_ORDER = Object.values(BUCKET_LABEL);

function normalizeBuckets(buckets) {
  return (buckets || [])
    .map((b) => ({ range: BUCKET_LABEL[b._id] ?? String(b._id), count: b.count }))
    .sort((a, b) => BUCKET_ORDER.indexOf(a.range) - BUCKET_ORDER.indexOf(b.range));
}

const fmtMoney = (n) => `$${Math.round(n).toLocaleString("en-US")}`;

export async function getDashboardPayload() {
  const total = await CleanedJobData.countDocuments();
  if (total === 0) return emptyDashboard();

  const [
    summaryRow,
    duplicateCount,
    remoteCount,
    salaryByRole,
    salaryTrendsRaw,
    jobsByCity,
    jobsByRole,
    salaryBuckets,
    topJobsRaw,
    topPayingCities,
    roleShare,
    companyAvg,
    topRoleByMaxRaw,
    jobTypeDistRaw,
    topSkillsRaw,
    salaryByJobTypeRaw,
  ] = await Promise.all([
    // Summary
    CleanedJobData.aggregate([
      excludeDuplicates,
      addSalaryNumAndDate,
      matchValidSalary,
      { $group: { _id: null, totalJobs: { $sum: 1 }, avgSalary: { $avg: "$salaryNum" } } },
    ]),
    CleanedJobData.countDocuments({ isDuplicate: true }),
    CleanedJobData.countDocuments({ isRemote: true, isDuplicate: { $ne: true } }),

    // Salary by Role (use normalizedTitle)
    
    CleanedJobData.aggregate([
      excludeDuplicates,
      addSalaryNumAndDate,
      matchValidSalary,
      {
        $group: {
          _id: { $ifNull: ["$normalizedTitle", $field(JF.jobTitleFilter)] },
          salary: { $avg: "$salaryNum" },
        },
      },
      { $match: { _id: { $nin: [null, ""] } } },
      { $sort: { salary: -1 } },
      { $limit: 8 },
      { $project: { _id: 0, role: "$_id", salary: { $round: ["$salary", 0] } } },
    ]),

    // Salary Trends
    CleanedJobData.aggregate([
      excludeDuplicates,
      addSalaryNumAndDate,
      matchValidSalary,
      { $match: { postDateParsed: { $ne: null } } },
      {
        $group: {
          _id: { y: { $year: "$postDateParsed" }, m: { $month: "$postDateParsed" } },
          salary: { $avg: "$salaryNum" },
        },
      },
      { $sort: { "_id.y": 1, "_id.m": 1 } },
      { $limit: 12 },
    ]),

    // Jobs by City (use normalizedCity)
    CleanedJobData.aggregate([
      excludeDuplicates,
      addSalaryNumAndDate,
      matchValidSalary,
      {
        $group: {
          _id: { $ifNull: ["$normalizedCity", $field(JF.city)] },
          count: { $sum: 1 },
        },
      },
      { $match: { _id: { $nin: [null, ""] } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
      { $project: { _id: 0, city: "$_id", count: 1 } },
    ]),

    // Jobs by Role (use normalizedTitle)
    CleanedJobData.aggregate([
      excludeDuplicates,
      addSalaryNumAndDate,
      matchValidSalary,
      {
        $group: {
          _id: { $ifNull: ["$normalizedTitle", $field(JF.jobTitleFilter)] },
          count: { $sum: 1 },
        },
      },
      { $match: { _id: { $nin: [null, ""] } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, role: "$_id", count: 1 } },
    ]),

    // Salary Distribution
    CleanedJobData.aggregate([
      excludeDuplicates,
      addSalaryNumAndDate,
      matchValidSalary,
      {
        $bucket: {
          groupBy: "$salaryNum",
          boundaries: [0, 40000, 60000, 80000, 100000, 120000, 140000, 160000, 200000],
          default: "Other",
          output: { count: { $sum: 1 } },
        },
      },
    ]),

    // Top Jobs (enhanced with new fields)
    CleanedJobData.aggregate([
      excludeDuplicates,
      addSalaryNumAndDate,
      matchValidSalary,
      { $sort: { salaryNum: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 1,
          salaryNum: 1,
          title: $field(JF.listingTitle),
          jobTitle: $field(JF.jobTitleFilter),
          normalizedTitle: 1,
          company: $field(JF.company),
          canonicalCompany: 1,
          city: $field(JF.city),
          state: $field(JF.state),
          normalizedCity: 1,
          normalizedState: 1,
          locationLabel: $field(JF.locationLabel),
          postDate: $field(JF.postDate),
          postedAt: 1,
          jobType: 1,
          skills: 1,
          isRemote: 1,
        },
      },
    ]),

    // Top Paying Cities (use normalizedCity)
    CleanedJobData.aggregate([
      excludeDuplicates,
      addSalaryNumAndDate,
      matchValidSalary,
      {
        $group: {
          _id: { $ifNull: ["$normalizedCity", $field(JF.city)] },
          avgSalary: { $avg: "$salaryNum" },
        },
      },
      { $match: { _id: { $nin: [null, ""] } } },
      { $sort: { avgSalary: -1 } },
      { $limit: 5 },
    ]),

    // Role Share (for featured insights)
    CleanedJobData.aggregate([
      excludeDuplicates,
      addSalaryNumAndDate,
      matchValidSalary,
      {
        $group: {
          _id: { $ifNull: ["$normalizedTitle", $field(JF.jobTitleFilter)] },
          count: { $sum: 1 },
        },
      },
      { $match: { _id: { $nin: [null, ""] } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),

    // Company Avg (use canonicalCompany)
    CleanedJobData.aggregate([
      excludeDuplicates,
      addSalaryNumAndDate,
      matchValidSalary,
      {
        $group: {
          _id: { $ifNull: ["$canonicalCompany", $field(JF.company)] },
          avgSalary: { $avg: "$salaryNum" },
        },
      },
      { $match: { _id: { $nin: [null, ""] } } },
      { $sort: { avgSalary: -1 } },
      { $limit: 5 },
    ]),

    // Highest Paying Role by Max
    CleanedJobData.aggregate([
      excludeDuplicates,
      addSalaryNumAndDate,
      matchValidSalary,
      {
        $group: {
          _id: { $ifNull: ["$normalizedTitle", $field(JF.jobTitleFilter)] },
          maxSalary: { $max: "$salaryNum" },
        },
      },
      { $match: { _id: { $nin: [null, ""] } } },
      { $sort: { maxSalary: -1 } },
      { $limit: 1 },
    ]),

    // ── NEW: Job Type Distribution ──
    CleanedJobData.aggregate([
      excludeDuplicates,
      { $group: { _id: "$jobType", count: { $sum: 1 } } },
      { $match: { _id: { $nin: [null, ""] } } },
      { $sort: { count: -1 } },
    ]),

    // ── NEW: Top Skills ──
    CleanedJobData.aggregate([
      excludeDuplicates,
      { $unwind: "$skills" },
      { $group: { _id: "$skills", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 12 },
      { $project: { _id: 0, skill: "$_id", count: 1 } },
    ]),

    // ── NEW: Salary by Job Type ──
    CleanedJobData.aggregate([
      excludeDuplicates,
      addSalaryNumAndDate,
      matchValidSalary,
      { $group: { _id: "$jobType", salary: { $avg: "$salaryNum" } } },
      { $match: { _id: { $nin: [null, ""] } } },
      { $sort: { salary: -1 } },
      { $project: { _id: 0, type: "$_id", salary: { $round: ["$salary", 0] } } },
    ]),
  ]);

  const s = summaryRow[0] || { totalJobs: 0, avgSalary: 0 };
  const uniqueJobs = s.totalJobs || 0;
  const avgSalary = Math.round(s.avgSalary || 0);
  const topRoleByMax = topRoleByMaxRaw?.[0];
  const topLoc = jobsByCity[0];
  const topSkillEntry = topSkillsRaw?.[0];

  let salaryTrends = (salaryTrendsRaw || []).map((row) => {
    const m = row._id?.m ?? 1;
    const y = row._id?.y ?? new Date().getFullYear();
    return { month: `${MONTH_SHORT[m - 1]} ${y}`, salary: Math.round(row.salary || 0) };
  });
  if (salaryTrends.length === 0) {
    salaryTrends = MONTH_SHORT.map((m) => ({ month: m, salary: avgSalary }));
  }

  const jobTypeDistribution = (jobTypeDistRaw || []).map((r) => ({
    type: JOB_TYPE_LABELS[r._id] || r._id || "Unknown",
    count: r.count,
  }));

  const salaryByJobType = (salaryByJobTypeRaw || []).map((r) => ({
    ...r,
    type: JOB_TYPE_LABELS[r.type] || r.type || "Unknown",
  }));

  const totalForPct = uniqueJobs || 1;

  const featuredInsights = [
    {
      title: "Top Paying Cities",
      description: "Cities with the highest average salaries",
      items: topPayingCities.map((r) => ({ name: r._id, value: fmtMoney(r.avgSalary || 0) })),
    },
    {
      title: "Top Roles by Volume",
      description: "Share of listings by job title",
      items: roleShare.map((r) => ({
        name: r._id,
        value: `${((r.count / totalForPct) * 100).toFixed(1)}%`,
      })),
    },
    {
      title: "Highest Salary Companies",
      description: "Companies with highest average compensation",
      items: companyAvg.map((r) => ({ name: r._id, value: fmtMoney(r.avgSalary || 0) })),
    },
  ];

  return {
    summaryStats: {
      totalJobs: total,
      uniqueJobs,
      duplicateJobs: duplicateCount,
      avgSalary,
      highestPayingRole: topRoleByMax?._id || "—",
      highestSalary: Math.round(topRoleByMax?.maxSalary ?? 0),
      topLocation: topLoc?.city || "—",
      topLocationJobs: topLoc?.count || 0,
      remoteCount,
      remotePct: uniqueJobs > 0 ? Math.round((remoteCount / uniqueJobs) * 100) : 0,
      topSkill: topSkillEntry?.skill || "—",
      topSkillCount: topSkillEntry?.count || 0,
    },
    salaryByRole,
    salaryTrends,
    jobsByCity,
    jobsByRole,
    salaryDistribution: normalizeBuckets(salaryBuckets),
    jobTypeDistribution,
    topSkills: topSkillsRaw || [],
    salaryByJobType,
    topJobs: (topJobsRaw || []).map(mapDocToTopJob),
    featuredInsights,
  };
}

function mapDocToTopJob(doc) {
  const loc =
    doc.locationLabel ||
    [doc.normalizedCity || doc.city, doc.normalizedState || doc.state].filter(Boolean).join(", ") ||
    "Remote";
  const title = doc.normalizedTitle || doc.title || doc.jobTitle || "—";

  let posted = "";
  if (doc.postedAt) {
    posted = new Date(doc.postedAt).toISOString().slice(0, 10);
  } else if (doc.postDate) {
    const d = doc.postDate instanceof Date ? doc.postDate : new Date(doc.postDate);
    posted = Number.isNaN(d.getTime()) ? String(doc.postDate) : d.toISOString().slice(0, 10);
  }

  return {
    id: String(doc._id),
    title,
    company: doc.canonicalCompany || doc.company || "—",
    location: loc,
    salary: Math.round(doc.salaryNum || 0),
    postedDate: posted,
    jobType: doc.jobType || "full_time",
    skills: doc.skills || [],
    isRemote: doc.isRemote || false,
  };
}
