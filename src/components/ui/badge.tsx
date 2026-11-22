import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeStyles = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
  {
    variants: {
      variant: {
        default: "border-primary/40 bg-primary/15 text-primary",
        secondary: "border-border bg-secondary/80 text-secondary-foreground",
        destructive: "border-red-500/40 bg-red-500/15 text-red-300",
        success: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
        warning: "border-amber-500/40 bg-amber-500/15 text-amber-300",
        outline: "border-border bg-transparent text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeStyles> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeStyles({ variant }), className)} {...props} />;
}
