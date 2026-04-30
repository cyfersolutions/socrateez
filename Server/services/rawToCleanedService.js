import { RawJobData } from "../models/RawJobData.js";
import { CleanedJobData } from "../models/CleanedJobData.js";
import { EtlAuditLog } from "../models/EtlAuditLog.js";
import { JobField } from "../models/jobDataFields.js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeSalaryForEtl, SALARY_MIN_ANNUAL } from "../lib/salaryNormalization.js";
import { classifyJobType } from "../lib/jobTypeClassification.js";
import { normalizeJobTitle } from "../lib/jobTitleNormalization.js";
import { normalizeDate } from "../lib/dateNormalization.js";
import { normalizeLocation } from "../lib/locationNormalization.js";
import { normalizeCompany } from "../lib/companyNormalization.js";
import { extractSkills } from "../lib/skillsExtraction.js";
import { computeDuplicateHash } from "../lib/duplicateDetection.js";
import { EtlRuleTracker } from "../lib/etlRuleTracker.js";

const FETCH_BATCH =
  Math.min(Math.max(Number(process.env.ETL_FETCH_BATCH) || 1500, 100), 10000);
const BULK_CHUNK =
  Math.min(Math.max(Number(process.env.ETL_BULK_CHUNK) || 250, 50), 1000);
const DUP_RULE_SAMPLE_LIMIT = 100;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DUP_RULE_SAMPLE_DIR = path.join(__dirname, "../debug/duplicate-rule-samples");

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
  hourly_explicit: {
    id: "SAL-01",
    desc: "Salary text included hourly cues (/hr, per hour, hourly, ph). The numeric amount was multiplied by 2,080 work hours per year to get an annual USD figure.",
  },
  annual_explicit: {
    id: "SAL-02",
    desc: "Salary text included annual cues (/yr, year, annual, salary, pa). The number was taken as USD per year without multiplying by hourly rate.",
  },
  annual_plain: {
    id: "SAL-03",
    desc: "A bare number fell between $20k and $500k with no hourly/annual keywords, so it was treated as annual USD (already in the valid band).",
  },
  k_suffix: {
    id: "SAL-03",
    desc: "A compact form like 120k or 85.5k was parsed: the number × 1,000 as annual USD.",
  },
  hourly_heuristic: {
    id: "SAL-04",
    desc: "A number between 5 and 400 had no annual keywords; it was treated as an hourly dollar rate and × 2,080 to annualize.",
  },
  deflate_one_2080: {
    id: "SAL-05",
    desc: "The value looked like an annual figure that was mistakenly multiplied by 2,080 once. It was divided by 2,080 once to recover a plausible annual salary.",
  },
  deflate_double_2080: {
    id: "SAL-05",
    desc: "The value looked double-inflated (× 2,080 twice). It was repaired by dividing down and re-annualizing from an implied hourly rate.",
  },
  hourly_from_inflated: {
    id: "SAL-05",
    desc: "A huge number was reinterpreted as a mistaken hourly × 2,080 on an annual; divided by 2,080 and treated as hourly-derived annual.",
  },
};

function trackSalary(norm, rawSalary, listingTitleForAudit, tracker) {
  if (!tracker) return;
  const before = { salary: rawSalary, listingTitle: listingTitleForAudit };

  if (!norm.ok) {
    const map = {
      empty_salary: { id: "SAL-06", desc: "Salary field was empty or whitespace — cannot normalize; row is skipped." },
      unparseable: { id: "SAL-06", desc: "No numeric salary could be extracted from the text — cannot normalize; row is skipped." },
      invalid_number: { id: "SAL-06", desc: "A number was found but it was not finite or positive — row is skipped." },
      outlier_or_unclassified: { id: "SAL-06", desc: "The value could not be classified as hourly or annual and was not repairable — row is skipped." },
      trainee_sanity_cap: {
        id: "SAL-09",
        desc: "Listing title matches trainee/intern-style wording but annualized pay exceeded $200k — treated as bad data; row is skipped.",
      },
    };
    let rule;
    if (norm.reason === "out_of_range") {
      rule = norm.detail < SALARY_MIN_ANNUAL
        ? { id: "SAL-07", desc: "After normalization the annual amount was below $20,000 (minimum policy) — row is skipped." }
        : { id: "SAL-08", desc: "After normalization the annual amount was above $500,000 (maximum policy) — row is skipped." };
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
    tracker.record("RMT-01", "remote_detection", "Location Label, State, City, and Country are all non-empty — job is treated as not remote (office/hybrid with a known site).", {
      before: loc, after: { isRemote: false },
    });
  } else if (missing.length === 4) {
    tracker.record("RMT-03", "remote_detection", "All four location fields are empty — no physical site; job is flagged isRemote = true.", {
      before: loc, after: { isRemote: true },
    });
  } else {
    const hasWhitespaceOnly = Object.values(loc).some(
      (v) => v != null && String(v) !== "" && String(v).trim() === "",
    );
    if (hasWhitespaceOnly) {
      tracker.record("RMT-04", "remote_detection", "At least one location field contained only spaces — treated like missing data; isRemote = true.", {
        before: loc, after: { isRemote: true },
      });
    } else {
      tracker.record("RMT-02", "remote_detection", "One or more of the four location fields are missing (partial address) — insufficient for an on-site pin; isRemote = true.", {
        before: loc, after: { isRemote: true, missingFields: missing.map(([k]) => k) },
      });
    }
  }
}

// ─── Per-document transform pipeline ───────────────────────────────────────────
// Order: Salary → Job Type → Title Norm (listing first) → rest (enrichment-only)
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
  const sal = normalizeSalaryForEtl(salary, listingTitle);
  trackSalary(sal, salary, listingTitle, tracker);
  if (sal.ok) allRules.push(...(sal.flags || []).map((f) => SAL_FLAG_MAP[f]?.id).filter(Boolean));
  if (!sal.ok) {
    return { ok: false, reason: sal.reason, rulesApplied: allRules, rejectedAtPhase: "salary_normalization" };
  }

  // 2. Job Type Classification (checks BOTH titles; strips keyword from whichever matched)
  const jtp = classifyJobType(originalTitle, listingTitle, tracker);
  allRules.push(...jtp.rulesApplied);

  // JTP-06: Internship type + suspiciously high salary → reject
  if (jtp.jobType === "internship" && sal.annual > 200_000) {
    tracker?.record("JTP-06", "job_type_classification", "Job type was classified as internship (keyword in title) but annual salary is over $200k — inconsistent; row is rejected.", {
      before: { jobType: jtp.jobType, annual: sal.annual },
      after: null, rejected: true,
    });
    allRules.push("JTP-06");
    return { ok: false, reason: "trainee_sanity_cap", rulesApplied: allRules, rejectedAtPhase: "job_type_classification" };
  }

  // 3. Job title normalization — prefer listing title, then filter title (same field family as search/display)
  let ttl;
  let roleSource = null;
  if (hasString(jtp.cleanedListingTitle)) {
    ttl = normalizeJobTitle(jtp.cleanedListingTitle, tracker);
    if (ttl.ok) roleSource = "listing_title";
  }
  if (!ttl?.ok && hasString(jtp.cleanedFilterTitle)) {
    ttl = normalizeJobTitle(jtp.cleanedFilterTitle, tracker);
    if (ttl.ok) roleSource = "filter_title";
  }
  if (!ttl?.ok) {
    return {
      ok: false,
      reason: ttl?.reason || "empty_title",
      rulesApplied: allRules,
      rejectedAtPhase: "job_title_normalization",
    };
  }
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
      normalizedTitle: ttl.normalizedTitle,
      roleSource,
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

  tracker.recordBulk("ELG-01", "eligibility_filter", "Raw rows that have both a non-empty Salary and a non-empty Job Title (filter) — these are the only rows the sync pipeline attempts to clean and upsert.", { affected: eligible });
  tracker.recordBulk("ELG-02", "eligibility_filter", "Rows with Job Title but no Salary — excluded from this sync (cannot normalize pay).", { affected: titleOnly, rejected: titleOnly });
  tracker.recordBulk("ELG-03", "eligibility_filter", "Rows with Salary but no Job Title — excluded from this sync (required for type/title steps).", { affected: salaryOnly, rejected: salaryOnly });
  tracker.recordBulk("ELG-04", "eligibility_filter", "Rows missing both Salary and Job Title — excluded from processing.", { affected: neither, rejected: neither });
  tracker.recordBulk("ELG-05", "eligibility_filter", "Rows with no Listing Title — still eligible if salary + filter title exist; title normalization falls back to the filter title only.", { affected: listingTitleMissing });

  return { total, eligible };
}

// ─── Duplicate-detection pass ──────────────────────────────────────────────────

async function runDuplicateDetection(tracker) {
  const totalBefore = await CleanedJobData.countDocuments();
  tracker.startPhase("duplicate_detection", totalBefore);
  const dupRuleSamples = { "DUP-01": [], "DUP-02": [], "DUP-03": [] };

  // Stream documents to avoid loading the whole cleaned collection in memory.
  const groups = new Map();
  const cursor = CleanedJobData.find({}).lean().cursor();

  for await (const doc of cursor) {
    const rawIdStr = (doc.sourceRawId ?? doc._id)?.toString();
    if (!rawIdStr) continue;

    const hash = computeDuplicateHash(doc);
    const postedTs = doc.postedAt ? new Date(doc.postedAt).getTime() : 0;

    if (!groups.has(hash)) {
      groups.set(hash, [{ id: rawIdStr, ts: postedTs }]);
    } else {
      groups.get(hash).push({ id: rawIdStr, ts: postedTs });
    }
  }

  let dupCount = 0;
  let uniqueCount = 0;
  let duplicateGroups = 0;
  const ops = [];

  for (const [hash, rows] of groups) {
    if (rows.length === 1) {
      uniqueCount++;
      if (dupRuleSamples["DUP-03"].length < DUP_RULE_SAMPLE_LIMIT) {
        dupRuleSamples["DUP-03"].push({
          sourceRawId: rows[0].id,
          duplicateHash: hash,
          postedAtTs: rows[0].ts || null,
          isDuplicate: false,
        });
      }
      ops.push({
        updateOne: {
          filter: { sourceRawId: rows[0].id },
          update: { $set: { isDuplicate: false, duplicateHash: hash } },
        },
      });
      continue;
    }

    duplicateGroups++;
    rows.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    if (dupRuleSamples["DUP-02"].length < DUP_RULE_SAMPLE_LIMIT) {
      dupRuleSamples["DUP-02"].push({
        duplicateHash: hash,
        keptSourceRawId: rows[0].id,
        keptPostedAtTs: rows[0].ts || null,
        droppedCount: rows.length - 1,
      });
    }

    ops.push({
      updateOne: {
        filter: { sourceRawId: rows[0].id },
        update: { $set: { isDuplicate: false, duplicateHash: hash } },
      },
    });

    for (let i = 1; i < rows.length; i++) {
      if (dupRuleSamples["DUP-01"].length < DUP_RULE_SAMPLE_LIMIT) {
        dupRuleSamples["DUP-01"].push({
          sourceRawId: rows[i].id,
          duplicateHash: hash,
          postedAtTs: rows[i].ts || null,
          isDuplicate: true,
          keptSourceRawId: rows[0].id,
        });
      }
      ops.push({
        updateOne: {
          filter: { sourceRawId: rows[i].id },
          update: { $set: { isDuplicate: true, duplicateHash: hash } },
        },
      });
      dupCount++;
    }
  }

  if (dupCount > 0) {
    tracker.recordBulk(
      "DUP-01",
      "duplicate_detection",
      "Duplicate group: same normalized full-row fingerprint hash (with posting date normalized first) as another cleaned row — older copies flagged isDuplicate=true.",
      { affected: dupCount },
    );
    tracker.recordBulk(
      "DUP-02",
      "duplicate_detection",
      "Within each duplicate fingerprint group, the newest postedAt is kept as canonical; all older rows in that group are marked duplicates.",
      { affected: duplicateGroups },
    );
  }
  if (uniqueCount > 0) {
    tracker.recordBulk(
      "DUP-03",
      "duplicate_detection",
      "Unique hash — no other cleaned job shared this fingerprint in the batch; isDuplicate=false.",
      { affected: uniqueCount },
    );
  }

  if (ops.length > 0) await flushBulkWrite(ops);
  await writeDuplicateRuleSamples(dupRuleSamples);

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
  // Phases that can reject: salary_normalization, job_type_classification, job_title_normalization.
  // All others are enrichment-only (no rejections, in == out).
  const cascadePhases = [
    "salary_normalization",
    "job_type_classification",
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

async function writeDuplicateRuleSamples(dupRuleSamples) {
  await mkdir(DUP_RULE_SAMPLE_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileWrites = Object.entries(dupRuleSamples).map(([ruleId, examples]) => {
    const filename = `${timestamp}-${ruleId}.json`;
    const filePath = path.join(DUP_RULE_SAMPLE_DIR, filename);
    const payload = {
      ruleId,
      sampleLimit: DUP_RULE_SAMPLE_LIMIT,
      sampleCount: examples.length,
      generatedAt: new Date().toISOString(),
      examples,
    };
    return writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
  });
  await Promise.all(fileWrites);
}
