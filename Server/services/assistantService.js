import { compressQuery } from "../lib/nlpCompressor.js";
import { getDashboardPayload } from "./dashboardService.js";
import { searchJobs } from "./jobSearchService.js";
import { formatSalaryText } from "./assistantFormat.js";
import { answerWithGemini } from "./geminiAssistantService.js";

function mean(nums) {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function stateFromJob(j) {
  const s = j.state?.trim();
  if (s) return s.length <= 3 ? s.toUpperCase() : s;
  const parts = String(j.location || "")
    .split(",")
    .map((x) => x.trim());
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    if (/^[A-Za-z]{2}$/.test(last)) return last.toUpperCase();
  }
  return null;
}

function salaryByState(items) {
  const map = new Map();
  for (const j of items) {
    const st = stateFromJob(j);
    if (!st) continue;
    const cur = map.get(st) || { total: 0, n: 0 };
    cur.total += j.salary;
    cur.n += 1;
    map.set(st, cur);
  }
  return [...map.entries()]
    .map(([state, { total, n }]) => ({
      state,
      avgSalary: Math.round(total / n),
    }))
    .sort((a, b) => b.avgSalary - a.avgSalary)
    .slice(0, 10);
}

/** Prefer token-based keywords; fall back to compromise-derived phrase */
function assistantSearchKeyword(q) {
  const fromTerms = stripIntentTokens(q.terms).join(" ").trim();
  if (fromTerms.length >= 3) return fromTerms.slice(0, 120);
  const nlp = String(q.nlpSearchPhrase || "").trim();
  if (nlp.length >= 2) return nlp.slice(0, 120);
  return String(q.keyword || "").trim().slice(0, 120);
}

function stripIntentTokens(tokens) {
  const skip = new Set([
    "salary",
    "salaries",
    "average",
    "avg",
    "mean",
    "median",
    "pay",
    "compensation",
    "job",
    "jobs",
    "role",
    "roles",
    "listing",
    "listings",
    "much",
    "make",
    "earn",
    "paid",
    "does",
    "did",
    "show",
    "find",
    "list",
    "open",
    "positions",
    "position",
    "vacancies",
    "vacancy",
  ]);
  return tokens.filter((t) => !skip.has(t));
}

/**
 * @param {string} userText
 * @returns {Promise<{ content: string, data?: { type: string, items?: { label: string, value: string }[], meta?: object } }>}
 */
export async function answerAssistantMessage(userText) {
  try {
    const gemini = await answerWithGemini(userText);
    if (gemini) return gemini;
  } catch (err) {
    console.error("Gemini assistant:", err);
  }

  const q = compressQuery(userText);
  const keywordForSearch = assistantSearchKeyword(q);

  try {
    switch (q.intent) {
      case "SALARY_OVERVIEW": {
        const dash = await getDashboardPayload();
        const s = dash.summaryStats;
        const top = (dash.salaryByRole || []).slice(0, 5);
        return {
          content: `Across our cleaned listings, there are ${formatNumber(s.totalJobs)} jobs with an overall average salary of ${formatSalaryText(s.avgSalary)}. The highest-paying titled role on average is ${s.highestPayingRole} at about ${formatSalaryText(s.highestSalary)}.`,
          data: {
            type: "salary",
            intent: q.intent,
            compressed: q.compressed,
            items: [
              { label: "Total listings", value: formatNumber(s.totalJobs) },
              { label: "Average salary", value: formatSalaryText(s.avgSalary) },
              { label: "Top location", value: `${s.topLocation} (${formatNumber(s.topLocationJobs)} jobs)` },
              ...top.map((r) => ({
                label: r.role,
                value: formatSalaryText(r.salary),
              })),
            ],
          },
        };
      }
      case "SALARY_AVG_ROLE": {
        const kw = q.roleHint || assistantSearchKeyword(q) || q.keyword;
        const res = await searchJobs({
          keyword: kw,
          limit: 2000,
          minSalary: 1,
          maxSalary: 10_000_000,
        });
        const salaries = res.items.map((j) => j.salary).filter((n) => n > 0);
        const avg = mean(salaries);
        return {
          content:
            salaries.length === 0
              ? `I could not find listings matching “${kw}”. Try a broader role name or check spelling.`
              : `For roles matching “${kw}”, the average salary across ${salaries.length} listings is ${formatSalaryText(avg)}.`,
          data: {
            type: "salary",
            intent: q.intent,
            compressed: q.compressed,
            items: [
              { label: "Query", value: kw || "(general)" },
              { label: "Listings used", value: String(salaries.length) },
              { label: "Average salary", value: formatSalaryText(avg) },
              { label: "Min", value: salaries.length ? formatSalaryText(Math.min(...salaries)) : "—" },
              { label: "Max", value: salaries.length ? formatSalaryText(Math.max(...salaries)) : "—" },
            ],
          },
        };
      }
      case "TOP_CITIES": {
        const dash = await getDashboardPayload();
        const rows = dash.jobsByCity || [];
        const items = rows.slice(0, 6).map((r) => ({
          label: r.city,
          value: `${formatNumber(r.count)} jobs`,
        }));
        return {
          content:
            rows.length === 0
              ? "There is not enough city data yet. Sync cleaned job data first."
              : `Top cities by number of listings in the current dataset: ${rows
                  .slice(0, 5)
                  .map((r) => r.city)
                  .join(", ")}.`,
          data: {
            type: "jobs",
            intent: q.intent,
            compressed: q.compressed,
            items,
          },
        };
      }
      case "TOP_COMPANIES": {
        const dash = await getDashboardPayload();
        const fi = dash.featuredInsights?.[2];
        const items = (fi?.items || []).slice(0, 6).map((x) => ({
          label: x.name,
          value: x.value,
        }));
        return {
          content:
            items.length === 0
              ? "Company compensation summaries are not available yet."
              : `Highest average compensation by company (from current analytics): ${items
                  .slice(0, 3)
                  .map((i) => i.label)
                  .join(", ")}.`,
          data: {
            type: "companies",
            intent: q.intent,
            compressed: q.compressed,
            items,
          },
        };
      }
      case "TRENDS_GROWTH": {
        const dash = await getDashboardPayload();
        const fi = dash.featuredInsights?.[1];
        const items = (fi?.items || []).map((x) => ({
          label: x.name,
          value: x.value,
        }));
        return {
          content:
            items.length === 0
              ? "Role demand shares are not available yet."
              : `Here is how roles rank by share of current listings (proxy for demand concentration).`,
          data: {
            type: "general",
            intent: q.intent,
            compressed: q.compressed,
            items,
          },
        };
      }
      case "JOB_LISTINGS":
      case "REMOTE_JOBS": {
        const loc =
          q.intent === "REMOTE_JOBS"
            ? "remote"
            : (q.places && q.places[0]) || "";
        const res = await searchJobs({
          keyword: keywordForSearch || q.keyword,
          location: loc,
          limit: 25,
          minSalary: 1,
          maxSalary: 10_000_000,
        });
        const slice = res.items.slice(0, 8);
        return {
          content:
            slice.length === 0
              ? "No listings matched that query. Try different keywords or relax filters in Job Search."
              : `Here are sample roles from the database (${res.total} matches, showing ${slice.length}).`,
          data: {
            type: "jobs",
            intent: q.intent,
            compressed: q.compressed,
            items: slice.map((j) => ({
              label: j.title,
              value: `${j.company} · ${formatSalaryText(j.salary)}`,
            })),
          },
        };
      }
      case "STATES_SALARY": {
        const res = await searchJobs({
          limit: 5000,
          minSalary: 1,
          maxSalary: 10_000_000,
        });
        const byState = salaryByState(res.items);
        const items = byState.slice(0, 8).map((r) => ({
          label: r.state,
          value: formatSalaryText(r.avgSalary),
        }));
        return {
          content:
            items.length === 0
              ? "Could not group salaries by state (missing state on listings). Check that State is populated in cleaned data."
              : `Average salary by state (from ${res.items.length} listings with a state): top is ${items[0].label} at ${items[0].value}.`,
          data: {
            type: "salary",
            intent: q.intent,
            compressed: q.compressed,
            items,
          },
        };
      }
      default: {
        const dash = await getDashboardPayload();
        const s = dash.summaryStats;
        return {
          content: `I parsed your question into: “${q.compressed || "(empty)"}” with intent ${q.intent}. Here is a quick snapshot of the dataset: ${formatNumber(s.totalJobs)} listings, average salary ${formatSalaryText(s.avgSalary)}. Ask about average pay for a role, top cities, companies, jobs in a state, or job openings.`,
          data: {
            type: "general",
            intent: q.intent,
            compressed: q.compressed,
            items: [
              { label: "Compressed query", value: q.compressed || "—" },
              { label: "Total jobs", value: formatNumber(s.totalJobs) },
              { label: "Avg salary", value: formatSalaryText(s.avgSalary) },
              { label: "Top city", value: s.topLocation },
            ],
          },
        };
      }
    }
  } catch (err) {
    return {
      content: `Something went wrong while fetching data: ${err.message || "Unknown error"}.`,
      data: { type: "general", items: [] },
    };
  }
}

function formatNumber(n) {
  return Number(n || 0).toLocaleString("en-US");
}
