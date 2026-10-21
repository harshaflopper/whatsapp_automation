import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCheck,
  CircleAlert,
  MessagesSquare,
  PenLine,
  Plus,
  Send,
  UserPlus,
  Users,
} from "lucide-react";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { EmptyState, IconChip, Meter, Section, StatCard } from "@/components/app/kit";
import { CampaignStatusPill } from "@/components/app/status";
import { buttonVariants } from "@/components/ui/button";
import { dateChip, formatClock, formatDateTime, formatNumber, greeting, percent } from "@/lib/format";
import { homeData } from "@/lib/services/home";
import { getBusinessProfile } from "@/lib/settings";
import { cn } from "@/lib/utils";

export default async function HomePage() {
  const [data, profile] = await Promise.all([homeData(), getBusinessProfile()]);
  const deliveredPct = percent(data.deliveredThisMonth, data.sentThisMonth);
  const live = data.recent.some((c) => c.status === "SENDING");

  const todos: { href: string; tone: "amber" | "rose" | "iris" | "sky"; icon: typeof MessagesSquare; title: string; text: string }[] = [];
  if (data.todo.unreadChats > 0)
    todos.push({
      href: "/chats?filter=unread",
      tone: "amber",
      icon: MessagesSquare,
      title: `${data.todo.unreadMessages} new ${data.todo.unreadMessages === 1 ? "reply" : "replies"}`,
      text: `${data.todo.unreadChats} ${data.todo.unreadChats === 1 ? "customer is" : "customers are"} waiting for an answer.`,
    });
  for (const d of data.todo.needsChanges.slice(0, 2))
    todos.push({ href: `/designs/${d.id}`, tone: "rose", icon: PenLine, title: `"${d.title}" needs changes`, text: d.problem ?? "Edit and submit it again." });
  if (data.todo.lastCampaign && data.todo.lastCampaign.failed > 0)
    todos.push({
      href: `/campaigns/${data.todo.lastCampaign.id}?filter=not_delivered`,
      tone: "rose",
      icon: CircleAlert,
      title: `${data.todo.lastCampaign.failed} ${data.todo.lastCampaign.failed === 1 ? "number" : "numbers"} couldn't receive your last campaign`,
      text: "Check and fix those numbers.",
    });
  if (data.todo.underReview > 0)
    todos.push({
      href: "/designs",
      tone: "iris",
      icon: PenLine,
      title: `${data.todo.underReview} ${data.todo.underReview === 1 ? "design is" : "designs are"} under review`,
      text: "WhatsApp usually answers within a few minutes.",
    });

  return (
    <>
      <AutoRefresh active={live} every={6000} />

      <section className="surface hero-glow relative mb-6 overflow-hidden p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{greeting()}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-[2.1rem]">{profile.businessName}</h1>
            <p className="mt-2 max-w-xl text-muted-foreground">
              {data.recent.length
                ? "Here's how your WhatsApp messages are doing this month."
                : "Add your customers, create a message, and send your first campaign."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/contacts?add=1" className={buttonVariants({ variant: "outline", size: "lg" })}>
              <UserPlus /> Add contacts
            </Link>
            <Link href="/campaigns/new" className={buttonVariants({ size: "lg" })}>
              <Send /> Send campaign
            </Link>
          </div>
        </div>
      </section>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Contacts" value={formatNumber(data.contacts)} icon={Users} tone="iris" hint={<Link href="/contacts" className="font-medium text-primary hover:underline">View all contacts</Link>} />
        <StatCard label="Messages sent this month" value={formatNumber(data.sentThisMonth)} icon={Send} tone="slate" hint="Campaigns, replies and single messages" />
        <StatCard
          label="Delivered this month"
          value={formatNumber(data.deliveredThisMonth)}
          icon={CheckCheck}
          tone="iris"
          hint={data.sentThisMonth ? `${deliveredPct}% of messages sent` : "Shows up once you send"}
        />
      </div>

      {!data.hasReadyDesign && (
        <section className="surface mb-6 flex flex-col gap-4 border-dashed p-5 sm:flex-row sm:items-center sm:p-6">
          <IconChip icon={PenLine} tone="iris" className="size-12" />
          <div className="flex-1">
            <h2 className="font-semibold">Create your first message design</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              WhatsApp needs to approve a message once before you can send it to customers. Start from a ready-made design. It takes a minute.
            </p>
          </div>
          <Link href="/designs/new" className={buttonVariants({ variant: "outline" })}>
            <Plus /> New design
          </Link>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Section
          title="Recent campaigns"
          actions={
            data.recent.length > 0 && (
              <Link href="/campaigns" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                All campaigns <ArrowRight className="size-4" />
              </Link>
            )
          }
          bodyClassName="px-2 pb-2 sm:px-3 sm:pb-3"
        >
          {data.recent.length === 0 ? (
            <EmptyState
              icon={Send}
              title="No campaigns yet"
              description="When you send a campaign, you'll see how many customers received, read and replied to it here."
              action={
                <Link href="/campaigns/new" className={buttonVariants()}>
                  <Send /> Send your first campaign
                </Link>
              }
            />
          ) : (
            <ul className="grid">
              {data.recent.map((c) => {
                const readPct = percent(c.stats.read, c.stats.sent);
                return (
                  <li key={c.id}>
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="grid gap-3 rounded-xl px-3 py-3.5 transition-colors hover:bg-muted/70 sm:grid-cols-[minmax(0,1fr)_8rem_6rem_7.5rem] sm:items-center"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{c.name}</div>
                        <div className="truncate text-[0.82rem] text-muted-foreground">
                          {c.designTitle} · {formatDateTime(c.startedAt ?? c.createdAt)}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                          <span>Read</span>
                          <span className="font-semibold text-foreground tabular-nums">{readPct}%</span>
                        </div>
                        <Meter value={readPct} className="mt-1.5" />
                      </div>
                      <div className="text-sm tabular-nums">
                        <span className="font-semibold">{formatNumber(c.stats.sent)}</span>
                        <span className="text-muted-foreground"> sent</span>
                        <div className="text-xs text-muted-foreground">{formatNumber(c.stats.replied)} replied</div>
                      </div>
                      <div className="sm:justify-self-end">
                        <CampaignStatusPill status={c.status} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <div className="grid content-start gap-6">
          <Section title="To do">
            {todos.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
                <CheckCheck className="size-5 text-primary" />
                You’re all caught up.
              </div>
            ) : (
              <ul className="grid gap-2">
                {todos.map((t) => (
                  <li key={t.title}>
                    <Link href={t.href} className="flex gap-3 rounded-xl p-3 transition-colors hover:bg-muted/70">
                      <IconChip icon={t.icon} tone={t.tone} className="size-9" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{t.title}</span>
                        <span className="block text-[0.82rem] text-muted-foreground">{t.text}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Coming up">
            {data.upcoming.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
                <CalendarClock className="size-5" />
                Nothing scheduled. Plan a campaign for later from Send campaign.
              </div>
            ) : (
              <ul className="grid gap-1">
                {data.upcoming.map((b) => {
                  const chip = dateChip(b.scheduledAt!);
                  return (
                    <li key={b.id}>
                      <Link href={`/campaigns/${b.id}`} className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted/70">
                        <span className="grid w-12 shrink-0 rounded-xl bg-accent py-1.5 text-center text-accent-foreground">
                          <span className="text-[0.65rem] font-bold tracking-wider uppercase">{chip.month}</span>
                          <span className="text-lg leading-tight font-bold">{chip.day}</span>
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{b.name}</span>
                          <span className={cn("block text-[0.82rem] text-muted-foreground")}>
                            {formatClock(b.scheduledAt)} · {formatNumber(b.recipientCount)} customers
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
