import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Megaphone, UserRound } from "lucide-react";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { Avatar, Pill } from "@/components/app/kit";
import { WhatsAppText } from "@/components/app/phone-preview";
import { Ticks } from "@/components/app/status";
import { formatClock, formatDate } from "@/lib/format";
import { firstName } from "@/lib/campaigns/personalize";
import { formatPhone } from "@/lib/phone";
import { getThread, listConversations, listQuickReplies, markRead, type ConversationFilter } from "@/lib/services/chats";
import { readyDesigns } from "@/lib/services/designs";
import { cn } from "@/lib/utils";
import { ChatList } from "../chat-list";
import { Composer } from "../composer";
import { ScrollToBottom } from "../scroll-bottom";

export const metadata: Metadata = { title: "Chat" };

function windowLeft(ms: number): string {
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

export default async function ChatPage({ params, searchParams }: PageProps<"/chats/[contactId]">) {
  const { contactId } = await params;
  const sp = await searchParams;
  const filter = (["all", "unread", "open"].includes(String(sp.filter)) ? sp.filter : "all") as ConversationFilter;
  const q = typeof sp.q === "string" ? sp.q : "";

  await markRead(contactId);
  const [thread, items, quickReplies, designs] = await Promise.all([
    getThread(contactId),
    listConversations({ q, filter }),
    listQuickReplies(),
    readyDesigns(),
  ]);
  if (!thread) notFound();
  const { contact, messages } = thread;
  const unsubscribed = !contact.optedIn && !!contact.optedOutAt;

  // Group by day for date separators.
  const days: { day: string; items: typeof messages }[] = [];
  for (const m of messages) {
    const d = formatDate(m.createdAt);
    if (!days.length || days[days.length - 1].day !== d) days.push({ day: d, items: [] });
    days[days.length - 1].items.push(m);
  }

  return (
    <>
      <AutoRefresh every={5000} />
      <div className="surface grid h-[calc(100svh-7.5rem)] min-h-[32rem] overflow-hidden lg:h-[calc(100svh-9rem)] lg:grid-cols-[22rem_minmax(0,1fr)]">
        <ChatList items={items} activeId={contactId} filter={filter} q={q} className="hidden lg:flex" />

        <div className="flex min-h-0 min-w-0 flex-col">
          <header className="flex items-center gap-3 border-b px-4 py-3 sm:px-5">
            <Link href="/chats" className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted lg:hidden" aria-label="Back to chats">
              <ArrowLeft className="size-5" />
            </Link>
            <Avatar name={contact.name} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{contact.name}</div>
              <div className="truncate text-xs whitespace-nowrap text-muted-foreground tabular-nums">{formatPhone(contact.phone)}</div>
            </div>
            {unsubscribed ? (
              <Pill tone="slate">Unsubscribed</Pill>
            ) : thread.windowOpen ? (
              <Pill tone="sky" dot>
                <span className="hidden sm:inline">Reply window open · </span>
                {windowLeft(thread.windowRemainingMs)} left
              </Pill>
            ) : (
              <Pill tone="slate">Chat closed</Pill>
            )}
            <Link href={`/contacts?q=${encodeURIComponent(contact.phone.replace("+", ""))}`} className="hidden h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-flex">
              <UserRound className="size-4" /> Contact
            </Link>
          </header>

          <ScrollToBottom dep={`${messages.length}-${messages.at(-1)?.status ?? ""}`} className="chat-wallpaper scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-8">
            {days.map((d) => (
              <div key={d.day} className="grid gap-1.5">
                <div className="my-3 flex justify-center">
                  <span className="rounded-lg bg-white/90 px-2.5 py-1 text-[0.7rem] font-medium text-[#54656f] shadow-sm">{d.day}</span>
                </div>
                {d.items.map((m) => {
                  const out = m.direction === "OUTBOUND";
                  return (
                    <div key={m.id} className={cn("flex", out ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[85%] rounded-xl px-3 pt-2 pb-1.5 text-[0.88rem] leading-[1.45] text-[#111b21] shadow-[0_1px_0.5px_rgb(11_20_26/0.13)] sm:max-w-[70%]",
                          out ? "rounded-tr-sm bg-[#e7e4fb]" : "rounded-tl-sm bg-white",
                        )}
                      >
                        {m.broadcast && (
                          <Link href={`/campaigns/${m.broadcast.id}`} className="mb-1 flex items-center gap-1 text-[0.7rem] font-semibold text-[oklch(0.45_0.18_277)] hover:underline">
                            <Megaphone className="size-3" /> {m.broadcast.name}
                          </Link>
                        )}
                        <div className="whitespace-pre-wrap break-words">
                          <WhatsAppText text={m.body ?? `[${m.type}]`} />
                        </div>
                        <div className="mt-0.5 flex items-center justify-end gap-1 text-[0.68rem] text-[#667781]">
                          {formatClock(m.createdAt)}
                          {out && <Ticks status={m.status} />}
                        </div>
                        {out && m.status === "FAILED" && m.errorDetail && <div className="mt-1 text-[0.72rem] text-[oklch(0.5_0.18_18)]">{m.errorDetail}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            {messages.length === 0 && <p className="py-10 text-center text-sm text-[#54656f]">No messages yet.</p>}
          </ScrollToBottom>

          <Composer
            contactId={contact.id}
            firstName={firstName(contact.name)}
            windowOpen={thread.windowOpen}
            unsubscribed={unsubscribed}
            quickReplies={quickReplies.map((r) => ({ id: r.id, title: r.title, body: r.body }))}
            designs={designs.map((d) => ({ id: d.id, title: d.title, header: d.header, body: d.body, footer: d.footer, buttons: d.buttons, variables: d.variables }))}
          />
        </div>
      </div>
    </>
  );
}
