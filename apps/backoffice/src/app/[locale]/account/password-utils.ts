export type PasswordValidationCode =
  | "CURRENT_REQUIRED"
  | "NEW_LENGTH"
  | "PASSWORD_REUSED"
  | "CONFIRM_MISMATCH";

export function validatePasswordChange(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  if (!input.currentPassword) {
    return { ok: false as const, code: "CURRENT_REQUIRED" as const };
  }
  if (input.newPassword.length < 8 || input.newPassword.length > 128) {
    return { ok: false as const, code: "NEW_LENGTH" as const };
  }
  if (input.newPassword === input.currentPassword) {
    return { ok: false as const, code: "PASSWORD_REUSED" as const };
  }
  if (input.newPassword !== input.confirmPassword) {
    return { ok: false as const, code: "CONFIRM_MISMATCH" as const };
  }
  return { ok: true as const };
}
