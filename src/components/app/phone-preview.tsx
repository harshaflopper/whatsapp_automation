import { CornerDownLeft, ExternalLink, Phone } from "lucide-react";
import type { TemplateButton } from "@/lib/messaging/provider";
import { cn } from "@/lib/utils";

/** Renders WhatsApp's *bold*, _italic_ and ~strike~ markers. */
export function WhatsAppText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const re = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    const inner = token.slice(1, -1);
    if (token.startsWith("*")) parts.push(<strong key={i++}>{inner}</strong>);
    else if (token.startsWith("_")) parts.push(<em key={i++}>{inner}</em>);
    else parts.push(<s key={i++}>{inner}</s>);
    last = m.index! + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

export function MessageBubble({
  header,
  body,
  footer,
  buttons = [],
  time = "10:30",
  className,
}: {
  header?: string | null;
  body: string;
  footer?: string | null;
  buttons?: TemplateButton[];
  time?: string;
  className?: string;
}) {
  return (
    <div className={cn("w-full max-w-[19rem]", className)}>
      <div className="relative rounded-[0.6rem] rounded-tl-none bg-white px-2.5 pt-2 pb-1.5 text-[0.85rem] leading-[1.4] text-[#111b21] shadow-[0_1px_0.5px_rgb(11_20_26/0.13)]">
        <span className="absolute top-0 -left-2 h-3 w-2 bg-white [clip-path:polygon(100%_0,0_0,100%_100%)]" />
        {header && <div className="mb-1 font-bold">{header}</div>}
        <div className="whitespace-pre-wrap break-words">
          <WhatsAppText text={body || " "} />
        </div>
        {footer && <div className="mt-1 text-[0.78rem] text-[#667781]">{footer}</div>}
        <div className="-mt-0.5 text-right text-[0.68rem] text-[#667781]">{time}</div>
      </div>
      {buttons.length > 0 && (
        <div className="mt-0.5 grid gap-0.5">
          {buttons.map((b, i) => (
            <div
              key={i}
              className="flex items-center justify-center gap-1.5 rounded-[0.6rem] bg-white py-2 text-[0.85rem] font-medium text-[#027eb5] shadow-[0_1px_0.5px_rgb(11_20_26/0.13)]"
            >
              {b.type === "URL" ? (
                <ExternalLink className="size-3.5" />
              ) : b.type === "PHONE_NUMBER" ? (
                <Phone className="size-3.5" />
              ) : (
                <CornerDownLeft className="size-3.5" />
              )}
              {b.text || "Button"}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** A phone frame with a chat header and the message bubble inside. */
export function PhonePreview({
  businessName,
  children,
  className,
  caption,
}: {
  businessName: string;
  children: React.ReactNode;
  className?: string;
  caption?: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[21rem]", className)}>
      <div className="rounded-[2.4rem] bg-[oklch(0.2_0.03_278)] p-2.5 shadow-[0_30px_60px_-30px_oklch(0.3_0.1_278/0.6),inset_0_0_0_1px_rgb(255_255_255/0.08)]">
        <div className="overflow-hidden rounded-[1.9rem] bg-white">
          <div className="flex items-center gap-2.5 bg-[#f0f2f5] px-4 pt-6 pb-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-[oklch(0.62_0.2_277)] to-[oklch(0.48_0.23_292)] text-[0.65rem] font-bold text-white">
              {businessName
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase())
                .join("")}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[0.82rem] font-semibold text-[#111b21]">{businessName}</div>
              <div className="text-[0.66rem] text-[#667781]">Business account</div>
            </div>
          </div>
          <div className="chat-wallpaper min-h-[22rem] px-3 py-4">
            <div className="mb-3 flex justify-center">
              <span className="rounded-md bg-white/90 px-2 py-0.5 text-[0.66rem] font-medium text-[#54656f] shadow-sm">TODAY</span>
            </div>
            <div className="pl-2">{children}</div>
          </div>
        </div>
      </div>
      {caption && <p className="mt-3 text-center text-xs text-muted-foreground">{caption}</p>}
    </div>
  );
}
