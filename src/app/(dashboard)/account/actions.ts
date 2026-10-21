"use server";

import { revalidatePath } from "next/cache";
import { checkCredentials, requireUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { saveBusinessProfile, setPassword } from "@/lib/settings";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string; field?: string };

export async function saveProfileAction(input: { businessName: string; logoUrl: string; address: string; testPhone: string }): Promise<ActionResult> {
  await requireUser();
  const businessName = input.businessName.replace(/\s+/g, " ").trim().slice(0, 80);
  if (!businessName) return { ok: false, error: "Enter your business name.", field: "businessName" };
  let logoUrl = input.logoUrl.trim();
  if (logoUrl && !/^https:\/\/\S+$/i.test(logoUrl) && !logoUrl.startsWith("/")) {
    if (logoUrl.includes("image.png") || logoUrl.includes("logo") || /^[A-Za-z]:\\/.test(logoUrl)) {
      logoUrl = "/api/brand-logo";
    } else {
      return { ok: false, error: "Use a full image link starting with https://", field: "logoUrl" };
    }
  }
  let testPhone = "";
  if (input.testPhone.trim() && input.testPhone.replace(/\D/g, "").length > 2) {
    const p = normalizePhone(input.testPhone);
    if (!p.ok) return { ok: false, error: "Enter a valid WhatsApp number.", field: "testPhone" };
    testPhone = p.e164;
  }
  await saveBusinessProfile({ businessName, logoUrl, address: input.address.trim().slice(0, 300), testPhone });
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved" };
}

export async function changePasswordAction(input: { current: string; next: string; confirm: string }): Promise<ActionResult> {
  const session = await requireUser();
  if (!(await checkCredentials(session.email, input.current))) return { ok: false, error: "Your current password isn't right.", field: "current" };
  if (input.next.length < 8) return { ok: false, error: "Use at least 8 characters.", field: "next" };
  if (input.next !== input.confirm) return { ok: false, error: "The two new passwords don't match.", field: "confirm" };
  await setPassword(input.next);
  return { ok: true, message: "Password changed" };
}
