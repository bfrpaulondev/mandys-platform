import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export const pageBackLinkClassName =
  "text-sm font-medium text-[var(--mandys-foreground-muted)] transition hover:text-[var(--mandys-foreground)]";

export type PageShellProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
};

export function PageShell({ className, children, ...props }: PageShellProps) {
  return (
    <main
      className={cn(
        "mx-auto min-h-screen w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8",
        className,
      )}
      {...props}
    >
      {children}
    </main>
  );
}

export type PageHeaderProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  back?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
};

export function PageHeader({
  back,
  eyebrow,
  title,
  subtitle,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header className={cn("mb-8 border-b border-[var(--mandys-border)] pb-6", className)} {...props}>
      {back}
      <div className={back ? "mt-5" : undefined}>
        {eyebrow ? (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mandys-accent)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{title}</h1>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-sm text-[var(--mandys-foreground-muted)]">{subtitle}</p>
        ) : null}
      </div>
    </header>
  );
}
