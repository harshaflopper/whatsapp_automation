import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { isWithinServiceWindow, serviceWindowRemainingMs } from "@/lib/messaging/compliance";

export type ConversationFilter = "all" | "unread" | "open";

/** Conversations = contacts who have written to the business at least once. */
export async function listConversations(opts: { q?: string; filter?: ConversationFilter } = {}) {
  const where: Prisma.ContactWhereInput = { lastInboundAt: { not: null } };
  if (opts.filter === "unread") where.unreadCount = { gt: 0 };
  if (opts.filter === "open") where.lastInboundAt = { gte: new Date(Date.now() - 24 * 3600_000) };
  const q = opts.q?.trim();
  if (q) {
    const digits = q.replace(/\D/g, "");
    where.OR = [{ name: { contains: q, mode: "insensitive" } }, ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : [])];
  }
  const rows = await db.contact.findMany({
    where,
    orderBy: { lastMessageAt: { sort: "desc", nulls: "last" } },
    take: 200,
    select: {
      id: true,
      name: true,
      phone: true,
      lastMessageAt: true,
      lastMessagePreview: true,
      lastInboundAt: true,
      unreadCount: true,
      optedIn: true,
      optedOutAt: true,
    },
  });
  return rows.map((r) => ({ ...r, windowOpen: isWithinServiceWindow(r.lastInboundAt) }));
}

export async function unreadTotal(): Promise<{ chats: number; messages: number }> {
  const agg = await db.contact.aggregate({ where: { unreadCount: { gt: 0 } }, _count: { _all: true }, _sum: { unreadCount: true } });
  return { chats: agg._count._all, messages: agg._sum.unreadCount ?? 0 };
}

export async function getThread(contactId: string) {
  const contact = await db.contact.findUnique({
    where: { id: contactId },
    include: { groups: { include: { group: { select: { id: true, name: true } } } } },
  });
  if (!contact) return null;
  const messages = await db.message.findMany({
    where: { contactId, OR: [{ direction: "INBOUND" }, { status: { notIn: ["QUEUED", "CANCELLED"] } }] },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true,
      direction: true,
      type: true,
      body: true,
      status: true,
      createdAt: true,
      errorDetail: true,
      broadcast: { select: { id: true, name: true } },
    },
  });
  return {
    contact,
    messages: messages.reverse(),
    windowOpen: isWithinServiceWindow(contact.lastInboundAt),
    windowRemainingMs: serviceWindowRemainingMs(contact.lastInboundAt),
  };
}

export async function markRead(contactId: string) {
  await db.contact.updateMany({ where: { id: contactId, unreadCount: { gt: 0 } }, data: { unreadCount: 0 } });
}

// ── Quick replies ────────────────────────────────────────────

export async function listQuickReplies() {
  return db.quickReply.findMany({ orderBy: { title: "asc" } });
}

export async function saveQuickReply(input: { id?: string; title: string; body: string }) {
  const title = input.title.trim().slice(0, 60);
  const body = input.body.trim().slice(0, 1000);
  if (!title || !body) return { ok: false as const, error: "Add a short name and the reply text." };
  const row = input.id
    ? await db.quickReply.update({ where: { id: input.id }, data: { title, body } })
    : await db.quickReply.create({ data: { title, body } });
  return { ok: true as const, id: row.id };
}

export async function deleteQuickReply(id: string) {
  await db.quickReply.deleteMany({ where: { id } });
}
