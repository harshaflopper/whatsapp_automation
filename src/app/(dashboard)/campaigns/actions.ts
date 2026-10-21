"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { renderMetaText } from "@/lib/designs/text";
import { normalizePhone } from "@/lib/phone";
import { resolveParams, validateMappings, type VariableMapping } from "@/lib/campaigns/personalize";
import {
  cancelCampaign,
  createCampaign,
  pauseCampaign,
  previewContacts,
  resumeCampaign,
  summarizeAudience,
  type Audience,
  type AudienceSummary,
} from "@/lib/services/campaigns";
import { getDesign } from "@/lib/services/designs";
import { sendTemplateNow } from "@/lib/services/direct-send";
import { processQueue } from "@/lib/services/queue";
import { getBusinessProfile, saveBusinessProfile } from "@/lib/settings";

export async function audienceAction(
  audience: Audience,
): Promise<{ summary: AudienceSummary; sample: { id: string; name: string; city: string | null }[] }> {
  await requireUser();
  const [summary, sample] = await Promise.all([summarizeAudience(audience), previewContacts(audience, 3)]);
  return { summary, sample };
}

export async function sendTestAction(input: {
  designId: string;
  mappings: VariableMapping[];
  phone: string;
}): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  await requireUser();
  const design = await getDesign(input.designId);
  if (!design || design.state !== "ready") return { ok: false, error: "Pick a message that's ready to use." };
  const problem = validateMappings(design.variables, input.mappings);
  if (problem) return { ok: false, error: problem };
  const phone = normalizePhone(input.phone);
  if (!phone.ok) return { ok: false, error: "Enter your WhatsApp number to get the test." };

  const profile = await getBusinessProfile();
  if (profile.testPhone !== phone.e164) await saveBusinessProfile({ testPhone: phone.e164 });

  let contact = await db.contact.findUnique({ where: { phone: phone.e164 } });
  if (!contact) {
    contact = await db.contact.create({
      data: { name: "Me (test phone)", phone: phone.e164, notes: "Your own number, used for test messages." },
    });
  }
  const params = resolveParams(input.mappings, { name: contact.name === "Me (test phone)" ? profile.businessName : contact.name, city: contact.city });
  const body = renderMetaText(design.body, params, design.variables.map((v) => v.label));
  const res = await sendTemplateNow({
    contact,
    templateName: design.name,
    language: design.language,
    bodyParams: params,
    renderedText: [design.header, body, design.footer].filter(Boolean).join("\n\n"),
    isTest: true,
  });
  return res.ok ? { ok: true, message: "Test sent. Check your WhatsApp." } : { ok: false, error: res.error };
}

export async function createCampaignAction(input: {
  name: string;
  designId: string;
  audience: Audience;
  mappings: VariableMapping[];
  sendAt: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await requireUser();
  const res = await createCampaign({
    name: input.name,
    designId: input.designId,
    audience: input.audience,
    mappings: input.mappings,
    sendAt: input.sendAt ? new Date(input.sendAt) : null,
  });
  if (!res.ok) return res;
  if (!res.scheduled) {
    // Start sending right after this response; the cron picks up anything left.
    after(async () => {
      await processQueue({ maxMs: 50_000 }).catch(() => undefined);
    });
  }
  revalidatePath("/campaigns");
  revalidatePath("/");
  return { ok: true, id: res.id };
}

export async function campaignControlAction(id: string, action: "pause" | "resume" | "stop") {
  await requireUser();
  if (action === "pause") await pauseCampaign(id);
  if (action === "resume") {
    await resumeCampaign(id);
    after(async () => {
      await processQueue({ maxMs: 50_000 }).catch(() => undefined);
    });
  }
  if (action === "stop") await cancelCampaign(id);
  revalidatePath(`/campaigns/${id}`);
  revalidatePath("/campaigns");
  revalidatePath("/");
}
