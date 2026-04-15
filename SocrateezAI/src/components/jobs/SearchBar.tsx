import { useEffect, useRef, useState } from 'react';
import { Search, MapPin, X } from 'lucide-react';
import { Input } from '../Input';
import { Button } from '../Button';

interface SearchBarProps {
  keyword: string;
  location: string;
  onKeywordChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onSearch: () => void;
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function SearchBar({
  keyword,
  location,
  onKeywordChange,
  onLocationChange,
  onSearch,
}: SearchBarProps) {
  const debouncedKeyword = useDebounce(keyword, 400);
  const debouncedLocation = useDebounce(location, 400);
  const prevRef = useRef({ k: '', l: '' });

  useEffect(() => {
    const changed =
      debouncedKeyword !== prevRef.current.k ||
      debouncedLocation !== prevRef.current.l;
    if (changed && (debouncedKeyword.trim() || debouncedLocation.trim())) {
      prevRef.current = { k: debouncedKeyword, l: debouncedLocation };
      onSearch();
    }
  }, [debouncedKeyword, debouncedLocation, onSearch]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      onSearch();
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          placeholder="Job title, skills, or company..."
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="pl-9 pr-8"
          aria-label="Search by job title, skills, or company"
        />
        {keyword && (
          <button
            type="button"
            onClick={() => onKeywordChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="relative sm:w-64">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          placeholder="City, state, or remote..."
          value={location}
          onChange={(e) => onLocationChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="pl-9 pr-8"
          aria-label="Search by location"
        />
        {location && (
          <button
            type="button"
            onClick={() => onLocationChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <Button onClick={onSearch} className="gap-2 shrink-0">
        <Search className="h-4 w-4" />
        Search
      </Button>
    </div>
  );
}
