import { describe, expect, it } from "vitest";
import {
  designState,
  friendlyLabels,
  renderFriendlyText,
  renderMetaText,
  slugifyName,
  toFriendlyBody,
  toMetaBody,
  validateDesignText,
} from "@/lib/designs/text";

describe("friendly placeholders", () => {
  it("numbers labels in order of first appearance and reuses repeats", () => {
    const { body, variables } = toMetaBody("Hi {{Name}}, get {{Offer}} today. {{Name}}, hurry!", { offer: "20% off" });
    expect(body).toBe("Hi {{1}}, get {{2}} today. {{1}}, hurry!");
    expect(variables).toEqual([
      { label: "Name", kind: "name", sample: "Priya" },
      { label: "Offer", kind: "detail", sample: "20% off" },
    ]);
  });

  it("round-trips back to friendly text", () => {
    const { body, variables } = toMetaBody("Hi {{Name}}, your {{Due date}} reminder.");
    expect(toFriendlyBody(body, variables)).toBe("Hi {{Name}}, your {{Due date}} reminder.");
  });

  it("treats labels case-insensitively", () => {
    expect(friendlyLabels("{{offer}} and {{Offer}}")).toEqual(["offer"]);
  });

  it("renders previews with samples and placeholders for blanks", () => {
    expect(renderFriendlyText("Hi {{Name}}, {{Offer}}!", { offer: "10% off" })).toBe("Hi Priya, 10% off!");
    expect(renderMetaText("Hi {{1}}, {{2}}", ["Ravi"], ["Name", "Offer"])).toBe("Hi Ravi, [Offer]");
  });
});

describe("validation", () => {
  it("rejects a placeholder at the start or end", () => {
    expect(validateDesignText({ body: "{{Name}} welcome to our shop today" })).toContain("Start the message with a word, not a placeholder.");
    expect(validateDesignText({ body: "Welcome to our shop {{Name}}" }).some((p) => p.startsWith("End the message"))).toBe(true);
  });
  it("rejects adjacent placeholders", () => {
    expect(validateDesignText({ body: "Hi there {{Name}} {{Offer}} is waiting for you today." })).toContain("Put at least one word between two placeholders.");
  });
  it("accepts a normal message", () => {
    expect(validateDesignText({ body: "Hi {{Name}}, your appointment is on {{Date}}. See you soon." })).toEqual([]);
  });
});

describe("misc", () => {
  it("slugifies titles for WhatsApp", () => {
    expect(slugifyName("Diwali Offer 2026!")).toBe("diwali_offer_2026");
    expect(slugifyName("   ")).toBe("message");
  });
  it("maps statuses to plain states", () => {
    expect(designState("APPROVED")).toBe("ready");
    expect(designState("PENDING")).toBe("review");
    expect(designState("REJECTED")).toBe("changes");
    expect(designState(undefined)).toBe("draft");
  });
});
