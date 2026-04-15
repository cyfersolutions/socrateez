import crypto from "crypto";

/**
 * Compute a deterministic hash for duplicate grouping.
 * Key = normalizedTitle + canonicalCompany + normalizedLocation + jobType.
 */
export function computeDuplicateHash(doc) {
  const parts = [
    (doc.normalizedTitle || ""),
    (doc.canonicalCompany || ""),
    (doc.normalizedCity || ""),
    (doc.normalizedState || ""),
    (doc.normalizedCountry || ""),
    (doc.jobType || ""),
  ]
    .map((s) => s.toLowerCase())
    .join("|");
  return crypto.createHash("md5").update(parts).digest("hex");
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
      tracker.recordBulk("DUP-01", "duplicate_detection", "Exact hash match found — flagged as duplicate", {
        affected: dupCount,
      });
      tracker.recordBulk("DUP-02", "duplicate_detection", "Keep most recent among dupes", {
        affected: groups.size - uniqueCount,
      });
    }
    if (uniqueCount > 0) {
      tracker.recordBulk("DUP-03", "duplicate_detection", "Not a duplicate — unique posting", {
        affected: uniqueCount,
      });
    }
  }

  return results;
}
