import { db } from "@/lib/db";
import { getProvider, isProviderError } from "@/lib/messaging";
import { assertCanSend, ComplianceError } from "@/lib/messaging/compliance";
import type { MessagingProvider } from "@/lib/messaging/provider";

/**
 * The send queue. QUEUED outbound rows in the Message table are the jobs (outbox pattern).
 * Runs from the "Send now" request (via after()), from /api/cron/process every minute, and
 * from `npm run worker` locally. Rows are claimed with FOR UPDATE SKIP LOCKED, so two
 * runners never send the same message twice.
 *
 * The business never sees any of this: over-limit messages simply wait and go out later,
 * and the campaign shows "Sending" until everything is done.
 */

const MAX_ATTEMPTS = 5;
const STALE_LOCK_MS = 5 * 60_000;
const WINDOW_MS = 24 * 60 * 60_000;

function dailyLimit(): number {
  const n = Number(process.env.WA_DAILY_LIMIT ?? 250);
  return Number.isFinite(n) && n > 0 ? n : 0; // 0 = don't enforce
}

function sendRate(): number {
  const n = Number(process.env.WA_SEND_RATE_PER_SEC ?? 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 80) : 10;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function backoffMs(attempt: number): number {
  return Math.min(30_000 * 2 ** Math.max(0, attempt - 1), 30 * 60_000);
}

async function claimBatch(size: number): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    UPDATE "Message" SET "status" = 'SENDING', "lockedAt" = NOW(), "updatedAt" = NOW()
    WHERE "id" IN (
      SELECT m."id" FROM "Message" m
      LEFT JOIN "Broadcast" b ON b."id" = m."broadcastId"
      WHERE m."status" = 'QUEUED' AND m."direction" = 'OUTBOUND'
        AND (m."nextAttemptAt" IS NULL OR m."nextAttemptAt" <= NOW())
        AND (m."broadcastId" IS NULL OR b."status" = 'SENDING')
      ORDER BY m."nextAttemptAt" ASC NULLS FIRST, m."queuedAt" ASC
      LIMIT ${size}
      FOR UPDATE OF m SKIP LOCKED
    )
    RETURNING "id"`;
  return rows.map((r) => r.id);
}

/** Who has received a business-started message in the last 24h, and when the oldest one frees up. */
async function recentRecipients(): Promise<{ set: Set<string>; oldest: Date | null }> {
  const since = new Date(Date.now() - WINDOW_MS);
  const rows = await db.message.findMany({
    where: { direction: "OUTBOUND", type: "template", sentAt: { gte: since } },
    select: { contactId: true, sentAt: true },
    orderBy: { sentAt: "asc" },
  });
  return { set: new Set(rows.map((r) => r.contactId)), oldest: rows[0]?.sentAt ?? null };
}

export type QueueRunResult = { sent: number; failed: number; deferred: number; retried: number; stoppedEarly?: string };

export async function processQueue(opts: { maxMs?: number; batch?: number } = {}): Promise<QueueRunResult> {
  const started = Date.now();
  const maxMs = opts.maxMs ?? 20_000;
  const batch = opts.batch ?? 25;
  const result: QueueRunResult = { sent: 0, failed: 0, deferred: 0, retried: 0 };

  // Release rows a crashed runner left half-done.
  await db.message.updateMany({
    where: { status: "SENDING", wamid: null, lockedAt: { lt: new Date(Date.now() - STALE_LOCK_MS) } },
    data: { status: "QUEUED", lockedAt: null },
  });

  // Scheduled campaigns whose time has come.
  await db.broadcast.updateMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
    data: { status: "SENDING", startedAt: new Date() },
  });

  let provider: MessagingProvider;
  try {
    provider = getProvider();
  } catch (e) {
    await finishCampaigns();
    return { ...result, stoppedEarly: e instanceof Error ? e.message : "Provider unavailable" };
  }

  const limit = dailyLimit();
  const recent = limit ? await recentRecipients() : { set: new Set<string>(), oldest: null };
  const gap = Math.ceil(1000 / sendRate());

  outer: while (Date.now() - started < maxMs) {
    const ids = await claimBatch(batch);
    if (!ids.length) break;

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (Date.now() - started >= maxMs) {
        // Out of time: hand the rest back untouched.
        await db.message.updateMany({ where: { id: { in: ids.slice(i) }, status: "SENDING" }, data: { status: "QUEUED", lockedAt: null } });
        break outer;
      }

      const m = await db.message.findUnique({ where: { id }, include: { contact: true } });
      if (!m || m.status !== "SENDING") continue;

      try {
        assertCanSend(m.contact, m.type === "text" ? "text" : "template");
      } catch (e) {
        if (e instanceof ComplianceError) {
          await db.message.update({
            where: { id },
            data: { status: "CANCELLED", errorCode: e.code, errorTitle: "Not sent", errorDetail: e.message, lockedAt: null },
          });
          result.failed++;
          continue;
        }
        throw e;
      }

      if (m.type === "template" && limit && !recent.set.has(m.contactId) && recent.set.size >= limit) {
        const freeAt = new Date((recent.oldest?.getTime() ?? Date.now()) + WINDOW_MS + 60_000);
        await db.message.update({ where: { id }, data: { status: "QUEUED", nextAttemptAt: freeAt, lockedAt: null } });
        result.deferred++;
        continue;
      }

      const payload = (m.payload ?? {}) as { body?: string[] };
      try {
        const res =
          m.type === "text"
            ? await provider.sendText({ to: m.contact.phone, body: m.body ?? "" })
            : await provider.sendTemplate({
                to: m.contact.phone,
                templateName: m.templateName ?? "",
                language: m.templateLang ?? "en",
                params: payload.body?.length ? { body: payload.body } : undefined,
              });
        await db.message.update({
          where: { id },
          data: { status: "SENT", wamid: res.messageId, sentAt: new Date(), attempts: { increment: 1 }, lockedAt: null, errorCode: null, errorTitle: null, errorDetail: null },
        });
        if (m.type === "template") {
          if (!recent.set.size) recent.oldest = new Date();
          recent.set.add(m.contactId);
        }
        result.sent++;
      } catch (e) {
        const err = isProviderError(e) ? e : null;
        const attempts = m.attempts + 1;
        if (err?.retryable && attempts < MAX_ATTEMPTS) {
          await db.message.update({
            where: { id },
            data: {
              status: "QUEUED",
              attempts,
              nextAttemptAt: new Date(Date.now() + backoffMs(attempts)),
              errorCode: err.code,
              errorTitle: err.info.title,
              errorDetail: err.friendly,
              lockedAt: null,
            },
          });
          result.retried++;
          // Throttled by Meta: stop this run and let the backoff breathe.
          if (["4", "80007", "130429"].includes(err.code)) break outer;
        } else if (e instanceof Error && e.name === "ConfigError") {
          await db.message.update({ where: { id }, data: { status: "QUEUED", lockedAt: null, nextAttemptAt: new Date(Date.now() + 5 * 60_000) } });
          result.stoppedEarly = e.message;
          break outer;
        } else {
          await db.message.update({
            where: { id },
            data: {
              status: "FAILED",
              attempts,
              failedAt: new Date(),
              errorCode: err?.code ?? "UNKNOWN",
              errorTitle: err?.info.title ?? "Unexpected error",
              errorDetail: err?.friendly ?? (e instanceof Error ? e.message : String(e)),
              lockedAt: null,
            },
          });
          if (err?.code === "131026") await db.contact.update({ where: { id: m.contactId }, data: { undeliverable: true } });
          result.failed++;
        }
      }
      await sleep(gap);
    }
  }

  await finishCampaigns();
  return result;
}

/** Campaigns with nothing left to send are complete. */
async function finishCampaigns() {
  const sending = await db.broadcast.findMany({ where: { status: "SENDING" }, select: { id: true } });
  for (const b of sending) {
    const left = await db.message.count({ where: { broadcastId: b.id, status: { in: ["QUEUED", "SENDING"] } } });
    if (!left) await db.broadcast.update({ where: { id: b.id }, data: { status: "COMPLETED", completedAt: new Date() } });
  }
}
