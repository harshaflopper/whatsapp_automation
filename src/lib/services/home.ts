import { db } from "@/lib/db";
import { listCampaigns } from "@/lib/services/campaigns";
import { unreadTotal } from "@/lib/services/chats";
import { listDesigns } from "@/lib/services/designs";

/** First moment of the current month in IST, as a UTC Date. */
export function istMonthStart(now: Date = new Date()): Date {
  const ist = new Date(now.getTime() + 330 * 60_000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - 330 * 60_000);
}

export async function homeData() {
  const monthStart = istMonthStart();
  const [contacts, sentThisMonth, deliveredThisMonth, recent, upcoming, unread, designs, lastCompleted] = await Promise.all([
    db.contact.count(),
    db.message.count({ where: { direction: "OUTBOUND", sentAt: { gte: monthStart } } }),
    db.message.count({ where: { direction: "OUTBOUND", deliveredAt: { gte: monthStart } } }),
    listCampaigns({ take: 6, where: { status: { not: "SCHEDULED" } } }),
    db.broadcast.findMany({
      where: { status: "SCHEDULED" },
      orderBy: { scheduledAt: "asc" },
      take: 4,
      include: { template: { select: { title: true, name: true } } },
    }),
    unreadTotal(),
    listDesigns(),
    db.broadcast.findFirst({ where: { status: "COMPLETED" }, orderBy: { completedAt: "desc" }, select: { id: true, name: true } }),
  ]);

  const failedLast = lastCompleted
    ? await db.message.count({ where: { broadcastId: lastCompleted.id, status: "FAILED" } })
    : 0;

  return {
    contacts,
    sentThisMonth,
    deliveredThisMonth,
    recent,
    upcoming,
    todo: {
      unreadChats: unread.chats,
      unreadMessages: unread.messages,
      needsChanges: designs.filter((d) => d.state === "changes"),
      underReview: designs.filter((d) => d.state === "review").length,
      lastCampaign: lastCompleted ? { ...lastCompleted, failed: failedLast } : null,
    },
    hasReadyDesign: designs.some((d) => d.state === "ready"),
  };
}
