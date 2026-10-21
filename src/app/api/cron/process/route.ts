import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { processQueue } from "@/lib/services/queue";

export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : (request.nextUrl.searchParams.get("key") ?? "");
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Hit every minute (Vercel Cron or cron-job.org) to send scheduled campaigns and retries. */
async function run(request: NextRequest) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const result = await processQueue({ maxMs: 45_000 });
  return Response.json(result);
}

export const GET = run;
export const POST = run;
