"use client";

import { useEffect, useRef } from "react";

/** Keeps a chat pinned to the newest message, unless the reader scrolled up. */
export function ScrollToBottom({ dep, children, className }: { dep: string; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (first.current || nearBottom) el.scrollTop = el.scrollHeight;
    first.current = false;
  }, [dep]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
