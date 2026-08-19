import type { ReactNode } from "react";

import { Button } from "./button";
import { cn } from "./cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("mandys-skeleton rounded-lg bg-[var(--mandys-surface-muted)]", className)} />;
}

export function LoadingState({ label, rows = 3, className }: { label: string; rows?: number; className?: string }) {
  return (
    <section data-loading-state role="status" aria-live="polite" aria-busy="true" className={cn("rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-5 sm:p-6", className)}>
      <span className="sr-only">{label}</span>
      <div className="space-y-3">
        <Skeleton className="h-5 w-2/5 max-w-48" />
        {Array.from({ length: rows }, (_, index) => <Skeleton key={index} className={cn("h-12 w-full", index === rows - 1 && "w-4/5")} />)}
      </div>
    </section>
  );
}

export function EmptyState({ title, description, action, className }: { title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <section data-empty-state className={cn("rounded-[var(--mandys-radius-lg)] border border-dashed border-[var(--mandys-border)] bg-[var(--mandys-surface)] p-8 text-center", className)}>
      <h2 className="text-base font-semibold">{title}</h2>
      {description ? <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--mandys-foreground-muted)]">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </section>
  );
}

export function ErrorState({ title, description, retryLabel, onRetry, className }: { title: string; description?: string; retryLabel?: string; onRetry?: () => void; className?: string }) {
  return (
    <section data-error-state role="alert" className={cn("rounded-[var(--mandys-radius-lg)] border border-[var(--mandys-danger)]/30 bg-[var(--mandys-surface)] p-5 sm:p-6", className)}>
      <h2 className="font-semibold">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-6 text-[var(--mandys-foreground-muted)]">{description}</p> : null}
      {onRetry && retryLabel ? <Button className="mt-4" variant="secondary" size="sm" onClick={onRetry}>{retryLabel}</Button> : null}
    </section>
  );
}
