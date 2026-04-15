import { useMemo } from 'react';
import { DollarSign, TrendingDown, TrendingUp, BarChart3 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../Card';
import { ChartContainer, ChartTooltipContent } from '../Chart';
import type { ChartConfig } from '../Chart';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { formatSalary } from '../../lib/utils';
import type { JobSearchItem } from '../../lib/api';

interface SearchAnalyticsProps {
  jobs: JobSearchItem[];
  salaryStats?: {
    minSalary: number;
    maxSalary: number;
    avgSalary: number;
  };
}

const salaryByCityConfig: ChartConfig = {
  avgSalary: {
    label: 'Avg Salary',
    color: 'var(--chart-1)',
  },
};

const salaryByStateConfig: ChartConfig = {
  avgSalary: {
    label: 'Avg Salary',
    color: 'var(--chart-2)',
  },
};

/** Prefer API `state`; else parse trailing "ST" from "City, ST". */
function stateLabel(job: JobSearchItem): string | null {
  const raw = job.state?.trim();
  if (raw) return raw.length <= 3 ? raw.toUpperCase() : raw;
  const parts = job.location.split(',').map((s) => s.trim());
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    if (/^[A-Za-z]{2}$/.test(last)) return last.toUpperCase();
  }
  return null;
}

export function SearchAnalytics({ jobs, salaryStats }: SearchAnalyticsProps) {
  const analytics = useMemo(() => {
    if (jobs.length === 0) {
      return {
        minSalary: 0,
        maxSalary: 0,
        avgSalary: 0,
        salaryByCity: [] as { city: string; avgSalary: number }[],
        salaryByState: [] as { state: string; avgSalary: number }[],
      };
    }
    const salaries = jobs.map((j) => j.salary);
    const minSalary = Number.isFinite(Number(salaryStats?.minSalary))
      ? Number(salaryStats.minSalary)
      : Math.min(...salaries);
    const maxSalary = Number.isFinite(Number(salaryStats?.maxSalary))
      ? Number(salaryStats.maxSalary)
      : Math.max(...salaries);
    const avgSalary = Number.isFinite(Number(salaryStats?.avgSalary))
      ? Number(salaryStats.avgSalary)
      : Math.round(salaries.reduce((a, b) => a + b, 0) / salaries.length);
    const cityMap = new Map<string, { total: number; count: number }>();
    for (const job of jobs) {
      const city = job.location.split(',')[0].trim() || job.location;
      const existing = cityMap.get(city) || { total: 0, count: 0 };
      cityMap.set(city, {
        total: existing.total + job.salary,
        count: existing.count + 1,
      });
    }
    const salaryByCity = Array.from(cityMap.entries())
      .map(([city, data]) => ({
        city,
        avgSalary: Math.round(data.total / data.count),
      }))
      .sort((a, b) => b.avgSalary - a.avgSalary)
      .slice(0, 8);

    const stateMap = new Map<string, { total: number; count: number }>();
    for (const job of jobs) {
      const st = stateLabel(job);
      if (!st) continue;
      const existing = stateMap.get(st) || { total: 0, count: 0 };
      stateMap.set(st, {
        total: existing.total + job.salary,
        count: existing.count + 1,
      });
    }
    const salaryByState = Array.from(stateMap.entries())
      .map(([state, data]) => ({
        state,
        avgSalary: Math.round(data.total / data.count),
      }))
      .sort((a, b) => b.avgSalary - a.avgSalary);

    return {
      minSalary,
      maxSalary,
      avgSalary,
      salaryByCity,
      salaryByState,
    };
  }, [jobs, salaryStats]);

  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              No data to analyze. Adjust your filters to see analytics.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card size="sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <TrendingDown className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Min Salary</p>
                <p className="text-lg font-semibold font-mono">
                  {formatSalary(analytics.minSalary)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <DollarSign className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Salary</p>
                <p className="text-lg font-semibold font-mono">
                  {formatSalary(analytics.avgSalary)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Max Salary</p>
                <p className="text-lg font-semibold font-mono">
                  {formatSalary(analytics.maxSalary)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {analytics.salaryByState.length > 0 ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Salary by State
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Average salary for current results (grouped by state)
              </p>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={salaryByStateConfig}
                className="h-[260px] w-full">
                <BarChart
                  data={analytics.salaryByState}
                  layout="vertical"
                  margin={{
                    left: 4,
                    right: 20,
                    top: 5,
                    bottom: 5,
                  }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                    fontSize={11}
                  />
                  <YAxis
                    type="category"
                    dataKey="state"
                    width={44}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={<ChartTooltipContent />}
                    formatter={(value: number) => formatSalary(value)}
                  />
                  <Bar
                    dataKey="avgSalary"
                    fill="var(--color-avgSalary)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        ) : null}

        {analytics.salaryByCity.length > 0 ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Salary by City</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={salaryByCityConfig}
                className="h-[260px] w-full">
                <BarChart
                  data={analytics.salaryByCity}
                  layout="vertical"
                  margin={{
                    left: 10,
                    right: 20,
                    top: 5,
                    bottom: 5,
                  }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                    fontSize={11}
                  />
                  <YAxis
                    type="category"
                    dataKey="city"
                    width={90}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={<ChartTooltipContent />}
                    formatter={(value: number) => formatSalary(value)}
                  />
                  <Bar
                    dataKey="avgSalary"
                    fill="var(--color-avgSalary)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
