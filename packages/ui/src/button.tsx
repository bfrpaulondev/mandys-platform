import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./cn";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--mandys-radius-sm)] px-4 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--mandys-accent)] text-[var(--mandys-accent-foreground)] hover:brightness-95",
        secondary:
          "border border-[var(--mandys-border)] bg-[var(--mandys-surface)] text-[var(--mandys-foreground)] hover:bg-[var(--mandys-surface-muted)]",
        ghost:
          "bg-transparent text-[var(--mandys-foreground)] hover:bg-[var(--mandys-surface-muted)]",
        danger: "bg-[var(--mandys-danger)] text-white hover:brightness-95",
      },
      size: {
        sm: "min-h-9 px-3 text-xs",
        md: "min-h-11 px-4 text-sm",
        lg: "min-h-12 px-5 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      type={type}
      {...props}
    />
  );
}
