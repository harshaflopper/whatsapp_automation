"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="surface mx-auto mt-10 flex max-w-lg flex-col items-center px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-[oklch(0.96_0.025_15)] text-[oklch(0.5_0.18_18)]">
        <TriangleAlert className="size-6" />
      </span>
      <h1 className="mt-4 text-lg font-semibold">Something went wrong</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">This page couldn’t load right now. Please try again. If it keeps happening, contact support.</p>
      <Button className="mt-6" onClick={reset}>
        <RotateCcw /> Try again
      </Button>
    </div>
  );
}
