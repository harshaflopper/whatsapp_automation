import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, PenLine } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { MessageBubble } from "@/components/app/phone-preview";
import { renderFriendlyText, STARTERS, typeLabel } from "@/lib/designs/text";
import { getBusinessProfile } from "@/lib/settings";
import { DesignEditor, type EditorInitial } from "../design-editor";

export const metadata: Metadata = { title: "New message design" };

export default async function NewDesignPage({ searchParams }: PageProps<"/designs/new">) {
  const { starter, scratch } = await searchParams;
  const profile = await getBusinessProfile();
  const chosen = STARTERS.find((s) => s.id === starter);

  const back = (
    <Link href={chosen || scratch ? "/designs/new" : "/designs"} className="inline-flex items-center gap-1 hover:text-foreground">
      <ArrowLeft className="size-4" /> {chosen || scratch ? "Pick another starting point" : "Message designs"}
    </Link>
  );

  if (!chosen && !scratch) {
    return (
      <>
        <PageHeader eyebrow={back} title="New message design" description="Start from a ready-made message and make it yours, or write your own." />
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {STARTERS.map((s) => (
            <Link key={s.id} href={`/designs/new?starter=${s.id}`} className="surface group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lift">
              <div className="chat-wallpaper relative h-44 overflow-hidden px-5 pt-5">
                <MessageBubble header={s.header} body={renderFriendlyText(s.body, s.samples)} footer={s.footer} className="max-w-[16rem]" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#efeae2] to-transparent" />
              </div>
              <div className="flex flex-1 items-start justify-between gap-3 p-5">
                <div>
                  <div className="font-semibold">{s.title}</div>
                  <div className="mt-0.5 text-[0.82rem] text-muted-foreground">{s.description}</div>
                  <div className="mt-2 text-xs font-medium text-accent-foreground">{typeLabel(s.category)}</div>
                </div>
                <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
            </Link>
          ))}
          <Link
            href="/designs/new?scratch=1"
            className="group flex min-h-[18rem] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-6 text-center transition hover:border-primary/50 hover:bg-accent/40"
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
              <PenLine className="size-5" />
            </span>
            <span className="mt-3 font-semibold">Start from scratch</span>
            <span className="mt-1 text-sm text-muted-foreground">Write your own message.</span>
          </Link>
        </div>
      </>
    );
  }

  const initial: EditorInitial = chosen
    ? {
        title: chosen.title,
        category: chosen.category,
        language: "en",
        header: chosen.header,
        body: chosen.body,
        footer: chosen.footer,
        button: { type: "NONE" },
        samples: chosen.samples,
        categoryLocked: false,
        underReview: false,
        wasApproved: false,
      }
    : {
        title: "",
        category: "MARKETING",
        language: "en",
        header: "",
        body: "Hi {{Name}}, ",
        footer: "",
        button: { type: "NONE" },
        samples: {},
        categoryLocked: false,
        underReview: false,
        wasApproved: false,
      };

  return (
    <>
      <PageHeader eyebrow={back} title={chosen ? chosen.title : "New message design"} description="Write your message, check the preview, and submit it to WhatsApp for review." />
      <DesignEditor initial={initial} businessName={profile.businessName} />
    </>
  );
}
