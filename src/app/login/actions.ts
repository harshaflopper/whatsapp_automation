"use server";

import { redirect } from "next/navigation";
import { checkCredentials, endSession, startSession } from "@/lib/auth";

export type LoginState = { error?: string; email?: string };

function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === "string" ? next : "";
  // Only allow same-site relative paths (blocks //evil.com and absolute URLs).
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!(await checkCredentials(email, password))) {
    // Small fixed delay slows down password guessing.
    await new Promise((r) => setTimeout(r, 600));
    return { error: "That email and password don't match.", email };
  }

  await startSession(email.trim().toLowerCase());
  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  await endSession();
  redirect("/login");
}
