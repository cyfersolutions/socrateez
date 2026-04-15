/**
 * Normalized annual salary policy for ETL + aggregations.
 * See docs/etl-raw-to-cleaned.md for assumptions and RCA.
 */

export const SALARY_MIN_ANNUAL = 20_000;
export const SALARY_MAX_ANNUAL = 500_000;
export const HOURLY_TO_ANNUAL = 2080;
/** Reject listings where title suggests junior role but pay is unrealistically high */
export const TRAINEE_TITLE_MAX_SALARY = 200_000;

const TRAINEE_TITLE_RE =
  /(trainee|intern|apprentice|entry\s*[- ]?level|co-?op\b|student\b|graduate\s+program)/i;

/** After $addFields salaryNum — keep dashboard/search consistent */
export const aggregationSalaryInRange = {
  $match: {
    salaryNum: { $gte: SALARY_MIN_ANNUAL, $lte: SALARY_MAX_ANNUAL },
  },
};

/**
 * @param {unknown} rawSalary
 * @param {string} [jobTitle]
 * @returns {{
 *   ok: boolean,
 *   annual?: number,
 *   formattedSalary?: string,
 *   flags?: string[],
 *   reason?: string,
 *   detail?: number,
 * }}
 */
export function normalizeSalaryForEtl(rawSalary, jobTitle = "") {
  const flags = [];
  const s0 = rawSalary == null ? "" : String(rawSalary).trim();
  if (!s0) return { ok: false, reason: "empty_salary" };

  const lower = s0.toLowerCase();
  const hourlyExplicit =
    /(\/?\s*hr\b|\bhr\b|\/hr\b|\bper\s*hour\b|\bhourly\b|\bph\b)/i.test(
      lower
    );
  const annualExplicit =
    /(\/yr\b|\byear\b|\bannual\b|\bper\s*year\b|\bsalary\b|\bpa\b)/i.test(
      lower
    );

  let n;
  const kCompact = lower.match(/\b(\d+(?:\.\d+)?)\s*k\b/i);
  if (kCompact) {
    n = parseFloat(kCompact[1]) * 1000;
    flags.push("k_suffix");
  } else {
    const cleaned = lower.replace(/,/g, "").replace(/\$/g, " ");
    const numMatch = cleaned.match(/(\d+(?:\.\d+)?(?:e[+-]?\d+)?)/);
    if (!numMatch) return { ok: false, reason: "unparseable" };
    n = parseFloat(numMatch[1]);
  }

  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, reason: "invalid_number" };
  }

  let annual;

  if (hourlyExplicit && !annualExplicit) {
    annual = n * HOURLY_TO_ANNUAL;
    flags.push("hourly_explicit");
  } else if (annualExplicit) {
    annual = n;
    flags.push("annual_explicit");
  } else if (n >= SALARY_MIN_ANNUAL && n <= SALARY_MAX_ANNUAL) {
    annual = n;
    flags.push("annual_plain");
  } else if (n >= 5 && n <= 400) {
    annual = n * HOURLY_TO_ANNUAL;
    flags.push("hourly_heuristic");
  } else {
    const repaired = tryRepairInflatedAnnual(n, flags);
    if (repaired == null) {
      return { ok: false, reason: "outlier_or_unclassified", detail: n };
    }
    annual = repaired;
  }

  annual = Math.round(annual);

  if (annual < SALARY_MIN_ANNUAL || annual > SALARY_MAX_ANNUAL) {
    return { ok: false, reason: "out_of_range", detail: annual };
  }

  if (TRAINEE_TITLE_RE.test(String(jobTitle || "")) && annual > TRAINEE_TITLE_MAX_SALARY) {
    return { ok: false, reason: "trainee_sanity_cap", detail: annual };
  }

  const formattedSalary = `$${annual.toLocaleString("en-US")}`;
  return { ok: true, annual, formattedSalary, flags };
}

/**
 * Handles accidental ×2080 (or ×2080²) on annual figures.
 * @param {number} n
 * @param {string[]} flags
 * @returns {number | null}
 */
function tryRepairInflatedAnnual(n, flags) {
  if (n <= SALARY_MAX_ANNUAL) return n;

  const h1 = n / HOURLY_TO_ANNUAL;
  /** One mistaken ×2080 on an annual figure (e.g. 45,000 → 93,600,000). */
  if (h1 >= SALARY_MIN_ANNUAL && h1 <= SALARY_MAX_ANNUAL) {
    flags.push("deflate_one_2080");
    return Math.round(h1);
  }

  const h2 = n / (HOURLY_TO_ANNUAL * HOURLY_TO_ANNUAL);
  if (h2 >= 5 && h2 <= 400) {
    flags.push("deflate_double_2080");
    return Math.round(h2 * HOURLY_TO_ANNUAL);
  }

  if (h1 >= 5 && h1 <= 400) {
    flags.push("hourly_from_inflated");
    return Math.round(h1 * HOURLY_TO_ANNUAL);
  }

  return null;
}
