import type { ReactNode } from "react";

import { Button } from "./button";
import { cn } from "./cn";
import { Surface } from "./surface";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("mandys-skeleton rounded-[var(--mandys-radius-sm)] bg-[var(--mandys-surface-muted)]", className)} />;
}

export function LoadingState({ label, rows = 3, className }: { label: string; rows?: number; className?: string }) {
  return (
    <Surface data-loading-state role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      <div className="space-y-3">
        <Skeleton className="h-5 w-2/5 max-w-48" />
        {Array.from({ length: rows }, (_, index) => <Skeleton key={index} className={cn("h-12 w-full", index === rows - 1 && "w-4/5")} />)}
      </div>
    </Surface>
  );
}

export function EmptyState({ title, description, action, className }: { title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <Surface data-empty-state variant="dashed" padding="lg" className={cn("text-center", className)}>
      <h2 className="text-base font-semibold">{title}</h2>
      {description ? <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--mandys-foreground-muted)]">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </Surface>
  );
}

export function ErrorState({ title, description, retryLabel, onRetry, className }: { title: string; description?: string; retryLabel?: string; onRetry?: () => void; className?: string }) {
  return (
    <Surface data-error-state role="alert" className={cn("border-[var(--mandys-danger)]/30", className)}>
      <h2 className="font-semibold">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-6 text-[var(--mandys-foreground-muted)]">{description}</p> : null}
      {onRetry && retryLabel ? <Button className="mt-4" variant="secondary" size="sm" onClick={onRetry}>{retryLabel}</Button> : null}
    </Surface>
  );
}
