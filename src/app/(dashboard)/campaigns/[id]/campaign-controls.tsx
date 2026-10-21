"use client";

import { useState, useTransition } from "react";
import { Loader2, Pause, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { campaignControlAction } from "../actions";

export function CampaignControls({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const act = (a: "pause" | "resume" | "stop", msg: string) =>
    start(async () => {
      await campaignControlAction(id, a);
      toast.success(msg);
      setOpen(false);
    });

  if (!["SENDING", "SCHEDULED", "PAUSED"].includes(status)) return null;
  return (
    <>
      {status === "PAUSED" ? (
        <Button variant="outline" disabled={pending} onClick={() => act("resume", "Campaign resumed")}>
          {pending ? <Loader2 className="animate-spin" /> : <Play />} Resume
        </Button>
      ) : (
        <Button variant="outline" disabled={pending} onClick={() => act("pause", "Campaign paused")}>
          {pending ? <Loader2 className="animate-spin" /> : <Pause />} Pause
        </Button>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button variant="outline" disabled={pending} className="text-destructive hover:text-destructive" />}>
          <Square /> {status === "SCHEDULED" ? "Cancel" : "Stop"}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64">
          <p className="text-sm">
            {status === "SCHEDULED" ? "Cancel this scheduled campaign? Nothing will be sent." : "Stop sending? Customers who already got it keep it; the rest won't be sent."}
          </p>
          <Button variant="destructive" size="sm" onClick={() => act("stop", status === "SCHEDULED" ? "Campaign cancelled" : "Campaign stopped")} disabled={pending}>
            {status === "SCHEDULED" ? "Cancel campaign" : "Stop campaign"}
          </Button>
        </PopoverContent>
      </Popover>
    </>
  );
}
