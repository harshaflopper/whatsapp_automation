import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tone = "iris" | "sky" | "amber" | "rose" | "slate" | "violet" | "ink";

const PILL: Record<Tone, string> = {
  iris: "bg-[oklch(0.96_0.035_65)] text-[oklch(0.42_0.14_60)] ring-[oklch(0.88_0.07_65)]",
  sky: "bg-[oklch(0.95_0.02_50)] text-[oklch(0.38_0.08_48)] ring-[oklch(0.87_0.05_50)]",
  amber: "bg-[oklch(0.96_0.05_80)] text-[oklch(0.45_0.12_65)] ring-[oklch(0.87_0.09_75)]",
  rose: "bg-[oklch(0.96_0.025_22)] text-[oklch(0.48_0.18_24)] ring-[oklch(0.88_0.07_24)]",
  slate: "bg-muted text-muted-foreground ring-border",
  violet: "bg-[oklch(0.96_0.035_85)] text-[oklch(0.45_0.12_80)] ring-[oklch(0.88_0.07_80)]",
  ink: "bg-foreground text-background ring-foreground",
};

const DOT: Record<Tone, string> = {
  iris: "bg-[oklch(0.56_0.16_62)]",
  sky: "bg-[oklch(0.52_0.10_48)]",
  amber: "bg-[oklch(0.70_0.15_72)]",
  rose: "bg-[oklch(0.60_0.20_24)]",
  slate: "bg-muted-foreground/60",
  violet: "bg-[oklch(0.65_0.14_80)]",
  ink: "bg-background",
};

export function Pill({
  tone = "slate",
  children,
  dot,
  pulse,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset",
        PILL[tone],
        className,
      )}
    >
      {dot && (
        <span className="relative flex size-1.5">
          {pulse && <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", DOT[tone])} />}
          <span className={cn("relative inline-flex size-1.5 rounded-full", DOT[tone])} />
        </span>
      )}
      {children}
    </span>
  );
}

export function IconChip({ icon: Icon, tone = "iris", className }: { icon: LucideIcon; tone?: Tone; className?: string }) {
  return (
    <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset", PILL[tone], className)}>
      <Icon className="size-[1.15rem]" strokeWidth={2.1} />
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "iris",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: LucideIcon;
  tone?: Tone;
}) {
  return (
    <div className="surface relative overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-muted-foreground">{label}</div>
          <div className="mt-2 text-[2rem] font-bold leading-none tracking-tight tabular-nums">{value}</div>
          {hint && <div className="mt-2.5 text-[0.82rem] text-muted-foreground">{hint}</div>}
        </div>
        <IconChip icon={icon} tone={tone} />
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <span className="grid size-14 place-items-center rounded-2xl bg-accent text-accent-foreground ring-1 ring-inset ring-primary/20 shadow-sm">
        <Icon className="size-6" strokeWidth={1.9} />
      </span>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("surface", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6">
          <div className="min-w-0">
            {title && <h2 className="text-[1.02rem] font-semibold tracking-tight">{title}</h2>}
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("p-5 sm:p-6", title || actions ? "pt-4 sm:pt-4" : "", bodyClassName)}>{children}</div>
    </section>
  );
}

const AVATAR_TONES = [
  "from-[oklch(0.60_0.16_62)] to-[oklch(0.48_0.14_52)]",
  "from-[oklch(0.54_0.12_48)] to-[oklch(0.42_0.10_38)]",
  "from-[oklch(0.68_0.14_75)] to-[oklch(0.55_0.14_60)]",
  "from-[oklch(0.42_0.04_55)] to-[oklch(0.28_0.03_55)]",
  "from-[oklch(0.58_0.18_28)] to-[oklch(0.46_0.16_22)]",
];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const tone = AVATAR_TONES[h % AVATAR_TONES.length];
  const box = size === "sm" ? "size-8 text-[0.7rem]" : size === "lg" ? "size-14 text-lg" : "size-10 text-sm";
  return (
    <span
      aria-hidden="true"
      className={cn("grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-semibold text-white", tone, box, className)}
    >
      {initials(name)}
    </span>
  );
}

export function Meter({ value, tone = "iris", className }: { value: number; tone?: Tone; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full rounded-full transition-[width] duration-700", DOT[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Native <select> styled to match inputs. Reliable everywhere, including mobile. */
export function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative", className)}>
      <select
        className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-input bg-card pr-9 pl-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="m6 8 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[0.8rem] font-medium text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-[0.8rem] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
