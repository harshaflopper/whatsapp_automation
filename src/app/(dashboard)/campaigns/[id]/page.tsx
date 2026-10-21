import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarClock, Download, MessageCircleReply, Search } from "lucide-react";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { Avatar, Meter, Section, type Tone } from "@/components/app/kit";
import { PageHeader } from "@/components/app/page-header";
import { MessageBubble } from "@/components/app/phone-preview";
import { CampaignStatusPill, MessageStatusPill } from "@/components/app/status";
import { buttonVariants } from "@/components/ui/button";
import { renderMetaText } from "@/lib/designs/text";
import { formatDateTime, formatNumber, isWithin, percent, timeAgo } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import {
  FOLLOW_UP_LABEL,
  followUpCounts,
  getCampaign,
  listRecipients,
  problemBreakdown,
  type FollowUpSegment,
  type RecipientFilter,
} from "@/lib/services/campaigns";
import { toView } from "@/lib/services/designs";
import { cn } from "@/lib/utils";
import { CampaignControls } from "./campaign-controls";

export const metadata: Metadata = { title: "Campaign report" };

const FILTERS: { key: RecipientFilter; label: string }[] = [
  { key: "all", label: "Everyone" },
  { key: "read", label: "Read" },
  { key: "replied", label: "Replied" },
  { key: "not_read", label: "Not read" },
  { key: "not_delivered", label: "Didn't receive" },
  { key: "pending", label: "Waiting" },
];

const FOLLOW_UPS: { key: FollowUpSegment; hint: string }[] = [
  { key: "read_no_reply", hint: "Nudge them with a reminder or a better offer" },
  { key: "not_read", hint: "Try again at a different time" },
  { key: "replied", hint: "Thank them or share a booking link" },
];

export default async function CampaignPage({ params, searchParams }: PageProps<"/campaigns/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const filter = (FILTERS.find((f) => f.key === sp.filter)?.key ?? "all") as RecipientFilter;
  const q = typeof sp.q === "string" ? sp.q : "";

  const data = await getCampaign(id);
  if (!data) notFound();
  const { broadcast: b, stats } = data;
  const design = toView(b.template);

  const [recipients, problems, follow] = await Promise.all([listRecipients(id, filter, q, 300), problemBreakdown(id), followUpCounts(id)]);

  const sendingNow = b.status === "SENDING";
  const recentlySent = isWithin(b.startedAt, 3 * 3600_000);
  const done = stats.total - stats.pending;
  const sampleParams = (b.variableMap as unknown as { source: string; value?: string; fallback?: string }[]) ?? [];
  const previewBody = renderMetaText(
    design.body,
    design.variables.map((v, i) => {
      const m = sampleParams[i];
      if (!m) return v.sample;
      if (m.source === "text") return m.value ?? "";
      return m.source === "city" ? "Bengaluru" : "Priya";
    }),
    design.variables.map((v) => v.label),
  );

  const funnel: { label: string; value: number; pct: number; tone: Tone; filter: RecipientFilter }[] = [
    { label: "Sent", value: stats.sent, pct: percent(stats.sent, stats.total), tone: "slate", filter: "all" },
    { label: "Delivered", value: stats.delivered, pct: percent(stats.delivered, stats.sent), tone: "sky", filter: "all" },
    { label: "Read", value: stats.read, pct: percent(stats.read, stats.sent), tone: "iris", filter: "read" },
    { label: "Replied", value: stats.replied, pct: percent(stats.replied, stats.sent), tone: "amber", filter: "replied" },
    { label: "Didn't receive", value: stats.notDelivered, pct: percent(stats.notDelivered, stats.total), tone: "rose", filter: "not_delivered" },
  ];

  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    if (filter !== "all") p.set("filter", filter);
    if (q) p.set("q", q);
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const s = p.toString();
    return `/campaigns/${id}${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <AutoRefresh active={sendingNow || recentlySent || b.status === "SCHEDULED"} every={sendingNow ? 4000 : 10000} />
      <PageHeader
        eyebrow={
          <Link href="/campaigns" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="size-4" /> Campaigns
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {b.name} <CampaignStatusPill status={b.status} />
          </span>
        }
        description={
          b.status === "SCHEDULED"
            ? `Goes out ${formatDateTime(b.scheduledAt)} to ${formatNumber(b.recipientCount)} customers.`
            : `${design.title} · started ${formatDateTime(b.startedAt ?? b.createdAt)} · ${formatNumber(b.recipientCount)} customers`
        }
        actions={
          <>
            <CampaignControls id={b.id} status={b.status} />
            <a href={`/api/campaigns/${b.id}/export`} className={buttonVariants({ variant: "outline" })}>
              <Download /> Download report
            </a>
          </>
        }
      />

      {b.status === "SCHEDULED" ? (
        <div className="surface mb-6 flex items-center gap-4 p-5">
          <span className="grid size-12 place-items-center rounded-2xl bg-[oklch(0.95_0.04_305)] text-[oklch(0.45_0.19_305)]">
            <CalendarClock className="size-6" />
          </span>
          <div>
            <div className="font-semibold">Scheduled for {formatDateTime(b.scheduledAt)}</div>
            <div className="text-sm text-muted-foreground">You can pause or cancel it until then. Results appear here once it starts.</div>
          </div>
        </div>
      ) : (
        <>
          {(sendingNow || b.status === "PAUSED") && stats.total > 0 && (
            <div className="surface mb-6 p-5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-semibold">{b.status === "PAUSED" ? "Paused" : "Sending…"}</span>
                <span className="text-muted-foreground tabular-nums">
                  {formatNumber(done)} of {formatNumber(stats.total)} done
                </span>
              </div>
              <Meter value={percent(done, stats.total)} className="mt-3 h-2" tone="sky" />
            </div>
          )}

          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            {funnel.map((f) => (
              <Link key={f.label} href={qs({ filter: f.filter === "all" ? "" : f.filter })} className="surface group p-5 transition hover:shadow-lift">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-muted-foreground">{f.label}</span>
                  <span className="text-xs font-semibold text-muted-foreground tabular-nums">{f.pct}%</span>
                </div>
                <div className="mt-2 text-3xl font-bold tracking-tight tabular-nums">{formatNumber(f.value)}</div>
                <Meter value={f.pct} tone={f.tone} className="mt-3" />
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="surface overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b p-4">
            <nav aria-label="Filter customers" className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
              {FILTERS.map((f) => (
                <Link
                  key={f.key}
                  href={qs({ filter: f.key === "all" ? "" : f.key })}
                  aria-current={filter === f.key ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center rounded-lg px-3 text-[0.82rem] font-medium transition-colors",
                    filter === f.key ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                </Link>
              ))}
            </nav>
            <form action={`/campaigns/${id}`} className="relative ml-auto w-full sm:w-60">
              {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Search name or number"
                aria-label="Search customers"
                className="h-9 w-full rounded-xl border border-input bg-card pr-3 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </form>
          </div>
          <div className="scrollbar-thin max-h-[36rem] overflow-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2.5 pr-4 pl-4 font-semibold">Customer</th>
                  <th className="py-2.5 pr-4 font-semibold">Status</th>
                  <th className="py-2.5 pr-4 font-semibold">Updated</th>
                  <th className="py-2.5 pr-4 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                    <td className="py-2.5 pr-4 pl-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.name} size="sm" />
                        <div className="min-w-0">
                          <div className="max-w-[12rem] truncate font-medium">{r.name}</div>
                          <div className="text-xs text-muted-foreground tabular-nums">{formatPhone(r.phone)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <MessageStatusPill status={r.status} />
                        {r.replied && (
                          <Link href={`/chats/${r.contactId}`} className="inline-flex h-6 items-center gap-1 rounded-full bg-[oklch(0.96_0.05_80)] px-2 text-xs font-semibold text-[oklch(0.45_0.11_60)] ring-1 ring-[oklch(0.87_0.09_75)] ring-inset hover:underline">
                            <MessageCircleReply className="size-3" /> Replied
                          </Link>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap text-muted-foreground">{timeAgo(r.readAt ?? r.deliveredAt ?? r.sentAt ?? r.updatedAt)}</td>
                    <td className="max-w-[16rem] py-2.5 pr-4 text-[0.82rem] text-muted-foreground">{r.problem ?? ""}</td>
                  </tr>
                ))}
                {recipients.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-muted-foreground">
                      No customers here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid content-start gap-6">
          {b.status !== "SCHEDULED" && (
            <Section title="Follow up" description="Send a new message to just one group from this campaign.">
              <ul className="grid gap-2">
                {FOLLOW_UPS.map((f) => {
                  const n = follow[f.key];
                  return (
                    <li key={f.key}>
                      <Link
                        href={n ? `/campaigns/new?from=${b.id}&segment=${f.key}` : "#"}
                        aria-disabled={!n}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border p-3.5 transition-colors",
                          n ? "hover:border-primary/40 hover:bg-accent/40" : "pointer-events-none opacity-50",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{FOLLOW_UP_LABEL[f.key]}</span>
                          <span className="block text-[0.8rem] text-muted-foreground">{f.hint}</span>
                        </span>
                        <span className="text-lg font-bold tabular-nums">{formatNumber(n)}</span>
                        <ArrowRight className="size-4 text-muted-foreground" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          {problems.length > 0 && (
            <Section title="Why some didn't receive it">
              <ul className="grid gap-2">
                {problems.map((p) => (
                  <li key={p.label} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{p.label}</span>
                    <span className="font-semibold tabular-nums">{formatNumber(p.count)}</span>
                  </li>
                ))}
              </ul>
              <Link href={qs({ filter: "not_delivered" })} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                See who <ArrowRight className="size-4" />
              </Link>
            </Section>
          )}

          <Section title="Message sent">
            <div className="chat-wallpaper rounded-xl p-4">
              <MessageBubble header={design.header} body={previewBody} footer={design.footer} buttons={design.buttons} />
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
