"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { renderMetaText } from "@/lib/designs/text";
import { deleteQuickReply, saveQuickReply } from "@/lib/services/chats";
import { getDesign } from "@/lib/services/designs";
import { sendTemplateNow, sendTextNow } from "@/lib/services/direct-send";

export async function sendReplyAction(contactId: string, text: string) {
  await requireUser();
  const contact = await db.contact.findUnique({ where: { id: contactId } });
  if (!contact) return { ok: false as const, error: "This contact no longer exists." };
  const res = await sendTextNow(contact, text);
  revalidatePath(`/chats/${contactId}`);
  return res;
}

export async function sendDesignToContactAction(contactId: string, designId: string, values: string[]) {
  await requireUser();
  const [contact, design] = await Promise.all([db.contact.findUnique({ where: { id: contactId } }), getDesign(designId)]);
  if (!contact) return { ok: false as const, error: "This contact no longer exists." };
  if (!design || design.state !== "ready") return { ok: false as const, error: "Pick a message that's ready to use." };
  const params = design.variables.map((_, i) => (values[i] ?? "").trim());
  const missing = design.variables.findIndex((_, i) => !params[i]);
  if (missing >= 0) return { ok: false as const, error: `Fill in "${design.variables[missing].label}".` };
  const body = renderMetaText(design.body, params, design.variables.map((v) => v.label));
  const res = await sendTemplateNow({
    contact,
    templateName: design.name,
    language: design.language,
    bodyParams: params,
    renderedText: [design.header, body, design.footer].filter(Boolean).join("\n\n"),
  });
  revalidatePath(`/chats/${contactId}`);
  return res;
}

export async function saveQuickReplyAction(input: { id?: string; title: string; body: string }) {
  await requireUser();
  const res = await saveQuickReply(input);
  revalidatePath("/chats", "layout");
  return res;
}

export async function deleteQuickReplyAction(id: string) {
  await requireUser();
  await deleteQuickReply(id);
  revalidatePath("/chats", "layout");
}
