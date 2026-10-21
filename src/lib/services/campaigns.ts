import type { BroadcastStatus, Contact, MessageStatus, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { renderMetaText } from "@/lib/designs/text";
import { resolveParams, validateMappings as validateVariableMappings, type VariableMapping } from "@/lib/campaigns/personalize";
import { getDesign, type DesignView } from "@/lib/services/designs";
import { toCsv } from "@/lib/services/contacts";

// ── Audience ─────────────────────────────────────────────────

export type FollowUpSegment = "read_no_reply" | "not_read" | "replied" | "not_delivered";

export const FOLLOW_UP_LABEL: Record<FollowUpSegment, string> = {
  read_no_reply: "Read but didn't reply",
  not_read: "Didn't read",
  replied: "Replied",
  not_delivered: "Didn't receive it",
};

export type Audience = {
  all?: boolean;
  groupIds?: string[];
  tags?: string[];
  contactIds?: string[];
  followUp?: { broadcastId: string; segment: FollowUpSegment };
};

export type AudienceSummary = {
  eligible: number;
  skippedUnsubscribed: number;
  skippedNotSubscribed: number;
  skippedUnreachable: number;
  total: number;
};

async function audienceContactIds(a: Audience): Promise<string[] | "all"> {
  if (a.all) return "all";
  const ids = new Set<string>(a.contactIds ?? []);
  if (a.groupIds?.length) {
    const rows = await db.contactGroup.findMany({ where: { groupId: { in: a.groupIds } }, select: { contactId: true } });
    rows.forEach((r) => ids.add(r.contactId));
  }
  if (a.tags?.length) {
    const rows = await db.contact.findMany({ where: { tags: { hasSome: a.tags } }, select: { id: true } });
    rows.forEach((r) => ids.add(r.id));
  }
  if (a.followUp) {
    (await followUpContactIds(a.followUp.broadcastId, a.followUp.segment)).forEach((id) => ids.add(id));
  }
  return [...ids];
}

export async function summarizeAudience(a: Audience): Promise<AudienceSummary> {
  const ids = await audienceContactIds(a);
  const base: Prisma.ContactWhereInput = ids === "all" ? {} : { id: { in: ids } };
  const [total, eligible, unsub, unreachable] = await Promise.all([
    db.contact.count({ where: base }),
    db.contact.count({ where: { ...base, optedIn: true, undeliverable: false } }),
    db.contact.count({ where: { ...base, optedIn: false, optedOutAt: { not: null } } }),
    db.contact.count({ where: { ...base, optedIn: true, undeliverable: true } }),
  ]);
  return {
    total,
    eligible,
    skippedUnsubscribed: unsub,
    skippedUnreachable: unreachable,
    skippedNotSubscribed: Math.max(0, total - eligible - unsub - unreachable),
  };
}

async function eligibleContacts(a: Audience): Promise<Contact[]> {
  const ids = await audienceContactIds(a);
  return db.contact.findMany({
    where: { ...(ids === "all" ? {} : { id: { in: ids } }), optedIn: true, undeliverable: false },
    orderBy: { name: "asc" },
  });
}

export async function previewContacts(a: Audience, take = 3) {
  const ids = await audienceContactIds(a);
  return db.contact.findMany({
    where: { ...(ids === "all" ? {} : { id: { in: ids } }), optedIn: true, undeliverable: false },
    take,
    orderBy: { name: "asc" },
    select: { id: true, name: true, city: true },
  });
}

// ── Personalisation ──────────────────────────────────────────

export { defaultMappings, firstName, resolveParams, resolveValue } from "@/lib/campaigns/personalize";
export type { VariableMapping, VariableSource } from "@/lib/campaigns/personalize";

export function renderForContact(design: DesignView, mappings: VariableMapping[], c: { name: string; city: string | null }) {
  const params = resolveParams(mappings, c);
  return {
    params,
    header: design.header,
    body: renderMetaText(design.body, params, design.variables.map((v) => v.label)),
    footer: design.footer,
  };
}

export function validateMappings(design: DesignView, mappings: VariableMapping[]): string | null {
  return validateVariableMappings(design.variables, mappings);
}

// ── Create ───────────────────────────────────────────────────

export type CreateCampaignInput = {
  name: string;
  designId: string;
  audience: Audience;
  mappings: VariableMapping[];
  sendAt: Date | null;
};

export type CreateCampaignResult = { ok: true; id: string; recipients: number; scheduled: boolean } | { ok: false; error: string };

export async function createCampaign(input: CreateCampaignInput): Promise<CreateCampaignResult> {
  const design = await getDesign(input.designId);
  if (!design) return { ok: false, error: "Pick a message design." };
  if (design.state !== "ready") return { ok: false, error: "This message design isn't approved by WhatsApp yet." };
  const problem = validateMappings(design, input.mappings);
  if (problem) return { ok: false, error: problem };
  if (input.sendAt && input.sendAt.getTime() < Date.now() - 60_000) return { ok: false, error: "Pick a time in the future." };

  const contacts = await eligibleContacts(input.audience);
  if (!contacts.length) return { ok: false, error: "No subscribed contacts in this selection." };

  const scheduled = !!input.sendAt && input.sendAt.getTime() > Date.now() + 60_000;
  const when = scheduled ? input.sendAt! : new Date();
  const name = input.name.trim() || `${design.title} · ${when.toISOString().slice(0, 10)}`;

  const broadcast = await db.broadcast.create({
    data: {
      name: name.slice(0, 120),
      templateId: design.id,
      audience: input.audience as object,
      variableMap: input.mappings as unknown as object,
      status: scheduled ? "SCHEDULED" : "SENDING",
      scheduledAt: scheduled ? input.sendAt : null,
      startedAt: scheduled ? null : new Date(),
      recipientCount: contacts.length,
    },
  });

  const rows = contacts.map((c) => {
    const r = renderForContact(design, input.mappings, c);
    const text = [r.header, r.body, r.footer].filter(Boolean).join("\n\n");
    return {
      direction: "OUTBOUND" as const,
      contactId: c.id,
      broadcastId: broadcast.id,
      type: "template",
      templateName: design.name,
      templateLang: design.language,
      body: text,
      payload: { body: r.params } as object,
      status: "QUEUED" as const,
      nextAttemptAt: when,
    };
  });
  for (let i = 0; i < rows.length; i += 1000) await db.message.createMany({ data: rows.slice(i, i + 1000) });

  return { ok: true, id: broadcast.id, recipients: contacts.length, scheduled };
}

// ── Control ──────────────────────────────────────────────────

export async function pauseCampaign(id: string) {
  await db.broadcast.updateMany({ where: { id, status: { in: ["SENDING", "SCHEDULED"] } }, data: { status: "PAUSED" } });
}

export async function resumeCampaign(id: string) {
  const b = await db.broadcast.findUnique({ where: { id } });
  if (!b || b.status !== "PAUSED") return;
  const future = b.scheduledAt && b.scheduledAt > new Date() && !b.startedAt;
  await db.broadcast.update({
    where: { id },
    data: { status: future ? "SCHEDULED" : "SENDING", startedAt: b.startedAt ?? (future ? null : new Date()) },
  });
}

export async function cancelCampaign(id: string) {
  await db.$transaction([
    db.message.updateMany({
      where: { broadcastId: id, status: "QUEUED" },
      data: { status: "CANCELLED", errorTitle: "Stopped", errorDetail: "Campaign was stopped before this was sent." },
    }),
    db.broadcast.updateMany({
      where: { id, status: { in: ["SENDING", "SCHEDULED", "PAUSED", "DRAFT"] } },
      data: { status: "CANCELLED", completedAt: new Date() },
    }),
  ]);
}

// ── Stats ────────────────────────────────────────────────────

export type CampaignStats = {
  total: number;
  pending: number;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  notDelivered: number;
};

const SENT_STATUSES: MessageStatus[] = ["SENT", "DELIVERED", "READ"];

function statsFromCounts(counts: Partial<Record<MessageStatus, number>>, replied: number): CampaignStats {
  const n = (s: MessageStatus) => counts[s] ?? 0;
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
  return {
    total,
    pending: n("QUEUED") + n("SENDING"),
    sent: n("SENT") + n("DELIVERED") + n("READ"),
    delivered: n("DELIVERED") + n("READ"),
    read: n("READ"),
    replied,
    notDelivered: n("FAILED") + n("CANCELLED"),
  };
}

async function repliedCounts(broadcastIds: string[]): Promise<Map<string, number>> {
  if (!broadcastIds.length) return new Map();
  const rows = await db.$queryRaw<{ broadcastId: string; n: bigint }[]>`
    SELECT m."broadcastId", COUNT(DISTINCT m."contactId") AS n
    FROM "Message" m
    WHERE m."broadcastId" = ANY(${broadcastIds})
      AND m."status" IN ('SENT', 'DELIVERED', 'READ')
      AND EXISTS (
        SELECT 1 FROM "Message" i
        WHERE i."contactId" = m."contactId" AND i."direction" = 'INBOUND'
          AND i."createdAt" >= COALESCE(m."sentAt", m."createdAt")
          AND i."createdAt" <= COALESCE(m."sentAt", m."createdAt") + INTERVAL '7 days'
      )
    GROUP BY m."broadcastId"`;
  return new Map(rows.map((r) => [r.broadcastId, Number(r.n)]));
}

export async function statsFor(broadcastIds: string[]): Promise<Map<string, CampaignStats>> {
  if (!broadcastIds.length) return new Map();
  const [grouped, replied] = await Promise.all([
    db.message.groupBy({ by: ["broadcastId", "status"], where: { broadcastId: { in: broadcastIds } }, _count: { _all: true } }),
    repliedCounts(broadcastIds),
  ]);
  const counts = new Map<string, Partial<Record<MessageStatus, number>>>();
  for (const g of grouped) {
    if (!g.broadcastId) continue;
    const c = counts.get(g.broadcastId) ?? {};
    c[g.status] = g._count._all;
    counts.set(g.broadcastId, c);
  }
  return new Map(broadcastIds.map((id) => [id, statsFromCounts(counts.get(id) ?? {}, replied.get(id) ?? 0)]));
}

export type CampaignRow = {
  id: string;
  name: string;
  designTitle: string;
  status: BroadcastStatus;
  scheduledAt: Date | null;
  startedAt: Date | null;
  createdAt: Date;
  recipientCount: number;
  stats: CampaignStats;
};

export async function listCampaigns(opts: { take?: number; where?: Prisma.BroadcastWhereInput } = {}): Promise<CampaignRow[]> {
  const rows = await db.broadcast.findMany({
    where: opts.where,
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 100,
    include: { template: { select: { title: true, name: true } } },
  });
  const stats = await statsFor(rows.map((r) => r.id));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    designTitle: r.template.title || r.template.name.replace(/_/g, " "),
    status: r.status,
    scheduledAt: r.scheduledAt,
    startedAt: r.startedAt,
    createdAt: r.createdAt,
    recipientCount: r.recipientCount,
    stats: stats.get(r.id)!,
  }));
}

export async function getCampaign(id: string) {
  const b = await db.broadcast.findUnique({
    where: { id },
    include: { template: { include: { submissions: true, _count: { select: { broadcasts: true } } } } },
  });
  if (!b) return null;
  const stats = (await statsFor([id])).get(id)!;
  return { broadcast: b, stats };
}

// ── Recipients ───────────────────────────────────────────────

export type RecipientFilter = "all" | "read" | "replied" | "not_read" | "not_delivered" | "pending";

/** Plain-language reason for a message that didn't arrive. */
export function deliveryProblem(m: { status: MessageStatus; errorCode: string | null }): string | null {
  if (m.status === "CANCELLED") return "Not sent (campaign stopped or customer unsubscribed)";
  if (m.status !== "FAILED") return null;
  switch (m.errorCode) {
    case "131026":
      return "Number isn't on WhatsApp or can't receive messages";
    case "131049":
      return "WhatsApp held it back to avoid too many offers to this person";
    case "131050":
      return "Customer turned off promotional messages";
    case "131030":
      return "This number can't receive messages from this account yet";
    case "OPTED_OUT":
    case "NOT_OPTED_IN":
      return "Customer is unsubscribed";
    case "131021":
      return "That's your own business number";
    default:
      return "Couldn't deliver. The phone may be off or out of network";
  }
}

export async function listRecipients(broadcastId: string, filter: RecipientFilter, q?: string, take = 200) {
  const where: Prisma.MessageWhereInput = { broadcastId };
  switch (filter) {
    case "read":
      where.status = "READ";
      break;
    case "not_read":
      where.status = { in: ["SENT", "DELIVERED"] };
      break;
    case "not_delivered":
      where.status = { in: ["FAILED", "CANCELLED"] };
      break;
    case "pending":
      where.status = { in: ["QUEUED", "SENDING"] };
      break;
    case "replied": {
      const ids = await followUpContactIds(broadcastId, "replied");
      where.contactId = { in: ids };
      break;
    }
  }
  if (q?.trim()) {
    const digits = q.replace(/\D/g, "");
    where.contact = {
      OR: [{ name: { contains: q.trim(), mode: "insensitive" } }, ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : [])],
    };
  }
  const [rows, repliedIds] = await Promise.all([
    db.message.findMany({
      where,
      take,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      include: { contact: { select: { id: true, name: true, phone: true } } },
    }),
    followUpContactIds(broadcastId, "replied"),
  ]);
  const replied = new Set(repliedIds);
  return rows.map((m) => ({
    id: m.id,
    contactId: m.contact.id,
    name: m.contact.name,
    phone: m.contact.phone,
    status: m.status,
    replied: replied.has(m.contactId),
    sentAt: m.sentAt,
    deliveredAt: m.deliveredAt,
    readAt: m.readAt,
    updatedAt: m.updatedAt,
    problem: deliveryProblem(m),
  }));
}

export async function problemBreakdown(broadcastId: string) {
  const rows = await db.message.groupBy({
    by: ["status", "errorCode"],
    where: { broadcastId, status: { in: ["FAILED", "CANCELLED"] } },
    _count: { _all: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    const label = deliveryProblem({ status: r.status, errorCode: r.errorCode }) ?? "Couldn't deliver";
    map.set(label, (map.get(label) ?? 0) + r._count._all);
  }
  return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

export async function followUpContactIds(broadcastId: string, segment: FollowUpSegment): Promise<string[]> {
  if (segment === "replied" || segment === "read_no_reply") {
    const rows = await db.$queryRaw<{ contactId: string; replied: boolean; status: string }[]>`
      SELECT m."contactId", m."status",
        EXISTS (
          SELECT 1 FROM "Message" i
          WHERE i."contactId" = m."contactId" AND i."direction" = 'INBOUND'
            AND i."createdAt" >= COALESCE(m."sentAt", m."createdAt")
            AND i."createdAt" <= COALESCE(m."sentAt", m."createdAt") + INTERVAL '7 days'
        ) AS replied
      FROM "Message" m
      WHERE m."broadcastId" = ${broadcastId} AND m."status" IN ('SENT', 'DELIVERED', 'READ')`;
    return rows
      .filter((r) => (segment === "replied" ? r.replied : r.status === "READ" && !r.replied))
      .map((r) => r.contactId);
  }
  const statuses: MessageStatus[] = segment === "not_read" ? ["SENT", "DELIVERED"] : ["FAILED", "CANCELLED"];
  const rows = await db.message.findMany({ where: { broadcastId, status: { in: statuses } }, select: { contactId: true } });
  return [...new Set(rows.map((r) => r.contactId))];
}

export async function followUpCounts(broadcastId: string): Promise<Record<FollowUpSegment, number>> {
  const [a, b, c, d] = await Promise.all([
    followUpContactIds(broadcastId, "read_no_reply"),
    followUpContactIds(broadcastId, "not_read"),
    followUpContactIds(broadcastId, "replied"),
    followUpContactIds(broadcastId, "not_delivered"),
  ]);
  return { read_no_reply: a.length, not_read: b.length, replied: c.length, not_delivered: d.length };
}

export async function exportCampaignCsv(broadcastId: string): Promise<string> {
  const rows = await listRecipients(broadcastId, "all", undefined, 100_000);
  const label: Record<string, string> = {
    QUEUED: "Waiting",
    SENDING: "Sending",
    SENT: "Sent",
    DELIVERED: "Delivered",
    READ: "Read",
    FAILED: "Not delivered",
    CANCELLED: "Not sent",
  };
  return toCsv(
    ["Name", "WhatsApp number", "Status", "Replied", "Sent at", "Delivered at", "Read at", "Problem"],
    rows.map((r) => [
      r.name,
      r.phone,
      label[r.status] ?? r.status,
      r.replied ? "Yes" : "No",
      r.sentAt?.toISOString() ?? "",
      r.deliveredAt?.toISOString() ?? "",
      r.readAt?.toISOString() ?? "",
      r.problem ?? "",
    ]),
  );
}

export { SENT_STATUSES };
