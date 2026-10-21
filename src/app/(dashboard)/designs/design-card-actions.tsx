"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, MoreHorizontal, Pencil, RefreshCw, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { deleteDesignAction, refreshDesignsAction } from "./actions";

export function DesignCardActions({ id, ready }: { id: string; ready: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      {ready ? (
        <Link href={`/campaigns/new?design=${id}`} className={buttonVariants({ size: "sm" })}>
          <Send /> Use
        </Link>
      ) : null}
      <Link href={`/designs/${id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
        <Pencil /> Edit
      </Link>
      <Popover onOpenChange={(o) => !o && setConfirm(false)}>
        <PopoverTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More options" />}>
          <MoreHorizontal />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 gap-1 p-1">
          {confirm ? (
            <div className="grid gap-2 p-2">
              <p className="text-sm">Delete this design? This can’t be undone.</p>
              <Button
                variant="destructive"
                size="sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await deleteDesignAction(id);
                    if (res.ok) {
                      toast.success("Design deleted");
                      router.refresh();
                    } else toast.error(res.error);
                  })
                }
              >
                {pending && <Loader2 className="animate-spin" />} Delete
              </Button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-sm text-destructive hover:bg-muted">
              <Trash2 className="size-4" /> Delete design
            </button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function RefreshDesignsButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await refreshDesignsAction();
          if (res.ok) toast.success("Statuses are up to date");
          else toast.error(res.error);
        })
      }
    >
      <RefreshCw className={pending ? "animate-spin" : ""} /> Refresh status
    </Button>
  );
}
