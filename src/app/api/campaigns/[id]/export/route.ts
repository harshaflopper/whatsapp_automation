import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { exportCampaignCsv } from "@/lib/services/campaigns";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const b = await db.broadcast.findUnique({ where: { id }, select: { name: true } });
  if (!b) return new Response("Not found", { status: 404 });
  const csv = await exportCampaignCsv(id);
  const safe = b.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "campaign";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safe}-report.csv"`,
    },
  });
}
