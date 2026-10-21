import { describe, expect, it } from "vitest";
import {
  assertCanSend,
  ComplianceError,
  isWithinServiceWindow,
  serviceWindowRemainingMs,
} from "@/lib/messaging/compliance";

const now = new Date("2026-10-20T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);

function codeOf(fn: () => void) {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof ComplianceError ? e.code : "OTHER";
  }
}

describe("24h customer service window", () => {
  it("is open right after an inbound message", () => {
    expect(isWithinServiceWindow(hoursAgo(0), now)).toBe(true);
  });
  it("is open at 23h59m", () => {
    expect(isWithinServiceWindow(new Date(now.getTime() - (24 * 3600_000 - 60_000)), now)).toBe(true);
  });
  it("is closed at exactly 24h", () => {
    expect(isWithinServiceWindow(hoursAgo(24), now)).toBe(false);
  });
  it("is closed when the contact never messaged us", () => {
    expect(isWithinServiceWindow(null, now)).toBe(false);
  });
  it("treats future timestamps (clock skew) as closed", () => {
    expect(isWithinServiceWindow(new Date(now.getTime() + 60_000), now)).toBe(false);
  });
  it("reports remaining time", () => {
    expect(serviceWindowRemainingMs(hoursAgo(20), now)).toBe(4 * 3600_000);
    expect(serviceWindowRemainingMs(hoursAgo(30), now)).toBe(0);
  });
});

describe("assertCanSend (opt-out blocking)", () => {
  const optedIn = { optedIn: true, optedOutAt: null, lastInboundAt: null };
  const optedOut = { optedIn: false, optedOutAt: hoursAgo(1), lastInboundAt: hoursAgo(1) };
  const neverOptedIn = { optedIn: false, optedOutAt: null, lastInboundAt: hoursAgo(2) };

  it("allows templates to opted-in contacts", () => {
    expect(codeOf(() => assertCanSend(optedIn, "template", now))).toBeNull();
  });
  it("blocks templates to opted-out contacts", () => {
    expect(codeOf(() => assertCanSend(optedOut, "template", now))).toBe("OPTED_OUT");
  });
  it("blocks templates to contacts who never opted in", () => {
    expect(codeOf(() => assertCanSend(neverOptedIn, "template", now))).toBe("NOT_OPTED_IN");
  });
  it("blocks free text to opted-out contacts even inside the window", () => {
    expect(codeOf(() => assertCanSend(optedOut, "text", now))).toBe("OPTED_OUT");
  });
  it("allows a service reply to someone who messaged first, inside the window", () => {
    expect(codeOf(() => assertCanSend(neverOptedIn, "text", now))).toBeNull();
  });
  it("blocks free text outside the window", () => {
    expect(codeOf(() => assertCanSend({ ...optedIn, lastInboundAt: hoursAgo(25) }, "text", now))).toBe(
      "OUTSIDE_WINDOW",
    );
  });
  it("re-opting in clears the block", () => {
    expect(codeOf(() => assertCanSend({ ...optedOut, optedIn: true }, "template", now))).toBeNull();
  });
});
