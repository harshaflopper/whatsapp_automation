import type { Contact } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getProvider, isProviderError } from "@/lib/messaging";
import { assertCanSend, ComplianceError } from "@/lib/messaging/compliance";

export type DirectSendResult = { ok: true; messageId: string } | { ok: false; error: string; code?: string };

/** Plain-language error for a single send the business is waiting on. */
function friendlySendError(e: unknown): { error: string; code?: string } {
  if (isProviderError(e)) {
    const c = e.code;
    if (c === "131030") return { error: "This number can't receive messages from this account yet. Please contact support.", code: c };
    if (c === "131026") return { error: "This number isn't on WhatsApp or can't receive messages right now.", code: c };
    if (c === "131047") return { error: "It's been more than 24 hours since this customer wrote to you. Send a message design instead.", code: c };
    if (c === "131050") return { error: "This customer has turned off promotional messages from your business.", code: c };
    if (["0", "3", "10", "190", "200", "131031", "131042", "368", "133010", "131045"].includes(c))
      return { error: "Sending isn't available right now. Please contact support.", code: c };
    if (e.retryable) return { error: "WhatsApp is busy right now. Please try again in a minute.", code: c };
    return { error: "WhatsApp couldn't send this message. Please try again.", code: c };
  }
  if (e instanceof Error && e.name === "ConfigError") return { error: "Sending isn't available right now. Please contact support.", code: "CONFIG" };
  return { error: "Something went wrong while sending. Please try again." };
}

async function touchConversation(contactId: string, preview: string) {
  await db.contact.update({
    where: { id: contactId },
    data: { lastMessageAt: new Date(), lastMessagePreview: preview.slice(0, 140) },
  });
}

/** Sends one approved design right away (chat "send a design" and campaign test sends). */
export async function sendTemplateNow(input: {
  contact: Contact;
  templateName: string;
  language: string;
  bodyParams: string[];
  renderedText: string;
  /** Test sends to the owner's own phone skip the subscription check. */
  isTest?: boolean;
}): Promise<DirectSendResult> {
  if (!input.isTest) {
    try {
      assertCanSend(input.contact, "template");
    } catch (e) {
      if (e instanceof ComplianceError)
        return {
          ok: false,
          error: e.code === "OPTED_OUT" ? "This customer has unsubscribed." : "This customer isn't subscribed to WhatsApp messages yet.",
          code: e.code,
        };
      throw e;
    }
  }

  const message = await db.message.create({
    data: {
      direction: "OUTBOUND",
      contactId: input.contact.id,
      type: "template",
      templateName: input.templateName,
      templateLang: input.language,
      body: input.renderedText,
      payload: { body: input.bodyParams },
      status: "SENDING",
      attempts: 1,
    },
  });

  try {
    const res = await getProvider().sendTemplate({
      to: input.contact.phone,
      templateName: input.templateName,
      language: input.language,
      params: input.bodyParams.length ? { body: input.bodyParams } : undefined,
    });
    await db.message.update({ where: { id: message.id }, data: { wamid: res.messageId, status: "SENT", sentAt: new Date() } });
    if (!input.isTest) await touchConversation(input.contact.id, input.renderedText);
    return { ok: true, messageId: message.id };
  } catch (e) {
    const err = isProviderError(e) ? e : null;
    const f = friendlySendError(e);
    await db.message.update({
      where: { id: message.id },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        errorCode: err?.code ?? f.code ?? "UNKNOWN",
        errorTitle: err?.info.title ?? "Not sent",
        errorDetail: f.error,
      },
    });
    if (err?.code === "131026") await db.contact.update({ where: { id: input.contact.id }, data: { undeliverable: true } });
    return { ok: false, ...f };
  }
}

/** Free-text reply inside the 24h window. */
export async function sendTextNow(contact: Contact, body: string): Promise<DirectSendResult> {
  const text = body.trim();
  if (!text) return { ok: false, error: "Type a message first." };
  if (text.length > 4096) return { ok: false, error: "This message is too long." };
  try {
    assertCanSend(contact, "text");
  } catch (e) {
    if (e instanceof ComplianceError)
      return {
        ok: false,
        error:
          e.code === "OPTED_OUT"
            ? "This customer has unsubscribed, so you can't message them."
            : "This chat is closed. It's been more than 24 hours since the customer wrote to you. Send a message design to restart it.",
        code: e.code,
      };
    throw e;
  }

  const message = await db.message.create({
    data: { direction: "OUTBOUND", contactId: contact.id, type: "text", body: text, status: "SENDING", attempts: 1 },
  });
  try {
    const res = await getProvider().sendText({ to: contact.phone, body: text, previewUrl: /https?:\/\//.test(text) });
    await db.message.update({ where: { id: message.id }, data: { wamid: res.messageId, status: "SENT", sentAt: new Date() } });
    await touchConversation(contact.id, text);
    return { ok: true, messageId: message.id };
  } catch (e) {
    const err = isProviderError(e) ? e : null;
    const f = friendlySendError(e);
    await db.message.update({
      where: { id: message.id },
      data: { status: "FAILED", failedAt: new Date(), errorCode: err?.code ?? f.code ?? "UNKNOWN", errorTitle: "Not sent", errorDetail: f.error },
    });
    return { ok: false, ...f };
  }
}
