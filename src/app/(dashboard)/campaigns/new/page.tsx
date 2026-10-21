import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { db } from "@/lib/db";
import { fromNow, toIstInputValue } from "@/lib/format";
import { FOLLOW_UP_LABEL, type FollowUpSegment } from "@/lib/services/campaigns";
import { contactOverview } from "@/lib/services/contacts";
import { readyDesigns } from "@/lib/services/designs";
import { getBusinessProfile } from "@/lib/settings";
import { CampaignWizard, type WizardDesign } from "./campaign-wizard";

export const metadata: Metadata = { title: "Send campaign" };

function one(v: string | string[] | undefined) {
  return typeof v === "string" && v ? v : undefined;
}

export default async function NewCampaignPage({ searchParams }: PageProps<"/campaigns/new">) {
  const sp = await searchParams;
  const [designs, overview, profile] = await Promise.all([readyDesigns(), contactOverview(), getBusinessProfile()]);

  const contactIds = (one(sp.contacts) ?? "").split(",").filter(Boolean).slice(0, 5000);
  let followUp: { broadcastId: string; segment: FollowUpSegment; label: string; campaignName: string } | undefined;
  const from = one(sp.from);
  const segment = one(sp.segment) as FollowUpSegment | undefined;
  if (from && segment && segment in FOLLOW_UP_LABEL) {
    const b = await db.broadcast.findUnique({ where: { id: from }, select: { id: true, name: true } });
    if (b) followUp = { broadcastId: b.id, segment, label: FOLLOW_UP_LABEL[segment], campaignName: b.name };
  }

  // Default schedule: tomorrow 10:00 am India time.
  const tomorrow = fromNow(24 * 3600_000);
  const defaultSchedule = `${toIstInputValue(tomorrow).slice(0, 10)}T10:00`;

  const wizardDesigns: WizardDesign[] = designs.map((d) => ({
    id: d.id,
    title: d.title,
    category: d.category,
    header: d.header,
    body: d.body,
    footer: d.footer,
    buttons: d.buttons,
    variables: d.variables,
  }));

  return (
    <>
      <PageHeader title={followUp ? "Send a follow-up" : "Send campaign"} description="Pick a message, choose your customers, and send it now or later." />
      <CampaignWizard
        designs={wizardDesigns}
        groups={overview.groups}
        tags={overview.tags}
        subscribedTotal={overview.counts.subscribed}
        initial={{ designId: one(sp.design), contactIds, followUp }}
        testPhone={profile.testPhone}
        businessName={profile.businessName}
        defaultSchedule={defaultSchedule}
        minSchedule={toIstInputValue(fromNow(0))}
      />
    </>
  );
}
