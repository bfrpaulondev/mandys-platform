import { describe, expect, it } from "vitest";

import { describeDevice, formatSessionDate } from "./session-utils";

describe("describeDevice", () => {
  it("detects common desktop browsers", () => {
    expect(describeDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36")).toBe("Windows · Chrome");
    expect(describeDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15")).toBe("Mac · Safari");
  });

  it("falls back safely when the user agent is missing", () => {
    expect(describeDevice()).toBe("Dispositivo desconhecido");
  });
});

describe("formatSessionDate", () => {
  it("returns a safe placeholder for invalid dates", () => {
    expect(formatSessionDate("not-a-date", "pt-PT")).toBe("—");
  });
});
