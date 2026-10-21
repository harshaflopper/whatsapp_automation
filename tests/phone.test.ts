import { describe, expect, it } from "vitest";
import { normalizePhone } from "@/lib/phone";

describe("normalizePhone", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["98765 43210", "+919876543210"],
    ["098765-43210", "+919876543210"],
    ["+91 98765 43210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["0091 9876543210", "+919876543210"],
    ["(+91) 98765-43210", "+919876543210"],
    ["+1 415 555 2671", "+14155552671"],
    ["+44 7400 123456", "+447400123456"],
  ])("normalises %s → %s", (input, expected) => {
    expect(normalizePhone(input)).toEqual({ ok: true, e164: expected });
  });

  it.each(["", "   ", "12345", "abcdefghij", "+91 12345", "98765432101234"])("rejects %j", (input) => {
    expect(normalizePhone(input).ok).toBe(false);
  });
});
