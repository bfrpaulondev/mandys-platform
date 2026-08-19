import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

type SurfaceVariant = "solid" | "dashed";
type SurfacePadding = "none" | "sm" | "md" | "lg";

const paddingClasses: Record<SurfacePadding, string> = {
  none: "p-0",
  sm: "p-4",
  md: "p-5 sm:p-6",
  lg: "p-8",
};

export type SurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "section" | "article";
  variant?: SurfaceVariant;
  padding?: SurfacePadding;
  children: ReactNode;
};

export function Surface({
  as: Component = "section",
  variant = "solid",
  padding = "md",
  className,
  children,
  ...props
}: SurfaceProps) {
  return (
    <Component
      className={cn(
        "rounded-[var(--mandys-radius-lg)] border bg-[var(--mandys-surface)]",
        variant === "dashed" ? "border-dashed border-[var(--mandys-border)]" : "border-[var(--mandys-border)]",
        paddingClasses[padding],
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
