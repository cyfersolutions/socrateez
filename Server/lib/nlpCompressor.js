/**
 * Query compression: compromise (nlp-compromise successor) for nouns/places,
 * plus stopword stripping and regex intent rules for the assistant.
 */

import nlp from "compromise";

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "must", "shall", "can", "need", "dare",
  "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by",
  "from", "as", "into", "through", "during", "before", "after", "above",
  "below", "between", "under", "again", "further", "then", "once", "here",
  "there", "when", "where", "why", "how", "all", "each", "every", "both",
  "few", "more", "most", "other", "some", "such", "no", "nor", "not",
  "only", "own", "same", "so", "than", "too", "very", "just", "and",
  "but", "if", "or", "because", "until", "while", "although", "though",
  "about", "what", "which", "who", "whom", "this", "that", "these", "those",
  "am", "i", "me", "my", "we", "our", "you", "your", "he", "him", "his",
  "she", "her", "it", "its", "they", "them", "their", "tell", "give",
  "show", "get", "find", "list", "want", "like", "please", "thanks",
]);

const ROLE_HINTS = [
  "engineer", "developer", "scientist", "manager", "analyst", "designer",
  "architect", "nurse", "caregiver", "therapist", "assistant", "director",
  "specialist", "consultant", "lead", "intern", "researcher", "devops",
  "frontend", "backend", "fullstack", "data", "ml", "software", "product",
  "ux", "qa", "sales", "marketing", "hr", "finance", "operations",
];

/** Nouns that are not useful as a job-title / role search phrase */
const GENERIC_NOUNS = new Set([
  "salary",
  "salaries",
  "pay",
  "compensation",
  "job",
  "jobs",
  "role",
  "roles",
  "opening",
  "openings",
  "vacancy",
  "vacancies",
  "position",
  "positions",
  "listing",
  "listings",
  "state",
  "states",
  "city",
  "cities",
  "average",
  "median",
  "mean",
  "question",
  "data",
  "market",
  "markets",
  "company",
  "companies",
  "employer",
  "employers",
]);

/**
 * Any of these tokens in a noun phrase from compromise makes it unsuitable as a job-title search string
 * (e.g. "the average salary" is wrongly grouped as one noun).
 */
const ROLE_PHRASE_BAD_WORDS = new Set([
  ...[...GENERIC_NOUNS].filter((w) => w !== "data"),
  "the",
  "a",
  "an",
  "what",
  "which",
  "who",
  "whom",
  "how",
  "when",
  "where",
  "why",
  "for",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "do",
  "does",
  "did",
  "total",
  "overall",
]);

function rolePhraseWordsAreClean(phrase) {
  const words = phrase
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\w]/g, ""))
    .filter(Boolean);
  if (words.length === 0) return false;
  return !words.some((w) => ROLE_PHRASE_BAD_WORDS.has(w));
}

/** "nursing".includes("nurse") is false in JS; match stems/prefixes */
function tokenMatchesRoleHint(t, r) {
  if (t === r) return true;
  if (t.includes(r) || r.includes(t)) return true;
  if (r.length >= 3 && t.startsWith(r)) return true;
  return false;
}

function normalizePhrase(s) {
  return String(s || "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * @param {string} original
 * @returns {{
 *   nouns: string[],
 *   places: string[],
 *   nlpSearchPhrase: string,
 *   nlpRoleHint: string | null,
 * }}
 */
function extractNlpFields(original) {
  const empty = {
    nouns: [],
    places: [],
    nlpSearchPhrase: "",
    nlpRoleHint: null,
  };
  const text = String(original || "").trim();
  if (!text) return empty;

  try {
    const doc = nlp(text);
    const nounsRaw = doc.nouns().out("array");
    const placesRaw = doc.places().out("array");
    const nouns = [...new Set(nounsRaw.map(normalizePhrase).filter(Boolean))];
    const places = [...new Set(placesRaw.map(normalizePhrase).filter(Boolean))];
    const placeSet = new Set(places);

    const roleParts = nouns.filter((n) => {
      const first = n.split(/\s+/)[0];
      if (GENERIC_NOUNS.has(n) || GENERIC_NOUNS.has(first)) return false;
      if (placeSet.has(n)) return false;
      if (!rolePhraseWordsAreClean(n)) return false;
      return n.length > 2;
    });

    const nlpRoleHint = roleParts.length ? roleParts.join(" ").slice(0, 120) : null;
    const nonGenericNouns = nouns.filter((n) => {
      if (placeSet.has(n)) return false;
      const first = n.split(/\s+/)[0];
      if (GENERIC_NOUNS.has(n) || GENERIC_NOUNS.has(first)) return false;
      if (!rolePhraseWordsAreClean(n)) return false;
      return n.length > 2;
    });
    const nlpSearchPhrase = (nlpRoleHint || nonGenericNouns.join(" ")).slice(0, 200);

    return {
      nouns,
      places,
      nlpSearchPhrase,
      nlpRoleHint,
    };
  } catch {
    return empty;
  }
}

/**
 * @param {string} raw
 * @returns {{
 *   intent: string,
 *   compressed: string,
 *   terms: string[],
 *   keyword: string,
 *   roleHint: string | null,
 *   original: string,
 *   nouns: string[],
 *   places: string[],
 *   nlpSearchPhrase: string,
 * }}
 */
export function compressQuery(raw) {
  const original = String(raw || "").trim();
  const nlpFields = extractNlpFields(original);

  const normalized = original
    .toLowerCase()
    .replace(/[^\w\s,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = normalized
    .split(/\s+/)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));

  const compressed = tokens.join(" ");
  const keyword = compressed.slice(0, 200);

  let intent = "GENERAL";
  const n = normalized;

  if (
    /\b(state|states)\b.*\b(salary|salaries|pay|compensation|earn|earning)\b/.test(
      n
    ) ||
    /\b(salary|salaries|pay)\b.*\b(state|states|by state)\b/.test(n) ||
    /\b(per|by) state\b/.test(n)
  ) {
    intent = "STATES_SALARY";
  } else if (
    /\b(top|best|leading)\s+cities?\b/.test(n) ||
    /\bcities?\s+(for|with)\b/.test(n) ||
    /\bwhere\s+(to\s+)?(find|get|work)\b/.test(n) ||
    /\bjob\s+markets?\s+in\b/.test(n)
  ) {
    intent = "TOP_CITIES";
  } else if (
    /\b(companies?|employers?)\b.*\b(pay|highest|top|most|compensation|salary)\b/.test(
      n
    ) ||
    /\b(highest|top|best)\s+paying\s+companies?\b/.test(n) ||
    /\bwho\s+pays\s+(the\s+)?most\b/.test(n)
  ) {
    intent = "TOP_COMPANIES";
  } else if (
    /\b(remote|wfh|work from home|distributed)\b/.test(n) &&
    /\b(jobs?|roles?|positions?|openings?|listings?)\b/.test(n)
  ) {
    intent = "REMOTE_JOBS";
  } else if (
    /\b(find|search|show|list|openings?|positions?|vacancies?|listings?)\b/.test(
      n
    ) &&
    /\b(jobs?|roles?|careers?)\b/.test(n)
  ) {
    intent = "JOB_LISTINGS";
  } else if (
    /\b(fastest|trending|growing|growth|demand)\b/.test(n) &&
    /\b(roles?|jobs?|careers?)\b/.test(n)
  ) {
    intent = "TRENDS_GROWTH";
  } else if (
    /\b(average|avg|mean|median)\b.*\b(salary|salaries|pay|compensation)\b/.test(
      n
    ) ||
    /\bhow\s+much\b.*\b(earn|make|paid|pay|salary)\b/.test(n) ||
    /\bsalary\b.*\b(for|of)\b/.test(n)
  ) {
    const hasRole = tokens.some(
      (t) =>
        ROLE_HINTS.some((r) => tokenMatchesRoleHint(t, r)) ||
        (t.length > 4 && !/^[0-9]+$/.test(t))
    );
    const hasNlpRole = Boolean(nlpFields.nlpRoleHint);
    intent =
      hasRole || hasNlpRole ? "SALARY_AVG_ROLE" : "SALARY_OVERVIEW";
  } else if (/\b(market|overall)\b.*\b(salary|pay)\b/.test(n)) {
    intent = "SALARY_OVERVIEW";
  }

  let roleHint = null;
  for (const t of tokens) {
    if (ROLE_HINTS.some((r) => tokenMatchesRoleHint(t, r))) {
      roleHint = tokens
        .slice(tokens.indexOf(t), Math.min(tokens.length, tokens.indexOf(t) + 4))
        .join(" ");
      break;
    }
  }

  const nlpPhraseIsGeneric = (s) => {
    const words = String(s || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return words.length > 0 && words.every((w) => GENERIC_NOUNS.has(w));
  };

  if (nlpFields.nlpRoleHint && rolePhraseWordsAreClean(nlpFields.nlpRoleHint)) {
    if (!roleHint || nlpFields.nlpRoleHint.length >= roleHint.length) {
      roleHint = nlpFields.nlpRoleHint;
    }
  } else if (
    !roleHint &&
    nlpFields.nlpSearchPhrase &&
    !nlpPhraseIsGeneric(nlpFields.nlpSearchPhrase) &&
    rolePhraseWordsAreClean(nlpFields.nlpSearchPhrase)
  ) {
    roleHint = nlpFields.nlpSearchPhrase.slice(0, 120);
  }

  return {
    intent,
    compressed,
    terms: tokens,
    keyword,
    roleHint,
    original,
    nouns: nlpFields.nouns,
    places: nlpFields.places,
    nlpSearchPhrase: nlpFields.nlpSearchPhrase,
  };
}
