import type { MessageStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { WebhookEventItem } from "@/lib/messaging/provider";

/** Statuses only ever move forward; Meta sometimes delivers "read" before "delivered". */
const RANK: Record<MessageStatus, number> = {
  QUEUED: 0,
  SENDING: 1,
  SENT: 2,
  DELIVERED: 3,
  READ: 4,
  FAILED: 1.5,
  CANCELLED: 0,
  RECEIVED: 0,
};

export const STOP_WORDS = ["stop", "unsubscribe", "stop all", "cancel", "opt out", "optout"];
export const START_WORDS = ["start", "subscribe", "unstop"];

export function isStopKeyword(text: string | null | undefined): boolean {
  const t = (text ?? "").trim().toLowerCase().replace(/[.!]+$/, "");
  return STOP_WORDS.includes(t);
}

export function isStartKeyword(text: string | null | undefined): boolean {
  const t = (text ?? "").trim().toLowerCase().replace(/[.!]+$/, "");
  return START_WORDS.includes(t);
}

export function nextStatus(current: MessageStatus, incoming: "sent" | "delivered" | "read" | "failed"): MessageStatus | null {
  const target: MessageStatus = incoming === "sent" ? "SENT" : incoming === "delivered" ? "DELIVERED" : incoming === "read" ? "READ" : "FAILED";
  if (target === "FAILED") return RANK[current] >= RANK.DELIVERED ? null : "FAILED";
  if (current === "FAILED") return target; // a late success wins over an earlier failure
  return RANK[target] > RANK[current] ? target : null;
}

export async function processWebhookEvents(events: WebhookEventItem[]) {
  for (const ev of events) {
    if (ev.kind === "status") await handleStatus(ev);
    else if (ev.kind === "message") await handleInbound(ev);
    else if (ev.kind === "template_status") await handleTemplateStatus(ev);
  }
}

async function handleStatus(ev: Extract<WebhookEventItem, { kind: "status" }>) {
  const m = await db.message.findUnique({ where: { wamid: ev.messageId } });
  if (!m) return;
  const next = nextStatus(m.status, ev.status);
  const stamp = ev.timestamp;
  const data: Record<string, unknown> = {};
  if (next) data.status = next;
  if (ev.status === "sent" && !m.sentAt) data.sentAt = stamp;
  if ((ev.status === "delivered" || ev.status === "read") && !m.deliveredAt) data.deliveredAt = stamp;
  if (ev.status === "read" && !m.readAt) data.readAt = stamp;
  if (next === "FAILED") {
    data.failedAt = stamp;
    data.errorCode = ev.error?.code ?? "unknown";
    data.errorTitle = ev.error?.title ?? "Failed";
    data.errorDetail = ev.error?.detail ?? null;
  }
  if (Object.keys(data).length) await db.message.update({ where: { id: m.id }, data });
  if (next === "FAILED" && ev.error?.code === "131026") {
    await db.contact.update({ where: { id: m.contactId }, data: { undeliverable: true } });
  }
  if (ev.status === "delivered" || ev.status === "read") {
    // Proof the number works.
    await db.contact.updateMany({ where: { id: m.contactId, undeliverable: true }, data: { undeliverable: false } });
  }
}

async function handleInbound(ev: Extract<WebhookEventItem, { kind: "message" }>) {
  const already = await db.message.findUnique({ where: { wamid: ev.messageId }, select: { id: true } });
  if (already) return;

  const at = ev.timestamp;
  const preview = (ev.text ?? `[${ev.type}]`).slice(0, 140);
  let contact = await db.contact.findUnique({ where: { phone: ev.from } });
  if (!contact) {
    contact = await db.contact.create({
      data: { name: ev.profileName?.trim() || "New customer", phone: ev.from, notes: "Messaged you first on WhatsApp" },
    });
  }

  await db.message.create({
    data: {
      direction: "INBOUND",
      contactId: contact.id,
      type: ev.type,
      body: ev.text,
      wamid: ev.messageId,
      status: "RECEIVED",
      receivedAt: at,
      createdAt: at,
    },
  });

  const stop = isStopKeyword(ev.text);
  const start = isStartKeyword(ev.text);
  await db.contact.update({
    where: { id: contact.id },
    data: {
      lastInboundAt: at,
      lastMessageAt: at,
      lastMessagePreview: preview,
      unreadCount: { increment: 1 },
      undeliverable: false,
      ...(contact.name === "New customer" && ev.profileName ? { name: ev.profileName } : {}),
      ...(stop ? { optedIn: false, optedOutAt: at } : {}),
      ...(start ? { optedIn: true, optedInAt: at, optedOutAt: null } : {}),
    },
  });
  if (stop || start) {
    await db.optEvent.create({
      data: {
        contactId: contact.id,
        type: stop ? "OPT_OUT" : "OPT_IN",
        source: "KEYWORD",
        note: `Customer replied "${(ev.text ?? "").trim().slice(0, 30)}"`,
      },
    });
    if (stop) {
      // Nothing else goes out to them, even from campaigns already running.
      await db.message.updateMany({
        where: { contactId: contact.id, status: "QUEUED", direction: "OUTBOUND" },
        data: { status: "CANCELLED", errorCode: "OPTED_OUT", errorTitle: "Unsubscribed", errorDetail: "Customer replied STOP." },
      });
    }
  }
}

async function handleTemplateStatus(ev: Extract<WebhookEventItem, { kind: "template_status" }>) {
  if (ev.status === "UNKNOWN") return;
  await db.templateSubmission.updateMany({
    where: { metaTemplateId: ev.templateId },
    data: { status: ev.status, rejectionReason: ev.reason ?? null, lastSyncedAt: new Date() },
  });
}
