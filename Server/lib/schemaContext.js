import { JobField } from "../models/jobDataFields.js";

/**
 * Full schema text for Gemini (and docs): exact Mongo field names as in CSV imports.
 */
export function buildSchemaContext() {
  const jobFields = Object.entries(JobField)
    .map(([k, v]) => `- ${k} → stored as exact key "${v}"`)
    .join("\n");

  return `
## Collections (MongoDB)

### cleaned_job_data (job listings)
Each document uses **exact string keys** (including spaces and parentheses) as imported from CSV.

Field mapping:
${jobFields}
- sourceRawId: ObjectId (optional), reference to raw import row
- isRemote: boolean — true unless all of Location Label, State, City, and Country are present and non-empty (incomplete location → remote)
- etlSalaryFlags: string[] — salary normalization tags (e.g. hourly_explicit, deflate_one_2080)
- normalizedTitle: string — cleaned, canonical job title picked from whichever title (filter or listing) best matched a known role
- roleSource: string enum (filter_title | listing_title) — which title produced the normalizedTitle
- jobType: string enum (full_time | part_time | contract | internship | freelance) — detected from both filter title and listing title
- postedAt: Date — parsed posting date (ISO)
- daysSincePosted: number — days since posting
- normalizedState: string — standardized state code (e.g. "NY")
- normalizedCity: string — title-cased city name
- normalizedCountry: string — ISO country code (e.g. "US")
- latitude: number — geocoordinate (nullable)
- longitude: number — geocoordinate (nullable)
- canonicalCompany: string — deduplicated company name (lowercased, suffixes stripped, aliases resolved)
- skills: string[] — extracted technology/skill keywords (e.g. ["Python", "AWS", "React"])
- isDuplicate: boolean — true if this is a duplicate posting (older than canonical)
- duplicateHash: string — MD5 hash used for duplicate grouping
- etlRulesApplied: string[] — all ETL rule IDs that fired on this document

**Salary**: string like "$120,000" after ETL normalization. Parsed to **salaryNum** in aggregations; **dashboard and job search only include listings with salaryNum between 20,000 and 500,000** (USD annual).

**Dates**: Post Date is the raw string; **postedAt** is the parsed ISO date. Use postedAt for date-based queries and sorting.

### employer_data (employer rollups)
- employer: string (company name), indexed
- numberOfListings: number
- medianSalary: string (formatted like job salary)

## Query rules for the planner
- Only these two collections; no joins across other databases.
- Prefer **aggregate** for group-by, averages, counts by dimension, top-N.
- Prefer **find** for listing sample rows matching filters (keep limit ≤ 50).
- Use **exact field keys** in $match / $group _id (quoted in JSON).
- For "average salary by X" on cleaned_job_data, set **prepend_salary_numeric**: true and use **$salaryNum** in $avg / $sum / $bucket.
- employer_data medianSalary is a string; avoid $avg on it unless parsing — prefer numberOfListings for counts.
`.trim();
}
