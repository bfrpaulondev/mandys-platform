import { describe, expect, it } from "vitest";

import { validatePasswordChange } from "./password-utils";

describe("password change validation", () => {
  it("requires the current password", () => {
    expect(validatePasswordChange({ currentPassword: "", newPassword: "bbbbbbbb", confirmPassword: "bbbbbbbb" })).toEqual({ ok: false, code: "CURRENT_REQUIRED" });
  });

  it("enforces Better Auth default password length", () => {
    expect(validatePasswordChange({ currentPassword: "aaaaaaaa", newPassword: "short", confirmPassword: "short" })).toEqual({ ok: false, code: "NEW_LENGTH" });
    expect(validatePasswordChange({ currentPassword: "aaaaaaaa", newPassword: "b".repeat(129), confirmPassword: "b".repeat(129) })).toEqual({ ok: false, code: "NEW_LENGTH" });
  });

  it("rejects reusing the current password", () => {
    expect(validatePasswordChange({ currentPassword: "aaaaaaaa", newPassword: "aaaaaaaa", confirmPassword: "aaaaaaaa" })).toEqual({ ok: false, code: "PASSWORD_REUSED" });
  });

  it("requires confirmation to match", () => {
    expect(validatePasswordChange({ currentPassword: "aaaaaaaa", newPassword: "bbbbbbbb", confirmPassword: "cccccccc" })).toEqual({ ok: false, code: "CONFIRM_MISMATCH" });
  });

  it("accepts a valid password change", () => {
    expect(validatePasswordChange({ currentPassword: "aaaaaaaa", newPassword: "bbbbbbbb", confirmPassword: "bbbbbbbb" })).toEqual({ ok: true });
  });
});
