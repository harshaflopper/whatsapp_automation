import type { TemplateStatus } from "../provider";

const KNOWN_STATUSES: TemplateStatus[] = ["PENDING", "APPROVED", "REJECTED", "PAUSED", "DISABLED", "IN_APPEAL"];

/** Maps Meta's template status / webhook event strings onto our TemplateStatus. */
export function normaliseTemplateStatus(s: string | undefined | null): TemplateStatus {
  const up = (s ?? "").toUpperCase();
  if ((KNOWN_STATUSES as string[]).includes(up)) return up as TemplateStatus;
  if (up === "PENDING_DELETION" || up === "DELETED") return "DISABLED";
  return "UNKNOWN";
}
