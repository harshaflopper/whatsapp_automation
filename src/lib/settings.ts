import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db } from "@/lib/db";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

/**
 * Business profile shown across the client dashboard. Values saved from the Account page
 * win; environment variables are the defaults our team sets when onboarding a client.
 */
export type BusinessProfile = {
  businessName: string;
  logoUrl: string | null;
  address: string;
  supportPhone: string;
  supportEmail: string;
  /** The owner's own WhatsApp number, used for "Send test to my phone". */
  testPhone: string;
};

const PROFILE_KEYS = ["businessName", "logoUrl", "address", "supportPhone", "supportEmail", "testPhone"] as const;
type ProfileKey = (typeof PROFILE_KEYS)[number];

async function readSettings(keys: readonly string[]): Promise<Record<string, string>> {
  try {
    const rows = await db.appSetting.findMany({ where: { key: { in: [...keys] } } });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch {
    // Database not reachable yet (e.g. first boot before migrations): fall back to env defaults.
    return {};
  }
}

export function normalizeLogoUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // If it's a web URL or data URI
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) {
    return trimmed;
  }
  // If it's already a relative web path and not a Windows file path
  if (trimmed.startsWith("/") && !trimmed.includes("\\") && !/^[A-Za-z]:/.test(trimmed)) {
    return trimmed;
  }
  // Local filesystem path (e.g. D:\internwhatsapp\image.png) or filename
  return "/api/brand-logo";
}

export async function getBusinessProfile(): Promise<BusinessProfile> {
  const s = await readSettings(PROFILE_KEYS);
  const rawLogo = s.logoUrl?.trim() || process.env.APP_LOGO_URL?.trim() || null;
  return {
    businessName: s.businessName?.trim() || process.env.APP_NAME?.trim() || "Your Business",
    logoUrl: normalizeLogoUrl(rawLogo),
    address: s.address ?? "",
    supportPhone: s.supportPhone ?? process.env.SUPPORT_PHONE ?? "",
    supportEmail: s.supportEmail ?? process.env.SUPPORT_EMAIL ?? "",
    testPhone: s.testPhone ?? "",
  };
}

export async function saveBusinessProfile(values: Partial<Record<ProfileKey, string>>) {
  const entries = Object.entries(values).filter(([k]) => (PROFILE_KEYS as readonly string[]).includes(k));
  await db.$transaction(
    entries.map(([key, value]) =>
      db.appSetting.upsert({ where: { key }, create: { key, value: value ?? "" }, update: { value: value ?? "" } }),
    ),
  );
}

// ── Password ────────────────────────────────────────────────

const PASSWORD_KEY = "passwordHash";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPasswordHash(password: string, stored: string): Promise<boolean> {
  const [algo, saltHex, hashHex] = stored.split("$");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Hash of a password changed from the Account page, or null if the env password is still in use. */
export async function getStoredPasswordHash(): Promise<string | null> {
  const s = await readSettings([PASSWORD_KEY]);
  return s[PASSWORD_KEY] || null;
}

export async function setPassword(password: string) {
  const value = await hashPassword(password);
  await db.appSetting.upsert({
    where: { key: PASSWORD_KEY },
    create: { key: PASSWORD_KEY, value },
    update: { value },
  });
}
