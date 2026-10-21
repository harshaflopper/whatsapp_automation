import { z } from "zod";

/**
 * Environment access. Parsed lazily so `next build` works without WhatsApp
 * credentials — missing values surface on the Settings page instead.
 */

const appSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  ADMIN_EMAIL: z.string().email("ADMIN_EMAIL must be an email"),
  ADMIN_PASSWORD: z.string().min(6, "ADMIN_PASSWORD must be at least 6 characters"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  APP_NAME: z.string().default("WA Broadcast"),
  APP_LOGO_URL: z.string().optional(),
  CRON_SECRET: z.string().optional(),
});

export type AppEnv = z.infer<typeof appSchema>;

let appEnvCache: AppEnv | null = null;

export function appEnv(): AppEnv {
  if (!appEnvCache) {
    const parsed = appSchema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
      throw new Error(`Invalid environment configuration:\n  ${issues.join("\n  ")}`);
    }
    appEnvCache = parsed.data;
  }
  return appEnvCache;
}

/** Branding is read without validation so the login page renders even if other env is broken. */
export function branding() {
  return {
    appName: process.env.APP_NAME?.trim() || "WA Broadcast",
    logoUrl: process.env.APP_LOGO_URL?.trim() || null,
  };
}

export type WhatsAppConfig = {
  graphVersion: string;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  appSecret: string;
  verifyToken: string;
  sendRatePerSec: number;
};

const WA_REQUIRED = [
  "WA_PHONE_NUMBER_ID",
  "WA_BUSINESS_ACCOUNT_ID",
  "WA_ACCESS_TOKEN",
  "WA_APP_SECRET",
  "WA_WEBHOOK_VERIFY_TOKEN",
] as const;

export const DEFAULT_GRAPH_VERSION = "v26.0";

export function missingWhatsAppEnv(): string[] {
  return WA_REQUIRED.filter((k) => !process.env[k]?.trim());
}

export class ConfigError extends Error {
  constructor(public missing: string[]) {
    super(`WhatsApp is not configured. Missing: ${missing.join(", ")}`);
    this.name = "ConfigError";
  }
}

export function whatsappConfig(): WhatsAppConfig {
  const missing = missingWhatsAppEnv();
  if (missing.length) throw new ConfigError(missing);
  const rate = Number(process.env.WA_SEND_RATE_PER_SEC);
  return {
    graphVersion: process.env.WA_GRAPH_VERSION?.trim() || DEFAULT_GRAPH_VERSION,
    phoneNumberId: process.env.WA_PHONE_NUMBER_ID!.trim(),
    wabaId: process.env.WA_BUSINESS_ACCOUNT_ID!.trim(),
    accessToken: process.env.WA_ACCESS_TOKEN!.trim(),
    appSecret: process.env.WA_APP_SECRET!.trim(),
    verifyToken: process.env.WA_WEBHOOK_VERIFY_TOKEN!.trim(),
    sendRatePerSec: Number.isFinite(rate) && rate > 0 ? Math.min(rate, 80) : 10,
  };
}

/** Show only enough of a secret to recognise it. Never render a full credential. */
export function maskSecret(value: string | undefined | null, visible = 4): string {
  if (!value) return "— not set —";
  if (value.length <= visible * 2) return "•".repeat(8);
  return `${value.slice(0, visible)}${"•".repeat(8)}${value.slice(-visible)}`;
}
