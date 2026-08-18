"use client";

import type { ReactNode } from "react";

import { installBackofficeDataCache } from "../../lib/client-data-cache";

if (typeof window !== "undefined") installBackofficeDataCache();

export function BackofficeCacheBoundary({ children }: { children: ReactNode }) {
  return children;
}
