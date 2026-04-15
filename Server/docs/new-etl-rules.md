Here's a comprehensive rules document covering both your existing ETL and the proposed ones:

---

## Master ETL Rules & Prompt Reference

---

### 🔴 PRIORITY 1 — Eligibility Filter *(Existing)*

**Prompt:**
> Only process raw documents that have both `Salary` and `Job Title (filter selection)` present and non-empty. Skip everything else and count it in `skippedCount`.

| Rule ID | Rule | Example | Action |
|---|---|---|---|
| ELG-01 | Both Salary + Job Title present | `$80,000` + `Data Analyst` | Process ✅ |
| ELG-02 | Salary missing | `""` + `Data Analyst` | Skip ❌ |
| ELG-03 | Job Title missing | `$80,000` + `""` | Skip ❌ |
| ELG-04 | Both missing | `""` + `""` | Skip ❌ |

---


### 🔴 PRIORITY 1 — Salary Normalization *(Existing)*

**Prompt:**
> Normalize the raw `Salary` field into a standard annual USD figure. Detect hourly vs annual context from keywords. Apply `× 2080` for hourly. Repair suspiciously large values by trying `÷ 2080`. Reject anything outside `$20,000–$500,000`. Cap trainee/intern titles at `$200,000`. Store flags in `etlSalaryFlags` for auditing.

| Rule ID | Rule | Example | Action |
|---|---|---|---|
| SAL-01 | Explicit hourly keyword detected | `$25/hr` | `× 2080` → `$52,000` ✅ |
| SAL-02 | Explicit annual keyword detected | `$80,000/yr` | Use as-is → `$80,000` ✅ |
| SAL-03 | Plain number in 20k–500k | `$95,000` | Treat as annual ✅ |
| SAL-04 | Plain number in 5–400 range | `$45` | Treat as hourly `× 2080` → `$93,600` ✅ |
| SAL-05 | Suspiciously huge value | `$93,600,000` | Try `÷ 2080` → `$45,000` ✅ |
| SAL-06 | Unrepairable huge value | `$999,999,999` | Reject ❌ |
| SAL-07 | Result below `$20,000` | `$3/hr` → `$6,240` | Reject ❌ |
| SAL-08 | Result above `$500,000` | `$600,000` | Reject ❌ |
| SAL-09 | Trainee/intern title + salary > `$200,000` | `Intern` + `$250,000` | Reject ❌ |

---


### 🔴 PRIORITY 1 — Remote Detection *(Existing)*

**Prompt:**
> Check all four location fields: `Location Label`, `State`, `City`, `Country`. If any one of them is missing or empty after trim, mark `isRemote: true`. Only mark `isRemote: false` when all four are present and non-empty.

| Rule ID | Rule | Example | Action |
|---|---|---|---|
| RMT-01 | All 4 location fields present | `NYC, New York, NY, US` | `isRemote: false` ✅ |
| RMT-02 | Any 1 field missing | `City` missing | `isRemote: true` ✅ |
| RMT-03 | All 4 fields missing | All empty | `isRemote: true` ✅ |
| RMT-04 | Field present but only whitespace | `"   "` | Treated as empty → `isRemote: true` ✅ |

---

### 🔴 PRIORITY 2 — Job Title Normalization *(New)*

**Prompt:**
> Normalize raw job titles into a clean, canonical form. Lowercase, strip punctuation, expand abbreviations, remove noise words like "remote" or "contract". Map to a `normalizedTitle` field. Use this field for all grouping, search, and dashboard analytics.

| Rule ID | Rule | Example | Action |
|---|---|---|---|
| TTL-01 | Lowercase everything | `SOFTWARE ENGINEER` | `software engineer` |
| TTL-02 | Expand abbreviations | `Sr. Eng.` | `senior engineer` |
| TTL-03 | Strip noise words | `Engineer - Remote (Contract)` | `engineer` |
| TTL-04 | Strip special characters | `Dev/Ops Engineer` | `devops engineer` |
| TTL-05 | Map to canonical title | `Snr SWE`, `Sr. Software Eng.` | `senior software engineer` |
| TTL-06 | Title is empty after cleaning | `"--"` → `""` | Reject ❌ |

---

### 🔴 PRIORITY 2 — Duplicate Detection *(New)*

**Prompt:**
> Detect duplicate job postings by hashing on `normalizedTitle + canonicalCompany + normalizedLocation + jobType`. Flag duplicates as `isDuplicate: true`. Among duplicates, keep the most recently posted one as the canonical record.

| Rule ID | Rule | Example | Action |
|---|---|---|---|
| DUP-01 | Exact hash match found | Same title + company + location | `isDuplicate: true` on older ✅ |
| DUP-02 | Keep most recent among dupes | 3 identical postings | Keep latest, flag rest ✅ |
| DUP-03 | Same title, different company | `Google` vs `Meta` | Not a duplicate ✅ |
| DUP-04 | Same title, same company, different location | `NYC` vs `SF` | Not a duplicate ✅ |

---

### 🟡 PRIORITY 3 — Job Type Classification *(New)*

**Prompt:**
> Detect employment type from the job title or any available description field. Classify into one of: `full_time`, `part_time`, `contract`, `internship`, `freelance`. Store as `jobType`. If no type is detectable, default to `full_time`. Strip the detected type keyword from the title before passing to Title Normalization.

| Rule ID | Rule | Example | Action |
|---|---|---|---|
| JTP-01 | Internship keyword detected | `Marketing Internship` | `jobType: internship` |
| JTP-02 | Contract keyword detected | `Engineer (Contract)` | `jobType: contract` |
| JTP-03 | Part-time keyword detected | `Part Time Support` | `jobType: part_time` |
| JTP-04 | Freelance keyword detected | `Freelance Designer` | `jobType: freelance` |
| JTP-05 | No keyword detected | `Data Analyst` | `jobType: full_time` (default) |
| JTP-06 | Feed into trainee salary cap | `jobType: internship` + `$250k` | Triggers SAL-09 rejection ❌ |

---

### 🟡 PRIORITY 3 — Date & Freshness Normalization *(New)*

**Prompt:**
> Parse all raw date formats into a standard ISO `postedAt` date. Compute `daysSincePosted`. Flag jobs older than 90 days as `isStale: true`. Remove stale jobs from the cleaned collection during sync.

| Rule ID | Rule | Example | Action |
|---|---|---|---|
| DTE-01 | ISO date format | `2025-01-05T00:00:00Z` | Parse as-is ✅ |
| DTE-02 | Human readable format | `Jan 5, 2025` | Parse → ISO ✅ |
| DTE-03 | Relative format | `Posted 3 days ago` | Compute absolute date ✅ |
| DTE-04 | Ambiguous format | `01/05/25` | Default to `MM/DD/YY` ✅ |
| DTE-05 | Date missing entirely | `""` | `postedAt: null`, `isStale: false` |

---

### 🟢 PRIORITY 4 — Location Normalization *(New)*

**Prompt:**
> Normalize all location fields into consistent formats. Standardize state codes, country names, and city names. Attempt geocoding to attach `latitude` and `longitude` for map-based features. Do not affect the `isRemote` flag — that is computed before this ETL.

| Rule ID | Rule | Example | Action |
|---|---|---|---|
| LOC-01 | Full state name → code | `New York` | `NY` |
| LOC-02 | Country name variants → standard | `USA`, `United States` | `US` |
| LOC-03 | City casing fix | `new york city` | `New York City` |
| LOC-04 | Attach geocoordinates | `Austin, TX, US` | `lat: 30.26`, `lng: -97.74` |
| LOC-05 | Unknown city/state combo | `Xyztown, ZZ` | Skip geocode, keep raw ✅ |
| LOC-06 | Geocode failure | API timeout | Keep normalized text, no coords ✅ |

---

### 🟢 PRIORITY 4 — Company Name Deduplication *(New)*

**Prompt:**
> Normalize company names by lowercasing, stripping legal suffixes like LLC, Inc., Corp., and applying fuzzy matching above a similarity threshold. Store the result as `canonicalCompany`. Use this field for all company-level grouping and analytics.

| Rule ID | Rule | Example | Action |
|---|---|---|---|
| CMP-01 | Strip legal suffixes | `Google LLC` | `google` |
| CMP-02 | Normalize casing | `AMAZON` | `amazon` |
| CMP-03 | Fuzzy match above threshold | `Meta` vs `Meta Platforms` | `canonicalCompany: meta` |
| CMP-04 | Known alias mapping | `Facebook (Meta)` | `canonicalCompany: meta` |
| CMP-05 | Below fuzzy threshold | `Apex` vs `Apex Technologies` | Keep separate ✅ |
| CMP-06 | Company field empty | `""` | `canonicalCompany: null` ✅ |

---

### 🟢 PRIORITY 5 — Skills Extraction *(New)*

**Prompt:**
> Scan the job description or title for known technology and skill keywords. Match against a maintained skills dictionary. Normalize variants to canonical names. Output a `skills[]` array on the cleaned document. Used for skill-based search and salary-by-skill analytics.

| Rule ID | Rule | Example | Action |
|---|---|---|---|
| SKL-01 | Exact skill match | `Python` | `skills: ["Python"]` |
| SKL-02 | Variant normalization | `NodeJS`, `Node JS` | `Node.js` |
| SKL-03 | Case-insensitive match | `react`, `REACT` | `React` |
| SKL-04 | Multi-skill extraction | `React, Node.js, AWS` | `skills: ["React","Node.js","AWS"]` |
| SKL-05 | No skills found | Generic job description | `skills: []` ✅ |
| SKL-06 | Unknown term | `FooBarJS` | Skip, not added ✅ |

---

## Full Priority Summary

| Priority | ETL | Rules | Status |
|---|---|---|---|
| 🔴 P1 | Salary Normalization | SAL-01 → SAL-09 | ✅ Existing |
| 🔴 P1 | Eligibility Filter | ELG-01 → ELG-04 | ✅ Existing |
| 🔴 P1 | Remote Detection | RMT-01 → RMT-04 | ✅ Existing |
| 🔴 P2 | Job Title Normalization | TTL-01 → TTL-06 | 🆕 New |
| 🔴 P2 | Duplicate Detection | DUP-01 → DUP-04 | 🆕 New |
| 🟡 P3 | Job Type Classification | JTP-01 → JTP-06 | 🆕 New |
| 🟡 P3 | Date & Freshness | DTE-01 → DTE-06 | 🆕 New |
| 🟢 P4 | Location Normalization | LOC-01 → LOC-06 | 🆕 New |
| 🟢 P4 | Company Deduplication | CMP-01 → CMP-06 | 🆕 New |
| 🟢 P5 | Skills Extraction | SKL-01 → SKL-06 | 🆕 New |

