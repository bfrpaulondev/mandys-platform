import { describe, expect, it } from "vitest";

import { validatePasswordReset } from "./password-recovery-utils";

describe("password reset validation", () => {
  it("requires a reset token", () => {
    expect(validatePasswordReset({ token: "", newPassword: "bbbbbbbb", confirmPassword: "bbbbbbbb" })).toEqual({ ok: false, code: "TOKEN_REQUIRED" });
  });

  it("enforces Better Auth password length", () => {
    expect(validatePasswordReset({ token: "token", newPassword: "short", confirmPassword: "short" })).toEqual({ ok: false, code: "NEW_LENGTH" });
    expect(validatePasswordReset({ token: "token", newPassword: "b".repeat(129), confirmPassword: "b".repeat(129) })).toEqual({ ok: false, code: "NEW_LENGTH" });
  });

  it("requires matching confirmation", () => {
    expect(validatePasswordReset({ token: "token", newPassword: "bbbbbbbb", confirmPassword: "cccccccc" })).toEqual({ ok: false, code: "CONFIRM_MISMATCH" });
  });

  it("accepts a valid reset", () => {
    expect(validatePasswordReset({ token: "token", newPassword: "bbbbbbbb", confirmPassword: "bbbbbbbb" })).toEqual({ ok: true });
  });
});
