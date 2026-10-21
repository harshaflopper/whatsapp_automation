"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { deleteDesign, saveDesign, syncDesigns, type DesignInput, type DesignSaveResult } from "@/lib/services/designs";

export async function saveDesignAction(input: DesignInput, submit: boolean): Promise<DesignSaveResult> {
  await requireUser();
  const res = await saveDesign(input, submit);
  revalidatePath("/designs");
  revalidatePath("/");
  return res;
}

export async function deleteDesignAction(id: string) {
  await requireUser();
  const res = await deleteDesign(id);
  revalidatePath("/designs");
  return res;
}

export async function refreshDesignsAction() {
  await requireUser();
  const res = await syncDesigns();
  revalidatePath("/designs");
  revalidatePath("/");
  return res.ok ? { ok: true as const } : res;
}
