import React from 'react';
import { Building2, MapPin, Calendar, Mail, User } from 'lucide-react';
import { Card, CardContent } from '../Card';
import { Badge } from '../Badge';
import { Avatar, AvatarFallback } from '../Avatar';
import { Separator } from '../Separator';
import type { Candidate } from '../../lib/mockData';
interface CandidatesListProps {
  candidates: Candidate[];
}
function getInitials(name: string): string {
  return name.
  split(' ').
  map((n) => n[0]).
  join('').
  toUpperCase();
}
function formatTenure(startDate: string): string {
  const start = new Date(startDate);
  const now = new Date();
  const months =
  (now.getFullYear() - start.getFullYear()) * 12 + (
  now.getMonth() - start.getMonth());
  if (months < 1) return 'Just started';
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} year${years === 1 ? '' : 's'}`;
  return `${years}y ${rem}m`;
}
function formatStartDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric'
  });
}
function availabilityVariant(
status: Candidate['availability'])
: 'default' | 'secondary' | 'outline' {
  switch (status) {
    case 'Open to offers':
      return 'default';
    case 'Active':
      return 'secondary';
    case 'Not looking':
      return 'outline';
    default:
      return 'outline';
  }
}
export function CandidatesList({ candidates }: CandidatesListProps) {
  if (candidates.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <User className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-base font-medium text-foreground mb-1">
              No candidates found
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              No candidates match your search. Try a different role or keyword.
            </p>
          </div>
        </CardContent>
      </Card>);

  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Found{' '}
        <span className="font-medium text-foreground">{candidates.length}</span>{' '}
        candidate{candidates.length !== 1 ? 's' : ''}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {candidates.map((candidate) =>
        <Card
          key={candidate.id}
          className="hover:shadow-md transition-shadow">
          
            <CardContent className="pt-5 pb-4">
              <div className="flex gap-3">
                {/* Avatar */}
                <Avatar size="lg">
                  <AvatarFallback className="text-sm font-medium">
                    {getInitials(candidate.name)}
                  </AvatarFallback>
                </Avatar>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground truncate">
                        {candidate.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {candidate.title}
                      </p>
                    </div>
                    <Badge
                    variant={availabilityVariant(candidate.availability)}
                    className="text-[10px] shrink-0">
                    
                      {candidate.availability}
                    </Badge>
                  </div>

                  <div className="mt-2.5 space-y-1.5">
                    {/* Company & Tenure */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-medium text-foreground">
                        {candidate.company}
                      </span>
                      <span>·</span>
                      <span>Since {formatStartDate(candidate.startDate)}</span>
                      <span className="text-muted-foreground/60">
                        ({formatTenure(candidate.startDate)})
                      </span>
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span>{candidate.location}</span>
                    </div>

                    {/* Experience */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>{candidate.experience} level</span>
                    </div>
                  </div>

                  {/* Skills */}
                  <div className="flex flex-wrap gap-1 mt-3">
                    {candidate.skills.map((skill) =>
                  <Badge
                    key={skill}
                    variant="outline"
                    className="text-[10px] px-1.5 py-0">
                    
                        {skill}
                      </Badge>
                  )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>);

}