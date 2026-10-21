import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { exportContactsCsv, type ContactStatus } from "@/lib/services/contacts";

export async function GET(request: NextRequest) {
  if (!(await getSession())) return new Response("Unauthorized", { status: 401 });
  const p = request.nextUrl.searchParams;
  const csv = await exportContactsCsv({
    q: p.get("q") ?? undefined,
    groupId: p.get("group") ?? undefined,
    tag: p.get("tag") ?? undefined,
    city: p.get("city") ?? undefined,
    status: (p.get("status") as ContactStatus | null) ?? undefined,
  });
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contacts-${date}.csv"`,
    },
  });
}
