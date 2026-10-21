import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { formatNumber, formatRelativeDay } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { contactOverview, contactStatus, listContacts, type ContactStatus } from "@/lib/services/contacts";
import { ContactsTable, type ContactRow } from "./contacts-table";
import { GroupsPanel } from "./groups-panel";

export const metadata: Metadata = { title: "Contacts" };

const STATUSES: ContactStatus[] = ["subscribed", "unsubscribed", "unreachable", "pending"];

function one(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

export default async function ContactsPage({ searchParams }: PageProps<"/contacts">) {
  const sp = await searchParams;
  const status = STATUSES.includes(one(sp.status) as ContactStatus) ? (one(sp.status) as ContactStatus) : undefined;
  const filters = {
    q: one(sp.q),
    groupId: one(sp.group),
    tag: one(sp.tag),
    city: one(sp.city),
    status,
    page: Number(one(sp.page) ?? 1) || 1,
  };
  const [list, overview] = await Promise.all([listContacts(filters), contactOverview()]);

  const rows: ContactRow[] = list.rows.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    phoneDisplay: formatPhone(c.phone),
    city: c.city,
    email: c.email,
    notes: c.notes,
    tags: c.tags,
    groupIds: c.groups.map((g) => g.group.id),
    groupNames: c.groups.map((g) => g.group.name),
    subscribed: c.optedIn,
    unsubscribedByCustomer: !c.optedIn && !!c.optedOutAt,
    status: contactStatus(c),
    lastActivity: c.lastMessageAt ? formatRelativeDay(c.lastMessageAt) : "—",
  }));

  // Links for the left panel keep the search text but reset the list choice.
  const base = new URLSearchParams();
  if (filters.q) base.set("q", filters.q);
  const link = (extra: Record<string, string>) => {
    const p = new URLSearchParams(base);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    const s = p.toString();
    return `/contacts${s ? `?${s}` : ""}`;
  };
  const hrefFor: Record<string, string> = {
    all: link({}),
    subscribed: link({ status: "subscribed" }),
    unsubscribed: link({ status: "unsubscribed" }),
    unreachable: link({ status: "unreachable" }),
    ...Object.fromEntries(overview.groups.map((g) => [`g:${g.id}`, link({ group: g.id })])),
  };

  const exportParams = new URLSearchParams();
  if (filters.q) exportParams.set("q", filters.q);
  if (filters.groupId) exportParams.set("group", filters.groupId);
  if (filters.tag) exportParams.set("tag", filters.tag);
  if (filters.city) exportParams.set("city", filters.city);
  if (filters.status) exportParams.set("status", filters.status);

  const activeGroup = overview.groups.find((g) => g.id === filters.groupId);

  return (
    <>
      <PageHeader
        title={activeGroup ? activeGroup.name : "Contacts"}
        description={
          activeGroup
            ? `${formatNumber(activeGroup.count)} contacts in this group`
            : `${formatNumber(overview.counts.all)} contacts · ${formatNumber(overview.counts.subscribed)} subscribed to WhatsApp messages`
        }
      />
      <div className="grid gap-6 lg:grid-cols-[15.5rem_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-6 lg:self-start">
          <GroupsPanel
            groups={overview.groups}
            counts={overview.counts}
            active={{ groupId: filters.groupId, status: filters.status }}
            hrefFor={hrefFor}
          />
        </div>
        <ContactsTable
          rows={rows}
          total={list.total}
          page={list.page}
          pages={list.pages}
          groups={overview.groups.map((g) => ({ id: g.id, name: g.name }))}
          tags={overview.tags.map((t) => t.tag)}
          cities={overview.cities}
          exportHref={`/api/contacts/export${exportParams.size ? `?${exportParams.toString()}` : ""}`}
          emptyBook={overview.counts.all === 0}
        />
      </div>
    </>
  );
}
