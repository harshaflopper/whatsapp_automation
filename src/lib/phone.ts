import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export type PhoneResult = { ok: true; e164: string } | { ok: false; reason: string };

/**
 * Normalise user-entered phone numbers to E.164 (e.g. +919876543210).
 * Accepts "98765 43210", "098765-43210", "+91 98765 43210", "919876543210", "0091…".
 * Numbers without a country code are assumed to be Indian (defaultCountry).
 */
export function normalizePhone(input: string | null | undefined, defaultCountry: CountryCode = "IN"): PhoneResult {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, reason: "Phone number is empty" };
  if (/[a-z]/i.test(raw.replace(/ext\.?|x/gi, ""))) return { ok: false, reason: "Phone number contains letters" };

  let cleaned = raw.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("00")) cleaned = `+${cleaned.slice(2)}`;

  const candidates = [cleaned];
  // "919876543210" — a country code typed without the plus sign.
  if (!cleaned.startsWith("+") && cleaned.length > 10) candidates.push(`+${cleaned}`);

  for (const candidate of candidates) {
    const parsed = parsePhoneNumberFromString(candidate, defaultCountry);
    if (parsed?.isValid()) return { ok: true, e164: parsed.number };
  }
  return { ok: false, reason: `"${raw}" is not a valid phone number` };
}

/** Pretty display: +91 98765 43210 */
export function formatPhone(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatInternational() : e164;
}
