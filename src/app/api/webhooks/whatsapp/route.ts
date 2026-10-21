import { createHash } from "node:crypto";
import { after, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getProvider } from "@/lib/messaging";
import { processWebhookEvents } from "@/lib/services/webhook-processor";

/** Meta's one-time verification handshake when the webhook URL is saved in the dashboard. */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const expected = process.env.WA_WEBHOOK_VERIFY_TOKEN?.trim();
  if (p.get("hub.mode") === "subscribe" && expected && p.get("hub.verify_token") === expected) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

/** Delivery ticks, customer replies and design review results. */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  let provider;
  try {
    provider = getProvider();
  } catch {
    return new Response("Not configured", { status: 503 });
  }
  if (!provider.verifyWebhookSignature(raw, request.headers.get("x-hub-signature-256"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  // Meta may deliver the same event more than once; the hash makes processing idempotent.
  const dedupeKey = createHash("sha256").update(raw).digest("hex");
  const existing = await db.webhookEvent.findUnique({ where: { dedupeKey }, select: { processedAt: true } });
  if (existing?.processedAt) return new Response("OK");
  const event = existing
    ? await db.webhookEvent.findUniqueOrThrow({ where: { dedupeKey } })
    : await db.webhookEvent.create({ data: { dedupeKey, payload: payload as object } });

  // Answer Meta quickly; do the work right after the response.
  after(async () => {
    try {
      await processWebhookEvents(provider.parseWebhook(payload));
      await db.webhookEvent.update({ where: { id: event.id }, data: { processedAt: new Date(), error: null } });
    } catch (e) {
      await db.webhookEvent.update({
        where: { id: event.id },
        data: { error: e instanceof Error ? e.message.slice(0, 500) : "Unknown error" },
      });
    }
  });
  return new Response("OK");
}
