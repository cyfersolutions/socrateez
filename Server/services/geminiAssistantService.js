import { GoogleGenerativeAI } from "@google/generative-ai";
import { appendFile, mkdir } from "node:fs/promises";
import { CleanedJobData } from "../models/CleanedJobData.js";
import { EmployerData } from "../models/EmployerData.js";
import { JobField as JF } from "../models/jobDataFields.js";
import { buildSchemaContext } from "../lib/schemaContext.js";
import { addSalaryNumAndDate, matchValidSalary } from "./dashboardService.js";
import {
  validateAggregationPipeline,
  validateFindOptions,
  getAllowedFields,
  validateMatchObject,
} from "./geminiPipelineValidator.js";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const PIPELINE_LOG_DIR = new URL("../logs/", import.meta.url);
const PIPELINE_LOG_FILE = new URL("../logs/gemini-pipelines.jsonl", import.meta.url);

function getApiKey() {
  return process.env.GEMINI_API_KEY || "";
}

function parseJsonFromModel(text) {
  const trimmed = String(text || "").trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : trimmed;
  return JSON.parse(raw);
}

function needsSalaryNumericStages(pipeline) {
  const s = JSON.stringify(pipeline);
  if (/salaryNum/.test(s)) return true;
  if (/\$avg\b/.test(s)) return true;
  if (/\$bucket\b/.test(s)) return true;
  if (/"Salary"/.test(s) && /\$match/.test(s)) return true;
  return false;
}

function buildPlannerSystemPrompt() {
  const exampleKey = JF.company;
  return `You are a MongoDB query planner for a read-only analytics API.

${buildSchemaContext()}

## Output (JSON only)
Return one JSON object:

{
  "reasoning": "1-3 sentences",
  "collection": "cleaned_job_data" | "employer_data",
  "operation": "aggregate" | "find" | "countDocuments" | "none",
  "prepend_salary_numeric": true | false,
  "pipeline": [ ],
  "find": { "filter": { }, "limit": 25, "sort": { } },
  "countFilter": { },
  "assistant_message": "only if operation is none"
}

Rules:
- **aggregate** + **pipeline**: group-by, averages, top-N, buckets. **pipeline** must be non-empty.
- **countDocuments** + **countFilter**: simple counts.
- **prepend_salary_numeric**: true when using salaryNum, $avg/$sum on pay, $bucket, or numeric salary. False for counts by city/title with no salary math.
- Exact field keys like "${exampleKey}" (quoted in JSON).
- Forbidden stages: $out, $merge, $lookup.
- no limit on the number of documents returned.
- use like operation for all string fields other then salary.
- our fields in db are like 
City -> string
Company -> string
Country -> string
Job Title (filter selection) -> string
Listing Title -> string
Location Label -> string
Naics 2 Digit Sector -> string
Naics 4 Digit Industry -> string
Post Date -> string
Salary -> string (normalized annual, e.g. "$120,000"; use salaryNum in aggregations)
State -> string

so create aggragation on basis of that
find job title in both listing title and job title filter selection
for location search in location label, city, state, country


If the question is off-topic or not answerable from this data, use operation "none" and **assistant_message**.
`.trim();
}

function buildSynthesisPrompt() {
  return `You are a concise data assistant for job market analytics.

You will receive:
1) The user's question
2) The schema summary
3) The executed query plan (JSON)
4) Query results (JSON, possibly truncated)

Write a helpful answer in plain English (2–6 sentences). Mention important numbers and caveats. Do not invent data beyond the results. If results are empty, say so and suggest a broader query. and show answer like it for non tech guy dont show that you fetched from these cols just point to point no extra information, like if someask for count of software engineer just return that much software enginer dont say that you found in these cols like job title filter and listing title`.trim();
}

async function runGeminiJson(systemText, userText) {
  const key = getApiKey();
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
    systemInstruction: systemText,
  });

  const result = await model.generateContent(userText);
  const text = result.response.text();
  return parseJsonFromModel(text);
}

async function runGeminiText(systemText, userText) {
  const key = getApiKey();
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 2048,
    },
    systemInstruction: systemText,
  });

  const result = await model.generateContent(userText);
  console.log(result.response.text());
  return result.response.text().trim();
}

function truncateForContext(obj, maxChars = 14000) {
  const s = JSON.stringify(obj, null, 0);
  if (s.length <= maxChars) return s;
  return `${s.slice(0, maxChars)}\n…(truncated)`;
}

async function logExecutedPlan({ userText, reasoning, plan, exec, error }) {
  try {
    await mkdir(PIPELINE_LOG_DIR, { recursive: true });
    const row = {
      ts: new Date().toISOString(),
      userText,
      reasoning: reasoning || "",
      operation: plan?.operation,
      collection: plan?.collection,
      prepend_salary_numeric: plan?.prepend_salary_numeric,
      plannedPipeline: plan?.pipeline,
      executedPipeline: exec?.pipeline,
      find: plan?.find,
      countFilter: plan?.countFilter,
      executionKind: exec?.kind,
      executionRowCount:
        typeof exec?.n === "number"
          ? exec.n
          : Array.isArray(exec?.rows)
            ? exec.rows.length
            : undefined,
      error: error || undefined,
    };
    await appendFile(PIPELINE_LOG_FILE, `${JSON.stringify(row)}\n`, "utf8");
  } catch (e) {
    console.error("Failed to write pipeline log:", e?.message || e);
  }
}

async function executePlan(plan) {
  const collName = plan.collection;
  if (!collName || !["cleaned_job_data", "employer_data"].includes(collName)) {
    throw new Error("Invalid or missing collection");
  }

  const allowed = getAllowedFields(collName);

  if (plan.operation === "none") {
    return {
      kind: "none",
      message: String(
        plan.assistant_message ||
          "I can only answer questions about job listings and employer summaries in this dataset."
      ),
    };
  }

  if (plan.operation === "aggregate") {
    const raw = Array.isArray(plan.pipeline) ? plan.pipeline : [];
    if (raw.length === 0) throw new Error("aggregate requires non-empty pipeline");
    let pipeline = [...raw];
    const prepend =
      plan.prepend_salary_numeric === true ||
      (plan.prepend_salary_numeric === undefined &&
        collName === "cleaned_job_data" &&
        needsSalaryNumericStages(pipeline));

    if (collName === "cleaned_job_data" && prepend) {
      pipeline = [addSalaryNumAndDate, matchValidSalary, ...pipeline];
    }

    validateAggregationPipeline(pipeline, allowed);

    console.log("Pipeline:", pipeline);
    if (collName === "cleaned_job_data") {
      
      const rows = await CleanedJobData.aggregate(pipeline)
        .allowDiskUse(true)
        .option({ maxTimeMS: 45000 });
      return { kind: "aggregate", collection: collName, pipeline, rows };
    }
    const rows = await EmployerData.aggregate(pipeline)
      .allowDiskUse(true)
      .option({ maxTimeMS: 45000 });
    return { kind: "aggregate", collection: collName, pipeline, rows };
  }

  if (plan.operation === "find") {
    const f = plan.find || {};
    const filter = f.filter || {};
    const limit = typeof f.limit === "number" ? f.limit : 25;
    const sort = f.sort || undefined;
    validateFindOptions(filter, allowed, Math.min(limit, 50), sort);

    if (collName === "cleaned_job_data") {
      let q = CleanedJobData.find(filter).lean();
      if (sort) q = q.sort(sort);
      const rows = await q.limit(Math.min(limit, 50)).maxTimeMS(30000);
      return { kind: "find", collection: collName, filter, sort, limit, rows };
    }
    let q = EmployerData.find(filter).lean();
    if (sort) q = q.sort(sort);
    const rows = await q.limit(Math.min(limit, 50)).maxTimeMS(30000);
    return { kind: "find", collection: collName, filter, sort, limit, rows };
  }

  if (plan.operation === "countDocuments") {
    const filter = plan.countFilter || {};
    validateMatchObject(filter, allowed);
    const Model = collName === "cleaned_job_data" ? CleanedJobData : EmployerData;
    const n = await Model.countDocuments(filter).maxTimeMS(30000);
    return { kind: "count", collection: collName, filter, n };
  }

  throw new Error(`Unsupported operation: ${plan.operation}`);
}

function resultsToItems(exec) {
  if (exec.kind === "count") {
    return [{ label: "Count", value: String(exec.n) }];
  }
  if (exec.kind === "none") {
    return [{ label: "Note", value: exec.message }];
  }
  const rows = exec.rows || [];
  const slice = rows.slice(0, 20);
  return slice.map((row, i) => ({
    label: `Row ${i + 1}`,
    value: truncateForContext(row, 400),
  }));
}

/**
 * Gemini planner + safe execution + Gemini synthesis.
 * @returns {Promise<{ content: string, data: object } | null>} null if API key missing (caller falls back)
 */
export async function answerWithGemini(userText) {
  if (!getApiKey()) return null;

  const plannerSystem = buildPlannerSystemPrompt();
  const userPayload = `User question:\n"""${userText}"""\n\nRespond with the JSON plan only.`;

  let plan;
  try {
    plan = await runGeminiJson(plannerSystem, userPayload);
  } catch (e) {
    console.error("Gemini planner error:", e);
    throw e;
  }

  const reasoning = String(plan.reasoning || "");
  let exec;
  try {
    exec = await executePlan(plan);
  } catch (e) {
    const errMsg = e.message || String(e);
    await logExecutedPlan({ userText, reasoning, plan, error: errMsg });
    const content = `The query could not be run safely: ${errMsg}. Try rephrasing or ask for a simpler breakdown.`;
    return {
      content,
      data: {
        type: "general",
        intent: "GEMINI_ERROR",
        gemini: {
          reasoning,
          plan,
          error: errMsg,
          schemaContext: buildSchemaContext(),
        },
        items: [{ label: "Error", value: errMsg }],
      },
    };
  }
  await logExecutedPlan({ userText, reasoning, plan, exec });

  if (exec.kind === "none") {
    return {
      content: exec.message,
      data: {
        type: "general",
        intent: "GEMINI_CONVERSATIONAL",
        gemini: {
          reasoning,
          plan,
          schemaContext: buildSchemaContext(),
        },
        items: [],
      },
    };
  }

  const resultsPayload = {
    kind: exec.kind,
    collection: exec.collection,
    ...(exec.kind === "count" ? { n: exec.n } : { rowCount: (exec.rows || []).length }),
    sample: exec.kind === "count" ? exec : { rows: (exec.rows || []).slice(0, 30) },
  };

  const synthesisUser = [
    `User question: """${userText}"""`,
    "",
    "Schema (short):",
    buildSchemaContext().slice(0, 6000),
    "",
    "Planner reasoning:",
    reasoning,
    "",
    "Executed plan (JSON):",
    truncateForContext(
      {
        operation: plan.operation,
        collection: plan.collection,
        prepend_salary_numeric: plan.prepend_salary_numeric,
        pipeline: plan.pipeline,
        find: plan.find,
        countFilter: plan.countFilter,
      },
      8000
    ),
    "",
    "Results (JSON):",
    truncateForContext(resultsPayload, 12000),
  ].join("\n");

  let content;
  try {
    content = await runGeminiText(buildSynthesisPrompt(), synthesisUser);
    console.log(content);
  } catch (e) {
    console.error("Gemini synthesis error:", e);
    content =
      exec.kind === "count"
        ? `Count: ${exec.n} document(s).`
        : `Returned ${(exec.rows || []).length} row(s). (Synthesis unavailable: ${e.message})`;
  }

  return {
    content,
    data: {
      type: "general",
      intent: "GEMINI_QUERY",
      gemini: {
        reasoning,
        plan: {
          operation: plan.operation,
          collection: plan.collection,
          prepend_salary_numeric: plan.prepend_salary_numeric,
          pipeline: plan.pipeline,
          find: plan.find,
          countFilter: plan.countFilter,
        },
        execution: {
          kind: exec.kind,
          collection: exec.collection,
          pipeline: exec.pipeline,
          filter: exec.filter,
          sort: exec.sort,
          limit: exec.limit,
          count: exec.kind === "count" ? exec.n : undefined,
          rowCount: exec.rows ? exec.rows.length : exec.kind === "count" ? 0 : undefined,
        },
        resultsPreview: truncateForContext(resultsPayload, 15000),
        schemaContext: buildSchemaContext(),
      },
      items: resultsToItems(exec),
    },
  };
}
