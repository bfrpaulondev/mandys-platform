import type { RestaurantTheme } from "@mandys/theme-core";

export const minimalTheme = {
  key: "minimal",
  name: "Mandy's Minimal",
  version: "1.0.0",
  included: true,
  tokens: {
    background: "#f7f7f5",
    surface: "#ffffff",
    surfaceMuted: "#f0f0ed",
    foreground: "#171715",
    foregroundMuted: "#6d6d67",
    border: "#e3e3de",
    accent: "#1f6b52",
    accentForeground: "#ffffff",
    danger: "#b42318",
    radiusSm: "0.625rem",
    radiusMd: "0.875rem",
    radiusLg: "1.25rem",
  },
} as const satisfies RestaurantTheme;
