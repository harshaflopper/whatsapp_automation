import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";

export type ContactStatus = "subscribed" | "unsubscribed" | "unreachable" | "pending";

/** What the business sees, in one word. */
export function contactStatus(c: { optedIn: boolean; optedOutAt: Date | null; undeliverable: boolean }): ContactStatus {
  if (!c.optedIn && c.optedOutAt) return "unsubscribed";
  if (c.undeliverable) return "unreachable";
  if (c.optedIn) return "subscribed";
  return "pending";
}

export const CONTACT_STATUS_LABEL: Record<ContactStatus, string> = {
  subscribed: "Subscribed",
  unsubscribed: "Unsubscribed",
  unreachable: "Not on WhatsApp",
  pending: "Not subscribed",
};

export type ContactFilters = {
  q?: string;
  groupId?: string;
  tag?: string;
  status?: ContactStatus | "all";
  city?: string;
  page?: number;
};

export const PAGE_SIZE = 50;

export function contactWhere(f: ContactFilters): Prisma.ContactWhereInput {
  const and: Prisma.ContactWhereInput[] = [];
  const q = f.q?.trim();
  if (q) {
    const digits = q.replace(/\D/g, "");
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
        ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
      ],
    });
  }
  if (f.groupId) and.push({ groups: { some: { groupId: f.groupId } } });
  if (f.tag) and.push({ tags: { has: f.tag } });
  if (f.city) and.push({ city: { equals: f.city, mode: "insensitive" } });
  switch (f.status) {
    case "subscribed":
      and.push({ optedIn: true, undeliverable: false });
      break;
    case "unsubscribed":
      and.push({ optedIn: false, optedOutAt: { not: null } });
      break;
    case "unreachable":
      and.push({ undeliverable: true });
      break;
    case "pending":
      and.push({ optedIn: false, optedOutAt: null });
      break;
  }
  return and.length ? { AND: and } : {};
}

export async function listContacts(f: ContactFilters) {
  const where = contactWhere(f);
  const page = Math.max(1, f.page ?? 1);
  const [rows, total] = await Promise.all([
    db.contact.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { groups: { include: { group: { select: { id: true, name: true } } } } },
    }),
    db.contact.count({ where }),
  ]);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function contactOverview() {
  const [all, subscribed, unsubscribed, unreachable, groups, tagRows, cityRows] = await Promise.all([
    db.contact.count(),
    db.contact.count({ where: { optedIn: true, undeliverable: false } }),
    db.contact.count({ where: { optedIn: false, optedOutAt: { not: null } } }),
    db.contact.count({ where: { undeliverable: true } }),
    db.group.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { members: true } } } }),
    db.$queryRaw<{ tag: string; n: bigint }[]>`SELECT unnest("tags") AS tag, COUNT(*) AS n FROM "Contact" GROUP BY tag ORDER BY tag`,
    db.$queryRaw<{ city: string }[]>`SELECT DISTINCT INITCAP(TRIM("city")) AS city FROM "Contact" WHERE "city" IS NOT NULL AND TRIM("city") <> '' ORDER BY city LIMIT 200`,
  ]);
  return {
    counts: { all, subscribed, unsubscribed, unreachable },
    groups: groups.map((g) => ({ id: g.id, name: g.name, count: g._count.members })),
    tags: tagRows.map((t) => ({ tag: t.tag, count: Number(t.n) })),
    cities: cityRows.map((c) => c.city),
  };
}

// ── Create / update ──────────────────────────────────────────

export type ContactInput = {
  name: string;
  phone: string;
  city?: string;
  email?: string;
  notes?: string;
  tags?: string[];
  groupIds?: string[];
  subscribed: boolean;
};

export type SaveResult = { ok: true; id: string } | { ok: false; error: string; field?: string };

export function cleanTags(tags: string[] | undefined): string[] {
  const out = new Map<string, string>();
  for (const t of tags ?? []) {
    const v = t.replace(/\s+/g, " ").trim().slice(0, 40);
    if (v) out.set(v.toLowerCase(), v);
  }
  return [...out.values()].slice(0, 20);
}

export async function createContact(input: ContactInput): Promise<SaveResult> {
  const phone = normalizePhone(input.phone);
  if (!phone.ok) return { ok: false, error: "Enter a valid WhatsApp number.", field: "phone" };
  if (!input.name.trim()) return { ok: false, error: "Enter a name.", field: "name" };
  const existing = await db.contact.findUnique({ where: { phone: phone.e164 }, select: { id: true, name: true } });
  if (existing) return { ok: false, error: `This number is already saved as ${existing.name}.`, field: "phone" };

  const now = new Date();
  const c = await db.contact.create({
    data: {
      name: input.name.trim(),
      phone: phone.e164,
      city: input.city?.trim() || null,
      email: input.email?.trim() || null,
      notes: input.notes?.trim() || null,
      tags: cleanTags(input.tags),
      optedIn: input.subscribed,
      optedInAt: input.subscribed ? now : null,
      optEvents: input.subscribed
        ? { create: { type: "OPT_IN", source: "MANUAL", note: "Added from Contacts" } }
        : undefined,
      groups: input.groupIds?.length ? { create: input.groupIds.map((groupId) => ({ groupId })) } : undefined,
    },
  });
  return { ok: true, id: c.id };
}

export async function updateContact(id: string, input: ContactInput): Promise<SaveResult> {
  const phone = normalizePhone(input.phone);
  if (!phone.ok) return { ok: false, error: "Enter a valid WhatsApp number.", field: "phone" };
  if (!input.name.trim()) return { ok: false, error: "Enter a name.", field: "name" };
  const current = await db.contact.findUnique({ where: { id } });
  if (!current) return { ok: false, error: "This contact no longer exists." };
  if (phone.e164 !== current.phone) {
    const clash = await db.contact.findUnique({ where: { phone: phone.e164 }, select: { name: true } });
    if (clash) return { ok: false, error: `This number is already saved as ${clash.name}.`, field: "phone" };
  }

  const now = new Date();
  const subscribing = input.subscribed && !current.optedIn;
  const unsubscribing = !input.subscribed && current.optedIn;

  await db.$transaction([
    db.contact.update({
      where: { id },
      data: {
        name: input.name.trim(),
        phone: phone.e164,
        city: input.city?.trim() || null,
        email: input.email?.trim() || null,
        notes: input.notes?.trim() || null,
        tags: cleanTags(input.tags),
        // A changed number might be reachable again.
        ...(phone.e164 !== current.phone ? { undeliverable: false } : {}),
        ...(subscribing ? { optedIn: true, optedInAt: now, optedOutAt: null } : {}),
        ...(unsubscribing ? { optedIn: false, optedOutAt: now } : {}),
      },
    }),
    ...(subscribing || unsubscribing
      ? [
          db.optEvent.create({
            data: { contactId: id, type: subscribing ? "OPT_IN" : "OPT_OUT", source: "MANUAL", note: "Changed from Contacts" },
          }),
        ]
      : []),
    db.contactGroup.deleteMany({ where: { contactId: id, groupId: { notIn: input.groupIds ?? [] } } }),
    db.contactGroup.createMany({
      data: (input.groupIds ?? []).map((groupId) => ({ contactId: id, groupId })),
      skipDuplicates: true,
    }),
  ]);
  return { ok: true, id };
}

export async function deleteContacts(ids: string[]) {
  if (!ids.length) return 0;
  const res = await db.contact.deleteMany({ where: { id: { in: ids } } });
  return res.count;
}

export async function addContactsToGroup(ids: string[], groupId: string) {
  await db.contactGroup.createMany({ data: ids.map((contactId) => ({ contactId, groupId })), skipDuplicates: true });
}

export async function removeContactsFromGroup(ids: string[], groupId: string) {
  await db.contactGroup.deleteMany({ where: { groupId, contactId: { in: ids } } });
}

export async function addTagToContacts(ids: string[], tag: string) {
  const [clean] = cleanTags([tag]);
  if (!clean || !ids.length) return;
  await db.$executeRaw`UPDATE "Contact" SET "tags" = array_append("tags", ${clean}), "updatedAt" = NOW()
    WHERE "id" = ANY(${ids}) AND NOT (${clean} = ANY("tags"))`;
}

export async function setSubscription(ids: string[], subscribed: boolean) {
  const now = new Date();
  const targets = await db.contact.findMany({
    where: { id: { in: ids }, optedIn: !subscribed },
    select: { id: true },
  });
  if (!targets.length) return 0;
  const tIds = targets.map((t) => t.id);
  await db.$transaction([
    db.contact.updateMany({
      where: { id: { in: tIds } },
      data: subscribed ? { optedIn: true, optedInAt: now, optedOutAt: null } : { optedIn: false, optedOutAt: now },
    }),
    db.optEvent.createMany({
      data: tIds.map((contactId) => ({
        contactId,
        type: subscribed ? ("OPT_IN" as const) : ("OPT_OUT" as const),
        source: "MANUAL" as const,
        note: "Bulk change from Contacts",
      })),
    }),
  ]);
  return tIds.length;
}

// ── Groups ───────────────────────────────────────────────────

export async function createGroup(name: string): Promise<SaveResult> {
  const n = name.replace(/\s+/g, " ").trim().slice(0, 60);
  if (!n) return { ok: false, error: "Enter a group name." };
  const clash = await db.group.findFirst({ where: { name: { equals: n, mode: "insensitive" } } });
  if (clash) return { ok: false, error: "A group with this name already exists." };
  const g = await db.group.create({ data: { name: n } });
  return { ok: true, id: g.id };
}

export async function renameGroup(id: string, name: string): Promise<SaveResult> {
  const n = name.replace(/\s+/g, " ").trim().slice(0, 60);
  if (!n) return { ok: false, error: "Enter a group name." };
  const clash = await db.group.findFirst({ where: { id: { not: id }, name: { equals: n, mode: "insensitive" } } });
  if (clash) return { ok: false, error: "A group with this name already exists." };
  await db.group.update({ where: { id }, data: { name: n } });
  return { ok: true, id };
}

export async function deleteGroup(id: string) {
  // Contacts stay; only the grouping is removed.
  await db.group.delete({ where: { id } });
}

// ── Import ───────────────────────────────────────────────────

export type ImportRow = {
  name?: string;
  phone?: string;
  city?: string;
  email?: string;
  notes?: string;
  tags?: string;
};

export type ImportSummary = {
  added: number;
  updated: number;
  duplicates: number;
  invalid: { row: number; value: string; reason: string }[];
};

/**
 * Imports parsed spreadsheet rows. Numbers are normalised to +91…; rows already in the
 * address book are updated (name/city filled in if empty) rather than duplicated.
 * `subscribed` is the owner's confirmation that these customers agreed to WhatsApp messages.
 */
export async function importContacts(
  rows: ImportRow[],
  opts: { groupId?: string; subscribed: boolean; updateExisting: boolean },
): Promise<ImportSummary> {
  const summary: ImportSummary = { added: 0, updated: 0, duplicates: 0, invalid: [] };
  const byPhone = new Map<string, ImportRow & { e164: string }>();

  rows.forEach((r, i) => {
    const phone = normalizePhone(r.phone ?? "");
    if (!phone.ok) {
      if ((r.phone ?? "").trim() || (r.name ?? "").trim()) {
        summary.invalid.push({ row: i + 2, value: r.phone ?? "", reason: (r.phone ?? "").trim() ? "Not a valid number" : "Number missing" });
      }
      return;
    }
    if (byPhone.has(phone.e164)) {
      summary.duplicates++;
      return;
    }
    byPhone.set(phone.e164, { ...r, e164: phone.e164 });
  });

  const phones = [...byPhone.keys()];
  const existing = new Map(
    (
      await db.contact.findMany({
        where: { phone: { in: phones } },
        select: { id: true, phone: true, name: true, city: true, email: true, optedIn: true, optedOutAt: true },
      })
    ).map((c) => [c.phone, c]),
  );

  const now = new Date();
  const toCreate = phones.filter((p) => !existing.has(p));
  const chunk = 500;
  for (let i = 0; i < toCreate.length; i += chunk) {
    const slice = toCreate.slice(i, i + chunk).map((p) => byPhone.get(p)!);
    await db.contact.createMany({
      data: slice.map((r) => ({
        name: r.name?.trim() || "Customer",
        phone: r.e164,
        city: r.city?.trim() || null,
        email: r.email?.trim() || null,
        notes: r.notes?.trim() || null,
        tags: cleanTags((r.tags ?? "").split(/[,;|]/)),
        optedIn: opts.subscribed,
        optedInAt: opts.subscribed ? now : null,
      })),
      skipDuplicates: true,
    });
    summary.added += slice.length;
  }

  const created = toCreate.length
    ? await db.contact.findMany({ where: { phone: { in: toCreate } }, select: { id: true } })
    : [];
  if (opts.subscribed && created.length) {
    await db.optEvent.createMany({
      data: created.map((c) => ({ contactId: c.id, type: "OPT_IN" as const, source: "IMPORT" as const, note: "Imported from file" })),
    });
  }

  let existingIds: string[] = [];
  if (opts.updateExisting) {
    for (const [p, c] of existing) {
      const r = byPhone.get(p)!;
      await db.contact.update({
        where: { id: c.id },
        data: {
          name: r.name?.trim() || c.name,
          city: r.city?.trim() || c.city,
          email: r.email?.trim() || c.email,
          // Never re-subscribe someone who unsubscribed themselves.
          ...(opts.subscribed && !c.optedIn && !c.optedOutAt ? { optedIn: true, optedInAt: now } : {}),
        },
      });
      const t = cleanTags((r.tags ?? "").split(/[,;|]/));
      if (t.length) for (const tag of t) await addTagToContacts([c.id], tag);
      summary.updated++;
    }
    existingIds = [...existing.values()].map((c) => c.id);
  } else {
    summary.duplicates += existing.size;
  }

  if (opts.groupId) {
    await addContactsToGroup([...created.map((c) => c.id), ...existingIds], opts.groupId);
  }
  return summary;
}

// ── Export ───────────────────────────────────────────────────

function csvCell(v: string | null | undefined): string {
  const s = v ?? "";
  // Guard against spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(header: string[], rows: (string | null | undefined)[][]): string {
  // BOM so Excel opens UTF-8 (Kannada/Hindi names) correctly.
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export async function exportContactsCsv(f: ContactFilters): Promise<string> {
  const rows = await db.contact.findMany({
    where: contactWhere(f),
    orderBy: { name: "asc" },
    include: { groups: { include: { group: { select: { name: true } } } } },
  });
  return toCsv(
    ["Name", "WhatsApp number", "City", "Email", "Groups", "Tags", "Status", "Notes", "Added on"],
    rows.map((c) => [
      c.name,
      c.phone,
      c.city,
      c.email,
      c.groups.map((g) => g.group.name).join("; "),
      c.tags.join("; "),
      CONTACT_STATUS_LABEL[contactStatus(c)],
      c.notes,
      c.createdAt.toISOString().slice(0, 10),
    ]),
  );
}
