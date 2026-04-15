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

/**
 * Normalize company name: strip suffixes, lowercase, resolve known aliases.
 * @returns {{ canonicalCompany: string|null, rulesApplied: string[] }}
 */
export function normalizeCompany(rawCompany, tracker) {
  const rulesApplied = [];
  const raw = (rawCompany == null ? "" : String(rawCompany)).trim();

  if (!raw) {
    tracker?.record("CMP-06", "company_deduplication", "Employer name was missing or blank — canonicalCompany is null; job still stored but company-based grouping may be limited.", {
      before: { company: rawCompany }, after: { canonicalCompany: null },
    });
    return { canonicalCompany: null, rulesApplied: ["CMP-06"] };
  }

  // CMP-02 — Lowercase
  let name = raw.toLowerCase();
  if (name !== raw) {
    rulesApplied.push("CMP-02");
    tracker?.record("CMP-02", "company_deduplication", "Lowercased the raw company string for consistent comparison before suffix stripping and alias lookup.", {
      before: { company: raw }, after: { company: name },
    });
  }

  // CMP-01 — Strip legal suffixes and parenthetical content
  const before = name;
  name = name.replace(PARENS_RE, " ").replace(LEGAL_SUFFIX_RE, "").replace(/[,.\s]+$/, "").trim();
  if (name !== before) {
    rulesApplied.push("CMP-01");
    tracker?.record("CMP-01", "company_deduplication", "Removed parenthetical segments and trailing legal suffixes (Inc, LLC, Corp, Ltd, etc.) so the core name can match aliases.", {
      before: { company: before }, after: { company: name },
    });
  }

  // CMP-04 — Known alias mapping (exact)
  const alias = KNOWN_ALIASES.get(name);
  if (alias) {
    rulesApplied.push("CMP-04");
    tracker?.record("CMP-04", "company_deduplication", "Exact match on an internal alias table (e.g. Meta ← Facebook) — canonicalCompany set to the preferred short name.", {
      before: { company: name }, after: { canonicalCompany: alias },
    });
    return { canonicalCompany: alias, rulesApplied };
  }

  return { canonicalCompany: name, rulesApplied };
}
