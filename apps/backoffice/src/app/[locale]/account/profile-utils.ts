export function normalizeProfileName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function validateProfileName(value: string) {
  const normalized = normalizeProfileName(value);
  if (!normalized) return { ok: false as const, value: normalized };
  if (normalized.length > 100) return { ok: false as const, value: normalized };
  return { ok: true as const, value: normalized };
}
