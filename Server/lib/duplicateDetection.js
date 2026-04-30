import crypto from "crypto";

/**
 * Compute a deterministic hash for duplicate grouping.
 * Key = normalized, stable fingerprint of the cleaned row.
 * We intentionally include most business fields (not just a handful),
 * and normalize posting date first so equivalent rows hash the same.
 */
export function computeDuplicateHash(doc) {
  const canonical = buildCanonicalRowFingerprint(doc);
  return crypto.createHash("md5").update(canonical).digest("hex");
}

function normalizePostedDateKey(doc) {
  const postedAt = doc?.postedAt;
  if (postedAt) {
    const d = new Date(postedAt);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const raw = doc?.["Post Date"];
  return raw == null ? "" : String(raw).trim().toLowerCase();
}

function normalizeValue(v) {
  if (v == null) return null;
  if (Array.isArray(v)) return v.map(normalizeValue);
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).sort()) {
      out[k] = normalizeValue(v[k]);
    }
    return out;
  }
  if (typeof v === "string") return v.trim().toLowerCase();
  return v;
}

function buildCanonicalRowFingerprint(doc) {
  const excluded = new Set([
    "_id",
    "__v",
    "sourceRawId",
    "isDuplicate",
    "duplicateHash",
    "etlRulesApplied",
    "createdAt",
    "updatedAt",
  ]);

  const payload = {};
  for (const key of Object.keys(doc || {}).sort()) {
    if (excluded.has(key)) continue;
    if (key === "postedAt" || key === "Post Date") continue;
    payload[key] = normalizeValue(doc[key]);
  }

  // Date normalization step requested: force one comparable date key.
  payload.postedDateNormalized = normalizePostedDateKey(doc);

  return JSON.stringify(payload);
}

/**
 * Detect duplicates across a batch of cleaned docs.
 * Returns a Map<sourceRawId_string, { isDuplicate, duplicateHash }>.
 * Among duplicates the most-recently-posted record is kept; the rest are flagged.
 */
export function detectDuplicates(docs, tracker) {
  const groups = new Map();

  for (const doc of docs) {
    const hash = computeDuplicateHash(doc);
    if (!groups.has(hash)) groups.set(hash, []);
    groups.get(hash).push(doc);
  }

  const results = new Map();
  let dupCount = 0;
  let uniqueCount = 0;

  for (const [hash, group] of groups) {
    if (group.length === 1) {
      const id = (group[0].sourceRawId ?? group[0]._id)?.toString();
      results.set(id, { isDuplicate: false, duplicateHash: hash });
      uniqueCount++;
      continue;
    }

    group.sort((a, b) => {
      const da = a.postedAt ? new Date(a.postedAt).getTime() : 0;
      const db = b.postedAt ? new Date(b.postedAt).getTime() : 0;
      return db - da;
    });

    const keepId = (group[0].sourceRawId ?? group[0]._id)?.toString();
    results.set(keepId, { isDuplicate: false, duplicateHash: hash });

    for (let i = 1; i < group.length; i++) {
      const id = (group[i].sourceRawId ?? group[i]._id)?.toString();
      results.set(id, { isDuplicate: true, duplicateHash: hash });
      dupCount++;
    }
  }

  if (tracker) {
    if (dupCount > 0) {
      tracker.recordBulk("DUP-01", "duplicate_detection", "Duplicate group: same normalized full-row fingerprint hash (with posting date normalized first) as another cleaned row — older copies flagged isDuplicate=true.", {
        affected: dupCount,
      });
      tracker.recordBulk("DUP-02", "duplicate_detection", "Within each duplicate fingerprint group, the newest postedAt is kept as canonical; all older rows in that group are marked duplicates.", {
        affected: groups.size - uniqueCount,
      });
    }
    if (uniqueCount > 0) {
      tracker.recordBulk("DUP-03", "duplicate_detection", "Unique hash — no other cleaned job shared this fingerprint in the batch; isDuplicate=false.", {
        affected: uniqueCount,
      });
    }
  }

  return results;
}
