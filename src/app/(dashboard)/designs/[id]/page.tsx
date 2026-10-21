import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DesignStatePill } from "@/components/app/status";
import type { DesignButtonInput } from "@/lib/designs/text";
import { getDesign } from "@/lib/services/designs";
import { getBusinessProfile } from "@/lib/settings";
import { DesignEditor, type EditorInitial } from "../design-editor";

export const metadata: Metadata = { title: "Edit message design" };

export default async function EditDesignPage({ params }: PageProps<"/designs/[id]">) {
  const { id } = await params;
  const [design, profile] = await Promise.all([getDesign(id), getBusinessProfile()]);
  if (!design) notFound();

  const b = design.buttons;
  const button: DesignButtonInput =
    b[0]?.type === "URL"
      ? { type: "URL", text: b[0].text, url: b[0].url }
      : b[0]?.type === "PHONE_NUMBER"
        ? { type: "PHONE_NUMBER", text: b[0].text, phone_number: b[0].phone_number }
        : b.length && b.every((x) => x.type === "QUICK_REPLY")
          ? { type: "QUICK_REPLY", replies: b.map((x) => x.text) }
          : { type: "NONE" };

  const initial: EditorInitial = {
    id: design.id,
    title: design.title,
    category: design.category === "UTILITY" ? "UTILITY" : "MARKETING",
    language: design.language,
    header: design.header ?? "",
    body: design.friendlyBody,
    footer: design.footer ?? "",
    button,
    samples: Object.fromEntries(design.variables.map((v) => [v.label.toLowerCase(), v.sample])),
    categoryLocked: design.state === "ready",
    underReview: design.state === "review",
    wasApproved: design.state === "ready",
  };

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/designs" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="size-4" /> Message designs
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {design.title} <DesignStatePill state={design.state} />
          </span>
        }
        description={design.problem ?? undefined}
      />
      <DesignEditor initial={initial} businessName={profile.businessName} />
    </>
  );
}
