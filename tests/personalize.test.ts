import { describe, expect, it } from "vitest";
import { firstName, resolveParams, validateMappings } from "@/lib/campaigns/personalize";

describe("personalisation", () => {
  it("uses first names with a fallback", () => {
    expect(firstName("Priya Sharma")).toBe("Priya");
    expect(firstName("Customer")).toBe("");
    expect(
      resolveParams(
        [
          { source: "first_name", fallback: "there" },
          { source: "text", value: "20% off" },
          { source: "city", fallback: "your city" },
        ],
        { name: "Customer", city: null },
      ),
    ).toEqual(["there", "20% off", "your city"]);
  });

  it("requires text values and fallbacks", () => {
    const vars = [
      { label: "Name", kind: "name" as const },
      { label: "Offer", kind: "detail" as const },
    ];
    expect(validateMappings(vars, [{ source: "first_name", fallback: "" }, { source: "text", value: "x" }])).toMatch(/backup/);
    expect(validateMappings(vars, [{ source: "first_name", fallback: "there" }, { source: "text", value: " " }])).toBe('Fill in "Offer".');
    expect(validateMappings(vars, [{ source: "first_name", fallback: "there" }, { source: "text", value: "x" }])).toBeNull();
  });
});
