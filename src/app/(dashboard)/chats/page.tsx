import type { Metadata } from "next";
import { MessagesSquare } from "lucide-react";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { EmptyState } from "@/components/app/kit";
import { PageHeader } from "@/components/app/page-header";
import { listConversations, type ConversationFilter } from "@/lib/services/chats";
import { ChatList } from "./chat-list";

export const metadata: Metadata = { title: "Chats" };

export default async function ChatsPage({ searchParams }: PageProps<"/chats">) {
  const sp = await searchParams;
  const filter = (["all", "unread", "open"].includes(String(sp.filter)) ? sp.filter : "all") as ConversationFilter;
  const q = typeof sp.q === "string" ? sp.q : "";
  const items = await listConversations({ q, filter });

  return (
    <>
      <AutoRefresh every={6000} />
      <PageHeader title="Chats" description="Replies from your customers. You can answer for free within 24 hours of their last message." />
      <div className="surface grid h-[calc(100svh-15rem)] min-h-[32rem] overflow-hidden lg:grid-cols-[22rem_minmax(0,1fr)]">
        <ChatList items={items} filter={filter} q={q} />
        <div className="hidden items-center justify-center bg-muted/30 lg:flex">
          <EmptyState icon={MessagesSquare} title="Pick a chat" description="Choose a conversation on the left to read and reply." />
        </div>
      </div>
    </>
  );
}
