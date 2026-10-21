import type { DeliveryStatus, WebhookEventItem } from "../provider";
import { normaliseTemplateStatus } from "./template-status";

/**
 * Turns a Meta webhook payload into provider-neutral events.
 * Unknown fields and message types are ignored or passed through as-is, never thrown.
 */

type MetaWebhook = {
  object?: string;
  entry?: {
    id?: string;
    changes?: { field?: string; value?: Record<string, unknown> }[];
  }[];
};

type MetaInboundMessage = {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body?: string };
  button?: { text?: string; payload?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
  image?: { caption?: string };
  video?: { caption?: string };
  document?: { caption?: string; filename?: string };
  reaction?: { emoji?: string };
};

type MetaStatus = {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
  errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[];
};

const DELIVERY_STATUSES: DeliveryStatus[] = ["sent", "delivered", "read", "failed"];

function toDate(unixSeconds: string | number | undefined): Date {
  const n = Number(unixSeconds);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000) : new Date();
}

function inboundText(m: MetaInboundMessage): string | null {
  switch (m.type) {
    case "text":
      return m.text?.body ?? null;
    case "button":
      return m.button?.text ?? m.button?.payload ?? null;
    case "interactive":
      return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? null;
    case "image":
      return m.image?.caption ? `Photo: ${m.image.caption}` : "Photo";
    case "video":
      return m.video?.caption ? `Video: ${m.video.caption}` : "Video";
    case "document":
      return `Document: ${m.document?.filename ?? "file"}`;
    case "audio":
      return "Voice message";
    case "sticker":
      return "Sticker";
    case "location":
      return "Location";
    case "reaction":
      return m.reaction?.emoji ? `Reacted ${m.reaction.emoji}` : null;
    default:
      return null;
  }
}

export function parseMetaWebhook(payload: unknown): WebhookEventItem[] {
  const body = payload as MetaWebhook;
  if (!body || body.object !== "whatsapp_business_account" || !Array.isArray(body.entry)) return [];

  const events: WebhookEventItem[] = [];

  for (const entry of body.entry) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};

      if (change.field === "messages") {
        const contacts = (value.contacts as { wa_id?: string; profile?: { name?: string } }[] | undefined) ?? [];
        const nameByWaId = new Map(contacts.map((c) => [c.wa_id, c.profile?.name]));

        for (const m of (value.messages as MetaInboundMessage[] | undefined) ?? []) {
          if (!m?.id || !m.from) continue;
          events.push({
            kind: "message",
            messageId: m.id,
            from: `+${m.from.replace(/[^\d]/g, "")}`,
            profileName: nameByWaId.get(m.from) ?? undefined,
            timestamp: toDate(m.timestamp),
            type: m.type,
            text: inboundText(m),
          });
        }

        for (const s of (value.statuses as MetaStatus[] | undefined) ?? []) {
          if (!s?.id || !DELIVERY_STATUSES.includes(s.status as DeliveryStatus)) continue;
          const err = s.errors?.[0];
          events.push({
            kind: "status",
            messageId: s.id,
            status: s.status as DeliveryStatus,
            timestamp: toDate(s.timestamp),
            recipient: s.recipient_id,
            ...(err
              ? {
                  error: {
                    code: String(err.code ?? "unknown"),
                    title: err.title ?? err.message ?? "Failed",
                    detail: err.error_data?.details,
                  },
                }
              : {}),
          });
        }
      }

      if (change.field === "message_template_status_update") {
        const v = value as {
          event?: string;
          message_template_id?: number | string;
          message_template_name?: string;
          message_template_language?: string;
          reason?: string | null;
        };
        if (!v.message_template_id) continue;
        events.push({
          kind: "template_status",
          templateId: String(v.message_template_id),
          templateName: v.message_template_name ?? "",
          language: v.message_template_language,
          status: normaliseTemplateStatus(v.event),
          reason: v.reason && v.reason !== "NONE" ? v.reason : null,
        });
      }
    }
  }
  return events;
}
