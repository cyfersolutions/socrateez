import crypto from "crypto";

/**
 * Compute a deterministic hash for duplicate grouping.
 * Key = title + company + city + state + country + jobType + postedDate/postDate.
 */
export function computeDuplicateHash(doc) {
  const canonical = buildCanonicalDuplicateKey(doc);
  return crypto.createHash("md5").update(canonical).digest("hex");
}

function normalizePart(v) {
  if (v == null) return "";
  return String(v).trim().toLowerCase();
}

function normalizePostedDatePart(doc) {
  const dateCandidates = [
    doc?.postedDate,
    doc?.postDate,
    doc?.[("Post Date")],
    doc?.postedAt,
  ];
  for (const candidate of dateCandidates) {
    if (candidate == null || String(candidate).trim() === "") continue;
    const d = new Date(candidate);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
    return normalizePart(candidate);
  }
  return "";
}

function buildCanonicalDuplicateKey(doc) {
  const parts = [
    normalizePart(doc?.normalizedTitle ?? doc?.title ?? doc?.["Job Title"] ?? doc?.["Listing Title"]),
    normalizePart(doc?.canonicalCompany ?? doc?.company ?? doc?.Company),
    normalizePart(doc?.normalizedCity ?? doc?.city ?? doc?.City),
    normalizePart(doc?.normalizedState ?? doc?.state ?? doc?.State),
    normalizePart(doc?.normalizedCountry ?? doc?.country ?? doc?.Country),
    normalizePart(doc?.jobType),
    normalizePostedDatePart(doc),
  ];

  return parts.join("|");
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
      tracker.recordBulk("DUP-01", "duplicate_detection", "Duplicate group: same hash computed from title + company + city + state + country + jobType + postedDate/postDate — older copies flagged isDuplicate=true.", {
        affected: dupCount,
      });
      tracker.recordBulk("DUP-02", "duplicate_detection", "Within each duplicate hash group, the newest postedAt is kept as canonical; all older rows in that group are marked duplicates.", {
        affected: groups.size - uniqueCount,
      });
    }
    if (uniqueCount > 0) {
      tracker.recordBulk("DUP-03", "duplicate_detection", "Unique hash — no other cleaned job shared this title/company/city/state/country/jobType/postedDate key in the batch; isDuplicate=false.", {
        affected: uniqueCount,
      });
    }
  }

  return results;
}
