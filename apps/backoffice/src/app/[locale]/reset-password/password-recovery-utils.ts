export type PasswordResetValidationCode = "TOKEN_REQUIRED" | "NEW_LENGTH" | "CONFIRM_MISMATCH";

export function validatePasswordReset(input: {
  token: string;
  newPassword: string;
  confirmPassword: string;
}) {
  if (!input.token.trim()) {
    return { ok: false as const, code: "TOKEN_REQUIRED" as const };
  }
  if (input.newPassword.length < 8 || input.newPassword.length > 128) {
    return { ok: false as const, code: "NEW_LENGTH" as const };
  }
  if (input.newPassword !== input.confirmPassword) {
    return { ok: false as const, code: "CONFIRM_MISMATCH" as const };
  }
  return { ok: true as const };
}
