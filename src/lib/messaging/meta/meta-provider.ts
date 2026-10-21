import { createHmac, timingSafeEqual } from "node:crypto";
import type { WhatsAppConfig } from "@/lib/env";
import { ProviderError } from "../errors";
import type {
  ConnectionInfo,
  MessagingProvider,
  RemoteTemplate,
  SendResult,
  TemplateButton,
  TemplateCategory,
  TemplateDefinition,
  TemplateSendParams,
  TemplateStatus,
  WebhookEventItem,
} from "../provider";
import { describeMetaError } from "./error-codes";
import { normaliseTemplateStatus } from "./template-status";
import { parseMetaWebhook } from "./webhook";

const REQUEST_TIMEOUT_MS = 15_000;

type GraphError = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    error_user_title?: string;
    error_user_msg?: string;
    error_data?: { details?: string } | string;
    fbtrace_id?: string;
  };
};

/** Meta wants digits only in `to` (country code included, no +). */
export function toMetaRecipient(e164: string): string {
  return e164.replace(/[^\d]/g, "");
}

export class MetaCloudProvider implements MessagingProvider {
  readonly name = "meta";
  private readonly base: string;

  constructor(private readonly cfg: WhatsAppConfig) {
    this.base = `https://graph.facebook.com/${cfg.graphVersion}`;
  }

  // ── HTTP ────────────────────────────────────────────────────

  private redact(text: string): string {
    return redactSecrets(text, [this.cfg.accessToken, this.cfg.appSecret]);
  }

  private async graph<T>(
    path: string,
    init: { method?: string; query?: Record<string, string>; body?: unknown } = {},
  ): Promise<T> {
    const url = path.startsWith("https://") ? new URL(path) : new URL(`${this.base}/${path.replace(/^\//, "")}`);
    for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);

    let res: Response;
    try {
      res = await fetch(url, {
        method: init.method ?? "GET",
        // Token goes in a header only — never in the URL, so it can't leak into logs.
        headers: {
          Authorization: `Bearer ${this.cfg.accessToken}`,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
        },
        body: init.body ? JSON.stringify(init.body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (e) {
      const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      throw new ProviderError({
        code: timedOut ? "TIMEOUT" : "NETWORK",
        title: timedOut ? "Request to Meta timed out" : "Could not reach Meta",
        friendly: timedOut ? "Meta took too long to respond. We'll retry." : "Couldn't reach Meta's servers. Check the internet connection.",
        retryable: true,
      });
    }

    const text = await res.text();
    let json: unknown = undefined;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      /* non-JSON body (rare; e.g. gateway errors) */
    }

    if (!res.ok || (json as GraphError | undefined)?.error) {
      const err = (json as GraphError | undefined)?.error;
      const code = err?.code !== undefined ? String(err.code) : `HTTP_${res.status}`;
      const subcode = err?.error_subcode !== undefined ? String(err.error_subcode) : undefined;
      const detail =
        (typeof err?.error_data === "object" ? err?.error_data?.details : err?.error_data) ||
        err?.error_user_msg ||
        undefined;
      const described = describeMetaError(err?.code ?? undefined, res.status);
      throw new ProviderError({
        code,
        subcode,
        httpStatus: res.status,
        // Meta echoes malformed tokens back in error text; scrub before it reaches logs, DB or UI.
        title: this.redact(err?.error_user_title || err?.message || `HTTP ${res.status}`),
        detail: detail ? this.redact(detail) : undefined,
        friendly: described.friendly,
        retryable: described.retryable,
        traceId: err?.fbtrace_id,
      });
    }
    return json as T;
  }

  // ── Connection ──────────────────────────────────────────────

  async testConnection(): Promise<ConnectionInfo> {
    const [phone, waba] = await Promise.all([
      this.graph<{ display_phone_number: string; verified_name?: string; quality_rating?: string }>(
        this.cfg.phoneNumberId,
        { query: { fields: "display_phone_number,verified_name,quality_rating" } },
      ),
      this.graph<{ name?: string }>(this.cfg.wabaId, { query: { fields: "name" } }),
    ]);
    return {
      ok: true,
      displayPhoneNumber: phone.display_phone_number,
      verifiedName: phone.verified_name,
      qualityRating: phone.quality_rating,
      phoneNumberId: this.cfg.phoneNumberId,
      wabaId: this.cfg.wabaId,
      wabaName: waba.name,
      graphVersion: this.cfg.graphVersion,
    };
  }

  // ── Sending ─────────────────────────────────────────────────

  async sendTemplate(input: {
    to: string;
    templateName: string;
    language: string;
    params?: TemplateSendParams;
  }): Promise<SendResult> {
    return this.postMessage({
      to: toMetaRecipient(input.to),
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.language },
        components: buildSendComponents(input.params),
      },
    });
  }

  async sendText(input: { to: string; body: string; previewUrl?: boolean }): Promise<SendResult> {
    return this.postMessage({
      to: toMetaRecipient(input.to),
      type: "text",
      text: { body: input.body, preview_url: input.previewUrl ?? false },
    });
  }

  private async postMessage(payload: Record<string, unknown>): Promise<SendResult> {
    const res = await this.graph<{
      contacts?: { input: string; wa_id: string }[];
      messages?: { id: string }[];
    }>(`${this.cfg.phoneNumberId}/messages`, {
      method: "POST",
      body: { messaging_product: "whatsapp", recipient_type: "individual", ...payload },
    });
    const id = res.messages?.[0]?.id;
    if (!id) {
      throw new ProviderError({
        code: "NO_MESSAGE_ID",
        title: "Meta accepted the request but returned no message id",
        friendly: "Meta didn't confirm the message. Please try again.",
        retryable: false,
      });
    }
    return { messageId: id, recipientWaId: res.contacts?.[0]?.wa_id };
  }

  // ── Templates ───────────────────────────────────────────────

  async listTemplates(): Promise<RemoteTemplate[]> {
    type Page = { data: MetaTemplate[]; paging?: { next?: string } };
    const out: RemoteTemplate[] = [];
    let next: string | undefined = `${this.cfg.wabaId}/message_templates`;
    let query: Record<string, string> | undefined = {
      fields: "id,name,status,category,language,components,rejected_reason",
      limit: "100",
    };
    // Follow cursor pagination; cap pages defensively.
    for (let page = 0; next && page < 50; page++) {
      const res: Page = await this.graph<Page>(next, { query });
      out.push(...res.data.map(fromMetaTemplate));
      next = res.paging?.next;
      query = undefined; // `next` already carries the cursor and fields
    }
    return out;
  }

  async createTemplate(def: TemplateDefinition): Promise<{ id: string; status: TemplateStatus }> {
    const res = await this.graph<{ id: string; status?: string }>(`${this.cfg.wabaId}/message_templates`, {
      method: "POST",
      body: {
        name: def.name,
        language: def.language,
        category: def.category,
        components: toMetaComponents(def),
      },
    });
    return { id: res.id, status: normaliseTemplateStatus(res.status) };
  }

  async editTemplate(remoteId: string, def: TemplateDefinition): Promise<void> {
    // Category can't change on an approved template, so we only send components.
    await this.graph(remoteId, { method: "POST", body: { components: toMetaComponents(def) } });
  }

  async deleteTemplate(name: string, remoteId?: string): Promise<void> {
    await this.graph(`${this.cfg.wabaId}/message_templates`, {
      method: "DELETE",
      query: remoteId ? { name, hsm_id: remoteId } : { name },
    });
  }

  // ── Webhooks ────────────────────────────────────────────────

  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    return verifyMetaSignature(rawBody, signatureHeader, this.cfg.appSecret);
  }

  parseWebhook(payload: unknown): WebhookEventItem[] {
    return parseMetaWebhook(payload);
  }
}

// ── Pure helpers (exported for tests) ─────────────────────────

/** Removes known secrets and anything that looks like a Meta access token (EAA…). */
export function redactSecrets(text: string, secrets: string[]): string {
  let out = text;
  for (const s of secrets) {
    if (s && s.length >= 6) out = out.split(s).join("[redacted]");
  }
  return out.replace(/\bEAA[A-Za-z0-9_-]{8,}/g, "[redacted-token]");
}

export function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader || !appSecret) return false;
  const [algo, received] = signatureHeader.split("=", 2);
  if (algo !== "sha256" || !received || !/^[0-9a-f]{64}$/i.test(received)) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  const given = Buffer.from(received, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function buildSendComponents(params?: TemplateSendParams) {
  const components: Record<string, unknown>[] = [];
  if (params?.header?.length) {
    components.push({ type: "header", parameters: params.header.map((text) => ({ type: "text", text })) });
  }
  if (params?.body?.length) {
    components.push({ type: "body", parameters: params.body.map((text) => ({ type: "text", text })) });
  }
  for (const [index, suffix] of Object.entries(params?.urlButtons ?? {})) {
    components.push({
      type: "button",
      sub_type: "url",
      index: String(index),
      parameters: [{ type: "text", text: suffix }],
    });
  }
  return components;
}

type MetaComponent =
  | { type: "HEADER"; format: string; text?: string; example?: { header_text?: string[] } }
  | { type: "BODY"; text: string; example?: { body_text?: string[][] } }
  | { type: "FOOTER"; text: string }
  | { type: "BUTTONS"; buttons: MetaButton[] };

type MetaButton = {
  type: string;
  text: string;
  url?: string;
  phone_number?: string;
  example?: string[];
};

type MetaTemplate = {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components?: MetaComponent[];
  rejected_reason?: string;
};

export function toMetaComponents(def: TemplateDefinition): MetaComponent[] {
  const components: MetaComponent[] = [];
  if (def.header?.trim()) {
    const headerExamples = def.examples?.header?.filter(Boolean);
    components.push({
      type: "HEADER",
      format: "TEXT",
      text: def.header,
      ...(headerExamples?.length ? { example: { header_text: headerExamples } } : {}),
    });
  }
  const bodyExamples = def.examples?.body?.filter((v) => v !== undefined);
  components.push({
    type: "BODY",
    text: def.body,
    ...(bodyExamples?.length ? { example: { body_text: [bodyExamples] } } : {}),
  });
  if (def.footer?.trim()) components.push({ type: "FOOTER", text: def.footer });
  if (def.buttons?.length) {
    components.push({
      type: "BUTTONS",
      buttons: def.buttons.map((b): MetaButton => {
        switch (b.type) {
          case "QUICK_REPLY":
            return { type: "QUICK_REPLY", text: b.text };
          case "URL":
            return { type: "URL", text: b.text, url: b.url, ...(b.example ? { example: [b.example] } : {}) };
          case "PHONE_NUMBER":
            return { type: "PHONE_NUMBER", text: b.text, phone_number: b.phone_number };
        }
      }),
    });
  }
  return components;
}

function fromMetaTemplate(t: MetaTemplate): RemoteTemplate {
  const header = t.components?.find((c) => c.type === "HEADER") as Extract<MetaComponent, { type: "HEADER" }> | undefined;
  const body = t.components?.find((c) => c.type === "BODY") as Extract<MetaComponent, { type: "BODY" }> | undefined;
  const footer = t.components?.find((c) => c.type === "FOOTER") as Extract<MetaComponent, { type: "FOOTER" }> | undefined;
  const buttons = t.components?.find((c) => c.type === "BUTTONS") as Extract<MetaComponent, { type: "BUTTONS" }> | undefined;

  return {
    id: t.id,
    name: t.name,
    language: t.language,
    category: (["MARKETING", "UTILITY", "AUTHENTICATION"].includes(t.category) ? t.category : "MARKETING") as TemplateCategory,
    status: normaliseTemplateStatus(t.status),
    rejectionReason: t.rejected_reason && t.rejected_reason !== "NONE" ? t.rejected_reason : null,
    header: header?.format === "TEXT" ? (header.text ?? null) : null,
    body: body?.text ?? "",
    footer: footer?.text ?? null,
    buttons: (buttons?.buttons ?? [])
      .map((b): TemplateButton | null => {
        if (b.type === "QUICK_REPLY") return { type: "QUICK_REPLY", text: b.text };
        if (b.type === "URL") return { type: "URL", text: b.text, url: b.url ?? "", example: b.example?.[0] };
        if (b.type === "PHONE_NUMBER") return { type: "PHONE_NUMBER", text: b.text, phone_number: b.phone_number ?? "" };
        return null; // OTP / catalog / flow buttons are out of scope
      })
      .filter((b): b is TemplateButton => b !== null),
    examples: {
      header: header?.example?.header_text,
      body: body?.example?.body_text?.[0],
    },
  };
}
