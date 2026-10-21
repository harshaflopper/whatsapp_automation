import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { db } from "@/lib/db";
import { ImportWizard } from "./import-wizard";

export const metadata: Metadata = { title: "Import contacts" };

export default async function ImportPage() {
  const groups = await db.group.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/contacts" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="size-4" /> Contacts
          </Link>
        }
        title="Import contacts"
        description="Bring in your customer list from Excel or a CSV file."
      />
      <ImportWizard groups={groups} />
    </>
  );
}
