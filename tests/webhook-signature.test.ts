import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyMetaSignature } from "@/lib/messaging/meta/meta-provider";

const SECRET = "test_app_secret";
const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "1", changes: [] }] });
const sign = (raw: string, secret = SECRET) =>
  `sha256=${createHmac("sha256", secret).update(raw, "utf8").digest("hex")}`;

describe("verifyMetaSignature", () => {
  it("accepts a valid signature over the raw body", () => {
    expect(verifyMetaSignature(body, sign(body), SECRET)).toBe(true);
  });

  it("accepts an upper-case hex digest", () => {
    const digest = sign(body).slice("sha256=".length).toUpperCase();
    expect(verifyMetaSignature(body, `sha256=${digest}`, SECRET)).toBe(true);
  });

  it("rejects a signature made with a different secret", () => {
    expect(verifyMetaSignature(body, sign(body, "other"), SECRET)).toBe(false);
  });

  it("rejects when the body was re-serialised (raw body must be used)", () => {
    const reformatted = JSON.stringify(JSON.parse(body), null, 2);
    expect(verifyMetaSignature(reformatted, sign(body), SECRET)).toBe(false);
  });

  it.each([null, "", "sha256=", "sha1=abcd", "sha256=zz", `md5=${"a".repeat(64)}`, `sha256=${"a".repeat(63)}`])(
    "rejects malformed header %j",
    (header) => {
      expect(verifyMetaSignature(body, header, SECRET)).toBe(false);
    },
  );

  it("rejects everything when the app secret is empty", () => {
    expect(verifyMetaSignature(body, sign(body, ""), "")).toBe(false);
  });

  it("handles non-ASCII bodies (Kannada/Hindi text, emoji)", () => {
    const raw = JSON.stringify({ text: "ನಮಸ್ಕಾರ नमस्ते 🎉" });
    expect(verifyMetaSignature(raw, sign(raw), SECRET)).toBe(true);
  });
});
