import { normalizeJobTitle } from "./jobTitleNormalization.js";

/**
 * Determine the best role from both the filter title and listing title.
 *
 * Strategy:
 *   1. Normalize both titles independently.
 *   2. If the filter title maps to a known canonical role, prefer it (ROL-01).
 *   3. If not, but the listing title maps to a canonical role, use that (ROL-02).
 *   4. If both normalize successfully but neither is canonical, prefer filter title (ROL-03).
 *   5. If only one normalizes, use whichever succeeds (ROL-04).
 *   6. If neither normalizes, reject (ROL-05).
 *
 * The tracker category is "role_detection".
 *
 * @param {string} filterTitle  — cleaned filter title (after JTP stripping)
 * @param {string} listingTitle — cleaned listing title (after JTP stripping)
 * @param {object} [tracker]
 * @returns {{
 *   ok: boolean,
 *   normalizedTitle: string | null,
 *   roleSource: string | null,
 *   rulesApplied: string[],
 *   reason?: string,
 * }}
 */
export function detectRole(filterTitle, listingTitle, tracker) {
  const filterResult = normalizeJobTitle(filterTitle, null);
  const listingResult = normalizeJobTitle(listingTitle, null);

  const filterOk = filterResult.ok;
  const listingOk = listingResult.ok;

  const filterIsCanonical = filterOk && filterResult.rulesApplied.includes("TTL-05");
  const listingIsCanonical = listingOk && listingResult.rulesApplied.includes("TTL-05");

  // ROL-01: Filter title resolved to a canonical role
  if (filterIsCanonical) {
    tracker?.record("ROL-01", "role_detection", "Role found in filter title (canonical match)", {
      before: { filterTitle, listingTitle },
      after: { normalizedTitle: filterResult.normalizedTitle, source: "filter_title" },
    });
    return {
      ok: true,
      normalizedTitle: filterResult.normalizedTitle,
      roleSource: "filter_title",
      rulesApplied: ["ROL-01"],
    };
  }

  // ROL-02: Listing title resolved to a canonical role (filter didn't)
  if (listingIsCanonical) {
    tracker?.record("ROL-02", "role_detection", "Role found in listing title (canonical match)", {
      before: { filterTitle, listingTitle },
      after: { normalizedTitle: listingResult.normalizedTitle, source: "listing_title" },
    });
    return {
      ok: true,
      normalizedTitle: listingResult.normalizedTitle,
      roleSource: "listing_title",
      rulesApplied: ["ROL-02"],
    };
  }

  // ROL-03: Both normalize but neither is canonical — prefer filter title
  if (filterOk && listingOk) {
    tracker?.record("ROL-03", "role_detection", "Both titles valid — filter title preferred", {
      before: { filterTitle, listingTitle },
      after: {
        normalizedTitle: filterResult.normalizedTitle,
        altTitle: listingResult.normalizedTitle,
        source: "filter_title",
      },
    });
    return {
      ok: true,
      normalizedTitle: filterResult.normalizedTitle,
      roleSource: "filter_title",
      rulesApplied: ["ROL-03"],
    };
  }

  // ROL-04: Only one normalizes — use whichever succeeded
  if (filterOk) {
    tracker?.record("ROL-04", "role_detection", "Only filter title valid — used as role", {
      before: { filterTitle, listingTitle },
      after: { normalizedTitle: filterResult.normalizedTitle, source: "filter_title" },
    });
    return {
      ok: true,
      normalizedTitle: filterResult.normalizedTitle,
      roleSource: "filter_title",
      rulesApplied: ["ROL-04"],
    };
  }

  if (listingOk) {
    tracker?.record("ROL-04", "role_detection", "Only listing title valid — used as role", {
      before: { filterTitle, listingTitle },
      after: { normalizedTitle: listingResult.normalizedTitle, source: "listing_title" },
    });
    return {
      ok: true,
      normalizedTitle: listingResult.normalizedTitle,
      roleSource: "listing_title",
      rulesApplied: ["ROL-04"],
    };
  }

  // ROL-05: Neither title produced a usable role
  tracker?.record("ROL-05", "role_detection", "Neither title produced a usable role", {
    before: { filterTitle, listingTitle },
    after: null,
    rejected: true,
  });
  return {
    ok: false,
    normalizedTitle: null,
    roleSource: null,
    rulesApplied: ["ROL-05"],
    reason: "no_usable_role",
  };
}
