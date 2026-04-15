const ABBREVIATIONS = new Map([
  ["sr", "senior"], ["sr.", "senior"], ["snr", "senior"],
  ["jr", "junior"], ["jr.", "junior"], ["jnr", "junior"],
  ["eng", "engineer"], ["eng.", "engineer"], ["engr", "engineer"],
  ["dev", "developer"],
  ["mgr", "manager"], ["mgt", "management"],
  ["dir", "director"],
  ["vp", "vice president"],
  ["svp", "senior vice president"],
  ["evp", "executive vice president"],
  ["swe", "software engineer"],
  ["qa", "quality assurance"],
  ["dba", "database administrator"],
  ["ops", "operations"],
  ["admin", "administrator"],
  ["assoc", "associate"],
  ["asst", "assistant"],
  ["coord", "coordinator"],
  ["spec", "specialist"],
  ["repr", "representative"], ["rep", "representative"],
  ["exec", "executive"],
  ["acct", "accountant"],
  ["anal", "analyst"],
  ["arch", "architect"],
  ["prog", "programmer"],
  ["sys", "systems"],
  ["dept", "department"],
  ["hr", "human resources"],
  ["it", "information technology"],
]);

const NOISE_RE =
  /\b(remote|hybrid|on-?site|temporary|temp|seasonal|immediate|urgent|hiring|now|apply)\b/gi;

const SPECIAL_CHARS_RE = /[\/\-()\[\]{}|\\:;,!@#$%^&*+=~`<>?'"]+/g;

const CANONICAL_TITLES = new Map([
  ["software engineer", "software engineer"],
  ["software developer", "software engineer"],
  ["software dev", "software engineer"],
  ["web developer", "web developer"],
  ["frontend developer", "frontend engineer"],
  ["front end developer", "frontend engineer"],
  ["frontend engineer", "frontend engineer"],
  ["front end engineer", "frontend engineer"],
  ["backend developer", "backend engineer"],
  ["back end developer", "backend engineer"],
  ["backend engineer", "backend engineer"],
  ["back end engineer", "backend engineer"],
  ["fullstack developer", "fullstack engineer"],
  ["full stack developer", "fullstack engineer"],
  ["fullstack engineer", "fullstack engineer"],
  ["full stack engineer", "fullstack engineer"],
  ["devops engineer", "devops engineer"],
  ["site reliability engineer", "site reliability engineer"],
  ["sre", "site reliability engineer"],
  ["data scientist", "data scientist"],
  ["data analyst", "data analyst"],
  ["data engineer", "data engineer"],
  ["machine learning engineer", "machine learning engineer"],
  ["ml engineer", "machine learning engineer"],
  ["product manager", "product manager"],
  ["project manager", "project manager"],
  ["program manager", "program manager"],
  ["engineering manager", "engineering manager"],
  ["technical lead", "technical lead"],
  ["tech lead", "technical lead"],
  ["solutions architect", "solutions architect"],
  ["cloud architect", "cloud architect"],
  ["systems administrator", "systems administrator"],
  ["system administrator", "systems administrator"],
  ["network engineer", "network engineer"],
  ["security engineer", "security engineer"],
  ["cybersecurity analyst", "cybersecurity analyst"],
  ["business analyst", "business analyst"],
  ["ux designer", "ux designer"],
  ["ui designer", "ui designer"],
  ["ux ui designer", "ux/ui designer"],
  ["product designer", "product designer"],
  ["graphic designer", "graphic designer"],
]);

function collapse(s) {
  return s.replace(/\s{2,}/g, " ").trim();
}

/**
 * Normalize a raw job title into a clean canonical form.
 * @returns {{ ok: boolean, normalizedTitle: string|null, rulesApplied: string[], reason?: string }}
 */
export function normalizeJobTitle(rawTitle, tracker) {
  const rulesApplied = [];
  let title = (rawTitle == null ? "" : String(rawTitle)).trim();

  if (!title) {
    tracker?.record("TTL-06", "job_title_normalization", "Title is empty after cleaning", {
      before: { title: rawTitle }, after: null, rejected: true,
    });
    return { ok: false, normalizedTitle: null, rulesApplied: ["TTL-06"], reason: "empty_title" };
  }

  const original = title;

  // TTL-01 — Lowercase
  title = title.toLowerCase();
  if (original !== title) {
    rulesApplied.push("TTL-01");
    tracker?.record("TTL-01", "job_title_normalization", "Lowercase everything", {
      before: { title: original }, after: { title },
    });
  }

  // TTL-02 — Expand abbreviations
  const beforeAbbr = title;
  title = title
    .split(/\s+/)
    .map((w) => ABBREVIATIONS.get(w) || w)
    .join(" ");
  if (title !== beforeAbbr) {
    rulesApplied.push("TTL-02");
    tracker?.record("TTL-02", "job_title_normalization", "Expand abbreviations", {
      before: { title: beforeAbbr }, after: { title },
    });
  }

  // TTL-03 — Strip noise words
  const beforeNoise = title;
  title = collapse(title.replace(NOISE_RE, " "));
  if (title !== beforeNoise) {
    rulesApplied.push("TTL-03");
    tracker?.record("TTL-03", "job_title_normalization", "Strip noise words", {
      before: { title: beforeNoise }, after: { title },
    });
  }

  // TTL-04 — Strip special characters
  const beforeSpec = title;
  title = collapse(title.replace(SPECIAL_CHARS_RE, " "));
  if (title !== beforeSpec) {
    rulesApplied.push("TTL-04");
    tracker?.record("TTL-04", "job_title_normalization", "Strip special characters", {
      before: { title: beforeSpec }, after: { title },
    });
  }

  // TTL-05 — Map to canonical title
  const canonical = CANONICAL_TITLES.get(title);
  if (canonical) {
    if (canonical !== title) {
      tracker?.record("TTL-05", "job_title_normalization", "Map to canonical title", {
        before: { title }, after: { title: canonical },
      });
      title = canonical;
    }
    rulesApplied.push("TTL-05");
  }

  // TTL-06 — Empty after cleaning
  if (!title) {
    tracker?.record("TTL-06", "job_title_normalization", "Title is empty after cleaning", {
      before: { title: rawTitle }, after: null, rejected: true,
    });
    return { ok: false, normalizedTitle: null, rulesApplied: ["TTL-06"], reason: "empty_title" };
  }

  return { ok: true, normalizedTitle: title, rulesApplied };
}
