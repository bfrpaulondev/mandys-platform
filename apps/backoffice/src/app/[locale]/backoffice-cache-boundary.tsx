"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

import { installBackofficeDataCache } from "../../lib/client-data-cache";

export function BackofficeCacheBoundary({ children }: { children: ReactNode }) {
  useEffect(() => installBackofficeDataCache(), []);
  return children;
}
