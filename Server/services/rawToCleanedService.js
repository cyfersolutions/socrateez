import { RawJobData } from "../models/RawJobData.js";
import { CleanedJobData } from "../models/CleanedJobData.js";
import { EtlAuditLog } from "../models/EtlAuditLog.js";
import { JobField } from "../models/jobDataFields.js";
import { normalizeSalaryForEtl, SALARY_MIN_ANNUAL } from "../lib/salaryNormalization.js";
import { classifyJobType } from "../lib/jobTypeClassification.js";
import { normalizeJobTitle } from "../lib/jobTitleNormalization.js";
import { detectRole } from "../lib/roleDetection.js";
import { normalizeDate } from "../lib/dateNormalization.js";
import { normalizeLocation } from "../lib/locationNormalization.js";
import { normalizeCompany } from "../lib/companyNormalization.js";
import { extractSkills } from "../lib/skillsExtraction.js";
import { detectDuplicates } from "../lib/duplicateDetection.js";
import { EtlRuleTracker } from "../lib/etlRuleTracker.js";

const FETCH_BATCH =
  Math.min(Math.max(Number(process.env.ETL_FETCH_BATCH) || 1500, 100), 10000);
const BULK_CHUNK =
  Math.min(Math.max(Number(process.env.ETL_BULK_CHUNK) || 250, 50), 1000);

const presentString = { $exists: true, $nin: [null, ""] };

function hasString(v) {
  return v != null && String(v).trim() !== "";
}

// ─── Eligibility filter ────────────────────────────────────────────────────────

export function buildEligibleRawFilter() {
  return {
    [JobField.salary]: presentString,
    [JobField.jobTitleFilter]: presentString,
  };
}

function hasCompleteLocation(raw) {
  return (
    hasString(raw[JobField.locationLabel]) &&
    hasString(raw[JobField.state]) &&
    hasString(raw[JobField.city]) &&
    hasString(raw[JobField.country])
  );
}

// ─── Salary audit helper ───────────────────────────────────────────────────────

const SAL_FLAG_MAP = {
  hourly_explicit: { id: "SAL-01", desc: "Explicit hourly keyword detected" },
  annual_explicit: { id: "SAL-02", desc: "Explicit annual keyword detected" },
  annual_plain: { id: "SAL-03", desc: "Plain number in annual range" },
  k_suffix: { id: "SAL-03", desc: "K-suffix notation (annual)" },
  hourly_heuristic: { id: "SAL-04", desc: "Plain number treated as hourly" },
  deflate_one_2080: { id: "SAL-05", desc: "Suspiciously huge value — repaired ÷2080" },
  deflate_double_2080: { id: "SAL-05", desc: "Double-inflated value — repaired ÷2080²" },
  hourly_from_inflated: { id: "SAL-05", desc: "Hourly derived from inflated value" },
};

function trackSalary(norm, rawSalary, title, tracker) {
  if (!tracker) return;
  const before = { salary: rawSalary, title };

  if (!norm.ok) {
    const map = {
      empty_salary: { id: "SAL-06", desc: "Unparseable salary" },
      unparseable: { id: "SAL-06", desc: "Unparseable salary" },
      invalid_number: { id: "SAL-06", desc: "Invalid number in salary" },
      outlier_or_unclassified: { id: "SAL-06", desc: "Unrepairable huge value" },
      trainee_sanity_cap: { id: "SAL-09", desc: "Trainee/intern salary cap exceeded" },
    };
    let rule;
    if (norm.reason === "out_of_range") {
      rule = norm.detail < SALARY_MIN_ANNUAL
        ? { id: "SAL-07", desc: "Result below $20,000" }
        : { id: "SAL-08", desc: "Result above $500,000" };
    } else {
      rule = map[norm.reason] || { id: "SAL-06", desc: norm.reason };
    }
    tracker.record(rule.id, "salary_normalization", rule.desc, {
      before, after: { rejected: true, reason: norm.reason, detail: norm.detail }, rejected: true,
    });
    return;
  }

  for (const flag of norm.flags || []) {
    const r = SAL_FLAG_MAP[flag];
    if (r) {
      tracker.record(r.id, "salary_normalization", r.desc, {
        before, after: { normalizedSalary: norm.formattedSalary, annual: norm.annual, flag },
      });
    }
  }
}

// ─── Remote-detection audit helper ─────────────────────────────────────────────

function trackRemote(raw, isRemote, tracker) {
  if (!tracker) return;
  const loc = {
    locationLabel: raw[JobField.locationLabel],
    state: raw[JobField.state],
    city: raw[JobField.city],
    country: raw[JobField.country],
  };
  const missing = Object.entries(loc).filter(([, v]) => !hasString(v));

  if (missing.length === 0) {
    tracker.record("RMT-01", "remote_detection", "All 4 location fields present", {
      before: loc, after: { isRemote: false },
    });
  } else if (missing.length === 4) {
    tracker.record("RMT-03", "remote_detection", "All 4 fields missing", {
      before: loc, after: { isRemote: true },
    });
  } else {
    const hasWhitespaceOnly = Object.values(loc).some(
      (v) => v != null && String(v) !== "" && String(v).trim() === "",
    );
    if (hasWhitespaceOnly) {
      tracker.record("RMT-04", "remote_detection", "Field present but only whitespace", {
        before: loc, after: { isRemote: true },
      });
    } else {
      tracker.record("RMT-02", "remote_detection", "Some location fields missing", {
        before: loc, after: { isRemote: true, missingFields: missing.map(([k]) => k) },
      });
    }
  }
}

// ─── Per-document transform pipeline ───────────────────────────────────────────
// Order: Salary → Job Type → Role Detection → Title Norm → rest (enrichment-only)
// Each rejection returns `rejectedAtPhase` so the sync function can build a
// cascading funnel where one phase's "Records out" = next phase's "Records in".

function processRawDoc(raw, tracker) {
  const allRules = [];
  const originalTitle = raw[JobField.jobTitleFilter] || "";
  const listingTitle = raw[JobField.listingTitle] || "";
  const salary = raw[JobField.salary] || "";
  const company = raw[JobField.company] || "";
  const postDate = raw[JobField.postDate] || "";

  // 1. Salary Normalization (biggest rejection gate — run first)
  const sal = normalizeSalaryForEtl(salary, originalTitle);
  trackSalary(sal, salary, originalTitle, tracker);
  if (sal.ok) allRules.push(...(sal.flags || []).map((f) => SAL_FLAG_MAP[f]?.id).filter(Boolean));
  if (!sal.ok) {
    return { ok: false, reason: sal.reason, rulesApplied: allRules, rejectedAtPhase: "salary_normalization" };
  }

  // 2. Job Type Classification (checks BOTH titles; strips keyword from whichever matched)
  const jtp = classifyJobType(originalTitle, listingTitle, tracker);
  allRules.push(...jtp.rulesApplied);

  // JTP-06: Internship type + suspiciously high salary → reject
  if (jtp.jobType === "internship" && sal.annual > 200_000) {
    tracker?.record("JTP-06", "job_type_classification", "Internship job type triggers salary cap", {
      before: { jobType: jtp.jobType, annual: sal.annual },
      after: null, rejected: true,
    });
    allRules.push("JTP-06");
    return { ok: false, reason: "trainee_sanity_cap", rulesApplied: allRules, rejectedAtPhase: "job_type_classification" };
  }

  // 3. Role Detection (examines both cleaned titles, picks the best canonical role)
  const rol = detectRole(jtp.cleanedFilterTitle, jtp.cleanedListingTitle, tracker);
  allRules.push(...rol.rulesApplied);
  if (!rol.ok) {
    return { ok: false, reason: rol.reason, rulesApplied: allRules, rejectedAtPhase: "role_detection" };
  }

  // 4. Title-level normalization audit (on whichever title was selected by role detection)
  const chosenTitle = rol.roleSource === "listing_title" ? jtp.cleanedListingTitle : jtp.cleanedFilterTitle;
  const ttl = normalizeJobTitle(chosenTitle, tracker);
  allRules.push(...ttl.rulesApplied);

  // 5. Remote Detection
  const isRemote = !hasCompleteLocation(raw);
  trackRemote(raw, isRemote, tracker);
  allRules.push(isRemote ? "RMT-02" : "RMT-01");

  // 6. Date & Freshness Normalization
  const dte = normalizeDate(postDate, tracker);
  allRules.push(...dte.rulesApplied);

  // 7. Location Normalization
  const loc = normalizeLocation(
    { state: raw[JobField.state], city: raw[JobField.city], country: raw[JobField.country] },
    tracker,
  );
  allRules.push(...loc.rulesApplied);

  // 8. Company Deduplication
  const cmp = normalizeCompany(company, tracker);
  allRules.push(...cmp.rulesApplied);

  // 9. Skills Extraction (scan title + listing title + job family + sub-family)
  const skillText = [originalTitle, listingTitle, raw[JobField.jobFamily], raw[JobField.subJobFamily]]
    .filter(Boolean)
    .join(" ");
  const skl = extractSkills(skillText, tracker);
  allRules.push(...skl.rulesApplied);

  // Build cleaned payload
  const { _id, __v, createdAt, updatedAt, ...jobFields } = raw;
  return {
    ok: true,
    payload: {
      ...jobFields,
      [JobField.salary]: sal.formattedSalary,
      sourceRawId: _id,
      isRemote,
      etlSalaryFlags: sal.flags || [],
      normalizedTitle: rol.normalizedTitle,
      roleSource: rol.roleSource,
      jobType: jtp.jobType,
      postedAt: dte.postedAt,
      daysSincePosted: dte.daysSincePosted,
      normalizedState: loc.normalizedState,
      normalizedCity: loc.normalizedCity,
      normalizedCountry: loc.normalizedCountry,
      latitude: loc.latitude,
      longitude: loc.longitude,
      canonicalCompany: cmp.canonicalCompany,
      skills: skl.skills,
      isDuplicate: false,
      duplicateHash: null,
      etlRulesApplied: [...new Set(allRules)],
    },
    rulesApplied: allRules,
  };
}

// ─── Batch ops builder ─────────────────────────────────────────────────────────

function buildOperationsForBatch(batch, tracker, skipReasons, phaseRejections) {
  const operations = [];
  const processedDocs = [];
  let skippedInBatch = 0;

  for (const raw of batch) {
    const result = processRawDoc(raw, tracker);

    if (!result.ok) {
      operations.push({ deleteOne: { filter: { sourceRawId: raw._id } } });
      skippedInBatch++;
      bumpReason(skipReasons, result.reason || "rejected");
      if (result.rejectedAtPhase) {
        phaseRejections[result.rejectedAtPhase] = (phaseRejections[result.rejectedAtPhase] || 0) + 1;
      }
      continue;
    }

    processedDocs.push(result.payload);
    operations.push({
      updateOne: {
        filter: { sourceRawId: raw._id },
        update: { $set: result.payload },
        upsert: true,
      },
    });
  }

  return { operations, skippedInBatch, processedDocs };
}

function bumpReason(skipReasons, reason) {
  skipReasons[reason] = (skipReasons[reason] || 0) + 1;
}

// ─── Bulk-write flusher ────────────────────────────────────────────────────────

async function flushBulkWrite(operations) {
  let upsertedCount = 0;
  let modifiedCount = 0;
  let matchedCount = 0;
  let deletedCount = 0;

  for (let i = 0; i < operations.length; i += BULK_CHUNK) {
    const chunk = operations.slice(i, i + BULK_CHUNK);
    if (chunk.length === 0) continue;
    const r = await CleanedJobData.bulkWrite(chunk, { ordered: false });
    upsertedCount += r.upsertedCount ?? 0;
    modifiedCount += r.modifiedCount ?? 0;
    matchedCount += r.matchedCount ?? 0;
    deletedCount += r.deletedCount ?? 0;
  }

  return { upsertedCount, modifiedCount, matchedCount, deletedCount };
}

// ─── Eligibility tracking ──────────────────────────────────────────────────────

async function trackEligibility(tracker) {
  const notPresent = (field) => ({
    $or: [{ [field]: { $exists: false } }, { [field]: null }, { [field]: "" }],
  });

  const [total, eligible, salaryOnly, titleOnly, listingTitleMissing] = await Promise.all([
    RawJobData.countDocuments(),
    RawJobData.countDocuments(buildEligibleRawFilter()),
    RawJobData.countDocuments({
      [JobField.salary]: presentString,
      ...notPresent(JobField.jobTitleFilter),
    }),
    RawJobData.countDocuments({
      [JobField.jobTitleFilter]: presentString,
      ...notPresent(JobField.salary),
    }),
    RawJobData.countDocuments(notPresent(JobField.listingTitle)),
  ]);

  const neither = Math.max(0, total - eligible - salaryOnly - titleOnly);

  tracker.recordBulk("ELG-01", "eligibility_filter", "Both Salary + Job Title present — process", { affected: eligible });
  tracker.recordBulk("ELG-02", "eligibility_filter", "Salary missing — skip", { affected: titleOnly, rejected: titleOnly });
  tracker.recordBulk("ELG-03", "eligibility_filter", "Job Title missing — skip", { affected: salaryOnly, rejected: salaryOnly });
  tracker.recordBulk("ELG-04", "eligibility_filter", "Both missing — skip", { affected: neither, rejected: neither });
  tracker.recordBulk("ELG-05", "eligibility_filter", "Listing Title missing — tracked (role detection may fall back to filter title)", { affected: listingTitleMissing });

  return { total, eligible };
}

// ─── Duplicate-detection pass ──────────────────────────────────────────────────

async function runDuplicateDetection(tracker) {
  const start = Date.now();

  const cleaned = await CleanedJobData.find({}, {
    sourceRawId: 1,
    normalizedTitle: 1,
    canonicalCompany: 1,
    normalizedCity: 1,
    normalizedState: 1,
    normalizedCountry: 1,
    jobType: 1,
    postedAt: 1,
  }).lean();

  const totalBefore = cleaned.length;
  tracker.startPhase("duplicate_detection", totalBefore);

  const dupMap = detectDuplicates(cleaned, tracker);

  const ops = [];
  let dupCount = 0;
  for (const [rawIdStr, { isDuplicate, duplicateHash }] of dupMap) {
    ops.push({
      updateOne: {
        filter: { sourceRawId: rawIdStr },
        update: { $set: { isDuplicate, duplicateHash } },
      },
    });
    if (isDuplicate) dupCount++;
  }

  if (ops.length > 0) await flushBulkWrite(ops);

  tracker.endPhase("duplicate_detection", totalBefore - dupCount);
  return { totalBefore, duplicatesFound: dupCount };
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function findEligibleRawJobs(options = {}) {
  const q = RawJobData.find(buildEligibleRawFilter()).sort({ createdAt: -1 }).lean();
  if (options.limit != null) q.limit(Number(options.limit));
  return q.exec();
}

export async function countEligibleRawJobs() {
  return RawJobData.countDocuments(buildEligibleRawFilter());
}

/**
 * Full ETL pipeline: processes eligible raw docs through all rules,
 * writes cleaned docs, detects duplicates, and saves audit logs.
 */
export async function syncEligibleRawToCleaned() {
  const tracker = new EtlRuleTracker();
  const syncStart = Date.now();

  // ── Phase 1: Eligibility ──
  const eligibilityStart = Date.now();
  const { total: totalRaw, eligible: eligibleRawCount } = await trackEligibility(tracker);
  tracker.setPhaseResult("eligibility_filter", totalRaw, eligibleRawCount, Date.now() - eligibilityStart);

  if (eligibleRawCount === 0) {
    await saveAuditLogs(tracker);
    return emptyResult(totalRaw, tracker.syncRunId, syncStart);
  }

  // ── Phase 2: Per-document transforms ──
  const transformStart = Date.now();
  const phaseRejections = {};
  const skipReasons = {};
  let skippedCount = 0;
  let upsertedCount = 0;
  let modifiedCount = 0;
  let matchedCount = 0;
  let deletedCount = 0;
  let processedTotal = 0;
  let lastId = null;

  const filter = buildEligibleRawFilter();

  for (;;) {
    const q = RawJobData.find(filter).sort({ _id: 1 }).limit(FETCH_BATCH).lean();
    if (lastId) q.where({ _id: { $gt: lastId } });

    const batch = await q.exec();
    if (batch.length === 0) break;

    const { operations, skippedInBatch, processedDocs } = buildOperationsForBatch(
      batch, tracker, skipReasons, phaseRejections,
    );
    skippedCount += skippedInBatch;
    processedTotal += processedDocs.length;

    const w = await flushBulkWrite(operations);
    upsertedCount += w.upsertedCount;
    modifiedCount += w.modifiedCount;
    matchedCount += w.matchedCount;
    deletedCount += w.deletedCount;

    lastId = batch[batch.length - 1]._id;
  }

  const transformTime = Date.now() - transformStart;

  // Build cascading funnel: each phase's "Records out" = next phase's "Records in".
  // Phases that can reject: salary_normalization, job_type_classification, role_detection.
  // All others are enrichment-only (no rejections, in == out).
  const cascadePhases = [
    "salary_normalization",
    "job_type_classification",
    "role_detection",
    "job_title_normalization",
    "remote_detection",
    "date_freshness",
    "location_normalization",
    "company_deduplication",
    "skills_extraction",
  ];

  let remaining = eligibleRawCount;
  for (const phase of cascadePhases) {
    const rejected = phaseRejections[phase] || 0;
    tracker.setPhaseResult(phase, remaining, remaining - rejected, transformTime);
    remaining -= rejected;
  }

  // ── Phase 3: Duplicate Detection ──
  const dupResult = await runDuplicateDetection(tracker);

  // ── Save audit logs ──
  await saveAuditLogs(tracker);

  return {
    syncRunId: tracker.syncRunId,
    eligibleRawCount,
    totalRaw,
    upsertedCount,
    modifiedCount,
    matchedCount,
    deletedCount,
    skippedCount,
    skipReasons,
    duplicatesFound: dupResult.duplicatesFound,
    pctSkippedFromEligible:
      eligibleRawCount > 0
        ? Math.round((skippedCount / eligibleRawCount) * 10000) / 100
        : 0,
    etlFetchBatch: FETCH_BATCH,
    etlBulkChunk: BULK_CHUNK,
    totalTimeTakenMs: Date.now() - syncStart,
  };
}

/**
 * Drops all cleaned rows, runs full pipeline from scratch.
 * Use after ETL rule changes (destructive).
 */
export async function resetCleanedCollectionAndSync() {
  const del = await CleanedJobData.deleteMany({});
  const sync = await syncEligibleRawToCleaned();
  return {
    cleanedDeletedCount: del.deletedCount ?? 0,
    ...sync,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function saveAuditLogs(tracker) {
  const entries = tracker.toAuditEntries();
  if (entries.length > 0) {
    await EtlAuditLog.insertMany(entries, { ordered: false });
  }
}

function emptyResult(totalRaw, syncRunId, syncStart) {
  return {
    syncRunId,
    eligibleRawCount: 0,
    totalRaw,
    upsertedCount: 0,
    modifiedCount: 0,
    matchedCount: 0,
    deletedCount: 0,
    skippedCount: 0,
    skipReasons: {},
    duplicatesFound: 0,
    pctSkippedFromEligible: 0,
    etlFetchBatch: FETCH_BATCH,
    etlBulkChunk: BULK_CHUNK,
    totalTimeTakenMs: Date.now() - syncStart,
  };
}
