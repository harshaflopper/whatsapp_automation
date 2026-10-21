export const APP_TIMEZONE = "Asia/Kolkata";

const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: APP_TIMEZONE,
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const dateFmt = new Intl.DateTimeFormat("en-IN", { timeZone: APP_TIMEZONE, day: "numeric", month: "short", year: "numeric" });
const shortDateFmt = new Intl.DateTimeFormat("en-IN", { timeZone: APP_TIMEZONE, day: "numeric", month: "short" });
const timeOnlyFmt = new Intl.DateTimeFormat("en-IN", { timeZone: APP_TIMEZONE, hour: "numeric", minute: "2-digit", hour12: true });
const dayFmt = new Intl.DateTimeFormat("en-IN", { timeZone: APP_TIMEZONE, day: "2-digit" });
const monFmt = new Intl.DateTimeFormat("en-IN", { timeZone: APP_TIMEZONE, month: "short" });
const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIMEZONE, hour: "numeric", hour12: false });

function toDate(d: Date | string) {
  return typeof d === "string" ? new Date(d) : d;
}

/** "20 Oct, 3:45 pm" in IST */
export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return dateTimeFmt.format(toDate(d));
}

/** "20 Oct 2026" */
export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return dateFmt.format(toDate(d));
}

/** "3:45 pm" */
export function formatClock(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return timeOnlyFmt.format(toDate(d));
}

/** Calendar chip parts: { day: "24", month: "Oct" } */
export function dateChip(d: Date | string) {
  return { day: dayFmt.format(toDate(d)), month: monFmt.format(toDate(d)) };
}

/** Chat-list style: time today, "Yesterday", or "20 Oct". */
export function formatRelativeDay(d: Date | string | null | undefined, now: Date = new Date()): string {
  if (!d) return "";
  const date = toDate(d);
  const key = (x: Date) => dateFmt.format(x);
  if (key(date) === key(now)) return timeOnlyFmt.format(date);
  const y = new Date(now.getTime() - 86_400_000);
  if (key(date) === key(y)) return "Yesterday";
  return shortDateFmt.format(date);
}

/** "2 min ago", "3 h ago", or a date. */
export function timeAgo(d: Date | string | null | undefined, now: Date = new Date()): string {
  if (!d) return "—";
  const diff = Math.max(0, now.getTime() - toDate(d).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  return formatDate(d);
}

export function greeting(now: Date = new Date()): string {
  const h = Number(hourFmt.format(now));
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n);
}

export function percent(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

/** The value for an <input type="datetime-local"> in IST. */
export function toIstInputValue(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/** Parses "2026-10-24T09:00" typed in IST into a UTC Date. */
export function fromIstInputValue(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  // IST is UTC+05:30 all year (no DST).
  return new Date(Date.UTC(y, mo - 1, d, h, mi) - 330 * 60_000);
}

/** True when `d` is within the last `ms` milliseconds. */
export function isWithin(d: Date | string | null | undefined, ms: number): boolean {
  if (!d) return false;
  return Date.now() - new Date(d).getTime() < ms;
}

/** True when `d` is at least `ms` milliseconds in the future. */
export function isFutureBy(d: Date | null | undefined, ms: number): boolean {
  return !!d && d.getTime() >= Date.now() + ms;
}

/** "Now" plus an offset, for defaults computed on the server. */
export function fromNow(ms: number): Date {
  return new Date(Date.now() + ms);
}
