"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-fetches the server component tree every few seconds while `active` (live counters, chats). */
export function AutoRefresh({ active = true, every = 4000 }: { active?: boolean; every?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(tick, every);
    return () => window.clearInterval(id);
  }, [active, every, router]);
  return null;
}
