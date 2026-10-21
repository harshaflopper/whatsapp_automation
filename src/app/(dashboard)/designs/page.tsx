import type { Metadata } from "next";
import Link from "next/link";
import { Globe, PenLine, Plus } from "lucide-react";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { EmptyState } from "@/components/app/kit";
import { PageHeader } from "@/components/app/page-header";
import { MessageBubble } from "@/components/app/phone-preview";
import { DesignStatePill } from "@/components/app/status";
import { buttonVariants } from "@/components/ui/button";
import { languageLabel, renderMetaText, typeLabel, type DesignState } from "@/lib/designs/text";
import { formatDate } from "@/lib/format";
import { autoSyncIfWaiting, listDesigns } from "@/lib/services/designs";
import { cn } from "@/lib/utils";
import { DesignCardActions, RefreshDesignsButton } from "./design-card-actions";

export const metadata: Metadata = { title: "Message designs" };

const TABS: { key: "all" | DesignState; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ready", label: "Ready to use" },
  { key: "review", label: "Under review" },
  { key: "changes", label: "Needs changes" },
  { key: "draft", label: "Drafts" },
];

export default async function DesignsPage({ searchParams }: PageProps<"/designs">) {
  const { tab: rawTab } = await searchParams;
  const tab = TABS.some((t) => t.key === rawTab) ? (rawTab as "all" | DesignState) : "all";
  const designs = await autoSyncIfWaiting(await listDesigns());
  const counts = Object.fromEntries(TABS.map((t) => [t.key, t.key === "all" ? designs.length : designs.filter((d) => d.state === t.key).length]));
  const shown = tab === "all" ? designs : designs.filter((d) => d.state === tab);

  return (
    <>
      <AutoRefresh active={designs.some((d) => d.state === "review")} every={20000} />
      <PageHeader
        title="Message designs"
        description="Messages WhatsApp has approved for you to send. Create one once, use it in as many campaigns as you like."
        actions={
          <>
            <RefreshDesignsButton />
            <Link href="/designs/new" className={buttonVariants()}>
              <Plus /> New design
            </Link>
          </>
        }
      />

      {designs.length > 0 && (
        <nav aria-label="Filter designs" className="mb-5 flex flex-wrap gap-1.5">
          {TABS.filter((t) => t.key === "all" || counts[t.key] > 0).map((t) => (
            <Link
              key={t.key}
              href={t.key === "all" ? "/designs" : `/designs?tab=${t.key}`}
              aria-current={tab === t.key ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors",
                tab === t.key ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              <span className={cn("text-xs tabular-nums", tab === t.key ? "text-background/70" : "text-muted-foreground")}>{counts[t.key]}</span>
            </Link>
          ))}
        </nav>
      )}

      {designs.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon={PenLine}
            title="Create your first message design"
            description="Pick a ready-made design like a festival offer or appointment reminder, adjust the words, and send it to WhatsApp for a quick review."
            action={
              <Link href="/designs/new" className={buttonVariants()}>
                <Plus /> New design
              </Link>
            }
          />
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((d) => (
            <article key={d.id} className="surface flex flex-col overflow-hidden">
              <div className="chat-wallpaper relative h-52 overflow-hidden px-5 pt-5">
                <MessageBubble
                  header={d.header}
                  body={renderMetaText(d.body, d.variables.map((v) => (v.kind === "name" ? "Priya" : v.sample)), d.variables.map((v) => v.label))}
                  footer={d.footer}
                  buttons={d.buttons}
                  className="max-w-[17rem]"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#efeae2] to-transparent" />
              </div>
              <div className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold">{d.title}</h2>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.82rem] text-muted-foreground">
                      <span>{typeLabel(d.category)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Globe className="size-3.5" />
                        {languageLabel(d.language)}
                      </span>
                    </p>
                  </div>
                  <DesignStatePill state={d.state} />
                </div>
                {d.problem && <p className="rounded-xl bg-[oklch(0.97_0.02_15)] px-3 py-2 text-[0.82rem] text-[oklch(0.45_0.17_18)]">{d.problem}</p>}
                {d.state === "review" && (
                  <p className="text-[0.82rem] text-muted-foreground">WhatsApp is checking this message. It usually takes a few minutes.</p>
                )}
                <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">
                    {d.usedIn > 0 ? `Used in ${d.usedIn} ${d.usedIn === 1 ? "campaign" : "campaigns"}` : `Edited ${formatDate(d.updatedAt)}`}
                  </span>
                  <DesignCardActions id={d.id} ready={d.state === "ready"} />
                </div>
              </div>
            </article>
          ))}
          {shown.length === 0 && <p className="text-sm text-muted-foreground">Nothing here right now.</p>}
        </div>
      )}
    </>
  );
}
