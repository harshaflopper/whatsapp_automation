"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { Bold, ExternalLink, Info, Italic, Loader2, Lock, MessageSquareText, Phone, Plus, Send, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Field, NativeSelect } from "@/components/app/kit";
import { MessageBubble, PhonePreview } from "@/components/app/phone-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  DESIGN_TYPES,
  friendlyLabels,
  LANGUAGES,
  NAME_LABEL,
  renderFriendlyText,
  validateDesignText,
  type DesignButtonInput,
} from "@/lib/designs/text";
import type { TemplateButton } from "@/lib/messaging/provider";
import { cn } from "@/lib/utils";
import { saveDesignAction } from "./actions";

export type EditorInitial = {
  id?: string;
  title: string;
  category: "MARKETING" | "UTILITY";
  language: string;
  header: string;
  body: string;
  footer: string;
  button: DesignButtonInput;
  samples: Record<string, string>;
  categoryLocked: boolean;
  underReview: boolean;
  wasApproved: boolean;
};

type ButtonMode = DesignButtonInput["type"];

export function DesignEditor({ initial, businessName }: { initial: EditorInitial; businessName: string }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [category, setCategory] = useState(initial.category);
  const [language, setLanguage] = useState(initial.language);
  const [header, setHeader] = useState(initial.header);
  const [body, setBody] = useState(initial.body);
  const [footer, setFooter] = useState(initial.footer);
  const [samples, setSamples] = useState<Record<string, string>>(initial.samples);
  const [buttonMode, setButtonMode] = useState<ButtonMode>(initial.button.type);
  const [linkText, setLinkText] = useState(initial.button.type === "URL" ? initial.button.text : "Visit website");
  const [linkUrl, setLinkUrl] = useState(initial.button.type === "URL" ? initial.button.url : "https://");
  const [callText, setCallText] = useState(initial.button.type === "PHONE_NUMBER" ? initial.button.text : "Call us");
  const [callNumber, setCallNumber] = useState(initial.button.type === "PHONE_NUMBER" ? initial.button.phone_number : "+91");
  const [replies, setReplies] = useState<string[]>(initial.button.type === "QUICK_REPLY" ? initial.button.replies : ["Interested", "Not now"]);
  const [detailLabel, setDetailLabel] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [submitting, setSubmitting] = useState<"draft" | "submit" | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const labels = useMemo(() => friendlyLabels(body), [body]);
  const details = labels.filter((l) => l.toLowerCase() !== NAME_LABEL.toLowerCase() && l.toLowerCase() !== "customer name");
  const problems = useMemo(() => validateDesignText({ body, header, footer }), [body, header, footer]);

  const button: DesignButtonInput =
    buttonMode === "URL"
      ? { type: "URL", text: linkText, url: linkUrl }
      : buttonMode === "PHONE_NUMBER"
        ? { type: "PHONE_NUMBER", text: callText, phone_number: callNumber }
        : buttonMode === "QUICK_REPLY"
          ? { type: "QUICK_REPLY", replies }
          : { type: "NONE" };

  const previewButtons: TemplateButton[] =
    button.type === "URL"
      ? [{ type: "URL", text: button.text, url: button.url }]
      : button.type === "PHONE_NUMBER"
        ? [{ type: "PHONE_NUMBER", text: button.text, phone_number: button.phone_number }]
        : button.type === "QUICK_REPLY"
          ? button.replies.filter((r) => r.trim()).map((text) => ({ type: "QUICK_REPLY" as const, text }))
          : [];

  const sampleKey = (l: string) => l.toLowerCase();

  function insertAtCursor(text: string) {
    const el = bodyRef.current;
    if (!el) {
      setBody((b) => b + text);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + text + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + text.length, start + text.length);
    });
  }

  function wrapSelection(mark: string) {
    const el = bodyRef.current;
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    if (s === e) {
      insertAtCursor(`${mark}text${mark}`);
      return;
    }
    const next = body.slice(0, s) + mark + body.slice(s, e) + mark + body.slice(e);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(e + 2, e + 2);
    });
  }

  function save(submit: boolean) {
    setError(null);
    setSubmitting(submit ? "submit" : "draft");
    start(async () => {
      const res = await saveDesignAction(
        { id: initial.id, title, category, language, header, friendlyBody: body, footer, button, samples },
        submit,
      );
      setSubmitting(null);
      if (res.ok) {
        toast.success(res.message);
        router.push(submit ? "/designs" : `/designs/${res.id}`);
        router.refresh();
      } else setError(res.error);
    });
  }

  const previewBody = renderFriendlyText(body, samples);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="grid content-start gap-6">
        {initial.underReview && (
          <div className="flex gap-3 rounded-2xl border border-[oklch(0.87_0.09_75)] bg-[oklch(0.98_0.025_80)] p-4 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-[oklch(0.6_0.13_65)]" />
            <p>WhatsApp is reviewing this design right now. You can make changes once the review is done.</p>
          </div>
        )}
        {initial.wasApproved && !initial.underReview && (
          <div className="flex gap-3 rounded-2xl border border-[oklch(0.86_0.07_277)] bg-accent/60 p-4 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>This design is approved. If you submit changes, WhatsApp reviews it again and it can’t be used until approved. You can edit an approved design once a day.</p>
          </div>
        )}

        <section className="surface grid gap-5 p-5 sm:p-6">
          <Field label="Design name" htmlFor="d-title" hint="Only you see this name.">
            <Input id="d-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Diwali offer 2026" maxLength={80} />
          </Field>

          <div className="grid gap-2">
            <span className="flex items-center gap-2 text-sm font-medium">
              Type of message {initial.categoryLocked && <Lock className="size-3.5 text-muted-foreground" aria-label="Locked" />}
            </span>
            <div className="grid gap-3 sm:grid-cols-2">
              {DESIGN_TYPES.map((t) => {
                const on = category === t.value;
                return (
                  <label
                    key={t.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                      on ? "border-primary bg-accent/60 ring-1 ring-primary/30" : "border-border hover:bg-muted/50",
                      initial.categoryLocked && "cursor-not-allowed opacity-70",
                    )}
                  >
                    <input
                      type="radio"
                      name="category"
                      value={t.value}
                      checked={on}
                      disabled={initial.categoryLocked}
                      onChange={() => setCategory(t.value)}
                      className="mt-0.5 size-4 accent-[oklch(0.52_0.215_277)]"
                    />
                    <span>
                      <span className="block text-sm font-semibold">{t.label}</span>
                      <span className="block text-[0.8rem] text-muted-foreground">{t.hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {initial.categoryLocked && <p className="text-[0.8rem] text-muted-foreground">The type of an approved design can’t be changed. Create a new design instead.</p>}
          </div>

          <Field label="Language" htmlFor="d-lang" className="sm:max-w-xs">
            <NativeSelect id="d-lang" value={language} onChange={(e) => setLanguage(e.target.value)} disabled={!!initial.id && initial.categoryLocked}>
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </section>

        <section className="surface grid gap-5 p-5 sm:p-6">
          <Field label={<>Title <span className="font-normal text-muted-foreground">(optional)</span></>} htmlFor="d-header" hint={`${header.length}/60 · Shown in bold at the top.`}>
            <Input id="d-header" value={header} onChange={(e) => setHeader(e.target.value)} maxLength={60} placeholder="e.g. A festive treat for you" />
          </Field>

          <div className="grid gap-2">
            <label htmlFor="d-body" className="text-sm font-medium">
              Message
            </label>
            <div className="overflow-hidden rounded-xl border border-input bg-card focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
              <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => insertAtCursor(`{{${NAME_LABEL}}}`)}
                  className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[0.8rem] font-semibold text-accent-foreground hover:bg-accent"
                >
                  <UserRound className="size-3.5" /> Customer name
                </button>
                <Popover open={detailOpen} onOpenChange={setDetailOpen}>
                  <PopoverTrigger
                    render={
                      <button
                        type="button"
                        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[0.8rem] font-semibold text-accent-foreground hover:bg-accent"
                      />
                    }
                  >
                    <Plus className="size-3.5" /> Detail
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-72">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const l = detailLabel.replace(/[{}]/g, "").trim();
                        if (!l) return;
                        insertAtCursor(`{{${l}}}`);
                        setDetailLabel("");
                        setDetailOpen(false);
                      }}
                      className="grid gap-2"
                    >
                      <label htmlFor="d-detail" className="text-sm font-medium">
                        What changes each time you send?
                      </label>
                      <Input id="d-detail" value={detailLabel} onChange={(e) => setDetailLabel(e.target.value)} placeholder="e.g. Offer, Date, Amount" autoFocus maxLength={30} />
                      <div className="flex flex-wrap gap-1">
                        {["Offer", "Date", "Time", "Amount", "Last date"].map((s) => (
                          <button key={s} type="button" onClick={() => setDetailLabel(s)} className="h-7 cursor-pointer rounded-md bg-muted px-2 text-xs font-medium hover:bg-accent">
                            {s}
                          </button>
                        ))}
                      </div>
                      <Button type="submit" size="sm" disabled={!detailLabel.trim()}>
                        Insert
                      </Button>
                    </form>
                  </PopoverContent>
                </Popover>
                <span className="mx-1 h-5 w-px bg-border" />
                <button type="button" aria-label="Bold" onClick={() => wrapSelection("*")} className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground">
                  <Bold className="size-4" />
                </button>
                <button type="button" aria-label="Italic" onClick={() => wrapSelection("_")} className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground">
                  <Italic className="size-4" />
                </button>
                <span className="ml-auto pr-1 text-xs text-muted-foreground tabular-nums">{body.length}/1024</span>
              </div>
              <Textarea
                id="d-body"
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={7}
                placeholder="Hi {{Name}}, ..."
                className="min-h-40 rounded-none border-0 bg-transparent px-3.5 py-3 leading-relaxed shadow-none focus-visible:ring-0"
              />
            </div>
            <p className="text-[0.8rem] text-muted-foreground">
              Words in curly brackets like <code className="rounded bg-muted px-1">{"{{Name}}"}</code> are filled in for each customer when you send.
            </p>
          </div>

          {details.length > 0 && (
            <div className="grid gap-3 rounded-xl bg-muted/50 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="size-4 text-primary" /> Example values for WhatsApp’s review
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {details.map((l) => (
                  <Field key={l} label={l} htmlFor={`s-${l}`}>
                    <Input
                      id={`s-${l}`}
                      value={samples[sampleKey(l)] ?? ""}
                      onChange={(e) => setSamples({ ...samples, [sampleKey(l)]: e.target.value })}
                      placeholder={`Example ${l.toLowerCase()}`}
                    />
                  </Field>
                ))}
              </div>
            </div>
          )}

          <Field
            label={<>Footer <span className="font-normal text-muted-foreground">(optional)</span></>}
            htmlFor="d-footer"
            hint={
              category === "MARKETING" && !footer ? (
                <button type="button" onClick={() => setFooter("Reply STOP to unsubscribe")} className="cursor-pointer font-medium text-primary hover:underline">
                  Add “Reply STOP to unsubscribe”
                </button>
              ) : (
                `${footer.length}/60 · Small grey text at the bottom.`
              )
            }
          >
            <Input id="d-footer" value={footer} onChange={(e) => setFooter(e.target.value)} maxLength={60} placeholder="e.g. Reply STOP to unsubscribe" />
          </Field>
        </section>

        <section className="surface grid gap-4 p-5 sm:p-6">
          <div>
            <h2 className="text-sm font-semibold">Button</h2>
            <p className="text-[0.8rem] text-muted-foreground">Give customers a one-tap way to respond.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                { mode: "NONE", label: "No button", icon: null },
                { mode: "URL", label: "Website link", icon: ExternalLink },
                { mode: "PHONE_NUMBER", label: "Call us", icon: Phone },
                { mode: "QUICK_REPLY", label: "Quick replies", icon: MessageSquareText },
              ] as const
            ).map(({ mode, label, icon: Icon }) => (
              <button
                key={mode}
                type="button"
                aria-pressed={buttonMode === mode}
                onClick={() => setButtonMode(mode)}
                className={cn(
                  "flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors",
                  buttonMode === mode ? "border-primary bg-accent/60 text-accent-foreground" : "border-border hover:bg-muted/50",
                )}
              >
                {Icon && <Icon className="size-4" />}
                {label}
              </button>
            ))}
          </div>
          {buttonMode === "URL" && (
            <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
              <Field label="Button text" htmlFor="b-lt">
                <Input id="b-lt" value={linkText} onChange={(e) => setLinkText(e.target.value)} maxLength={25} />
              </Field>
              <Field label="Link" htmlFor="b-lu">
                <Input id="b-lu" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://yourwebsite.com" inputMode="url" />
              </Field>
            </div>
          )}
          {buttonMode === "PHONE_NUMBER" && (
            <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
              <Field label="Button text" htmlFor="b-ct">
                <Input id="b-ct" value={callText} onChange={(e) => setCallText(e.target.value)} maxLength={25} />
              </Field>
              <Field label="Phone number" htmlFor="b-cn">
                <Input id="b-cn" value={callNumber} onChange={(e) => setCallNumber(e.target.value)} inputMode="tel" placeholder="+91 98765 43210" />
              </Field>
            </div>
          )}
          {buttonMode === "QUICK_REPLY" && (
            <div className="grid gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Field key={i} label={`Reply ${i + 1}${i > 0 ? " (optional)" : ""}`} htmlFor={`b-qr-${i}`}>
                  <Input
                    id={`b-qr-${i}`}
                    value={replies[i] ?? ""}
                    maxLength={25}
                    onChange={(e) => {
                      const next = [...replies];
                      next[i] = e.target.value;
                      setReplies(next);
                    }}
                  />
                </Field>
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className="grid content-start gap-4 xl:sticky xl:top-6 xl:self-start">
        <PhonePreview businessName={businessName} caption="This is how customers will see it.">
          <MessageBubble header={header} body={previewBody} footer={footer} buttons={previewButtons} />
        </PhonePreview>

        <div className="surface grid gap-3 p-4">
          {(problems.length > 0 || error) && (
            <ul className="grid gap-1.5 rounded-xl bg-[oklch(0.97_0.02_15)] p-3 text-[0.82rem] text-[oklch(0.45_0.17_18)]">
              {error && <li className="font-semibold">{error}</li>}
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          {labels.length > 0 && problems.length === 0 && !error && (
            <p className="text-[0.82rem] text-muted-foreground">
              Fills in per customer: {labels.join(", ")}.
            </p>
          )}
          <Button size="lg" disabled={pending || problems.length > 0 || initial.underReview || !title.trim()} onClick={() => save(true)}>
            {submitting === "submit" ? <Loader2 className="animate-spin" /> : <Send />}
            Submit for review
          </Button>
          <Button variant="outline" disabled={pending || !title.trim() || initial.underReview} onClick={() => save(false)}>
            {submitting === "draft" && <Loader2 className="animate-spin" />}
            Save as draft
          </Button>
          <p className="text-center text-xs text-muted-foreground">WhatsApp usually approves designs within a few minutes.</p>
        </div>
      </aside>
    </div>
  );
}
