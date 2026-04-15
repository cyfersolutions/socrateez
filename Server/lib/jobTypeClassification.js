const TYPE_PATTERNS = [
  {
    type: "internship",
    ruleId: "JTP-01",
    desc: "Internship or co-op wording — jobType set to internship.",
    pattern: /\b(intern(?:ship)?|co-?op)\b/i,
  },
  {
    type: "contract",
    ruleId: "JTP-02",
    desc: "Contract or consulting wording — jobType set to contract.",
    pattern: /\b(contract(?:or)?|consulting)\b/i,
  },
  {
    type: "part_time",
    ruleId: "JTP-03",
    desc: "Part-time wording — jobType set to part_time.",
    pattern: /\b(part[\s-]?time)\b/i,
  },
  {
    type: "freelance",
    ruleId: "JTP-04",
    desc: "Freelance or gig wording — jobType set to freelance.",
    pattern: /\b(freelance|freelancer|gig)\b/i,
  },
];

/**
 * Detect employment type from BOTH the filter title and the listing title.
 * Checks filter title first; if no match, falls back to listing title.
 * Strips the matched keyword from whichever source contained it.
 * @param {string} filterTitle  — "Job Title (filter selection)"
 * @param {string} listingTitle — "Listing Title"
 * @param {object} [tracker]
 * @returns {{ jobType: string, cleanedFilterTitle: string, cleanedListingTitle: string, rulesApplied: string[] }}
 */
export function classifyJobType(filterTitle, listingTitle, tracker) {
  const rulesApplied = [];
  let jobType = "full_time";
  let cleanedFilter = (filterTitle == null ? "" : String(filterTitle)).trim();
  let cleanedListing = (listingTitle == null ? "" : String(listingTitle)).trim();
  let matchedSource = null;

  for (const { type, ruleId, desc, pattern } of TYPE_PATTERNS) {
    if (pattern.test(cleanedFilter)) {
      jobType = type;
      cleanedFilter = cleanedFilter.replace(pattern, " ").replace(/\s{2,}/g, " ").trim();
      matchedSource = "filterTitle";
      rulesApplied.push(ruleId);
      if (tracker) {
        tracker.record(
          ruleId,
          "job_type_classification",
          `${desc} Match was in the Job Title (filter) field; the keyword was removed from that string only (listing title unchanged for this rule).`,
          {
            before: { filterTitle, listingTitle },
            after: { cleanedFilterTitle: cleanedFilter, jobType, source: "filterTitle" },
          },
        );
      }
      break;
    }
    if (pattern.test(cleanedListing)) {
      jobType = type;
      cleanedListing = cleanedListing.replace(pattern, " ").replace(/\s{2,}/g, " ").trim();
      matchedSource = "listingTitle";
      rulesApplied.push(ruleId);
      if (tracker) {
        tracker.record(
          ruleId,
          "job_type_classification",
          `${desc} Match was in the Listing Title field; the keyword was removed from that string only (filter title unchanged for this rule).`,
          {
            before: { filterTitle, listingTitle },
            after: { cleanedListingTitle: cleanedListing, jobType, source: "listingTitle" },
          },
        );
      }
      break;
    }
  }

  if (!matchedSource) {
    rulesApplied.push("JTP-05");
    if (tracker) {
      tracker.record("JTP-05", "job_type_classification", "No employment-type keyword matched in the filter title or listing title — jobType defaults to full_time; titles unchanged.", {
        before: { filterTitle, listingTitle },
        after: { jobType: "full_time" },
      });
    }
  }

  return { jobType, cleanedFilterTitle: cleanedFilter, cleanedListingTitle: cleanedListing, rulesApplied };
}
