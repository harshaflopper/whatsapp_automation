"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  addContactsToGroup,
  addTagToContacts,
  createContact,
  createGroup,
  deleteContacts,
  deleteGroup,
  importContacts,
  removeContactsFromGroup,
  renameGroup,
  setSubscription,
  updateContact,
  type ContactInput,
  type ImportRow,
  type ImportSummary,
  type SaveResult,
} from "@/lib/services/contacts";

function done() {
  revalidatePath("/contacts");
  revalidatePath("/");
}

export async function saveContactAction(id: string | null, input: ContactInput): Promise<SaveResult> {
  await requireUser();
  const res = id ? await updateContact(id, input) : await createContact(input);
  if (res.ok) done();
  return res;
}

export async function deleteContactsAction(ids: string[]) {
  await requireUser();
  const n = await deleteContacts(ids);
  done();
  return n;
}

export type BulkAction =
  | { type: "addToGroup"; groupId: string }
  | { type: "removeFromGroup"; groupId: string }
  | { type: "addTag"; tag: string }
  | { type: "subscribe" }
  | { type: "unsubscribe" };

export async function bulkAction(ids: string[], action: BulkAction): Promise<{ ok: true; message: string }> {
  await requireUser();
  const n = ids.length;
  const who = `${n} ${n === 1 ? "contact" : "contacts"}`;
  let message = "";
  switch (action.type) {
    case "addToGroup":
      await addContactsToGroup(ids, action.groupId);
      message = `Added ${who} to the group.`;
      break;
    case "removeFromGroup":
      await removeContactsFromGroup(ids, action.groupId);
      message = `Removed ${who} from the group.`;
      break;
    case "addTag":
      await addTagToContacts(ids, action.tag);
      message = `Tagged ${who}.`;
      break;
    case "subscribe": {
      const c = await setSubscription(ids, true);
      message = c ? `Marked ${c} as subscribed.` : "They were already subscribed.";
      break;
    }
    case "unsubscribe": {
      const c = await setSubscription(ids, false);
      message = c ? `Unsubscribed ${c}.` : "They were already unsubscribed.";
      break;
    }
  }
  done();
  return { ok: true, message };
}

export async function createGroupAction(name: string): Promise<SaveResult> {
  await requireUser();
  const res = await createGroup(name);
  if (res.ok) done();
  return res;
}

export async function renameGroupAction(id: string, name: string): Promise<SaveResult> {
  await requireUser();
  const res = await renameGroup(id, name);
  if (res.ok) done();
  return res;
}

export async function deleteGroupAction(id: string) {
  await requireUser();
  await deleteGroup(id);
  done();
}

export async function importContactsAction(
  rows: ImportRow[],
  opts: { groupId?: string; newGroupName?: string; subscribed: boolean; updateExisting: boolean },
): Promise<{ ok: true; summary: ImportSummary; groupId?: string } | { ok: false; error: string }> {
  await requireUser();
  if (rows.length > 20000) return { ok: false, error: "That file is too big. Split it into files of 20,000 rows or fewer." };
  let groupId = opts.groupId || undefined;
  if (!groupId && opts.newGroupName?.trim()) {
    const g = await createGroup(opts.newGroupName);
    if (!g.ok) return { ok: false, error: g.error };
    groupId = g.id;
  }
  const summary = await importContacts(rows, { groupId, subscribed: opts.subscribed, updateExisting: opts.updateExisting });
  done();
  return { ok: true, summary, groupId };
}
