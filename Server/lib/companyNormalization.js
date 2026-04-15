const LEGAL_SUFFIX_RE =
  /\b(llc|inc\.?|corp\.?|corporation|ltd\.?|limited|plc|co\.?|company|group|gmbh|ag|sa|sarl|pte\.?\s*ltd\.?|pty\.?\s*ltd\.?)\s*\.?\s*$/gi;

const PARENS_RE = /\s*\([^)]*\)\s*/g;

const KNOWN_ALIASES = new Map([
  ["facebook", "meta"], ["facebook inc", "meta"], ["meta platforms", "meta"],
  ["meta platforms inc", "meta"],
  ["alphabet", "google"], ["alphabet inc", "google"], ["google llc", "google"],
  ["amazon.com", "amazon"], ["amazon web services", "amazon"], ["aws", "amazon"],
  ["microsoft corp", "microsoft"], ["microsoft corporation", "microsoft"],
  ["apple inc", "apple"], ["apple computer", "apple"],
  ["ibm corporation", "ibm"], ["international business machines", "ibm"],
  ["tesla motors", "tesla"], ["tesla inc", "tesla"],
  ["netflix inc", "netflix"],
  ["salesforce.com", "salesforce"], ["salesforce inc", "salesforce"],
  ["oracle corporation", "oracle"], ["oracle inc", "oracle"],
  ["intel corporation", "intel"], ["intel corp", "intel"],
  ["nvidia corporation", "nvidia"], ["nvidia corp", "nvidia"],
  ["adobe inc", "adobe"], ["adobe systems", "adobe"],
  ["uber technologies", "uber"], ["uber inc", "uber"],
  ["lyft inc", "lyft"],
  ["airbnb inc", "airbnb"],
  ["stripe inc", "stripe"],
  ["shopify inc", "shopify"],
  ["twitter", "x"], ["twitter inc", "x"], ["x corp", "x"],
  ["snapchat", "snap"], ["snap inc", "snap"],
  ["linkedin corporation", "linkedin"], ["linkedin corp", "linkedin"],
  ["paypal holdings", "paypal"], ["paypal inc", "paypal"],
  ["square inc", "block"], ["block inc", "block"],
  ["coinbase global", "coinbase"], ["coinbase inc", "coinbase"],
  ["walmart inc", "walmart"], ["walmart stores", "walmart"],
  ["jp morgan chase", "jpmorgan"], ["jpmorgan chase", "jpmorgan"], ["j.p. morgan", "jpmorgan"],
  ["bank of america", "bank of america"], ["bofa", "bank of america"],
  ["goldman sachs group", "goldman sachs"],
  ["deloitte touche", "deloitte"], ["deloitte llp", "deloitte"],
  ["mckinsey company", "mckinsey"], ["mckinsey and company", "mckinsey"],
  ["pwc", "pricewaterhousecoopers"], ["pricewaterhousecoopers llp", "pricewaterhousecoopers"],
  ["ernst young", "ey"], ["ernst & young", "ey"],
  ["kpmg llp", "kpmg"],
  ["accenture plc", "accenture"], ["accenture llp", "accenture"],
]);

function levenshteinSimilarity(a, b) {
  if (a === b) return 1;
  const la = a.length;
  const lb = b.length;
  if (!la || !lb) return 0;
  const dp = Array.from({ length: la + 1 }, (_, i) => {
    const row = new Array(lb + 1);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= lb; j++) dp[0][j] = j;
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return 1 - dp[la][lb] / Math.max(la, lb);
}

const FUZZY_THRESHOLD = 0.85;

/**
 * Normalize company name: strip suffixes, lowercase, resolve aliases, fuzzy-match.
 * @returns {{ canonicalCompany: string|null, rulesApplied: string[] }}
 */
export function normalizeCompany(rawCompany, tracker) {
  const rulesApplied = [];
  const raw = (rawCompany == null ? "" : String(rawCompany)).trim();

  if (!raw) {
    tracker?.record("CMP-06", "company_deduplication", "Company field empty", {
      before: { company: rawCompany }, after: { canonicalCompany: null },
    });
    return { canonicalCompany: null, rulesApplied: ["CMP-06"] };
  }

  // CMP-02 — Lowercase
  let name = raw.toLowerCase();
  if (name !== raw) {
    rulesApplied.push("CMP-02");
    tracker?.record("CMP-02", "company_deduplication", "Normalize casing", {
      before: { company: raw }, after: { company: name },
    });
  }

  // CMP-01 — Strip legal suffixes and parenthetical content
  const before = name;
  name = name.replace(PARENS_RE, " ").replace(LEGAL_SUFFIX_RE, "").replace(/[,.\s]+$/, "").trim();
  if (name !== before) {
    rulesApplied.push("CMP-01");
    tracker?.record("CMP-01", "company_deduplication", "Strip legal suffixes", {
      before: { company: before }, after: { company: name },
    });
  }

  // CMP-04 — Known alias mapping (exact)
  const alias = KNOWN_ALIASES.get(name);
  if (alias) {
    rulesApplied.push("CMP-04");
    tracker?.record("CMP-04", "company_deduplication", "Known alias mapping", {
      before: { company: name }, after: { canonicalCompany: alias },
    });
    return { canonicalCompany: alias, rulesApplied };
  }

  // CMP-03 / CMP-05 — Fuzzy match against known aliases
  let bestMatch = null;
  let bestSim = 0;
  for (const [key, canonical] of KNOWN_ALIASES) {
    const sim = levenshteinSimilarity(name, key);
    if (sim > bestSim) {
      bestSim = sim;
      bestMatch = canonical;
    }
  }

  if (bestSim >= FUZZY_THRESHOLD && bestMatch) {
    rulesApplied.push("CMP-03");
    tracker?.record("CMP-03", "company_deduplication", "Fuzzy match above threshold", {
      before: { company: name, similarity: Math.round(bestSim * 100) / 100 },
      after: { canonicalCompany: bestMatch },
    });
    return { canonicalCompany: bestMatch, rulesApplied };
  }

  if (bestSim > 0 && bestSim < FUZZY_THRESHOLD) {
    rulesApplied.push("CMP-05");
    tracker?.record("CMP-05", "company_deduplication", "Below fuzzy threshold — keep separate", {
      before: { company: name },
      after: { canonicalCompany: name },
    });
  }

  return { canonicalCompany: name, rulesApplied };
}
