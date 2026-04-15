# ETL: `raw_job_data` → `cleaned_job_data`

This pipeline promotes rows from **`raw_job_data`** into **`cleaned_job_data`** with **salary normalization**, **outlier rejection**, and **remote handling**. Upserts are keyed by **`sourceRawId`** (the raw document `_id`) so re-runs stay idempotent.

## Field names (MongoDB)

Job documents use **human-readable column titles** as keys (see `JobField` in `models/jobDataFields.js`).

## Eligibility (what gets synced)

A raw document is processed if **both** are present and non-empty:

1. **`Salary`**
2. **`Job Title (filter selection)`**

**Location is not required for eligibility**, but **`isRemote`** uses all four columns: if **any** of `Location Label`, `State`, `City`, or `Country` is missing or empty (after trim), the cleaned row gets **`isRemote: true`**. Only when **all four** are present and non-empty is the row marked as not remote.

## Salary normalization (`lib/salaryNormalization.js`)

Raw `Salary` is interpreted and rewritten as a **normalized annual USD** string, e.g. `$120,000`.

### Rules (summary)

| Case | Handling |
|------|-----------|
| Explicit hourly (`/hr`, `hourly`, `per hour`, …) | `rate × 2080` (once) |
| Explicit annual hints (`/yr`, `annual`, …) | Use numeric value as annual |
| Plain number in **20,000–500,000** | Treat as annual |
| Number ~**5–400** without annual context | Treat as **hourly** → `× 2080` |
| Huge values (bad ETL / double `×2080`) | Try **÷2080** if result lands in annual band; else try double-hourly repair |
| Outside **20,000–500,000** after normalization | **Rejected** (row skipped, cleaned row removed if it existed) |
| Titles matching trainee/intern/co-op patterns | Rejected if salary **> 200,000** |

### Outlier band

- **Keep:** annual salary in **`[20_000, 500_000]`** (config: `SALARY_MIN_ANNUAL`, `SALARY_MAX_ANNUAL`).
- **Remove / skip:** everything else (counted in sync stats).

### Flags on document

`etlSalaryFlags` stores short tags (e.g. `hourly_explicit`, `deflate_one_2080`) for auditing.

## Sync behavior (`services/rawToCleanedService.js`)

1. Count eligible raw docs (`countDocuments` on the eligibility filter).
2. **Paginate** eligible raw docs by `_id` (default **1500** per fetch) so the process does not load the whole collection into memory.
3. For each batch, build Mongo `bulkWrite` operations; **chunk** writes (default **250** ops per `bulkWrite`) to stay under command size limits and keep heap use bounded.
4. For each raw doc:
   - Run `normalizeSalaryForEtl(salary, jobTitle)`.
   - If **not ok**: `deleteOne` cleaned row with that `sourceRawId` (cleanup stale data).
   - If **ok**: `updateOne` upsert with normalized `Salary`, `isRemote`, `etlSalaryFlags`, and copied fields.

### Tuning (large collections / memory)

| Env var | Default | Role |
|---------|---------|------|
| `ETL_FETCH_BATCH` | 1500 (clamped 100–10000) | Raw docs loaded per round-trip |
| `ETL_BULK_CHUNK` | 250 (clamped 50–1000) | Operations per `bulkWrite` |

If you still hit Node heap limits, lower these or run with a larger heap, e.g. `NODE_OPTIONS=--max-old-space-size=8192`.

### Sync response (useful fields)

- `skippedCount` / `skipReasons` — rows rejected (unparseable, out of range, trainee cap, etc.).
- `pctSkippedFromEligible` — approximate % of eligible raw rows not represented in cleaned after this run.
- `etlFetchBatch` / `etlBulkChunk` — effective batch sizes for this run.

## Full reset (destructive)

After changing ETL rules, wipe cleaned and rebuild:

```http
POST /api/cleaned-jobs/reset-and-sync
```

This runs `resetCleanedCollectionAndSync()` (delete all `cleaned_job_data`, then full sync).

Incremental update without wipe:

```http
POST /api/cleaned-jobs/sync
```

## Dashboard & Job Search

- **`matchValidSalary`** in aggregations is now **salaryNum ∈ [20_000, 500_000]** (same as product policy).
- **Highest paying role** in dashboard summary uses **`MAX(salaryNum)` per job title** (aligned with “max salary by role”), not average-by-role.

## Root cause analysis (RCA) — inflated salaries

- **Source / CSV ambiguity:** Mixed hourly and annual figures in one column; some rows labeled hourly, others not.
- **Wrong unit conversion:** Hourly wages multiplied by 2080 when the value was **already** annual (or multiplied more than once).
- **Numeric explosions:** A stray `×2080` on a valid annual (e.g. 45,000 → 93,600,000) produced impossible totals.
- **No guardrails in v1 ETL:** Clean step copied `Salary` verbatim; aggregations only stripped `$`/commas, so bad values flowed into averages and “top role.”
- **Strict location filter:** Rows with missing location were dropped, so some legitimate titles (e.g. concierge) could be absent from cleaned data depending on raw completeness.

**Mitigations shipped:** normalization + single/double `2080` repair, hard annual band, trainee sanity rule, optional remote rows, bounded aggregations, max-salary-by-title for “highest paying role,” and documented reset path.

## Code map

| Piece | Location |
|-------|-----------|
| Salary policy + `normalizeSalaryForEtl` | `lib/salaryNormalization.js` |
| ETL sync + reset | `services/rawToCleanedService.js` |
| Cleaned schema (`isRemote`, flags) | `models/CleanedJobData.js` |
| Routes | `routes/cleanedJobs.js` |
| Dashboard bounds + top role by max | `services/dashboardService.js` |
| Job search bounds + stats | `services/jobSearchService.js` |
