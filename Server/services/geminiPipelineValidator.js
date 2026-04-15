import { JobField } from "../models/jobDataFields.js";

const CLEANED_EXTRA = new Set([
  "sourceRawId",
  "isRemote",
  "etlSalaryFlags",
  "_id",
  "createdAt",
  "updatedAt",
  "salaryNum",
  "postDateParsed",
]);

const EMPLOYER_FIELDS = new Set([
  "employer",
  "numberOfListings",
  "medianSalary",
  "_id",
  "createdAt",
  "updatedAt",
]);

export function getAllowedFields(collection) {
  const s = new Set();
  if (collection === "cleaned_job_data") {
    Object.values(JobField).forEach((f) => s.add(f));
    CLEANED_EXTRA.forEach((f) => s.add(f));
  } else if (collection === "employer_data") {
    EMPLOYER_FIELDS.forEach((f) => s.add(f));
  }
  return s;
}

const ALLOWED_STAGE_KEYS = new Set([
  "$match",
  "$group",
  "$sort",
  "$limit",
  "$project",
  "$addFields",
  "$skip",
  "$count",
  "$bucket",
  "$facet",
]);

const FORBIDDEN_MATCH_TOP = new Set(["$where", "$expr", "$jsonSchema", "$comment"]);

const ALLOWED_MATCH_OPS = new Set([
  "$and",
  "$or",
  "$nor",
  "$not",
  "$eq",
  "$ne",
  "$gt",
  "$gte",
  "$lt",
  "$lte",
  "$in",
  "$nin",
  "$exists",
  "$regex",
  "$options",
  "$type",
  "$mod",
]);

const MAX_PIPELINE_STAGES = 24;
const MAX_LIMIT = 500;
const MAX_SKIP = 5000;

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "Invalid pipeline");
}

export function validateMatchObject(obj, allowedFields, depth = 0) {
  assert(depth < 14, "Match nesting too deep");
  if (obj === null || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const x of obj) validateMatchObject(x, allowedFields, depth + 1);
    return;
  }
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$")) {
      assert(!FORBIDDEN_MATCH_TOP.has(key), `Forbidden operator in $match: ${key}`);
      if (key === "$and" || key === "$or" || key === "$nor") {
        assert(Array.isArray(obj[key]), "$and/$or/$nor must be arrays");
        for (const sub of obj[key]) validateMatchObject(sub, allowedFields, depth + 1);
        continue;
      }
      if (key === "$not") {
        validateMatchObject(obj[key], allowedFields, depth + 1);
        continue;
      }
      assert(
        ALLOWED_MATCH_OPS.has(key) || key === "$not",
        `Unsupported $match operator: ${key}`
      );
      continue;
    }
    assert(allowedFields.has(key), `Unknown field in $match: "${key}"`);
    const v = obj[key];
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      const subKeys = Object.keys(v);
      const allOps = subKeys.every((k) => k.startsWith("$"));
      if (allOps) {
        for (const sk of subKeys) {
          assert(!FORBIDDEN_MATCH_TOP.has(sk), `Forbidden nested op: ${sk}`);
          assert(
            ALLOWED_MATCH_OPS.has(sk) || sk === "$not",
            `Unsupported nested op: ${sk}`
          );
        }
      } else {
        validateMatchObject(v, allowedFields, depth + 1);
      }
    }
  }
}

function validateSortObject(sort, allowedFields) {
  assert(sort && typeof sort === "object" && !Array.isArray(sort), "sort must be object");
  for (const k of Object.keys(sort)) {
    assert(allowedFields.has(k) || k === "_id", `Unknown sort field: ${k}`);
    const d = sort[k];
    assert(d === 1 || d === -1 || d === "asc" || d === "desc", "Invalid sort direction");
  }
}

/**
 * @param {object[]} pipeline
 * @param {Set<string>} allowedFields
 * @param {{ maxLimit?: number }} [opts]
 */
export function validateAggregationPipeline(pipeline, allowedFields, opts = {}) {
  const maxLimit = opts.maxLimit ?? MAX_LIMIT;
  assert(Array.isArray(pipeline), "pipeline must be array");
  assert(
    pipeline.length > 0 && pipeline.length <= MAX_PIPELINE_STAGES,
    `pipeline length must be 1–${MAX_PIPELINE_STAGES}`
  );
  for (const stage of pipeline) {
    assert(stage && typeof stage === "object" && !Array.isArray(stage), "Invalid stage");
    const keys = Object.keys(stage);
    assert(keys.length === 1, "Each stage must have exactly one operator key");
    const op = keys[0];
    assert(ALLOWED_STAGE_KEYS.has(op), `Stage not allowed: ${op}`);

    if (op === "$match") {
      validateMatchObject(stage.$match, allowedFields);
    }
    if (op === "$sort") {
      validateSortObject(stage.$sort, allowedFields);
    }
    if (op === "$limit") {
      const n = stage.$limit;
      assert(typeof n === "number" && n >= 1 && n <= maxLimit, `$limit must be 1–${maxLimit}`);
    }
    if (op === "$skip") {
      const n = stage.$skip;
      assert(typeof n === "number" && n >= 0 && n <= MAX_SKIP, "Invalid $skip");
    }
    if (op === "$facet") {
      assert(stage.$facet && typeof stage.$facet === "object", "Invalid $facet");
      for (const sub of Object.values(stage.$facet)) {
        assert(Array.isArray(sub), "$facet subpipelines must be arrays");
        if (sub.length === 0) continue;
        validateAggregationPipeline(sub, allowedFields, opts);
      }
    }
  }
}

export function validateFindOptions(filter, allowedFields, limit, sort) {
  validateMatchObject(filter, allowedFields);
  assert(typeof limit === "number" && limit >= 1 && limit <= 100, "find limit must be 1–100");
  if (sort) validateSortObject(sort, allowedFields);
}
