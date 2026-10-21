import Link from "next/link";
import { Search } from "lucide-react";
import { Avatar } from "@/components/app/kit";
import { formatRelativeDay } from "@/lib/format";
import type { ConversationFilter } from "@/lib/services/chats";
import { cn } from "@/lib/utils";

export type ConversationItem = {
  id: string;
  name: string;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  windowOpen: boolean;
};

const TABS: { key: ConversationFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "open", label: "Open" },
];

export function ChatList({
  items,
  activeId,
  filter,
  q,
  className,
}: {
  items: ConversationItem[];
  activeId?: string;
  filter: ConversationFilter;
  q: string;
  className?: string;
}) {
  const href = (patch: { filter?: string; q?: string }, base = "/chats") => {
    const p = new URLSearchParams();
    const f = patch.filter ?? filter;
    const qq = patch.q ?? q;
    if (f !== "all") p.set("filter", f);
    if (qq) p.set("q", qq);
    const s = p.toString();
    return `${base}${s ? `?${s}` : ""}`;
  };
  const keep = href({}, "").replace(/^\?/, "");

  return (
    <div className={cn("flex min-h-0 flex-col border-r bg-card", className)}>
      <div className="grid gap-3 border-b p-4">
        <form action="/chats" className="relative">
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search chats"
            aria-label="Search chats"
            className="h-10 w-full rounded-xl border border-input bg-background pr-3 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </form>
        <nav aria-label="Filter chats" className="flex gap-1 rounded-xl bg-muted p-1">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={href({ filter: t.key })}
              aria-current={filter === t.key ? "page" : undefined}
              className={cn(
                "flex h-8 flex-1 items-center justify-center rounded-lg text-[0.82rem] font-medium transition-colors",
                filter === t.key ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      <ul className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2">
        {items.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-muted-foreground">
            {q || filter !== "all" ? "No chats match." : "When customers reply to your messages, their chats show up here."}
          </li>
        )}
        {items.map((c) => {
          const active = c.id === activeId;
          return (
            <li key={c.id}>
              <Link
                href={`/chats/${c.id}${keep ? `?${keep}` : ""}`}
                aria-current={active ? "page" : undefined}
                className={cn("flex gap-3 rounded-xl p-3 transition-colors", active ? "bg-accent" : "hover:bg-muted/70")}
              >
                <span className="relative">
                  <Avatar name={c.name} />
                  {c.windowOpen && <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-card bg-[oklch(0.62_0.13_236)]" title="Reply window open" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate text-sm", c.unreadCount ? "font-bold" : "font-semibold")}>{c.name}</span>
                    <span className={cn("shrink-0 text-[0.72rem]", c.unreadCount ? "font-semibold text-primary" : "text-muted-foreground")}>{formatRelativeDay(c.lastMessageAt)}</span>
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className={cn("truncate text-[0.82rem]", c.unreadCount ? "text-foreground" : "text-muted-foreground")}>{c.lastMessagePreview ?? ""}</span>
                    {c.unreadCount > 0 && (
                      <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[0.68rem] font-bold text-primary-foreground">{c.unreadCount}</span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
