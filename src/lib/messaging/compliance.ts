/**
 * WhatsApp sending rules, enforced at the send layer (not just the UI).
 *
 *  - Business-initiated (template) messages: contact must be opted in.
 *  - Free-text messages: only inside the 24h customer-service window, counted from the
 *    contact's last inbound message, and never to someone who has opted out (e.g. replied STOP).
 *    A contact who messaged us first but never formally opted in may still get a service reply.
 */

export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ComplianceContact = {
  optedIn: boolean;
  optedOutAt?: Date | null;
  lastInboundAt?: Date | null;
};

export type ComplianceCode = "OPTED_OUT" | "NOT_OPTED_IN" | "OUTSIDE_WINDOW";

export class ComplianceError extends Error {
  constructor(
    public readonly code: ComplianceCode,
    message: string,
  ) {
    super(message);
    this.name = "ComplianceError";
  }
}

export function isWithinServiceWindow(lastInboundAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!lastInboundAt) return false;
  const age = now.getTime() - lastInboundAt.getTime();
  return age >= 0 && age < SERVICE_WINDOW_MS;
}

/** Milliseconds left in the window, or 0 if closed. */
export function serviceWindowRemainingMs(lastInboundAt: Date | null | undefined, now: Date = new Date()): number {
  if (!isWithinServiceWindow(lastInboundAt, now)) return 0;
  return SERVICE_WINDOW_MS - (now.getTime() - lastInboundAt!.getTime());
}

export function hasOptedOut(c: ComplianceContact): boolean {
  return !c.optedIn && !!c.optedOutAt;
}

export function assertCanSend(c: ComplianceContact, kind: "template" | "text", now: Date = new Date()): void {
  if (hasOptedOut(c)) {
    throw new ComplianceError("OPTED_OUT", "This contact has opted out of WhatsApp messages.");
  }
  if (kind === "template" && !c.optedIn) {
    throw new ComplianceError("NOT_OPTED_IN", "This contact hasn't opted in, so templates can't be sent to them.");
  }
  if (kind === "text" && !isWithinServiceWindow(c.lastInboundAt, now)) {
    throw new ComplianceError(
      "OUTSIDE_WINDOW",
      "The 24-hour reply window is closed. Send an approved template instead.",
    );
  }
}
