import React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "../../lib/utils";

const Pagination = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) =>
  <nav ref={ref} role="navigation" aria-label="pagination" className={cn("mx-auto flex w-full justify-center", className)} {...props} />

);
Pagination.displayName = "Pagination";

const PaginationContent = React.forwardRef<HTMLUListElement, React.HTMLAttributes<HTMLUListElement>>(
  ({ className, ...props }, ref) =>
  <ul ref={ref} className={cn("flex flex-row items-center gap-1", className)} {...props} />

);
PaginationContent.displayName = "PaginationContent";

const PaginationItem = React.forwardRef<HTMLLIElement, React.LiHTMLAttributes<HTMLLIElement>>(
  (props, ref) => <li ref={ref} {...props} />
);
PaginationItem.displayName = "PaginationItem";

interface PaginationLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  isActive?: boolean;
}

const PaginationLink = React.forwardRef<HTMLAnchorElement, PaginationLinkProps>(
  ({ className, isActive, ...props }, ref) =>
  <a
    ref={ref}
    aria-current={isActive ? "page" : undefined}
    className={cn(
      "inline-flex size-8 items-center justify-center rounded-lg text-sm font-medium whitespace-nowrap transition-all",
      isActive ?
      "border border-border bg-background hover:bg-muted" :
      "hover:bg-muted hover:text-foreground",
      className
    )}
    {...props} />


);
PaginationLink.displayName = "PaginationLink";

const PaginationPrevious = React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
  ({ className, ...props }, ref) =>
  <a
    ref={ref}
    aria-label="Go to previous page"
    className={cn("inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-sm font-medium hover:bg-muted", className)}
    {...props}>
    
      <ChevronLeft className="size-4" />
      <span>Previous</span>
    </a>

);
PaginationPrevious.displayName = "PaginationPrevious";

const PaginationNext = React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
  ({ className, ...props }, ref) =>
  <a
    ref={ref}
    aria-label="Go to next page"
    className={cn("inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-sm font-medium hover:bg-muted", className)}
    {...props}>
    
      <span>Next</span>
      <ChevronRight className="size-4" />
    </a>

);
PaginationNext.displayName = "PaginationNext";

const PaginationEllipsis = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) =>
  <span ref={ref} aria-hidden className={cn("flex size-8 items-center justify-center", className)} {...props}>
      <MoreHorizontal className="size-4" />
      <span className="sr-only">More pages</span>
    </span>

);
PaginationEllipsis.displayName = "PaginationEllipsis";

export { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis };