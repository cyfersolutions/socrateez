import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Database,
  Filter,
  Hash,
  Layers,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Separator } from '../components/Separator';
import { formatNumber } from '../lib/utils';
import {
  fetchEtlRuns,
  fetchEtlRunDetail,
  type EtlAuditRun,
  type EtlAuditRunDetail,
  type EtlAuditPhase,
} from '../lib/api';

// ─── Friendly labels for rule categories ────────────────────────

const CATEGORY_META: Record<
  string,
  { label: string; description: string; icon: typeof Activity; color: string }
> = {
  eligibility_filter: {
    label: 'Eligibility Check',
    description:
      'Counts how many raw rows fall into each bucket before the main pipeline. Only rows with both a non-empty salary and a non-empty job title (filter) are processed; others are skipped. Also reports how many rows lack a listing title (they can still run if salary + filter title exist).',
    icon: Filter,
    color: 'text-red-600 bg-red-500/10',
  },
  salary_normalization: {
    label: 'Salary Cleanup',
    description:
      'Parses the raw salary string into a single annual USD amount and stores it as a formatted string (e.g. $120,000). Detects hourly vs annual cues, handles k-suffix and common data-entry mistakes (e.g. accidental ×2,080). Rejects rows that are unparseable, out of band ($20k–$500k), or fail the trainee/intern listing-title sanity cap.',
    icon: Hash,
    color: 'text-emerald-600 bg-emerald-500/10',
  },
  remote_detection: {
    label: 'Remote Detection',
    description:
      'Sets isRemote from the four location fields (Location Label, State, City, Country). If all four are present and non-whitespace, the job is treated as not remote. If any are missing or only whitespace, the job is treated as remote for analytics (no reliable on-site address).',
    icon: Activity,
    color: 'text-violet-600 bg-violet-500/10',
  },
  job_type_classification: {
    label: 'Job Type Detection',
    description:
      'Scans the filter title first, then the listing title, for employment-type keywords (internship, contract, part-time, freelance). Sets jobType and removes the matched keyword from the title string that contained it so later steps see a cleaner title.',
    icon: Layers,
    color: 'text-blue-600 bg-blue-500/10',
  },
  job_title_normalization: {
    label: 'Title Cleanup',
    description:
      'Builds normalizedTitle from the listing title when possible, otherwise the filter title. Applies lowercasing, abbreviation expansion, punctuation removal, and optional mapping to a small set of canonical role names for consistent dashboards.',
    icon: Activity,
    color: 'text-amber-600 bg-amber-500/10',
  },
  date_freshness: {
    label: 'Date Parsing',
    description:
      'Parses the raw post date into postedAt (ISO) and daysSincePosted. Tries ISO, slash dates, relative phrases (“3 days ago”), and natural language. Unparseable or empty dates leave postedAt null but do not drop the job.',
    icon: Clock,
    color: 'text-pink-600 bg-pink-500/10',
  },
  location_normalization: {
    label: 'Location Cleanup',
    description:
      'Normalizes state names to US postal codes where applicable, maps common country names to ISO codes, title-cases cities, and fills latitude/longitude when the city appears in a built-in coordinate table.',
    icon: Activity,
    color: 'text-teal-600 bg-teal-500/10',
  },
  company_deduplication: {
    label: 'Company Normalization',
    description:
      'Lowercases the employer string, strips legal suffixes and parentheticals, then applies an exact alias table (e.g. “Facebook Inc” → meta). No fuzzy string matching — unknown names stay as cleaned text.',
    icon: Database,
    color: 'text-orange-600 bg-orange-500/10',
  },
  skills_extraction: {
    label: 'Skills Detection',
    description:
      'Scans combined text from titles and job family fields against a fixed dictionary of technologies (languages, frameworks, cloud, etc.). Produces a deduplicated list of canonical skill labels for filtering and display.',
    icon: Activity,
    color: 'text-indigo-600 bg-indigo-500/10',
  },
  duplicate_detection: {
    label: 'Duplicate Removal',
    description:
      'After all rows are written, computes an MD5 from a normalized full-row fingerprint (including a normalized posting date). Rows with the same fingerprint are grouped; the newest postedAt is kept and older rows are marked duplicates.',
    icon: XCircle,
    color: 'text-red-600 bg-red-500/10',
  },
};

function getCategoryMeta(cat: string) {
  return (
    CATEGORY_META[cat] ?? {
      label: cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      description: '',
      icon: Activity,
      color: 'text-muted-foreground bg-muted',
    }
  );
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtPct(numerator: number, denominator: number): string {
  if (!denominator || denominator <= 0) return '0.00%';
  return `${((numerator / denominator) * 100).toFixed(2)}%`;
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

// ─── Page ───────────────────────────────────────────────────────

export function EtlAuditPage() {
  const [runs, setRuns] = useState<EtlAuditRun[] | null>(null);
  const [selectedRun, setSelectedRun] = useState<EtlAuditRunDetail | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingRuns(true);
    setError(null);
    fetchEtlRuns()
      .then((data) => {
        if (!cancelled) setRuns(data);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingRuns(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function openRun(syncRunId: string) {
    setLoadingDetail(true);
    setError(null);
    fetchEtlRunDetail(syncRunId)
      .then(setSelectedRun)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoadingDetail(false));
  }

  if (selectedRun && !loadingDetail) {
    return (
      <RunDetailView
        detail={selectedRun}
        onBack={() => setSelectedRun(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Data Processing History
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every time we clean and enrich job data, each step is recorded here.
          Click a run to see exactly what happened.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {loadingRuns && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="py-5">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-72" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {loadingDetail && (
        <div className="flex items-center gap-3 py-10 justify-center text-sm text-muted-foreground">
          <Activity className="h-4 w-4 animate-spin" />
          Loading run details...
        </div>
      )}

      {runs && runs.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Database className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No processing runs yet. Trigger a sync from the API to see results
              here.
            </p>
          </CardContent>
        </Card>
      )}

      {runs && runs.length > 0 && (
        <div className="space-y-3">
          {runs.map((run) => (
            <button
              key={run._id}
              type="button"
              onClick={() => openRun(run._id)}
              className="w-full text-left"
            >
              <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                      <Activity className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">
                          Processing Run
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {run.totalRules} steps
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {fmtDate(run.appliedAt)}
                      </p>
                    </div>
                    <div className="hidden sm:flex flex-wrap gap-1 max-w-[300px] justify-end">
                      {run.categories.slice(0, 4).map((cat) => {
                        const meta = getCategoryMeta(cat);
                        return (
                          <span
                            key={cat}
                            className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                          >
                            {meta.label}
                          </span>
                        );
                      })}
                      {run.categories.length > 4 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{run.categories.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Run Detail View ────────────────────────────────────────────

function RunDetailView({
  detail,
  onBack,
}: {
  detail: EtlAuditRunDetail;
  onBack: () => void;
}) {
  const totalRejected = detail.phases.reduce(
    (sum, p) => sum + p.subRules.reduce((s, r) => s + r.rejectedCount, 0),
    0
  );
  const recordsProcessed = detail.phases[0].countBeforePhase ?? 0;
  const recordsCleaned = Math.max(0, recordsProcessed - totalRejected);
  const overallRejectionPct = fmtPct(totalRejected, recordsProcessed);
  const overallCleanedPct = fmtPct(recordsCleaned, recordsProcessed);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1.5 mb-3 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to all runs
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Processing Run Details
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {fmtDate(detail.appliedAt)} — here's a step-by-step breakdown of
          what happened to your data.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <MiniStat
          label="Steps Performed"
          value={String(detail.phases.length)}
          icon={<Layers className="h-4 w-4 text-blue-600" />}
          bg="bg-blue-500/10"
        />
        <MiniStat
          label="Records Processed"
          value={formatNumber(recordsProcessed)}
          icon={<Database className="h-4 w-4 text-emerald-600" />}
          bg="bg-emerald-500/10"
        />
        <MiniStat
          label="Records Rejected"
          value={`${formatNumber(totalRejected)} (${overallRejectionPct})`}
          icon={<XCircle className="h-4 w-4 text-red-600" />}
          bg="bg-red-500/10"
        />
        <MiniStat
          label="Records Cleaned"
          value={`${formatNumber(recordsCleaned)} (${overallCleanedPct})`}
          icon={<CheckCircle2 className="h-4 w-4 text-green-600" />}
          bg="bg-amber-500/10"
        />
        <MiniStat
          label="Overall Rejection Rate"
          value={overallRejectionPct}
          icon={<XCircle className="h-4 w-4 text-rose-700" />}
          bg="bg-rose-500/10"
        />
      </div>

      {/* Pipeline steps */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">
          Pipeline Steps
        </h2>
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

          <div className="space-y-4">
            {detail.phases.map((phase, idx) => (
              <PhaseCard key={phase.category} phase={phase} stepNumber={idx + 1} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Phase Card ─────────────────────────────────────────────────

function PhaseCard({ phase, stepNumber }: { phase: EtlAuditPhase; stepNumber: number }) {
  const [expanded, setExpanded] = useState(false);
  const meta = getCategoryMeta(phase.category);
  const Icon = meta.icon;
  const totalRejected = phase.subRules.reduce((s, r) => s + r.rejectedCount, 0);
  const inCount = Math.max(0, phase.countBeforePhase ?? 0);
  const outCount = Math.max(0, phase.countAfterPhase ?? 0);
  const phaseRejectedFromFlow = Math.max(0, inCount - outCount);
  const phaseRejectedPct = fmtPct(phaseRejectedFromFlow, inCount);
  const phasePassPct = fmtPct(outCount, inCount);

  return (
    <div className="relative pl-12">
      {/* Step circle on timeline */}
      <div
        className={`absolute left-0 top-4 flex h-10 w-10 items-center justify-center rounded-full border-2 border-background ${meta.color}`}
      >
        <Icon className="h-4 w-4" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px] tabular-nums">
                  Step {stepNumber}
                </Badge>
                <CardTitle className="text-base">{meta.label}</CardTitle>
              </div>
              <CardDescription className="mt-1">{meta.description}</CardDescription>
            </div>
            {/* {phase.phaseTimeTakenMs != null && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Clock className="h-3 w-3" />
                {fmtTime(phase.phaseTimeTakenMs)}
              </div>
            )} */}
          </div>
        </CardHeader>

        <CardContent>
          {/* Summary stats row */}
          <div className="flex flex-wrap gap-4 text-sm mb-4">
            {phase.countBeforePhase != null && (
              <div>
                <span className="text-muted-foreground">Records in: </span>
                <span className="font-medium tabular-nums">
                  {formatNumber(phase.countBeforePhase)}
                </span>
              </div>
            )}
            {phase.countAfterPhase != null && (
              <div>
                <span className="text-muted-foreground">Records out: </span>
                <span className="font-medium tabular-nums">
                  {formatNumber(phase.countAfterPhase)}
                </span>
              </div>
            )}
            {phase.countBeforePhase != null && phase.countAfterPhase != null && (
              <>
                <div>
                  <span className="text-muted-foreground">Rejection %: </span>
                  <span className="font-medium tabular-nums text-red-600">
                    {phaseRejectedPct}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Pass %: </span>
                  <span className="font-medium tabular-nums text-emerald-600">
                    {phasePassPct}
                  </span>
                </div>
              </>
            )}
            {/* <div>
              <span className="text-muted-foreground">Touched: </span>
              <span className="font-medium tabular-nums">
                {formatNumber(totalAffected)}
              </span>
            </div> */}
            {totalRejected > 0 && (
              <div>
                <span className="text-muted-foreground">Removed: </span>
                <span className="font-medium tabular-nums text-red-600">
                  {formatNumber(totalRejected)}
                </span>
              </div>
            )}
          </div>

          {/* Sub-rules summary */}
          <div className="space-y-2">
            {phase.subRules.map((rule) => (
              <SubRuleRow key={rule.ruleId} rule={rule} />
            ))}
          </div>

          {/* Expand sample data */}
          {phase.subRules.some(
            (r) => r.sampleBefore.length > 0 || r.sampleAfter.length > 0
          ) && (
            <>
              <Separator className="my-3" />
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                {expanded ? 'Hide' : 'Show'} sample data
              </button>
              {expanded && (
                <div className="mt-3 space-y-4">
                  {phase.subRules
                    .filter(
                      (r) =>
                        r.sampleBefore.length > 0 || r.sampleAfter.length > 0
                    )
                    .map((rule) => (
                      <SampleDataView key={rule.ruleId} rule={rule} />
                    ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sub-rule row ───────────────────────────────────────────────

function SubRuleRow({
  rule,
}: {
  rule: { ruleId: string; ruleDescription: string; affectedCount: number; rejectedCount: number };
}) {
  const isReject = rule.rejectedCount > 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="shrink-0">
        {isReject ? (
          <XCircle className="h-4 w-4 text-red-500" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground">{rule.ruleDescription}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0 text-xs tabular-nums">
        <span className="text-muted-foreground">
          {formatNumber(rule.affectedCount)} affected
        </span>
        {isReject && (
          <span className="text-red-600">
            {formatNumber(rule.rejectedCount)} removed
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Sample data viewer ─────────────────────────────────────────

function SampleDataView({
  rule,
}: {
  rule: {
    ruleId: string;
    ruleDescription: string;
    sampleBefore: unknown[];
    sampleAfter: unknown[];
  };
}) {
  return (
    <div className="rounded-lg border p-3 bg-muted/30">
      <p className="text-xs font-medium text-foreground mb-2">
        {rule.ruleDescription}
        <span className="ml-2 font-normal text-muted-foreground">
          ({rule.ruleId})
        </span>
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rule.sampleBefore.length > 0 && (
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Before
            </p>
            <pre className="text-[11px] bg-background rounded-md p-2 overflow-x-auto max-h-[200px] overflow-y-auto border">
              {JSON.stringify(rule.sampleBefore[0], null, 2)}
            </pre>
          </div>
        )}
        {rule.sampleAfter.length > 0 && (
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
              After
            </p>
            <pre className="text-[11px] bg-background rounded-md p-2 overflow-x-auto max-h-[200px] overflow-y-auto border">
              {JSON.stringify(rule.sampleAfter[0], null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Mini stat card ─────────────────────────────────────────────

function MiniStat({
  label,
  value,
  icon,
  bg,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  bg: string;
}) {
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${bg}`}
          >
            {icon}
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
