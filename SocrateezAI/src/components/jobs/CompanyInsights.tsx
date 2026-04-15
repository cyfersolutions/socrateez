import { useMemo } from 'react';
import { X, Building2, DollarSign, Briefcase, Users } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../Card';
import { Button } from '../Button';
import { Badge } from '../Badge';
import { Separator } from '../Separator';
import { formatSalary } from '../../lib/utils';
import type { JobSearchItem } from '../../lib/api';

interface CompanyInsightsProps {
  companyName: string;
  jobs: JobSearchItem[];
  onClose: () => void;
}

export function CompanyInsights({
  companyName,
  jobs,
  onClose,
}: CompanyInsightsProps) {
  const insights = useMemo(() => {
    const companyJobs = jobs.filter((j) => j.company === companyName);
    if (companyJobs.length === 0) {
      return null;
    }
    const salaries = companyJobs.map((j) => j.salary);
    const totalJobs = companyJobs.length;
    const avgSalary = Math.round(
      salaries.reduce((a, b) => a + b, 0) / salaries.length
    );
    const minSalary = Math.min(...salaries);
    const maxSalary = Math.max(...salaries);
    const roleMap = new Map<string, number>();
    for (const job of companyJobs) {
      roleMap.set(job.title, (roleMap.get(job.title) || 0) + 1);
    }
    const topRoles = Array.from(roleMap.entries())
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count);
    return {
      totalJobs,
      avgSalary,
      minSalary,
      maxSalary,
      topRoles,
    };
  }, [companyName, jobs]);

  if (!insights) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{companyName}</CardTitle>
              <p className="text-xs text-muted-foreground">Company Insights</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            aria-label="Close company insights">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <Briefcase className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-semibold">{insights.totalJobs}</p>
            <p className="text-[10px] text-muted-foreground">Open Jobs</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <DollarSign className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-semibold font-mono">
              {formatSalary(insights.avgSalary)}
            </p>
            <p className="text-[10px] text-muted-foreground">Avg Salary</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-sm font-semibold font-mono">
              {formatSalary(insights.minSalary)}–
              {formatSalary(insights.maxSalary)}
            </p>
            <p className="text-[10px] text-muted-foreground">Salary Range</p>
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="text-sm font-medium mb-2">Open Positions</h4>
          <div className="space-y-1.5">
            {insights.topRoles.map((role) => (
              <div
                key={role.title}
                className="flex items-center justify-between py-1">
                <span className="text-sm text-foreground">{role.title}</span>
                <Badge variant="secondary" className="text-xs">
                  {role.count} {role.count === 1 ? 'role' : 'roles'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
