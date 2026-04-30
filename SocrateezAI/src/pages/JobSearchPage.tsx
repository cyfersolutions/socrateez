import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  SlidersHorizontal,
  Users,
  Wifi,
  Briefcase,
  Cpu,
  X,
} from 'lucide-react';
import { Button } from '../components/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/Tabs';
import { SearchBar } from '../components/jobs/SearchBar';
import { FiltersPanel, defaultFilters } from '../components/jobs/FiltersPanel';
import type { FilterState } from '../components/jobs/FiltersPanel';
import { SearchAnalytics } from '../components/jobs/SearchAnalytics';
import { JobResultsTable } from '../components/jobs/JobResultsTable';
import { CompanyInsights } from '../components/jobs/CompanyInsights';
import { CandidatesList } from '../components/jobs/CandidatesList';
import { Card, CardContent } from '../components/Card';
import { Badge } from '../components/Badge';
import {
  fetchJobFacets,
  fetchJobSearch,
  type JobSearchItem,
  type JobSearchPayload,
  type FacetOption,
  type JobTypeFacet,
} from '../lib/api';
import type { Candidate } from '../lib/mockData';

type Job = JobSearchItem;
const JOBS_PER_PAGE = 10;

function hasActiveQuery(
  appliedKeyword: string,
  appliedLocation: string,
  filters: FilterState,
  salaryBounds: [number, number]
): boolean {
  if (appliedKeyword.trim() !== '') return true;
  if (appliedLocation.trim() !== '') return true;
  if (filters.cities.length > 0) return true;
  if (filters.companies.length > 0) return true;
  if (filters.jobTypes.length > 0) return true;
  if (filters.skills.length > 0) return true;
  if (filters.isRemote !== null) return true;
  if (
    filters.salaryRange[0] !== salaryBounds[0] ||
    filters.salaryRange[1] !== salaryBounds[1]
  ) {
    return true;
  }
  return false;
}

const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
  freelance: 'Freelance',
};

export function JobSearchPage() {
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [appliedLocation, setAppliedLocation] = useState('');
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [sortField, setSortField] = useState('postedDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [searchJobs, setSearchJobs] = useState<Job[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [salaryStats, setSalaryStats] =
    useState<JobSearchPayload['salaryStats']>();
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Facet data from DB
  const [facetCities, setFacetCities] = useState<FacetOption[]>([]);
  const [facetCompanies, setFacetCompanies] = useState<FacetOption[]>([]);
  const [facetJobTypes, setFacetJobTypes] = useState<JobTypeFacet[]>([]);
  const [facetSkills, setFacetSkills] = useState<FacetOption[]>([]);
  const [salaryBounds, setSalaryBounds] = useState<[number, number]>([
    40000, 200000,
  ]);
  const [facetsLoading, setFacetsLoading] = useState(true);
  const [facetsError, setFacetsError] = useState<string | null>(null);

  const shouldRunSearch = useMemo(
    () =>
      hasActiveQuery(appliedKeyword, appliedLocation, filters, salaryBounds),
    [appliedKeyword, appliedLocation, filters, salaryBounds]
  );

  // Load facets on mount
  useEffect(() => {
    let cancelled = false;
    setFacetsLoading(true);
    setFacetsError(null);
    fetchJobFacets()
      .then((data) => {
        if (cancelled) return;
        const bounds =
          Array.isArray(data.salaryRange) && data.salaryRange.length === 2
            ? ([
                Math.round(data.salaryRange[0]),
                Math.round(data.salaryRange[1]),
              ] as [number, number])
            : ([40000, 200000] as [number, number]);
        setFacetCities(data.cities || []);
        setFacetCompanies(data.companies || []);
        setFacetJobTypes(data.jobTypes || []);
        setFacetSkills(data.skills || []);
        setSalaryBounds(bounds);
        setFilters((prev) => {
          const untouched =
            prev.salaryRange[0] === defaultFilters.salaryRange[0] &&
            prev.salaryRange[1] === defaultFilters.salaryRange[1];
          if (untouched) return { ...prev, salaryRange: bounds };
          return prev;
        });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setFacetsError(err.message ?? 'Failed to load filter options');
      })
      .finally(() => {
        if (!cancelled) setFacetsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSearch = useCallback(() => {
    setAppliedKeyword(keyword);
    setAppliedLocation(location);
    setCurrentPage(1);
  }, [keyword, location]);

  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({
      ...defaultFilters,
      salaryRange: [salaryBounds[0], salaryBounds[1]],
    });
    setCurrentPage(1);
  }, [salaryBounds]);

  const handleSort = useCallback(
    (field: string) => {
      if (sortField === field) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDirection('desc');
      }
      setCurrentPage(1);
    },
    [sortField]
  );

  const handleJobClick = useCallback((job: Job) => {
    setSelectedCompany(job.company);
  }, []);

  const isSalaryAtBounds =
    filters.salaryRange[0] === salaryBounds[0] &&
    filters.salaryRange[1] === salaryBounds[1];

  // Run search whenever deps change
  useEffect(() => {
    if (!shouldRunSearch) {
      setSearchJobs([]);
      setTotalJobs(0);
      setSalaryStats(undefined);
      setLoadError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    fetchJobSearch({
      keyword: appliedKeyword,
      location: appliedLocation,
      cities: filters.cities,
      companies: filters.companies,
      jobTypes: filters.jobTypes,
      skills: filters.skills,
      isRemote: filters.isRemote ?? undefined,
      minSalary: isSalaryAtBounds ? undefined : filters.salaryRange[0],
      maxSalary: isSalaryAtBounds ? undefined : filters.salaryRange[1],
      sortField,
      sortDirection,
      limit: 5000,
    })
      .then((res) => {
        if (cancelled) return;
        setSearchJobs(res.items);
        setTotalJobs(res.total);
        setSalaryStats(res.salaryStats);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setSearchJobs([]);
        setTotalJobs(0);
        setSalaryStats(undefined);
        setLoadError(err.message || 'Failed to load jobs');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    shouldRunSearch,
    appliedKeyword,
    appliedLocation,
    filters,
    isSalaryAtBounds,
    sortField,
    sortDirection,
  ]);

  const sortedJobs = searchJobs;
  const totalPages = Math.max(1, Math.ceil(sortedJobs.length / JOBS_PER_PAGE));
  const paginatedJobs = useMemo(() => {
    const start = (currentPage - 1) * JOBS_PER_PAGE;
    return sortedJobs.slice(start, start + JOBS_PER_PAGE);
  }, [sortedJobs, currentPage]);

  const activeFilterCount =
    filters.cities.length +
    filters.companies.length +
    filters.jobTypes.length +
    filters.skills.length +
    (filters.isRemote !== null ? 1 : 0) +
    (filters.salaryRange[0] !== salaryBounds[0] ||
    filters.salaryRange[1] !== salaryBounds[1]
      ? 1
      : 0);

  const filteredCandidates: Candidate[] = [];

  const filterPanelProps = {
    filters,
    onFilterChange: handleFilterChange,
    onClear: handleClearFilters,
    cities: facetCities,
    companies: facetCompanies,
    jobTypes: facetJobTypes,
    topSkills: facetSkills,
    salaryBounds,
    facetsLoading,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Job Search
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {shouldRunSearch
            ? `Found ${totalJobs.toLocaleString()} job${totalJobs === 1 ? '' : 's'}. ${isLoading ? 'Updating...' : ''}`
            : 'Start typing to search, or use the filters on the left.'}
        </p>
        {facetsError && (
          <p className="text-xs text-destructive mt-1">{facetsError}</p>
        )}
        {shouldRunSearch && loadError && (
          <p className="text-xs text-destructive mt-1">{loadError}</p>
        )}
      </div>

      <SearchBar
        keyword={keyword}
        location={location}
        onKeywordChange={setKeyword}
        onLocationChange={setLocation}
        onSearch={handleSearch}
      />

      {/* Active filter chips (mobile-friendly summary) */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          {filters.isRemote === true && (
            <Badge
              variant="secondary"
              className="gap-1 text-xs cursor-pointer"
              onClick={() =>
                handleFilterChange({ ...filters, isRemote: null })
              }
            >
              <Wifi className="h-3 w-3" /> Remote
              <X className="h-2.5 w-2.5" />
            </Badge>
          )}
          {filters.isRemote === false && (
            <Badge
              variant="secondary"
              className="gap-1 text-xs cursor-pointer"
              onClick={() =>
                handleFilterChange({ ...filters, isRemote: null })
              }
            >
              On-site
              <X className="h-2.5 w-2.5" />
            </Badge>
          )}
          {filters.jobTypes.map((jt) => (
            <Badge
              key={jt}
              variant="secondary"
              className="gap-1 text-xs cursor-pointer"
              onClick={() =>
                handleFilterChange({
                  ...filters,
                  jobTypes: filters.jobTypes.filter((t) => t !== jt),
                })
              }
            >
              <Briefcase className="h-3 w-3" />
              {JOB_TYPE_LABELS[jt] || jt}
              <X className="h-2.5 w-2.5" />
            </Badge>
          ))}
          {filters.companies.map((c) => (
            <Badge
              key={c}
              variant="secondary"
              className="gap-1 text-xs cursor-pointer"
              onClick={() =>
                handleFilterChange({
                  ...filters,
                  companies: filters.companies.filter((x) => x !== c),
                })
              }
            >
              {c}
              <X className="h-2.5 w-2.5" />
            </Badge>
          ))}
          {filters.cities.map((c) => (
            <Badge
              key={c}
              variant="secondary"
              className="gap-1 text-xs cursor-pointer"
              onClick={() =>
                handleFilterChange({
                  ...filters,
                  cities: filters.cities.filter((x) => x !== c),
                })
              }
            >
              {c}
              <X className="h-2.5 w-2.5" />
            </Badge>
          ))}
          {filters.skills.map((s) => (
            <Badge
              key={s}
              variant="secondary"
              className="gap-1 text-xs cursor-pointer"
              onClick={() =>
                handleFilterChange({
                  ...filters,
                  skills: filters.skills.filter((x) => x !== s),
                })
              }
            >
              <Cpu className="h-3 w-3" />
              {s}
              <X className="h-2.5 w-2.5" />
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="xs"
            onClick={handleClearFilters}
            className="text-xs text-muted-foreground"
          >
            Clear all
          </Button>
        </div>
      )}

      <div className="lg:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowMobileFilters(!showMobileFilters)}
          className="gap-2"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-medium">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {showMobileFilters && (
        <div className="lg:hidden">
          <FiltersPanel {...filterPanelProps} />
        </div>
      )}

      <div className="flex gap-6">
        <aside className="hidden lg:block w-72 shrink-0">
          <div className="sticky top-20">
            <FiltersPanel {...filterPanelProps} />
          </div>
        </aside>

        <div className="flex-1 min-w-0 space-y-6">
          <Tabs defaultValue="jobs">
            <TabsList>
              <TabsTrigger value="jobs" className="gap-1.5">
                <Search className="h-3.5 w-3.5" />
                Jobs
                <span className="ml-1 text-xs text-muted-foreground">
                  ({shouldRunSearch ? totalJobs.toLocaleString() : 0})
                </span>
              </TabsTrigger>
              <TabsTrigger value="candidates" className="gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Candidates
                <span className="ml-1 text-xs text-muted-foreground">(0)</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="jobs" className="space-y-6 mt-4">
              {!shouldRunSearch ? (
                <Card>
                  <CardContent className="py-10">
                    <p className="text-sm text-muted-foreground text-center max-w-md mx-auto">
                      Use the search bar or adjust filters (job type, company,
                      city, skills, remote) to load job listings.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <SearchAnalytics
                    jobs={searchJobs}
                    salaryStats={salaryStats}
                  />
                  <JobResultsTable
                    jobs={paginatedJobs}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    onJobClick={handleJobClick}
                    totalFiltered={totalJobs}
                  />
                  {selectedCompany && (
                    <CompanyInsights
                      companyName={selectedCompany}
                      jobs={searchJobs}
                      onClose={() => setSelectedCompany(null)}
                    />
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="candidates" className="mt-4">
              <CandidatesList candidates={filteredCandidates} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
