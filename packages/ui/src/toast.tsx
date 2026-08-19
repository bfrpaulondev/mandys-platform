"use client";

import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";

import { cn } from "./cn";

type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; message: string; tone: ToastTone };
type ToastApi = { success: (message: string) => void; error: (message: string) => void; info: (message: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const push = useCallback((message: string, tone: ToastTone) => {
    const id = ++idRef.current;
    setItems((current) => [...current.slice(-3), { id, message, tone }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4200);
  }, []);

  const api = useMemo<ToastApi>(() => ({
    success: (message) => push(message, "success"),
    error: (message) => push(message, "error"),
    info: (message) => push(message, "info"),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 bottom-3 z-[100] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[min(24rem,calc(100vw-2rem))]" aria-label="Notifications">
        {items.map((item) => (
          <div key={item.id} data-toast data-toast-tone={item.tone} role={item.tone === "error" ? "alert" : "status"} className={cn("pointer-events-auto flex w-full items-start gap-3 rounded-[var(--mandys-radius-md)] border bg-[var(--mandys-surface)] px-4 py-3 text-sm shadow-[var(--mandys-shadow-md)]", item.tone === "error" ? "border-[var(--mandys-danger)]/40" : "border-[var(--mandys-border)]")}>
            <span aria-hidden="true" className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", item.tone === "success" ? "bg-emerald-500" : item.tone === "error" ? "bg-[var(--mandys-danger)]" : "bg-[var(--mandys-accent)]")} />
            <span className="min-w-0 flex-1 leading-5">{item.message}</span>
            <button type="button" className="-m-2 min-h-11 min-w-11 rounded-lg text-lg text-[var(--mandys-foreground-muted)] hover:bg-[var(--mandys-surface-muted)]" aria-label="Dismiss notification" onClick={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}
