import { cn } from "@/lib/utils";

/** Business mark: the client's logo if set, otherwise a monogram on an iris gradient. */
export function Brand({
  name,
  logoUrl,
  className,
  size = "md",
  subtitle,
  dark,
}: {
  name: string;
  logoUrl: string | null;
  className?: string;
  size?: "md" | "lg";
  subtitle?: string;
  dark?: boolean;
}) {
  const box = size === "lg" ? "size-12 rounded-2xl text-lg" : "size-9 rounded-xl text-sm";
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary client logo URL
        <img src={logoUrl} alt="" className={cn(box, "shrink-0 rounded-xl object-contain bg-card ring-1 ring-border/40 p-0.5")} />
      ) : (
        <span
          className={cn(
            box,
            "grid shrink-0 place-items-center bg-gradient-to-br from-[oklch(0.64_0.16_65)] to-[oklch(0.48_0.14_52)] font-bold text-white shadow-[0_6px_18px_-6px_oklch(0.54_0.165_62/0.6)]",
          )}
        >
          {letters || "B"}
        </span>
      )}
      <span className="min-w-0">
        <span className={cn("block truncate font-bold tracking-tight", size === "lg" ? "text-xl" : "text-[0.95rem]", dark ? "text-white" : "text-foreground")}>
          {name}
        </span>
        {subtitle && <span className={cn("block truncate text-xs", dark ? "text-sidebar-foreground/70" : "text-muted-foreground")}>{subtitle}</span>}
      </span>
    </div>
  );
}
