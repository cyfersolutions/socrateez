import { useEffect, useState } from 'react';
import {
  Briefcase,
  DollarSign,
  TrendingUp,
  MapPin,
  Star,
  Wifi,
  Code,
  Copy,
  Layers,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../components/Card';
import { Badge } from '../components/Badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/Table';
import { ChartContainer, ChartTooltipContent } from '../components/Chart';
import type { ChartConfig } from '../components/Chart';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from 'recharts';
import { fetchDashboard, type DashboardPayload } from '../lib/api';
import { formatNumber } from '../lib/utils';

// ─── Helpers ────────────────────────────────────────────────────

function fmtSalary(v: number | undefined | null): string {
  if (v == null || isNaN(v)) return '$0';
  return `$${v.toLocaleString('en-US')}`;
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
  freelance: 'Freelance',
};

function jobTypeLabel(t: string) {
  return JOB_TYPE_LABELS[t] || t;
}

function jobTypeBadgeVariant(t: string): 'default' | 'secondary' | 'outline' {
  if (t === 'full_time' || t === 'Full-time') return 'default';
  if (t === 'contract' || t === 'Contract') return 'secondary';
  return 'outline';
}

// ─── Chart Configs ──────────────────────────────────────────────

const PIE_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

const salaryByRoleConfig: ChartConfig = {
  salary: { label: 'Avg Salary', color: 'var(--chart-1)' },
};
const salaryTrendsConfig: ChartConfig = {
  salary: { label: 'Avg Salary', color: 'var(--chart-2)' },
};
const jobsByCityConfig: ChartConfig = {
  count: { label: 'Job Count', color: 'var(--chart-3)' },
};
const salaryDistConfig: ChartConfig = {
  count: { label: 'Job Count', color: 'var(--chart-4)' },
};
const topSkillsConfig: ChartConfig = {
  count: { label: 'Mentions', color: 'var(--chart-2)' },
};
const salaryByTypeConfig: ChartConfig = {
  salary: { label: 'Avg Salary', color: 'var(--chart-5)' },
};
const jobTypeConfig: ChartConfig = {
  count: { label: 'Jobs', color: 'var(--chart-1)' },
};

const emptySummary: DashboardPayload['summaryStats'] = {
  totalJobs: 0,
  uniqueJobs: 0,
  duplicateJobs: 0,
  avgSalary: 0,
  highestPayingRole: '—',
  highestSalary: 0,
  topLocation: '—',
  topLocationJobs: 0,
  remoteCount: 0,
  remotePct: 0,
  topSkill: '—',
  topSkillCount: 0,
};

// ─── Loading Skeleton ───────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted ${className}`}
    />
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-7 w-48 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-40 mb-1" />
              <Skeleton className="h-3 w-56" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Dashboard Page ─────────────────────────────────────────────

export function DashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    fetchDashboard()
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((e: Error) => {
        if (!cancelled) setLoadError(e.message ?? 'Failed to load dashboard');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <Briefcase className="h-6 w-6 text-destructive" />
        </div>
        <p className="text-sm text-destructive font-medium">{loadError}</p>
      </div>
    );
  }

  if (!data) return <DashboardSkeleton />;

  const ss = data.summaryStats ?? emptySummary;
  const salaryByRole = data.salaryByRole ?? [];
  const salaryTrends = data.salaryTrends ?? [];
  const jobsByCity = data.jobsByCity ?? [];
  const jobsByRole = data.jobsByRole ?? [];
  const salaryDistribution = data.salaryDistribution ?? [];
  const jobTypeDistribution = data.jobTypeDistribution ?? [];
  const topSkills = data.topSkills ?? [];
  const salaryByJobType = data.salaryByJobType ?? [];
  const topJobs = data.topJobs ?? [];
  const featuredInsights = data.featuredInsights ?? [];

  return (
    <div className="space-y-8">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Job market overview — salary insights, demand analytics, skills
          breakdown, and top opportunities.
        </p>
      </div>

      {/* ─── Summary Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <SummaryCard
          label="Total Jobs"
          value={formatNumber(ss.totalJobs)}
          sub={`${formatNumber(ss.uniqueJobs)} unique`}
          icon={<Briefcase className="h-4 w-4 text-primary" />}
          iconBg="bg-primary/10"
        />
        <SummaryCard
          label="Average Salary"
          value={fmtSalary(ss.avgSalary)}
          sub="Annual USD"
          icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
          iconBg="bg-emerald-500/10"
        />
        <SummaryCard
          label="Highest Paying Role"
          value={ss.highestPayingRole}
          sub={`Up to ${fmtSalary(ss.highestSalary)}`}
          icon={<TrendingUp className="h-4 w-4 text-amber-600" />}
          iconBg="bg-amber-500/10"
          small
        />
        <SummaryCard
          label="Top Location"
          value={ss.topLocation}
          sub={`${formatNumber(ss.topLocationJobs)} positions`}
          icon={<MapPin className="h-4 w-4 text-blue-600" />}
          iconBg="bg-blue-500/10"
        />
        <SummaryCard
          label="Remote Jobs"
          value={`${ss.remotePct}%`}
          sub={`${formatNumber(ss.remoteCount)} remote`}
          icon={<Wifi className="h-4 w-4 text-violet-600" />}
          iconBg="bg-violet-500/10"
        />
        <SummaryCard
          label="Top Skill"
          value={ss.topSkill}
          sub={`${formatNumber(ss.topSkillCount)} mentions`}
          icon={<Code className="h-4 w-4 text-pink-600" />}
          iconBg="bg-pink-500/10"
        />
      </div>

      {/* ─── ETL Insights: Job Types + Top Skills ───────────────── */}
      <div>
        <SectionHeading
          title="ETL Insights"
          description="New data fields from the enrichment pipeline"
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Job Type Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Job Type Distribution</CardTitle>
              <CardDescription>
                Employment types across all listings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {jobTypeDistribution.length === 0 ? (
                <EmptyChart />
              ) : (
                <ChartContainer config={jobTypeConfig} className="h-[300px] w-full">
                  <PieChart>
                    <Pie
                      data={jobTypeDistribution}
                      dataKey="count"
                      nameKey="type"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={55}
                      strokeWidth={2}
                      stroke="var(--background)"
                    >
                      {jobTypeDistribution.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltipContent nameKey="type" />} />
                  </PieChart>
                </ChartContainer>
              )}
              <ChartLegend items={jobTypeDistribution.map((d, i) => ({ label: d.type, color: PIE_COLORS[i % PIE_COLORS.length] }))} />
            </CardContent>
          </Card>

          {/* Top Skills */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Skills in Demand</CardTitle>
              <CardDescription>
                Most mentioned technologies across job listings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topSkills.length === 0 ? (
                <EmptyChart />
              ) : (
                <ChartContainer config={topSkillsConfig} className="h-[300px] w-full">
                  <BarChart
                    data={topSkills}
                    layout="vertical"
                    margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" fontSize={12} />
                    <YAxis
                      type="category"
                      dataKey="skill"
                      width={90}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
                    <Tooltip
                      content={<ChartTooltipContent />}
                      cursor={{ fill: 'var(--muted)', opacity: 0.3 }}
                    />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── Salary Analytics ───────────────────────────────────── */}
      <div>
        <SectionHeading
          title="Salary Analytics"
          description="Compensation trends and comparisons"
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Average Salary by Role */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Average Salary by Role</CardTitle>
              <CardDescription>
                Comparison across top normalized titles
              </CardDescription>
            </CardHeader>
            <CardContent>
              {salaryByRole.length === 0 ? (
                <EmptyChart />
              ) : (
                <ChartContainer config={salaryByRoleConfig} className="h-[300px] w-full">
                  <BarChart
                    data={salaryByRole}
                    layout="vertical"
                    margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => `$${v / 1000}K`}
                      fontSize={12}
                    />
                    <YAxis
                      type="category"
                      dataKey="role"
                      width={140}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Bar dataKey="salary" fill="var(--color-salary)" radius={[0, 4, 4, 0]} />
                    <Tooltip
                      content={<ChartTooltipContent />}
                      cursor={{ fill: 'var(--muted)', opacity: 0.3 }}
                    />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Salary by Job Type */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Salary by Job Type</CardTitle>
              <CardDescription>
                Average compensation by employment type
              </CardDescription>
            </CardHeader>
            <CardContent>
              {salaryByJobType.length === 0 ? (
                <EmptyChart />
              ) : (
                <ChartContainer config={salaryByTypeConfig} className="h-[300px] w-full">
                  <BarChart
                    data={salaryByJobType}
                    margin={{ top: 10, right: 20, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="type"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => `$${v / 1000}K`}
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Bar dataKey="salary" fill="var(--color-salary)" radius={[4, 4, 0, 0]} />
                    <Tooltip
                      content={<ChartTooltipContent />}
                      cursor={{ fill: 'var(--muted)', opacity: 0.3 }}
                    />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── Salary Trends ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Salary Trends Over Time</CardTitle>
          <CardDescription>Average salary — past 12 months</CardDescription>
        </CardHeader>
        <CardContent>
          {salaryTrends.length === 0 ? (
            <EmptyChart />
          ) : (
            <ChartContainer config={salaryTrendsConfig} className="h-[280px] w-full">
              <AreaChart data={salaryTrends} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  tickFormatter={(v) => `$${v / 1000}K`}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <defs>
                  <linearGradient id="salaryGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-salary)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--color-salary)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="salary"
                  stroke="var(--color-salary)"
                  strokeWidth={2}
                  fill="url(#salaryGrad)"
                />
                <Tooltip content={<ChartTooltipContent indicator="line" />} />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* ─── Job Demand Analytics ───────────────────────────────── */}
      <div>
        <SectionHeading
          title="Job Demand Analytics"
          description="Geographic and role distribution"
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Jobs by City */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Jobs by City</CardTitle>
              <CardDescription>Open positions across top metro areas</CardDescription>
            </CardHeader>
            <CardContent>
              {jobsByCity.length === 0 ? (
                <EmptyChart />
              ) : (
                <ChartContainer config={jobsByCityConfig} className="h-[300px] w-full">
                  <BarChart data={jobsByCity} margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="city"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      angle={-35}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} />
                    <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
                    <Tooltip
                      content={<ChartTooltipContent />}
                      cursor={{ fill: 'var(--muted)', opacity: 0.3 }}
                    />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Jobs by Role (Donut) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Jobs by Role</CardTitle>
              <CardDescription>Distribution of open positions by normalized title</CardDescription>
            </CardHeader>
            <CardContent>
              {jobsByRole.length === 0 ? (
                <EmptyChart />
              ) : (
                <ChartContainer config={jobTypeConfig} className="h-[300px] w-full">
                  <PieChart>
                    <Pie
                      data={jobsByRole}
                      dataKey="count"
                      nameKey="role"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={50}
                      strokeWidth={2}
                      stroke="var(--background)"
                    >
                      {jobsByRole.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltipContent nameKey="role" />} />
                  </PieChart>
                </ChartContainer>
              )}
              <ChartLegend items={jobsByRole.map((r, i) => ({ label: r.role, color: PIE_COLORS[i % PIE_COLORS.length] }))} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── Salary Distribution ────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Salary Distribution</CardTitle>
          <CardDescription>Number of jobs across salary ranges</CardDescription>
        </CardHeader>
        <CardContent>
          {salaryDistribution.length === 0 ? (
            <EmptyChart />
          ) : (
            <ChartContainer config={salaryDistConfig} className="h-[250px] w-full">
              <BarChart data={salaryDistribution} margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="range" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
                <Tooltip
                  content={<ChartTooltipContent />}
                  cursor={{ fill: 'var(--muted)', opacity: 0.3 }}
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* ─── Top Jobs Table ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Top Job Listings</CardTitle>
              <CardDescription>
                Highest-paying opportunities — {formatNumber(ss.duplicateJobs)} duplicates excluded
              </CardDescription>
            </div>
            {ss.duplicateJobs > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Copy className="h-3.5 w-3.5" />
                {formatNumber(ss.duplicateJobs)} dupes removed
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Title</TableHead>
                <TableHead>Company</TableHead>
                <TableHead className="hidden sm:table-cell">Location</TableHead>
                <TableHead className="text-right">Salary</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead className="hidden lg:table-cell">Skills</TableHead>
                <TableHead className="hidden lg:table-cell pr-6">Posted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topJobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="pl-6 text-muted-foreground">
                    No listings yet. Run a sync to populate.
                  </TableCell>
                </TableRow>
              ) : (
                topJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="pl-6 font-medium max-w-[200px] truncate">
                      <div className="flex items-center gap-2">
                        {job.title}
                        {job.isRemote && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            Remote
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate">{job.company}</TableCell>
                    <TableCell className="hidden sm:table-cell">{job.location}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {fmtSalary(job.salary)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant={jobTypeBadgeVariant(job.jobType)}>
                        {jobTypeLabel(job.jobType)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {(job.skills || []).slice(0, 3).map((s) => (
                          <span
                            key={s}
                            className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                          >
                            {s}
                          </span>
                        ))}
                        {(job.skills || []).length > 3 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{job.skills.length - 3}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell pr-6 text-muted-foreground">
                      {fmtDate(job.postedDate)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ─── Featured Insights ──────────────────────────────────── */}
      <div>
        <SectionHeading title="Featured Insights" description="Key takeaways from the data" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              Icon: DollarSign,
              wrap: 'bg-amber-500/10',
              iconClass: 'text-amber-600',
              rankBg: 'bg-amber-500/10',
              rankText: 'text-amber-700',
              valueClass: 'text-sm font-mono tabular-nums text-muted-foreground',
            },
            {
              Icon: Layers,
              wrap: 'bg-emerald-500/10',
              iconClass: 'text-emerald-600',
              rankBg: 'bg-emerald-500/10',
              rankText: 'text-emerald-700',
              valueClass: 'text-sm font-medium text-emerald-600',
            },
            {
              Icon: Star,
              wrap: 'bg-blue-500/10',
              iconClass: 'text-blue-600',
              rankBg: 'bg-blue-500/10',
              rankText: 'text-blue-700',
              valueClass: 'text-sm font-mono tabular-nums text-muted-foreground',
            },
          ].map((style, idx) => {
            const insight = featuredInsights[idx];
            if (!insight) return null;
            const { Icon } = style;
            return (
              <Card key={insight.title}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${style.wrap}`}
                    >
                      <Icon className={`h-4 w-4 ${style.iconClass}`} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{insight.title}</CardTitle>
                      <CardDescription className="text-xs">
                        {insight.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {insight.items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No data yet.</p>
                    ) : (
                      insight.items.map((item, i) => (
                        <div
                          key={`${item.name}-${i}`}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${style.rankBg} ${style.rankText}`}
                            >
                              {i + 1}
                            </span>
                            <span className="text-sm font-medium truncate max-w-[140px]">
                              {item.name}
                            </span>
                          </div>
                          <span className={style.valueClass}>{item.value}</span>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
  icon,
  iconBg,
  small,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  iconBg: string;
  small?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div
          className={`font-bold tabular-nums truncate ${small ? 'text-lg' : 'text-2xl'}`}
        >
          {value}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
      No data available
    </div>
  );
}

function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: item.color }}
          />
          <span className="text-xs text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
