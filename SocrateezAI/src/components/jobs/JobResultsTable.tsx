import { ArrowUpDown, ArrowUp, ArrowDown, Inbox, Wifi } from 'lucide-react';
import { Card, CardContent } from '../Card';
import { Badge } from '../Badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../Table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '../Pagination';
import { formatSalary } from '../../lib/utils';
import type { JobSearchItem } from '../../lib/api';

interface JobResultsTableProps {
  jobs: JobSearchItem[];
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onJobClick: (job: JobSearchItem) => void;
  totalFiltered: number;
}

const JOB_TYPE_COLORS: Record<string, string> = {
  full_time: 'bg-emerald-500/10 text-emerald-700',
  part_time: 'bg-blue-500/10 text-blue-700',
  contract: 'bg-amber-500/10 text-amber-700',
  internship: 'bg-violet-500/10 text-violet-700',
  freelance: 'bg-pink-500/10 text-pink-700',
};

const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
  freelance: 'Freelance',
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr || '—';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function SortIcon({
  field,
  sortField,
  sortDirection,
}: {
  field: string;
  sortField: string;
  sortDirection: 'asc' | 'desc';
}) {
  if (sortField !== field) {
    return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground/50" />;
  }
  return sortDirection === 'asc' ? (
    <ArrowUp className="h-3 w-3 ml-1" />
  ) : (
    <ArrowDown className="h-3 w-3 ml-1" />
  );
}

function generatePageNumbers(
  current: number,
  total: number
): (number | 'ellipsis')[] {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | 'ellipsis')[] = [1];
  if (current > 3) pages.push('ellipsis');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('ellipsis');
  if (total > 1) pages.push(total);
  return pages;
}

export function JobResultsTable({
  jobs,
  sortField,
  sortDirection,
  onSort,
  currentPage,
  totalPages,
  onPageChange,
  onJobClick,
  totalFiltered,
}: JobResultsTableProps) {
  const perPage = 10;
  const startIdx = (currentPage - 1) * perPage + 1;
  const endIdx = Math.min(currentPage * perPage, totalFiltered);

  if (totalFiltered === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <Inbox className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-base font-medium text-foreground mb-1">
              No jobs found
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              No jobs match your current filters. Try adjusting your search
              criteria or clearing some filters.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const pageNumbers = generatePageNumbers(currentPage, totalPages);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing{' '}
          <span className="font-medium text-foreground">
            {startIdx}–{endIdx}
          </span>{' '}
          of{' '}
          <span className="font-medium text-foreground">
            {totalFiltered.toLocaleString()}
          </span>{' '}
          jobs
        </p>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">Job Title</TableHead>
              <TableHead className="hidden sm:table-cell">Company</TableHead>
              <TableHead className="hidden md:table-cell">Location</TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => onSort('salary')}
                  className="flex items-center text-xs font-medium hover:text-foreground transition-colors"
                  aria-label="Sort by salary"
                >
                  Salary
                  <SortIcon
                    field="salary"
                    sortField={sortField}
                    sortDirection={sortDirection}
                  />
                </button>
              </TableHead>
              <TableHead className="hidden lg:table-cell">Type</TableHead>
              <TableHead className="hidden xl:table-cell">Skills</TableHead>
              <TableHead className="hidden lg:table-cell">
                <button
                  type="button"
                  onClick={() => onSort('postedDate')}
                  className="flex items-center text-xs font-medium hover:text-foreground transition-colors"
                  aria-label="Sort by posted date"
                >
                  Posted
                  <SortIcon
                    field="postedDate"
                    sortField={sortField}
                    sortDirection={sortDirection}
                  />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow
                key={job.id}
                className="cursor-pointer"
                onClick={() => onJobClick(job)}
              >
                <TableCell>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-sm text-foreground">
                        {job.title}
                      </p>
                      {job.isRemote && (
                        <Wifi className="h-3 w-3 text-blue-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground sm:hidden">
                      {job.company}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-sm">
                  {job.company}
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {job.isRemote ? 'Remote' : job.location}
                </TableCell>
                <TableCell>
                  <span className="font-mono text-sm font-medium">
                    {formatSalary(job.salary)}
                  </span>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <span
                    className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${JOB_TYPE_COLORS[job.jobType] || 'bg-muted text-muted-foreground'}`}
                  >
                    {JOB_TYPE_LABELS[job.jobType] || job.jobType}
                  </span>
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {(job.skills || []).slice(0, 3).map((skill) => (
                      <Badge
                        key={skill}
                        variant="outline"
                        className="text-[9px] px-1 py-0"
                      >
                        {skill}
                      </Badge>
                    ))}
                    {(job.skills || []).length > 3 && (
                      <span className="text-[9px] text-muted-foreground">
                        +{job.skills.length - 3}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                  {formatDate(job.postedDate)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage > 1) onPageChange(currentPage - 1);
                }}
                aria-disabled={currentPage === 1}
                className={
                  currentPage === 1 ? 'pointer-events-none opacity-50' : ''
                }
              />
            </PaginationItem>
            {pageNumbers.map((page, idx) =>
              page === 'ellipsis' ? (
                <PaginationItem key={`ellipsis-${idx}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={page}>
                  <PaginationLink
                    href="#"
                    isActive={page === currentPage}
                    onClick={(e) => {
                      e.preventDefault();
                      onPageChange(page);
                    }}
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage < totalPages) onPageChange(currentPage + 1);
                }}
                aria-disabled={currentPage === totalPages}
                className={
                  currentPage === totalPages
                    ? 'pointer-events-none opacity-50'
                    : ''
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
