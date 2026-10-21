import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getStoredPasswordHash, verifyPasswordHash } from "./settings";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession } from "./session";

export { SESSION_COOKIE } from "./session";

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * Checks the login. The email always comes from ADMIN_EMAIL (set by our team when the
 * client is onboarded). The password is the one saved from the Account page if the
 * business changed it, otherwise ADMIN_PASSWORD.
 */
export async function checkCredentials(email: string, password: string): Promise<boolean> {
  const expectedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  if (!expectedEmail) return false;
  const emailOk = timingSafeEqual(sha256(email.trim().toLowerCase()), sha256(expectedEmail));

  const stored = await getStoredPasswordHash();
  let passwordOk: boolean;
  if (stored) {
    passwordOk = await verifyPasswordHash(password, stored);
  } else {
    const expectedPassword = process.env.ADMIN_PASSWORD ?? "";
    passwordOk = !!expectedPassword && timingSafeEqual(sha256(password), sha256(expectedPassword));
  }
  return emailOk && passwordOk;
}

export async function startSession(email: string) {
  const token = await signSession(email);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifySession(token) : null;
}

/** Defence in depth for server actions and route handlers — the proxy already guards pages. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
