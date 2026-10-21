/**
 * Provider-neutral messaging contract. UI and business logic only ever talk to this
 * interface; MetaCloudProvider is the first implementation. A Gupshup/AiSensy provider
 * can be added later without touching anything above this layer.
 */

export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";

export type TemplateStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "PAUSED"
  | "DISABLED"
  | "IN_APPEAL"
  | "UNKNOWN";

export type TemplateButton =
  | { type: "QUICK_REPLY"; text: string }
  | { type: "URL"; text: string; url: string; example?: string }
  | { type: "PHONE_NUMBER"; text: string; phone_number: string };

/** Provider-neutral template definition (text-only header; media headers are out of scope). */
export type TemplateDefinition = {
  name: string;
  language: string;
  category: TemplateCategory;
  header?: string | null;
  body: string;
  footer?: string | null;
  buttons?: TemplateButton[];
  examples?: { header?: string[]; body?: string[] };
};

export type RemoteTemplate = TemplateDefinition & {
  id: string;
  status: TemplateStatus;
  rejectionReason?: string | null;
};

/** Values for one send, already resolved per recipient. */
export type TemplateSendParams = {
  header?: string[];
  body?: string[];
  /** Dynamic URL button suffixes keyed by button index. */
  urlButtons?: Record<number, string>;
};

export type SendResult = {
  messageId: string; // wamid
  recipientWaId?: string;
};

export type ConnectionInfo = {
  ok: true;
  displayPhoneNumber: string;
  verifiedName?: string;
  qualityRating?: string;
  phoneNumberId: string;
  wabaId: string;
  wabaName?: string;
  graphVersion: string;
};

// ── Normalised webhook events ────────────────────────────────

export type DeliveryStatus = "sent" | "delivered" | "read" | "failed";

export type WebhookEventItem =
  | {
      kind: "status";
      messageId: string;
      status: DeliveryStatus;
      timestamp: Date;
      recipient: string;
      error?: { code: string; title: string; detail?: string };
    }
  | {
      kind: "message";
      messageId: string;
      from: string; // E.164 with leading +
      profileName?: string;
      timestamp: Date;
      type: string;
      text: string | null;
    }
  | {
      kind: "template_status";
      templateId: string;
      templateName: string;
      language?: string;
      status: TemplateStatus;
      reason?: string | null;
    };

export interface MessagingProvider {
  readonly name: string;

  testConnection(): Promise<ConnectionInfo>;

  sendTemplate(input: {
    to: string;
    templateName: string;
    language: string;
    params?: TemplateSendParams;
  }): Promise<SendResult>;

  sendText(input: { to: string; body: string; previewUrl?: boolean }): Promise<SendResult>;

  listTemplates(): Promise<RemoteTemplate[]>;
  createTemplate(def: TemplateDefinition): Promise<{ id: string; status: TemplateStatus }>;
  /** Edits trigger re-review by the provider; the template goes back to PENDING. */
  editTemplate(remoteId: string, def: TemplateDefinition): Promise<void>;
  deleteTemplate(name: string, remoteId?: string): Promise<void>;

  /** True only when the payload was signed by the provider (constant-time compare). */
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean;
  parseWebhook(payload: unknown): WebhookEventItem[];
}
