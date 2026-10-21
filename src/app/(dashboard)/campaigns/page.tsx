import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, CheckCheck, Eye, MessageCircleReply, Send } from "lucide-react";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { EmptyState, Meter, StatCard } from "@/components/app/kit";
import { PageHeader } from "@/components/app/page-header";
import { CampaignStatusPill } from "@/components/app/status";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime, formatNumber, percent } from "@/lib/format";
import { listCampaigns } from "@/lib/services/campaigns";
import { istMonthStart } from "@/lib/services/home";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Campaigns" };

const TABS = [
  { key: "all", label: "All" },
  { key: "SCHEDULED", label: "Scheduled" },
  { key: "SENDING", label: "Sending" },
  { key: "COMPLETED", label: "Completed" },
] as const;

export default async function CampaignsPage({ searchParams }: PageProps<"/campaigns">) {
  const { tab: rawTab } = await searchParams;
  const tab = TABS.find((t) => t.key === rawTab)?.key ?? "all";
  const campaigns = await listCampaigns({ take: 200 });
  const month = campaigns.filter((c) => (c.startedAt ?? c.createdAt) >= istMonthStart() && c.status !== "SCHEDULED");
  const m = month.reduce(
    (a, c) => ({ sent: a.sent + c.stats.sent, delivered: a.delivered + c.stats.delivered, read: a.read + c.stats.read, replied: a.replied + c.stats.replied }),
    { sent: 0, delivered: 0, read: 0, replied: 0 },
  );
  const shown = tab === "all" ? campaigns : campaigns.filter((c) => c.status === tab);

  return (
    <>
      <AutoRefresh active={campaigns.some((c) => c.status === "SENDING")} every={6000} />
      <PageHeader
        title="Campaigns"
        description="Every campaign you've sent, and how customers responded."
        actions={
          <Link href="/campaigns/new" className={buttonVariants()}>
            <Send /> Send campaign
          </Link>
        }
      />

      {campaigns.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon={BarChart3}
            title="No campaigns yet"
            description="Send your first campaign to see who received, read and replied."
            action={
              <Link href="/campaigns/new" className={buttonVariants()}>
                <Send /> Send campaign
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Campaigns this month" value={formatNumber(month.length)} icon={Send} tone="iris" />
            <StatCard label="Delivered" value={`${percent(m.delivered, m.sent)}%`} icon={CheckCheck} tone="sky" hint={`${formatNumber(m.delivered)} of ${formatNumber(m.sent)} messages`} />
            <StatCard label="Read" value={`${percent(m.read, m.sent)}%`} icon={Eye} tone="violet" hint={`${formatNumber(m.read)} customers read your messages`} />
            <StatCard label="Replies" value={formatNumber(m.replied)} icon={MessageCircleReply} tone="amber" hint={`${percent(m.replied, m.sent)}% of customers replied`} />
          </div>

          <nav aria-label="Filter campaigns" className="mb-4 flex flex-wrap gap-1.5">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={t.key === "all" ? "/campaigns" : `/campaigns?tab=${t.key}`}
                aria-current={tab === t.key ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors",
                  tab === t.key ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            ))}
          </nav>

          <div className="surface overflow-hidden">
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-[56rem] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-3 pr-4 pl-5 font-semibold">Campaign</th>
                    <th className="py-3 pr-4 font-semibold">Date</th>
                    <th className="py-3 pr-4 text-right font-semibold">Customers</th>
                    <th className="w-36 py-3 pr-4 font-semibold">Delivered</th>
                    <th className="w-36 py-3 pr-4 font-semibold">Read</th>
                    <th className="py-3 pr-4 text-right font-semibold">Replied</th>
                    <th className="py-3 pr-5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((c) => {
                    const d = percent(c.stats.delivered, c.stats.sent);
                    const r = percent(c.stats.read, c.stats.sent);
                    return (
                      <tr key={c.id} className="group border-b border-border/60 last:border-0 hover:bg-muted/50">
                        <td className="py-3 pr-4 pl-5">
                          <Link href={`/campaigns/${c.id}`} className="block max-w-[18rem]">
                            <span className="block truncate font-semibold group-hover:text-primary">{c.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">{c.designTitle}</span>
                          </Link>
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground">{formatDateTime(c.status === "SCHEDULED" ? c.scheduledAt : (c.startedAt ?? c.createdAt))}</td>
                        <td className="py-3 pr-4 text-right font-medium tabular-nums">{formatNumber(c.recipientCount)}</td>
                        <td className="py-3 pr-4">
                          {c.status === "SCHEDULED" ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Meter value={d} tone="sky" className="w-16" />
                              <span className="tabular-nums">{d}%</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {c.status === "SCHEDULED" ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Meter value={r} className="w-16" />
                              <span className="tabular-nums">{r}%</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums">{c.status === "SCHEDULED" ? "—" : formatNumber(c.stats.replied)}</td>
                        <td className="py-3 pr-5">
                          <CampaignStatusPill status={c.status} />
                        </td>
                      </tr>
                    );
                  })}
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-muted-foreground">
                        Nothing here right now.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
