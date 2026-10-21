import type { Template, TemplateSubmission } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getProvider, isProviderError } from "@/lib/messaging";
import type { TemplateButton, TemplateDefinition } from "@/lib/messaging/provider";
import {
  countMetaVariables,
  designState,
  friendlyRejection,
  slugifyName,
  toFriendlyBody,
  toMetaBody,
  validateDesignText,
  type DesignButtonInput,
  type DesignState,
  type DesignVariable,
} from "@/lib/designs/text";

/** The WhatsApp account this dashboard sends from (set by our team). */
export function currentWabaId(): string | null {
  return process.env.WA_BUSINESS_ACCOUNT_ID?.trim() || null;
}

export type DesignView = {
  id: string;
  title: string;
  name: string;
  language: string;
  category: string;
  header: string | null;
  body: string;
  friendlyBody: string;
  footer: string | null;
  buttons: TemplateButton[];
  variables: DesignVariable[];
  state: DesignState;
  status: string;
  problem: string | null;
  updatedAt: Date;
  submittedAt: Date | null;
  usedIn: number;
};

export function humanizeName(name: string): string {
  const s = name.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function readVariables(t: Template): DesignVariable[] {
  const raw = Array.isArray(t.variables) ? (t.variables as unknown as Partial<DesignVariable>[]) : [];
  const examples = (t.examples as { body?: string[] } | null)?.body ?? [];
  const count = Math.max(raw.length, countMetaVariables(t.body));
  return Array.from({ length: count }, (_, i) => {
    const v = raw[i] ?? {};
    const label = v.label || (i === 0 ? "Name" : `Detail ${i + 1}`);
    return {
      label,
      kind: v.kind ?? (label.toLowerCase() === "name" ? "name" : "detail"),
      sample: v.sample ?? examples[i] ?? "",
    };
  });
}

export function toView(t: Template & { submissions: TemplateSubmission[]; _count?: { broadcasts: number } }): DesignView {
  const waba = currentWabaId();
  const sub = t.submissions.find((s) => s.wabaId === waba) ?? null;
  const status = sub?.status ?? "DRAFT";
  const variables = readVariables(t);
  return {
    id: t.id,
    title: t.title || humanizeName(t.name),
    name: t.name,
    language: t.language,
    category: t.category,
    header: t.header,
    body: t.body,
    friendlyBody: toFriendlyBody(t.body, variables),
    footer: t.footer,
    buttons: (Array.isArray(t.buttons) ? t.buttons : []) as unknown as TemplateButton[],
    variables,
    state: designState(status),
    status,
    problem: friendlyRejection(status, sub?.rejectionReason, t.category),
    updatedAt: t.updatedAt,
    submittedAt: sub?.submittedAt ?? null,
    usedIn: t._count?.broadcasts ?? 0,
  };
}

export async function listDesigns(): Promise<DesignView[]> {
  const rows = await db.template.findMany({
    orderBy: { updatedAt: "desc" },
    include: { submissions: true, _count: { select: { broadcasts: true } } },
  });
  return rows.map(toView);
}

export async function getDesign(id: string): Promise<DesignView | null> {
  const t = await db.template.findUnique({
    where: { id },
    include: { submissions: true, _count: { select: { broadcasts: true } } },
  });
  return t ? toView(t) : null;
}

export async function readyDesigns(): Promise<DesignView[]> {
  return (await listDesigns()).filter((d) => d.state === "ready");
}

// ── Save & submit ────────────────────────────────────────────

export type DesignInput = {
  id?: string;
  title: string;
  category: "MARKETING" | "UTILITY";
  language: string;
  header: string;
  friendlyBody: string;
  footer: string;
  button: DesignButtonInput;
  /** Example values keyed by lower-case label, for WhatsApp's review. */
  samples: Record<string, string>;
};

export type DesignSaveResult = { ok: true; id: string; submitted: boolean; message: string } | { ok: false; error: string };

function toButtons(b: DesignButtonInput): TemplateButton[] {
  switch (b.type) {
    case "URL":
      return b.text.trim() && b.url.trim() ? [{ type: "URL", text: b.text.trim().slice(0, 25), url: b.url.trim() }] : [];
    case "PHONE_NUMBER":
      return b.text.trim() && b.phone_number.trim()
        ? [{ type: "PHONE_NUMBER", text: b.text.trim().slice(0, 25), phone_number: b.phone_number.replace(/[^\d+]/g, "") }]
        : [];
    case "QUICK_REPLY":
      return b.replies
        .map((r) => r.trim().slice(0, 25))
        .filter(Boolean)
        .slice(0, 3)
        .map((text) => ({ type: "QUICK_REPLY" as const, text }));
    default:
      return [];
  }
}

async function uniqueName(base: string, language: string, excludeId?: string): Promise<string> {
  let name = base;
  for (let i = 2; i < 200; i++) {
    const clash = await db.template.findFirst({ where: { name, language, ...(excludeId ? { id: { not: excludeId } } : {}) } });
    if (!clash) return name;
    name = `${base}_${i}`;
  }
  return `${base}_${Date.now().toString(36)}`;
}

function submissionError(e: unknown): string {
  if (isProviderError(e)) {
    const code = e.code;
    if (["0", "190", "10", "200", "3"].includes(code) || code === "CONFIG")
      return "Message designs can't be submitted right now. Please contact support.";
    if (e.info.detail) return `WhatsApp didn't accept this design: ${e.info.detail}`;
    if (e.retryable) return "WhatsApp is busy right now. Please try again in a few minutes.";
    return "WhatsApp didn't accept this design. Check the wording and try again.";
  }
  if (e instanceof Error && e.name === "ConfigError") return "Message designs can't be submitted right now. Please contact support.";
  return "Something went wrong while submitting. Please try again.";
}

export async function saveDesign(input: DesignInput, submit: boolean): Promise<DesignSaveResult> {
  const title = input.title.replace(/\s+/g, " ").trim();
  if (!title) return { ok: false, error: "Give this design a name." };
  const header = input.header.trim();
  const footer = input.footer.trim();
  const problems = validateDesignText({ body: input.friendlyBody, header, footer });
  if (problems.length) return { ok: false, error: problems[0] };

  const { body, variables } = toMetaBody(input.friendlyBody.trim(), input.samples);
  const buttons = toButtons(input.button);
  if (input.button.type === "URL" && buttons.length && !/^https?:\/\/\S+\.\S+/.test(input.button.url.trim()))
    return { ok: false, error: "Enter a full website link starting with https://" };

  const existing = input.id
    ? await db.template.findUnique({ where: { id: input.id }, include: { submissions: true } })
    : null;
  if (input.id && !existing) return { ok: false, error: "This design no longer exists." };

  const waba = currentWabaId();
  const sub = existing?.submissions.find((s) => s.wabaId === waba) ?? null;
  if (sub && sub.status === "PENDING" && submit) return { ok: false, error: "This design is still under review. Wait for WhatsApp's answer before editing it." };
  const lockedCategory = sub?.metaTemplateId && sub.status === "APPROVED" ? existing!.category : null;
  const category = lockedCategory ?? input.category;

  const name = existing && sub?.metaTemplateId ? existing.name : await uniqueName(slugifyName(title), input.language, existing?.id);
  const data = {
    title,
    name,
    language: existing && sub?.metaTemplateId ? existing.language : input.language,
    category,
    header: header || null,
    body,
    footer: footer || null,
    buttons: buttons as unknown as object,
    variables: variables as unknown as object,
    examples: { body: variables.map((v) => v.sample) } as object,
  };

  const t = existing
    ? await db.template.update({ where: { id: existing.id }, data })
    : await db.template.create({ data });

  if (!submit) return { ok: true, id: t.id, submitted: false, message: "Saved as draft." };
  if (!waba) return { ok: false, error: "Message designs can't be submitted right now. Please contact support." };

  const def: TemplateDefinition = {
    name: t.name,
    language: t.language,
    category: t.category,
    header: t.header,
    body: t.body,
    footer: t.footer,
    buttons,
    examples: { body: variables.map((v) => v.sample) },
  };

  try {
    const provider = getProvider();
    if (sub?.metaTemplateId) {
      await provider.editTemplate(sub.metaTemplateId, def);
      await db.templateSubmission.update({
        where: { id: sub.id },
        data: { status: "PENDING", rejectionReason: null, submittedAt: new Date() },
      });
    } else {
      let res: { id: string; status: string };
      try {
        res = await provider.createTemplate(def);
      } catch (e) {
        // A deleted design's name stays reserved at WhatsApp for a while; retry once with a fresh name.
        if (isProviderError(e) && /exist|already|deleted/i.test(`${e.info.title} ${e.info.detail ?? ""}`)) {
          const fresh = await uniqueName(`${slugifyName(title)}_${Date.now().toString(36).slice(-4)}`, t.language, t.id);
          await db.template.update({ where: { id: t.id }, data: { name: fresh } });
          def.name = fresh;
          res = await provider.createTemplate(def);
        } else throw e;
      }
      await db.templateSubmission.upsert({
        where: { templateId_wabaId: { templateId: t.id, wabaId: waba } },
        create: {
          templateId: t.id,
          wabaId: waba,
          metaTemplateId: res.id,
          status: res.status === "UNKNOWN" ? "PENDING" : (res.status as TemplateSubmission["status"]),
          submittedAt: new Date(),
        },
        update: {
          metaTemplateId: res.id,
          status: res.status === "UNKNOWN" ? "PENDING" : (res.status as TemplateSubmission["status"]),
          rejectionReason: null,
          submittedAt: new Date(),
        },
      });
    }
    return { ok: true, id: t.id, submitted: true, message: "Sent to WhatsApp for review. This usually takes a few minutes." };
  } catch (e) {
    return { ok: false, error: submissionError(e) };
  }
}

export async function deleteDesign(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = await db.template.findUnique({
    where: { id },
    include: { submissions: true, _count: { select: { broadcasts: true } } },
  });
  if (!t) return { ok: true };
  if (t._count.broadcasts > 0) return { ok: false, error: "This design was used in a campaign, so it's kept for your reports." };
  const sub = t.submissions.find((s) => s.wabaId === currentWabaId());
  if (sub?.metaTemplateId) {
    try {
      await getProvider().deleteTemplate(t.name, sub.metaTemplateId);
    } catch (e) {
      // Already gone at WhatsApp is fine; anything else stops the delete.
      if (!(isProviderError(e) && /not.?found|does not exist/i.test(`${e.info.title} ${e.info.detail ?? ""}`)))
        return { ok: false, error: submissionError(e) };
    }
  }
  await db.template.delete({ where: { id } });
  return { ok: true };
}

/** Pulls the latest review results from WhatsApp. Also brings in designs created elsewhere. */
export async function syncDesigns(): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  const waba = currentWabaId();
  if (!waba) return { ok: false, error: "Couldn't refresh right now. Please contact support." };
  try {
    const remote = await getProvider().listTemplates();
    let updated = 0;
    for (const r of remote) {
      const local =
        (await db.templateSubmission.findFirst({ where: { metaTemplateId: r.id }, include: { template: true } }))?.template ??
        (await db.template.findUnique({ where: { name_language: { name: r.name, language: r.language } } }));
      const t =
        local ??
        (await db.template.create({
          data: {
            title: humanizeName(r.name),
            name: r.name,
            language: r.language,
            category: r.category,
            header: r.header ?? null,
            body: r.body,
            footer: r.footer ?? null,
            buttons: (r.buttons ?? []) as unknown as object,
            examples: (r.examples ?? {}) as object,
          },
        }));
      await db.templateSubmission.upsert({
        where: { templateId_wabaId: { templateId: t.id, wabaId: waba } },
        create: {
          templateId: t.id,
          wabaId: waba,
          metaTemplateId: r.id,
          status: r.status as TemplateSubmission["status"],
          rejectionReason: r.rejectionReason ?? null,
          lastSyncedAt: new Date(),
        },
        update: {
          metaTemplateId: r.id,
          status: r.status as TemplateSubmission["status"],
          rejectionReason: r.rejectionReason ?? null,
          lastSyncedAt: new Date(),
        },
      });
      updated++;
    }
    return { ok: true, updated };
  } catch (e) {
    return { ok: false, error: submissionError(e) };
  }
}

let lastAutoSync = 0;

/** While designs wait for review, pulls fresh results at most once a minute (backup for the webhook). */
export async function autoSyncIfWaiting(designs: DesignView[]): Promise<DesignView[]> {
  if (!designs.some((d) => d.state === "review") || Date.now() - lastAutoSync < 60_000) return designs;
  lastAutoSync = Date.now();
  const res = await syncDesigns();
  return res.ok ? listDesigns() : designs;
}
