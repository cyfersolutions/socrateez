const RELATIVE_RE = /(?:posted\s+)?(\d+)\s+(day|week|month|year)s?\s+ago/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}/;
const SLASH_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/;

/**
 * Parse raw date into ISO `postedAt` and compute `daysSincePosted`.
 * No stale rejection — all jobs are kept regardless of age.
 * @returns {{ postedAt: Date|null, daysSincePosted: number|null, rulesApplied: string[] }}
 */
export function normalizeDate(rawDate, tracker) {
  const rulesApplied = [];
  const raw = (rawDate == null ? "" : String(rawDate)).trim();

  if (!raw) {
    tracker?.record("DTE-05", "date_freshness", "No usable post date: field empty or text could not be parsed — postedAt and daysSincePosted are null; job is still kept.", {
      before: { date: rawDate },
      after: { postedAt: null, daysSincePosted: null },
    });
    return { postedAt: null, daysSincePosted: null, rulesApplied: ["DTE-05"] };
  }

  let parsed = null;

  // DTE-01 — ISO format
  if (ISO_RE.test(raw)) {
    const d = new Date(raw);
    if (!isNaN(d)) {
      parsed = d;
      rulesApplied.push("DTE-01");
      tracker?.record("DTE-01", "date_freshness", "String started with YYYY-MM-DD — parsed as ISO calendar date for postedAt.", {
        before: { date: raw }, after: { postedAt: d.toISOString() },
      });
    }
  }

  // DTE-04 — Ambiguous slash format (try before human-readable to avoid misparse)
  if (!parsed) {
    const m = raw.match(SLASH_RE);
    if (m) {
      let [, mm, dd, yy] = m;
      if (yy.length === 2) yy = (parseInt(yy, 10) > 50 ? "19" : "20") + yy;
      const d = new Date(`${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T00:00:00Z`);
      if (!isNaN(d)) {
        parsed = d;
        rulesApplied.push("DTE-04");
        tracker?.record("DTE-04", "date_freshness", "Slash date M/D/YY or MM/DD/YYYY — interpreted as US month/day/year with 2-digit year rules applied.", {
          before: { date: raw }, after: { postedAt: d.toISOString() },
        });
      }
    }
  }

  // DTE-03 — Relative format ("Posted 3 days ago")
  if (!parsed) {
    const rel = raw.match(RELATIVE_RE);
    if (rel) {
      const count = parseInt(rel[1], 10);
      const unit = rel[2].toLowerCase();
      const now = new Date();
      if (unit === "day") now.setDate(now.getDate() - count);
      else if (unit === "week") now.setDate(now.getDate() - count * 7);
      else if (unit === "month") now.setMonth(now.getMonth() - count);
      else if (unit === "year") now.setFullYear(now.getFullYear() - count);
      parsed = now;
      rulesApplied.push("DTE-03");
      tracker?.record("DTE-03", "date_freshness", "Relative phrase like \"3 days ago\" or \"2 weeks ago\" — converted to an approximate postedAt from sync time.", {
        before: { date: raw }, after: { postedAt: parsed.toISOString() },
      });
    }
  }

  // DTE-02 — Human readable ("Jan 5, 2025")
  if (!parsed) {
    const d = new Date(raw);
    if (!isNaN(d)) {
      parsed = d;
      rulesApplied.push("DTE-02");
      tracker?.record("DTE-02", "date_freshness", "Passed to the JavaScript Date parser as a natural-language date string (e.g. \"Jan 5, 2025\").", {
        before: { date: raw }, after: { postedAt: d.toISOString() },
      });
    }
  }

  // Still unparseable → treat as missing
  if (!parsed) {
    tracker?.record("DTE-05", "date_freshness", "No usable post date: field empty or text could not be parsed — postedAt and daysSincePosted are null; job is still kept.", {
      before: { date: raw },
      after: { postedAt: null, daysSincePosted: null },
    });
    return { postedAt: null, daysSincePosted: null, rulesApplied: ["DTE-05"] };
  }

  const daysSincePosted = Math.floor((Date.now() - parsed.getTime()) / 86_400_000);

  return { postedAt: parsed, daysSincePosted, rulesApplied };
}
