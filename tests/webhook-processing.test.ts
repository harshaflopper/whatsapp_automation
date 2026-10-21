import { describe, expect, it } from "vitest";
import { isStartKeyword, isStopKeyword, nextStatus } from "@/lib/services/webhook-processor";

describe("delivery status ordering", () => {
  it("only moves forward", () => {
    expect(nextStatus("SENT", "delivered")).toBe("DELIVERED");
    expect(nextStatus("READ", "delivered")).toBeNull();
    expect(nextStatus("DELIVERED", "sent")).toBeNull();
    expect(nextStatus("SENT", "read")).toBe("READ");
  });
  it("ignores a failure after delivery, accepts a late success after failure", () => {
    expect(nextStatus("DELIVERED", "failed")).toBeNull();
    expect(nextStatus("SENT", "failed")).toBe("FAILED");
    expect(nextStatus("FAILED", "read")).toBe("READ");
  });
});

describe("opt-out keywords", () => {
  it("recognises STOP variants only as whole replies", () => {
    expect(isStopKeyword("STOP")).toBe(true);
    expect(isStopKeyword(" stop. ")).toBe(true);
    expect(isStopKeyword("Unsubscribe")).toBe(true);
    expect(isStopKeyword("please don't stop the offers")).toBe(false);
    expect(isStartKeyword("START")).toBe(true);
  });
});
