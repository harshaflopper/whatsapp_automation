/**
 * Message design text helpers. Pure functions, shared by server and client.
 *
 * Businesses never see Meta's `{{1}}` syntax. In the editor they write friendly tokens like
 * `{{Name}}` or `{{Offer}}`; on save we number them in order of first appearance and keep the
 * labels alongside, so the editor can show them again later.
 */

export type DesignVariable = { label: string; kind: "name" | "detail"; sample: string };

export const NAME_LABEL = "Name";
const TOKEN_RE = /\{\{\s*([^{}]{1,40}?)\s*\}\}/g;

function cleanLabel(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function labelKind(label: string): DesignVariable["kind"] {
  return label.toLowerCase() === NAME_LABEL.toLowerCase() || label.toLowerCase() === "customer name" ? "name" : "detail";
}

/** Distinct friendly labels in order of first appearance. */
export function friendlyLabels(text: string): string[] {
  const seen = new Map<string, string>();
  for (const m of text.matchAll(TOKEN_RE)) {
    const label = cleanLabel(m[1]);
    const key = label.toLowerCase();
    if (!seen.has(key)) seen.set(key, label);
  }
  return [...seen.values()];
}

/** Converts friendly `{{Offer}}` tokens into Meta's `{{1}}`. */
export function toMetaBody(
  friendly: string,
  samples: Record<string, string> = {},
): { body: string; variables: DesignVariable[] } {
  const labels = friendlyLabels(friendly);
  const index = new Map(labels.map((l, i) => [l.toLowerCase(), i + 1]));
  const body = friendly.replace(TOKEN_RE, (_m, raw: string) => `{{${index.get(cleanLabel(raw).toLowerCase())}}}`);
  const variables = labels.map((label) => {
    const kind = labelKind(label);
    const sample = samples[label.toLowerCase()]?.trim() || (kind === "name" ? "Priya" : label);
    return { label, kind, sample };
  });
  return { body, variables };
}

/** Converts Meta's `{{1}}` back into friendly tokens using saved labels. */
export function toFriendlyBody(metaBody: string, variables: DesignVariable[] | null | undefined): string {
  return metaBody.replace(/\{\{\s*(\d+)\s*\}\}/g, (_m, n: string) => {
    const v = variables?.[Number(n) - 1];
    return `{{${v?.label ?? (Number(n) === 1 ? NAME_LABEL : `Detail ${n}`)}}}`;
  });
}

/** Fills `{{1}}`-style placeholders with values (1-based). Missing values show as [Label]. */
export function renderMetaText(text: string, values: (string | undefined)[], labels: string[] = []): string {
  return text.replace(/\{\{\s*(\d+)\s*\}\}/g, (_m, n: string) => {
    const i = Number(n) - 1;
    const v = values[i];
    return v && v.trim() ? v : `[${labels[i] ?? `Detail ${n}`}]`;
  });
}

/** Fills friendly `{{Label}}` tokens for live previews in the editor. */
export function renderFriendlyText(text: string, samples: Record<string, string>): string {
  return text.replace(TOKEN_RE, (_m, raw: string) => {
    const label = cleanLabel(raw);
    const v = samples[label.toLowerCase()];
    return v && v.trim() ? v : labelKind(label) === "name" ? "Priya" : `[${label}]`;
  });
}

export function countMetaVariables(text: string): number {
  let max = 0;
  for (const m of text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) max = Math.max(max, Number(m[1]));
  return max;
}

/** Meta template names: lowercase letters, digits and underscores. */
export function slugifyName(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
  return base || "message";
}

/** Problems Meta would reject, in plain words. Empty array = fine. */
export function validateDesignText(input: { body: string; header?: string | null; footer?: string | null }): string[] {
  const problems: string[] = [];
  const body = input.body.trim();
  if (!body) problems.push("Write the message text.");
  if (body.length > 1024) problems.push("The message is too long. Keep it under 1,024 characters.");
  if (/^\{\{[^}]+\}\}/.test(body)) problems.push("Start the message with a word, not a placeholder.");
  if (/\{\{[^}]+\}\}[.!?\s]*$/.test(body)) problems.push("End the message with a word or full stop after the last placeholder.");
  if (/\}\}\s*\{\{/.test(body)) problems.push("Put at least one word between two placeholders.");
  if (/(\{\{|\}\})/.test(body.replace(TOKEN_RE, ""))) problems.push("A placeholder isn't closed properly. Use the Insert buttons.");
  if (input.header && input.header.length > 60) problems.push("The title can be at most 60 characters.");
  if (input.header && /\{\{/.test(input.header)) problems.push("Placeholders aren't allowed in the title.");
  if (input.footer && input.footer.length > 60) problems.push("The footer can be at most 60 characters.");
  if (input.footer && /\{\{/.test(input.footer)) problems.push("Placeholders aren't allowed in the footer.");
  const vars = friendlyLabels(body).length;
  const words = body.replace(TOKEN_RE, "").split(/\s+/).filter(Boolean).length;
  if (vars > 0 && words < vars * 3) problems.push("Add a few more words. Messages with many placeholders and little text get rejected.");
  return problems;
}

// ── Friendly statuses ────────────────────────────────────────

export type DesignState = "ready" | "review" | "changes" | "draft";

export function designState(status: string | null | undefined): DesignState {
  switch (status) {
    case "APPROVED":
      return "ready";
    case "PENDING":
    case "IN_APPEAL":
      return "review";
    case "REJECTED":
    case "PAUSED":
    case "DISABLED":
      return "changes";
    default:
      return "draft";
  }
}

export const DESIGN_STATE_LABEL: Record<DesignState, string> = {
  ready: "Ready to use",
  review: "Under review",
  changes: "Needs changes",
  draft: "Draft",
};

/** Meta's rejection / pause reasons rewritten for a business owner. */
export function friendlyRejection(status: string | null | undefined, reason: string | null | undefined, category?: string): string | null {
  if (status === "PAUSED") return "WhatsApp paused this message because customers didn't respond well to it. Edit the text to resume.";
  if (status === "DISABLED") return "WhatsApp disabled this message. Create a new one with different wording.";
  if (status !== "REJECTED") return null;
  const r = (reason ?? "").toUpperCase();
  if (r.includes("INCORRECT_CATEGORY") || r.includes("CATEGORY"))
    return category === "MARKETING"
      ? "WhatsApp says the wording doesn't match the type. Make the message clearer about the offer, then submit again."
      : "WhatsApp thinks this is a promotion. Change the type to Offer / Promotion and submit again.";
  if (r.includes("INVALID_FORMAT") || r.includes("FORMAT"))
    return "The format isn't allowed. Check placeholders aren't at the very start or end, and remove unusual symbols.";
  if (r.includes("ABUSIVE") || r.includes("SCAM") || r.includes("PROHIBITED"))
    return "The wording looks like content WhatsApp doesn't allow. Rewrite it in plain, clear language.";
  if (r.includes("TAG_CONTENT_MISMATCH"))
    return "The text doesn't match the type you picked. Pick the right type or adjust the wording.";
  return "WhatsApp asked for changes. Make the wording clearer and avoid all caps or too many placeholders, then submit again.";
}

export const DESIGN_TYPES = [
  { value: "MARKETING", label: "Offer / Promotion", hint: "Discounts, new arrivals, festival wishes" },
  { value: "UTILITY", label: "Reminder / Update", hint: "Appointments, payments, order updates" },
] as const;

export const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "kn", label: "Kannada" },
  { value: "hi", label: "Hindi" },
  { value: "en_US", label: "English (US)" },
] as const;

export function languageLabel(code: string): string {
  return LANGUAGES.find((l) => l.value === code)?.label ?? code;
}

export function typeLabel(category: string): string {
  return category === "UTILITY" ? "Reminder / Update" : category === "AUTHENTICATION" ? "Login code" : "Offer / Promotion";
}

// ── Starters ─────────────────────────────────────────────────

export type DesignButtonInput =
  | { type: "NONE" }
  | { type: "URL"; text: string; url: string }
  | { type: "PHONE_NUMBER"; text: string; phone_number: string }
  | { type: "QUICK_REPLY"; replies: string[] };

export type Starter = {
  id: string;
  title: string;
  category: "MARKETING" | "UTILITY";
  header: string;
  body: string;
  footer: string;
  samples: Record<string, string>;
  description: string;
};

export const STARTERS: Starter[] = [
  {
    id: "festival-offer",
    title: "Festival offer",
    category: "MARKETING",
    header: "A festive treat for you",
    body: "Hi {{Name}}, celebrate this season with {{Offer}} at our store. The offer is valid till {{Last date}}. Visit us or reply to this message to book.",
    footer: "Reply STOP to unsubscribe",
    samples: { offer: "20% off on all services", "last date": "30 Oct" },
    description: "Share a discount for Diwali, Ugadi, Christmas or any festival.",
  },
  {
    id: "appointment-reminder",
    title: "Appointment reminder",
    category: "UTILITY",
    header: "Appointment reminder",
    body: "Hi {{Name}}, this is a reminder of your appointment on {{Date and time}}. Please reply YES to confirm or call us if you need to reschedule.",
    footer: "",
    samples: { "date and time": "24 Oct, 11:30 am" },
    description: "Reduce no-shows with a reminder a day before.",
  },
  {
    id: "payment-reminder",
    title: "Payment reminder",
    category: "UTILITY",
    header: "Payment reminder",
    body: "Hi {{Name}}, a payment of {{Amount}} for {{For what}} is due on {{Due date}}. Please ignore this message if you have already paid. Thank you.",
    footer: "",
    samples: { amount: "Rs 2,500", "for what": "your October invoice", "due date": "31 Oct" },
    description: "A polite nudge for pending payments.",
  },
  {
    id: "thank-you-review",
    title: "Thank you and review",
    category: "MARKETING",
    header: "Thank you for visiting",
    body: "Hi {{Name}}, thank you for choosing us today. We would love to hear how it went. Please take a minute to share your review, it helps us a lot.",
    footer: "Reply STOP to unsubscribe",
    samples: {},
    description: "Ask happy customers for a Google review.",
  },
  {
    id: "new-arrival",
    title: "New arrival",
    category: "MARKETING",
    header: "Just arrived",
    body: "Hi {{Name}}, we have something new for you: {{What is new}}. Drop by this week to see it first, or reply to this message to know more.",
    footer: "Reply STOP to unsubscribe",
    samples: { "what is new": "our new winter collection" },
    description: "Announce a new product, service or menu.",
  },
];
