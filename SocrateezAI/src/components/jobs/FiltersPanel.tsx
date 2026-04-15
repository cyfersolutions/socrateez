import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SlidersHorizontal,
  X,
  Search,
  Wifi,
  Briefcase,
  Cpu,
  MapPin,
  Building2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../Card';
import { Button } from '../Button';
import { Separator } from '../Separator';
import { Badge } from '../Badge';
import { Input } from '../Input';
import { searchFacet, type FacetOption, type JobTypeFacet } from '../../lib/api';

export interface FilterState {
  cities: string[];
  salaryRange: [number, number];
  companies: string[];
  jobTypes: string[];
  skills: string[];
  isRemote: boolean | null;
}

export const defaultFilters: FilterState = {
  cities: [],
  salaryRange: [40000, 200000],
  companies: [],
  jobTypes: [],
  skills: [],
  isRemote: null,
};

interface FiltersPanelProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onClear: () => void;
  cities: FacetOption[];
  companies: FacetOption[];
  jobTypes: JobTypeFacet[];
  topSkills: FacetOption[];
  remoteCount: number;
  totalCount: number;
  salaryBounds?: [number, number];
  facetsLoading?: boolean;
}

const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
  freelance: 'Freelance',
};

function toggleItem(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function FacetSearch({
  type,
  placeholder,
  selected,
  onToggle,
  initialOptions,
  icon: Icon,
}: {
  type: 'company' | 'city' | 'skill';
  placeholder: string;
  selected: string[];
  onToggle: (name: string) => void;
  initialOptions: FacetOption[];
  icon: typeof Search;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FacetOption[]>([]);
  const [searching, setSearching] = useState(false);
  const debouncedQ = useDebounce(query, 300);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!debouncedQ.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    searchFacet(type, debouncedQ, 20)
      .then((r) => {
        if (!cancelled) setResults(r);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQ, type]);

  const options = debouncedQ.trim() ? results : initialOptions;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Icon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 pl-8 text-xs"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Selected pills */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((s) => (
            <Badge
              key={s}
              variant="default"
              className="text-[10px] gap-1 cursor-pointer"
              onClick={() => onToggle(s)}
            >
              {s}
              <X className="h-2.5 w-2.5" />
            </Badge>
          ))}
        </div>
      )}

      {/* Options list */}
      {searching && (
        <p className="text-[10px] text-muted-foreground px-1">Searching...</p>
      )}
      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
        {options
          .filter((o) => !selected.includes(o.name))
          .map((opt) => (
            <button
              key={opt.name}
              type="button"
              onClick={() => onToggle(opt.name)}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              {opt.name}
              <span className="text-[9px] opacity-60">{opt.count}</span>
            </button>
          ))}
        {!searching && options.length === 0 && debouncedQ.trim() && (
          <p className="text-[10px] text-muted-foreground px-1">No matches</p>
        )}
      </div>
    </div>
  );
}

export function FiltersPanel({
  filters,
  onFilterChange,
  onClear,
  cities,
  companies,
  jobTypes,
  topSkills,
  remoteCount,
  totalCount,
  facetsLoading = false,
}: FiltersPanelProps) {
  const activeFilterCount =
    filters.cities.length +
    filters.companies.length +
    filters.jobTypes.length +
    filters.skills.length +
    (filters.isRemote !== null ? 1 : 0);

  const handleToggle = useCallback(
    (key: 'cities' | 'companies' | 'skills', name: string) => {
      onFilterChange({
        ...filters,
        [key]: toggleItem(filters[key], name),
      });
    },
    [filters, onFilterChange]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Filters</CardTitle>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </div>
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={onClear}
              className="text-muted-foreground text-xs"
            >
              Clear all
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {facetsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Remote toggle */}
            <div>
              <h3 className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
                <Wifi className="h-3.5 w-3.5" /> Work Type
              </h3>
              <div className="flex gap-1.5">
                <Button
                  variant={filters.isRemote === null ? 'default' : 'outline'}
                  size="xs"
                  className="text-xs"
                  onClick={() =>
                    onFilterChange({ ...filters, isRemote: null })
                  }
                >
                  All
                </Button>
                <Button
                  variant={filters.isRemote === true ? 'default' : 'outline'}
                  size="xs"
                  className="text-xs"
                  onClick={() =>
                    onFilterChange({
                      ...filters,
                      isRemote: filters.isRemote === true ? null : true,
                    })
                  }
                >
                  Remote
                  <span className="ml-1 text-[9px] opacity-60">
                    {remoteCount}
                  </span>
                </Button>
                <Button
                  variant={filters.isRemote === false ? 'default' : 'outline'}
                  size="xs"
                  className="text-xs"
                  onClick={() =>
                    onFilterChange({
                      ...filters,
                      isRemote: filters.isRemote === false ? null : false,
                    })
                  }
                >
                  On-site
                  <span className="ml-1 text-[9px] opacity-60">
                    {totalCount - remoteCount}
                  </span>
                </Button>
              </div>
            </div>

            <Separator />

            {/* Job Type */}
            <div>
              <h3 className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5" /> Job Type
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {jobTypes.map((jt) => (
                  <Button
                    key={jt.type}
                    variant={
                      filters.jobTypes.includes(jt.type)
                        ? 'default'
                        : 'outline'
                    }
                    size="xs"
                    className="text-xs"
                    onClick={() =>
                      onFilterChange({
                        ...filters,
                        jobTypes: toggleItem(filters.jobTypes, jt.type),
                      })
                    }
                  >
                    {JOB_TYPE_LABELS[jt.type] || jt.type}
                    <span className="ml-1 text-[9px] opacity-60">
                      {jt.count}
                    </span>
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Company search */}
            <div>
              <h3 className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> Company
              </h3>
              <FacetSearch
                type="company"
                placeholder="Search companies..."
                selected={filters.companies}
                onToggle={(name) => handleToggle('companies', name)}
                initialOptions={companies}
                icon={Search}
              />
            </div>

            <Separator />

            {/* City search */}
            <div>
              <h3 className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> City
              </h3>
              <FacetSearch
                type="city"
                placeholder="Search cities..."
                selected={filters.cities}
                onToggle={(name) => handleToggle('cities', name)}
                initialOptions={cities}
                icon={Search}
              />
            </div>

            <Separator />

            {/* Skills search */}
            <div>
              <h3 className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5" /> Skills
              </h3>
              <FacetSearch
                type="skill"
                placeholder="Search skills..."
                selected={filters.skills}
                onToggle={(name) => handleToggle('skills', name)}
                initialOptions={topSkills}
                icon={Search}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
