import type { DesignState } from "@/lib/designs/text";
import type { ContactStatus } from "@/lib/services/contacts";
import { Pill, type Tone } from "./kit";

const CAMPAIGN: Record<string, { label: string; tone: Tone; pulse?: boolean }> = {
  DRAFT: { label: "Draft", tone: "slate" },
  SCHEDULED: { label: "Scheduled", tone: "violet" },
  SENDING: { label: "Sending", tone: "sky", pulse: true },
  PAUSED: { label: "Paused", tone: "amber" },
  CANCELLED: { label: "Stopped", tone: "slate" },
  COMPLETED: { label: "Completed", tone: "iris" },
};

export function CampaignStatusPill({ status }: { status: string }) {
  const s = CAMPAIGN[status] ?? { label: status, tone: "slate" as Tone };
  return (
    <Pill tone={s.tone} dot pulse={s.pulse}>
      {s.label}
    </Pill>
  );
}

const DESIGN: Record<DesignState, { label: string; tone: Tone }> = {
  ready: { label: "Ready to use", tone: "iris" },
  review: { label: "Under review", tone: "amber" },
  changes: { label: "Needs changes", tone: "rose" },
  draft: { label: "Draft", tone: "slate" },
};

export function DesignStatePill({ state }: { state: DesignState }) {
  const s = DESIGN[state];
  return (
    <Pill tone={s.tone} dot pulse={state === "review"}>
      {s.label}
    </Pill>
  );
}

const CONTACT: Record<ContactStatus, { label: string; tone: Tone }> = {
  subscribed: { label: "Subscribed", tone: "iris" },
  unsubscribed: { label: "Unsubscribed", tone: "slate" },
  unreachable: { label: "Not on WhatsApp", tone: "rose" },
  pending: { label: "Not subscribed", tone: "amber" },
};

export function ContactStatusPill({ status }: { status: ContactStatus }) {
  const s = CONTACT[status];
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

const MESSAGE: Record<string, { label: string; tone: Tone }> = {
  QUEUED: { label: "Waiting", tone: "slate" },
  SENDING: { label: "Sending", tone: "slate" },
  SENT: { label: "Sent", tone: "slate" },
  DELIVERED: { label: "Delivered", tone: "sky" },
  READ: { label: "Read", tone: "iris" },
  FAILED: { label: "Not delivered", tone: "rose" },
  CANCELLED: { label: "Not sent", tone: "slate" },
};

export function MessageStatusPill({ status }: { status: string }) {
  const s = MESSAGE[status] ?? { label: status, tone: "slate" as Tone };
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

/** WhatsApp-like ticks: one grey (sent), two grey (delivered), two blue (read). */
export function Ticks({ status, className }: { status: string; className?: string }) {
  if (status === "FAILED") {
    return (
      <svg viewBox="0 0 16 16" className={className ?? "size-3.5 text-destructive"} aria-label="Not delivered" role="img">
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 4.5v4.2M8 11h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === "QUEUED" || status === "SENDING") {
    return (
      <svg viewBox="0 0 16 16" className={className ?? "size-3.5 text-muted-foreground"} aria-label="Sending" role="img">
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 5v3.2l2 1.3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  const double = status === "DELIVERED" || status === "READ";
  const color = status === "READ" ? "text-[#53bdeb]" : "text-[#8696a0]";
  return (
    <svg viewBox="0 0 18 12" className={className ?? `h-3 w-[1.1rem] ${color}`} aria-label={status === "READ" ? "Read" : double ? "Delivered" : "Sent"} role="img">
      <path d={double ? "M1 6.6 4 9.6 10 2.6" : "M3.5 6.6 6.5 9.6 12.5 2.6"} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {double && <path d="M6.6 9.1 7.1 9.6 13.1 2.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}
