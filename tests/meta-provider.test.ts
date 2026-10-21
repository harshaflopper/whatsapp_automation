import { describe, expect, it } from "vitest";
import { describeMetaError } from "@/lib/messaging/meta/error-codes";
import {
  buildSendComponents,
  redactSecrets,
  toMetaComponents,
  toMetaRecipient,
} from "@/lib/messaging/meta/meta-provider";
import { parseMetaWebhook } from "@/lib/messaging/meta/webhook";

const wrap = (field: string, value: unknown) => ({
  object: "whatsapp_business_account",
  entry: [{ id: "WABA", changes: [{ field, value }] }],
});

describe("parseMetaWebhook", () => {
  it("parses delivery statuses including failures", () => {
    const events = parseMetaWebhook(
      wrap("messages", {
        statuses: [
          { id: "wamid.A", status: "delivered", timestamp: "1760961600", recipient_id: "919876543210" },
          {
            id: "wamid.B",
            status: "failed",
            timestamp: "1760961601",
            recipient_id: "919876543211",
            errors: [{ code: 131030, title: "Recipient not in allowed list", error_data: { details: "x" } }],
          },
        ],
      }),
    );
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ kind: "status", messageId: "wamid.A", status: "delivered" });
    expect(events[0].kind === "status" && events[0].timestamp.toISOString()).toBe("2025-10-20T12:00:00.000Z");
    expect(events[1]).toMatchObject({ kind: "status", status: "failed", error: { code: "131030", detail: "x" } });
  });

  it("parses inbound text with profile name and E.164 sender", () => {
    const [ev] = parseMetaWebhook(
      wrap("messages", {
        contacts: [{ wa_id: "919876543210", profile: { name: "Priya" } }],
        messages: [
          { from: "919876543210", id: "wamid.IN", timestamp: "1760961600", type: "text", text: { body: "STOP" } },
        ],
      }),
    );
    expect(ev).toMatchObject({ kind: "message", from: "+919876543210", profileName: "Priya", text: "STOP" });
  });

  it("parses quick-reply button taps as text", () => {
    const [ev] = parseMetaWebhook(
      wrap("messages", {
        messages: [{ from: "919876543210", id: "w", timestamp: "1", type: "button", button: { text: "Interested" } }],
      }),
    );
    expect(ev).toMatchObject({ kind: "message", type: "button", text: "Interested" });
  });

  it("parses template status updates", () => {
    const [ev] = parseMetaWebhook(
      wrap("message_template_status_update", {
        event: "REJECTED",
        message_template_id: 12345,
        message_template_name: "diwali_offer",
        message_template_language: "en",
        reason: "INVALID_FORMAT",
      }),
    );
    expect(ev).toEqual({
      kind: "template_status",
      templateId: "12345",
      templateName: "diwali_offer",
      language: "en",
      status: "REJECTED",
      reason: "INVALID_FORMAT",
    });
  });

  it("ignores unrelated objects and junk", () => {
    expect(parseMetaWebhook({ object: "page", entry: [] })).toEqual([]);
    expect(parseMetaWebhook(null)).toEqual([]);
    expect(parseMetaWebhook(wrap("messages", { statuses: [{ id: "x", status: "weird" }] }))).toEqual([]);
  });
});

describe("Meta payload builders", () => {
  it("strips the + for the recipient", () => {
    expect(toMetaRecipient("+919876543210")).toBe("919876543210");
  });

  it("builds send components for header, body and URL buttons", () => {
    expect(buildSendComponents({ header: ["Diwali"], body: ["Priya", "20%"], urlButtons: { 0: "abc" } })).toEqual([
      { type: "header", parameters: [{ type: "text", text: "Diwali" }] },
      { type: "body", parameters: [{ type: "text", text: "Priya" }, { type: "text", text: "20%" }] },
      { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: "abc" }] },
    ]);
    expect(buildSendComponents()).toEqual([]);
  });

  it("builds template components with examples", () => {
    const comps = toMetaComponents({
      name: "t",
      language: "en",
      category: "MARKETING",
      header: "Hi {{1}}",
      body: "Hello {{1}}, {{2}} off",
      footer: "Reply STOP to opt out",
      buttons: [{ type: "QUICK_REPLY", text: "Interested" }],
      examples: { header: ["Priya"], body: ["Priya", "20%"] },
    });
    expect(comps.map((c) => c.type)).toEqual(["HEADER", "BODY", "FOOTER", "BUTTONS"]);
    expect(comps[0]).toMatchObject({ format: "TEXT", example: { header_text: ["Priya"] } });
    expect(comps[1]).toMatchObject({ example: { body_text: [["Priya", "20%"]] } });
  });
});

describe("redactSecrets", () => {
  it("scrubs the configured token and any EAA… token Meta echoes back", () => {
    expect(redactSecrets("Malformed access token EAAfake_token_for_testing", ["EAAfake_token_for_testing"])).toBe(
      "Malformed access token [redacted]",
    );
    expect(redactSecrets("bad token EAAGm0PX4ZCpsBAOtherTokenValue here", [])).toBe("bad token [redacted-token] here");
    expect(redactSecrets("Template name does not exist", ["secret123"])).toBe("Template name does not exist");
  });
});

describe("describeMetaError", () => {
  it("maps the test-number recipient error to a friendly message", () => {
    expect(describeMetaError(131030).friendly).toMatch(/isn't added as a test recipient/);
    expect(describeMetaError(131030).retryable).toBe(false);
  });
  it("retries rate limits and Meta outages", () => {
    expect(describeMetaError(130429).retryable).toBe(true);
    expect(describeMetaError(999999, 503).retryable).toBe(true);
  });
  it("never retries unknown 4xx errors", () => {
    expect(describeMetaError(999999, 400).retryable).toBe(false);
  });
});
