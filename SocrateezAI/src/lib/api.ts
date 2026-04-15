/** Use empty string with Vite dev proxy (`vite.config.ts` → `/api` → backend). */
const base = import.meta.env.VITE_API_BASE_URL ?? "";

export interface DashboardPayload {
  summaryStats: {
    totalJobs: number;
    uniqueJobs: number;
    duplicateJobs: number;
    avgSalary: number;
    highestPayingRole: string;
    highestSalary: number;
    topLocation: string;
    topLocationJobs: number;
    remoteCount: number;
    remotePct: number;
    topSkill: string;
    topSkillCount: number;
  };
  salaryByRole: { role: string; salary: number }[];
  salaryTrends: { month: string; salary: number }[];
  jobsByCity: { city: string; count: number }[];
  jobsByRole: { role: string; count: number }[];
  salaryDistribution: { range: string; count: number }[];
  jobTypeDistribution: { type: string; count: number }[];
  topSkills: { skill: string; count: number }[];
  salaryByJobType: { type: string; salary: number }[];
  topJobs: {
    id: string;
    title: string;
    company: string;
    location: string;
    salary: number;
    postedDate: string;
    jobType: string;
    skills: string[];
    isRemote: boolean;
  }[];
  featuredInsights: {
    title: string;
    description: string;
    items: { name: string; value: string }[];
  }[];
}

export async function fetchDashboard(): Promise<DashboardPayload> {
  const res = await fetch(`${base}/api/dashboard`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Dashboard request failed (${res.status})`);
  }
  return res.json();
}

export interface JobSearchParams {
  keyword?: string;
  location?: string;
  cities?: string[];
  companies?: string[];
  jobTypes?: string[];
  skills?: string[];
  isRemote?: boolean;
  minSalary?: number;
  maxSalary?: number;
  sortField?: string;
  sortDirection?: "asc" | "desc";
  limit?: number;
}

export interface JobSearchItem {
  id: string;
  title: string;
  company: string;
  location: string;
  state?: string;
  salary: number;
  postedDate: string;
  jobType: string;
  skills: string[];
  isRemote: boolean;
  roleSource?: string | null;
}

export interface FacetOption {
  name: string;
  count: number;
}

export interface JobTypeFacet {
  type: string;
  count: number;
}

export interface JobFacetsPayload {
  cities: FacetOption[];
  companies: FacetOption[];
  jobTypes: JobTypeFacet[];
  skills: FacetOption[];
  totalCount: number;
  remoteCount: number;
  salaryRange: [number, number];
}

export interface JobSearchPayload {
  items: JobSearchItem[];
  total: number;
  salaryStats?: {
    minSalary: number;
    maxSalary: number;
    avgSalary: number;
  };
}

function withList(params: URLSearchParams, key: string, values?: string[]) {
  if (values && values.length > 0) {
    params.set(key, values.join(","));
  }
}

export async function fetchJobSearch(
  input: JobSearchParams
): Promise<JobSearchPayload> {
  const params = new URLSearchParams();
  if (input.keyword) params.set("keyword", input.keyword);
  if (input.location) params.set("location", input.location);
  withList(params, "cities", input.cities);
  withList(params, "companies", input.companies);
  withList(params, "jobTypes", input.jobTypes);
  withList(params, "skills", input.skills);
  if (input.isRemote != null) params.set("isRemote", String(input.isRemote));
  if (input.minSalary != null) params.set("minSalary", String(input.minSalary));
  if (input.maxSalary != null) params.set("maxSalary", String(input.maxSalary));
  if (input.sortField) params.set("sortField", input.sortField);
  if (input.sortDirection) params.set("sortDirection", input.sortDirection);
  if (input.limit != null) params.set("limit", String(input.limit));

  const res = await fetch(`${base}/api/jobs/search?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Job search request failed (${res.status})`);
  }
  return res.json();
}

export async function fetchJobFacets(): Promise<JobFacetsPayload> {
  const res = await fetch(`${base}/api/jobs/facets`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Job facets request failed (${res.status})`);
  }
  return res.json();
}

export async function searchFacet(
  type: "company" | "city" | "skill",
  query: string,
  limit = 20
): Promise<FacetOption[]> {
  const params = new URLSearchParams({ type, q: query, limit: String(limit) });
  const res = await fetch(`${base}/api/jobs/facets/search?${params.toString()}`);
  if (!res.ok) return [];
  return res.json();
}

export interface AssistantGeminiMeta {
  reasoning?: string;
  plan?: Record<string, unknown>;
  execution?: Record<string, unknown>;
  resultsPreview?: string;
  schemaContext?: string;
  error?: string;
}

export interface AssistantChatPayload {
  content: string;
  data?: {
    type: "salary" | "jobs" | "companies" | "general";
    intent?: string;
    compressed?: string;
    items?: { label: string; value: string }[];
    gemini?: AssistantGeminiMeta;
  };
}

// ─── ETL Audit ──────────────────────────────────────────────────

export interface EtlAuditRun {
  _id: string;
  appliedAt: string;
  totalRules: number;
  categories: string[];
}

export interface EtlAuditSubRule {
  ruleId: string;
  ruleDescription: string;
  affectedCount: number;
  rejectedCount: number;
  sampleBefore: unknown[];
  sampleAfter: unknown[];
}

export interface EtlAuditPhase {
  category: string;
  countBeforePhase: number | null;
  countAfterPhase: number | null;
  phaseTimeTakenMs: number | null;
  subRules: EtlAuditSubRule[];
}

export interface EtlAuditRunDetail {
  syncRunId: string;
  appliedAt: string;
  phases: EtlAuditPhase[];
}

export async function fetchEtlRuns(): Promise<EtlAuditRun[]> {
  const res = await fetch(`${base}/api/etl-audit/runs`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `ETL audit request failed (${res.status})`);
  }
  return res.json();
}

export async function fetchEtlRunDetail(
  syncRunId: string
): Promise<EtlAuditRunDetail> {
  const res = await fetch(`${base}/api/etl-audit/runs/${syncRunId}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `ETL audit detail request failed (${res.status})`);
  }
  return res.json();
}

// ─── Assistant ──────────────────────────────────────────────────

export async function fetchAssistantChat(
  message: string
): Promise<AssistantChatPayload> {
  const res = await fetch(`${base}/api/assistant/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Assistant request failed (${res.status})`);
  }
  return res.json();
}
