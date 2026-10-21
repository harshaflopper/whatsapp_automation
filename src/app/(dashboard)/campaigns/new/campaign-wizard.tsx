"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { CalendarClock, Check, Loader2, PenLine, Send, Smartphone, Users, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, Field, NativeSelect } from "@/components/app/kit";
import { MessageBubble, PhonePreview } from "@/components/app/phone-preview";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { defaultMappings, resolveParams, SOURCE_LABEL, validateMappings, type VariableMapping, type VariableSource } from "@/lib/campaigns/personalize";
import { renderMetaText, typeLabel, type DesignVariable } from "@/lib/designs/text";
import { formatDateTime, formatNumber, fromIstInputValue, isFutureBy } from "@/lib/format";
import type { TemplateButton } from "@/lib/messaging/provider";
import type { Audience, AudienceSummary, FollowUpSegment } from "@/lib/services/campaigns";
import { cn } from "@/lib/utils";
import { audienceAction, createCampaignAction, sendTestAction } from "../actions";

export type WizardDesign = {
  id: string;
  title: string;
  category: string;
  header: string | null;
  body: string;
  footer: string | null;
  buttons: TemplateButton[];
  variables: DesignVariable[];
};

type Sample = { id: string; name: string; city: string | null };

export function CampaignWizard({
  designs,
  groups,
  tags,
  subscribedTotal,
  initial,
  testPhone,
  businessName,
  defaultSchedule,
  minSchedule,
}: {
  designs: WizardDesign[];
  groups: { id: string; name: string; count: number }[];
  tags: { tag: string; count: number }[];
  subscribedTotal: number;
  initial: {
    designId?: string;
    contactIds?: string[];
    followUp?: { broadcastId: string; segment: FollowUpSegment; label: string; campaignName: string };
  };
  testPhone: string;
  businessName: string;
  defaultSchedule: string;
  minSchedule: string;
}) {
  const router = useRouter();
  const [designId, setDesignId] = useState(initial.designId && designs.some((d) => d.id === initial.designId) ? initial.designId : (designs[0]?.id ?? ""));
  const design = designs.find((d) => d.id === designId) ?? null;
  const [mappings, setMappings] = useState<VariableMapping[]>(() => (design ? defaultMappings(design.variables) : []));
  const [all, setAll] = useState(!initial.contactIds?.length && !initial.followUp);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [tagSel, setTagSel] = useState<string[]>([]);
  const [contactIds, setContactIds] = useState<string[]>(initial.contactIds ?? []);
  const [followUp, setFollowUp] = useState(initial.followUp ?? null);
  const [result, setResult] = useState<{ key: string; summary: AudienceSummary; sample: Sample[] } | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [when, setWhen] = useState<"now" | "later">("now");
  const [scheduleAt, setScheduleAt] = useState(defaultSchedule);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(testPhone || "+91 ");
  const [testing, startTest] = useTransition();
  const [creating, startCreate] = useTransition();

  const audience: Audience = useMemo(
    () =>
      all
        ? { all: true }
        : {
            groupIds,
            tags: tagSel,
            contactIds,
            ...(followUp ? { followUp: { broadcastId: followUp.broadcastId, segment: followUp.segment } } : {}),
          },
    [all, groupIds, tagSel, contactIds, followUp],
  );
  const audienceEmpty = !all && !groupIds.length && !tagSel.length && !contactIds.length && !followUp;

  const audienceKey = JSON.stringify(audience);
  useEffect(() => {
    if (audienceEmpty) return;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      const res = await audienceAction(JSON.parse(audienceKey) as Audience);
      if (!cancelled) {
        setResult({ key: audienceKey, summary: res.summary, sample: res.sample });
        setPreviewIdx(0);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [audienceKey, audienceEmpty]);

  const summary = audienceEmpty ? null : (result?.summary ?? null);
  const sample = audienceEmpty ? [] : (result?.sample ?? []);
  const loadingAudience = !audienceEmpty && result?.key !== audienceKey;

  function pickDesign(id: string) {
    setDesignId(id);
    const d = designs.find((x) => x.id === id);
    setMappings(d ? defaultMappings(d.variables) : []);
  }

  const mappingProblem = design ? validateMappings(design.variables, mappings) : "Pick a message.";
  const previewContact = sample[previewIdx] ?? { id: "x", name: "Priya Sharma", city: "Bengaluru" };
  const rendered = design
    ? renderMetaText(design.body, resolveParams(mappings, previewContact), design.variables.map((v) => v.label))
    : "";
  const scheduleDate = when === "later" ? fromIstInputValue(scheduleAt) : null;
  const recipients = summary?.eligible ?? 0;

  const blocker = !design
    ? "Pick a message."
    : audienceEmpty
      ? "Choose who should get it."
      : !loadingAudience && summary && recipients === 0
        ? "No subscribed customers in this selection."
        : mappingProblem
          ? mappingProblem
          : when === "later" && !isFutureBy(scheduleDate, 60_000)
            ? "Pick a time in the future."
            : null;

  function create() {
    if (!design || blocker) return;
    startCreate(async () => {
      const res = await createCampaignAction({
        name,
        designId: design.id,
        audience,
        mappings,
        sendAt: when === "later" && scheduleDate ? scheduleDate.toISOString() : null,
      });
      if (res.ok) {
        toast.success(when === "later" ? "Campaign scheduled" : "Your campaign is on its way");
        router.push(`/campaigns/${res.id}`);
      } else toast.error(res.error);
    });
  }

  if (!designs.length) {
    return (
      <div className="surface">
        <EmptyState
          icon={PenLine}
          title="You need an approved message first"
          description="Create a message design and WhatsApp will review it, usually within a few minutes. Then come back here to send it."
          action={
            <Link href="/designs/new" className={buttonVariants()}>
              Create a message design
            </Link>
          }
        />
      </div>
    );
  }

  const stepDone = [!!design, !audienceEmpty && recipients > 0, !mappingProblem, when === "now" || !!scheduleDate];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
      <div className="grid content-start gap-5">
        <Step n={1} title="Message" done={stepDone[0]}>
          <div className="grid gap-3 sm:grid-cols-2">
            {designs.map((d) => {
              const on = d.id === designId;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => pickDesign(d.id)}
                  aria-pressed={on}
                  className={cn(
                    "group cursor-pointer overflow-hidden rounded-xl border text-left transition",
                    on ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-primary/40",
                  )}
                >
                  <div className="chat-wallpaper relative h-28 overflow-hidden px-3 pt-3">
                    <MessageBubble header={d.header} body={renderMetaText(d.body, d.variables.map((v) => (v.kind === "name" ? "Priya" : v.sample)), d.variables.map((v) => v.label))} footer={d.footer} className="max-w-[14rem] origin-top-left scale-[0.85]" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#efeae2] to-transparent" />
                  </div>
                  <div className="flex items-center justify-between gap-2 px-3.5 py-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{d.title}</span>
                      <span className="block text-xs text-muted-foreground">{typeLabel(d.category)}</span>
                    </span>
                    <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                      {on && <Check className="size-3" strokeWidth={3} />}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </Step>

        <Step n={2} title="Who gets it" done={stepDone[1]}>
          <div className="grid gap-4">
            {(followUp || contactIds.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {followUp && (
                  <Chip onRemove={() => setFollowUp(null)}>
                    {followUp.label} · {followUp.campaignName}
                  </Chip>
                )}
                {contactIds.length > 0 && <Chip onRemove={() => setContactIds([])}>{contactIds.length} picked contacts</Chip>}
              </div>
            )}

            <label className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors", all ? "border-primary bg-accent/60" : "border-border hover:bg-muted/50")}>
              <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="size-4 cursor-pointer accent-primary" />
              <Users className="size-5 text-primary" />
              <span className="flex-1">
                <span className="block text-sm font-semibold">All subscribed customers</span>
                <span className="block text-[0.8rem] text-muted-foreground">{formatNumber(subscribedTotal)} customers</span>
              </span>
            </label>

            {!all && groups.length > 0 && (
              <div className="grid gap-2">
                <span className="text-sm font-medium">Groups</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {groups.map((g) => {
                    const on = groupIds.includes(g.id);
                    return (
                      <label key={g.id} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors", on ? "border-primary bg-accent/60" : "border-border hover:bg-muted/50")}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) => setGroupIds(e.target.checked ? [...groupIds, g.id] : groupIds.filter((x) => x !== g.id))}
                          className="size-4 cursor-pointer accent-primary"
                        />
                        <span className="flex-1 truncate text-sm font-medium">{g.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{formatNumber(g.count)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {!all && tags.length > 0 && (
              <div className="grid gap-2">
                <span className="text-sm font-medium">Tags</span>
                <div className="flex flex-wrap gap-2">
                  {tags.map((t) => {
                    const on = tagSel.includes(t.tag);
                    return (
                      <button
                        key={t.tag}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setTagSel(on ? tagSel.filter((x) => x !== t.tag) : [...tagSel, t.tag])}
                        className={cn(
                          "h-8 cursor-pointer rounded-full border px-3 text-[0.82rem] font-medium transition-colors",
                          on ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
                        )}
                      >
                        #{t.tag} <span className="text-xs opacity-70">{t.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {!all && !groups.length && !tags.length && !contactIds.length && !followUp && (
              <p className="text-sm text-muted-foreground">
                Tip: create groups in <Link href="/contacts" className="font-medium text-primary hover:underline">Contacts</Link> to send to specific customers.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-muted/60 px-4 py-3 text-sm">
              {loadingAudience ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Counting customers…
                </span>
              ) : summary ? (
                <>
                  <span>
                    Will reach <strong className="text-base tabular-nums">{formatNumber(summary.eligible)}</strong> {summary.eligible === 1 ? "customer" : "customers"}
                  </span>
                  {summary.skippedUnsubscribed + summary.skippedNotSubscribed + summary.skippedUnreachable > 0 && (
                    <span className="text-[0.8rem] text-muted-foreground">
                      {formatNumber(summary.skippedUnsubscribed + summary.skippedNotSubscribed + summary.skippedUnreachable)} left out (unsubscribed or not on WhatsApp)
                    </span>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">Choose customers above.</span>
              )}
            </div>
          </div>
        </Step>

        <Step n={3} title="Personalise" done={stepDone[2]}>
          {!design || design.variables.length === 0 ? (
            <p className="text-sm text-muted-foreground">This message has nothing to fill in. Everyone gets the same text.</p>
          ) : (
            <div className="grid gap-4">
              {design.variables.map((v, i) => {
                const m = mappings[i] ?? { source: "text" as VariableSource };
                const set = (patch: Partial<VariableMapping>) => {
                  const next = [...mappings];
                  next[i] = { ...m, ...patch };
                  setMappings(next);
                };
                return (
                  <div key={i} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[10rem_1fr_1fr] sm:items-end">
                    <div className="self-center">
                      <span className="inline-flex h-7 items-center rounded-lg bg-accent px-2.5 font-mono text-[0.8rem] font-semibold text-accent-foreground">{`{{${v.label}}}`}</span>
                    </div>
                    <Field label="Fill with" htmlFor={`src-${i}`}>
                      <NativeSelect id={`src-${i}`} value={m.source} onChange={(e) => set({ source: e.target.value as VariableSource })}>
                        {(Object.keys(SOURCE_LABEL) as VariableSource[]).map((s) => (
                          <option key={s} value={s}>
                            {SOURCE_LABEL[s]}
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                    {m.source === "text" ? (
                      <Field label="Text" htmlFor={`val-${i}`}>
                        <Input id={`val-${i}`} value={m.value ?? ""} onChange={(e) => set({ value: e.target.value })} placeholder={v.sample || v.label} />
                      </Field>
                    ) : (
                      <Field label="If missing, use" htmlFor={`fb-${i}`}>
                        <Input id={`fb-${i}`} value={m.fallback ?? ""} onChange={(e) => set({ fallback: e.target.value })} placeholder="there" />
                      </Field>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Step>

        <Step n={4} title="When" done={stepDone[3]}>
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                aria-pressed={when === "now"}
                onClick={() => setWhen("now")}
                className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-left transition-colors", when === "now" ? "border-primary bg-accent/60" : "border-border hover:bg-muted/50")}
              >
                <Zap className="mt-0.5 size-5 text-primary" />
                <span>
                  <span className="block text-sm font-semibold">Send now</span>
                  <span className="block text-[0.8rem] text-muted-foreground">Starts within a few seconds</span>
                </span>
              </button>
              <button
                type="button"
                aria-pressed={when === "later"}
                onClick={() => setWhen("later")}
                className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-left transition-colors", when === "later" ? "border-primary bg-accent/60" : "border-border hover:bg-muted/50")}
              >
                <CalendarClock className="mt-0.5 size-5 text-primary" />
                <span>
                  <span className="block text-sm font-semibold">Schedule for later</span>
                  <span className="block text-[0.8rem] text-muted-foreground">Pick a date and time</span>
                </span>
              </button>
            </div>
            {when === "later" && (
              <Field label="Date and time (India time)" htmlFor="sched" className="sm:max-w-xs">
                <Input id="sched" type="datetime-local" value={scheduleAt} min={minSchedule} onChange={(e) => setScheduleAt(e.target.value)} />
              </Field>
            )}
            <Field label={<>Campaign name <span className="font-normal text-muted-foreground">(optional)</span></>} htmlFor="cname" hint="Helps you find it in reports." className="sm:max-w-md">
              <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} placeholder={design ? `${design.title}` : "e.g. Diwali offer"} maxLength={120} />
            </Field>
          </div>
        </Step>
      </div>

      <aside className="grid content-start gap-4 xl:sticky xl:top-6 xl:self-start">
        <PhonePreview
          businessName={businessName}
          caption={
            sample.length > 1 ? (
              <span className="inline-flex items-center gap-1.5">
                Preview for
                {sample.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setPreviewIdx(i)}
                    className={cn("cursor-pointer rounded-full px-2 py-0.5 font-medium", i === previewIdx ? "bg-foreground text-background" : "bg-muted hover:bg-accent")}
                  >
                    {s.name.split(/\s+/)[0]}
                  </button>
                ))}
              </span>
            ) : (
              `Preview for ${previewContact.name}`
            )
          }
        >
          {design ? <MessageBubble header={design.header} body={rendered} footer={design.footer} buttons={design.buttons} /> : null}
        </PhonePreview>

        <div className="surface grid gap-4 p-5">
          <dl className="grid gap-2.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Message</dt>
              <dd className="truncate text-right font-medium">{design?.title ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Customers</dt>
              <dd className="font-medium tabular-nums">{summary ? formatNumber(recipients) : "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">When</dt>
              <dd className="text-right font-medium">{when === "now" ? "Right away" : scheduleDate ? formatDateTime(scheduleDate) : "—"}</dd>
            </div>
          </dl>

          {blocker && !loadingAudience && <p className="rounded-xl bg-muted/70 px-3 py-2 text-[0.82rem] text-muted-foreground">{blocker}</p>}

          <Button size="lg" className="h-12 text-[0.95rem]" disabled={!!blocker || creating || loadingAudience} onClick={create}>
            {creating ? <Loader2 className="animate-spin" /> : when === "now" ? <Send /> : <CalendarClock />}
            {when === "now" ? `Send to ${formatNumber(recipients)} ${recipients === 1 ? "customer" : "customers"}` : "Schedule campaign"}
          </Button>

          <div className="grid gap-2 border-t pt-4">
            <label htmlFor="test-phone" className="flex items-center gap-2 text-sm font-medium">
              <Smartphone className="size-4 text-muted-foreground" /> Send a test to my phone
            </label>
            <div className="flex gap-2">
              <Input id="test-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+91 98765 43210" />
              <Button
                variant="outline"
                disabled={!design || testing || !!mappingProblem}
                onClick={() =>
                  startTest(async () => {
                    const res = await sendTestAction({ designId: design!.id, mappings, phone });
                    if (res.ok) toast.success(res.message);
                    else toast.error(res.error);
                  })
                }
              >
                {testing ? <Loader2 className="animate-spin" /> : "Send"}
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className="surface p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-3 text-[1.02rem] font-semibold">
        <span
          className={cn(
            "grid size-7 place-items-center rounded-full text-xs font-bold transition-colors",
            done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {done ? <Check className="size-3.5" strokeWidth={3} /> : n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex h-8 items-center gap-1 rounded-full bg-accent pr-1 pl-3 text-[0.82rem] font-medium text-accent-foreground">
      {children}
      <button type="button" onClick={onRemove} aria-label="Remove" className="grid size-6 cursor-pointer place-items-center rounded-full hover:bg-background/60">
        <X className="size-3.5" />
      </button>
    </span>
  );
}
