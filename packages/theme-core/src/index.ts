export interface ThemeTokens {
  background: string;
  surface: string;
  surfaceMuted: string;
  foreground: string;
  foregroundMuted: string;
  border: string;
  accent: string;
  accentForeground: string;
  danger: string;
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
}

export interface RestaurantTheme {
  key: string;
  name: string;
  version: string;
  included: boolean;
  tokens: ThemeTokens;
}

export type ThemeOverrides = Partial<ThemeTokens>;

export function resolveThemeTokens(
  theme: RestaurantTheme,
  overrides: ThemeOverrides = {},
): ThemeTokens {
  return { ...theme.tokens, ...overrides };
}

export function toCssVariables(tokens: ThemeTokens): Record<string, string> {
  return {
    "--mandys-background": tokens.background,
    "--mandys-surface": tokens.surface,
    "--mandys-surface-muted": tokens.surfaceMuted,
    "--mandys-foreground": tokens.foreground,
    "--mandys-foreground-muted": tokens.foregroundMuted,
    "--mandys-border": tokens.border,
    "--mandys-accent": tokens.accent,
    "--mandys-accent-foreground": tokens.accentForeground,
    "--mandys-danger": tokens.danger,
    "--mandys-radius-sm": tokens.radiusSm,
    "--mandys-radius-md": tokens.radiusMd,
    "--mandys-radius-lg": tokens.radiusLg,
  };
}
