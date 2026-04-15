import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all [&>svg]:pointer-events-none [&>svg]:!size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        destructive:
        "bg-destructive/10 text-destructive dark:bg-destructive/20",
        outline: "border-border text-foreground"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

interface BadgeProps extends
  React.HTMLAttributes<HTMLSpanElement>,
  VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <span
        ref={ref}
        data-slot="badge"
        data-variant={variant}
        className={cn(badgeVariants({ variant }), className)}
        {...props} />);


  }
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
export type { BadgeProps };