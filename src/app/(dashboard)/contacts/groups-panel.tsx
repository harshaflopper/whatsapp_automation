"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { FolderPlus, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createGroupAction, deleteGroupAction, renameGroupAction } from "./actions";

type Group = { id: string; name: string; count: number };

export function GroupsPanel({
  groups,
  counts,
  active,
  hrefFor,
}: {
  groups: Group[];
  counts: { all: number; subscribed: number; unsubscribed: number; unreachable: number };
  active: { groupId?: string; status?: string };
  hrefFor: Record<string, string>;
}) {
  const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "rename"; group: Group } | { mode: "delete"; group: Group } | null>(null);

  const item = (key: string, label: string, count: number, on: boolean, extra?: React.ReactNode) => (
    <div key={key} className={cn("group/item flex items-center rounded-xl transition-colors", on ? "bg-accent" : "hover:bg-muted/70")}>
      <Link
        href={hrefFor[key]}
        aria-current={on ? "true" : undefined}
        className={cn("flex h-10 min-w-0 flex-1 items-center justify-between gap-2 px-3 text-sm", on ? "font-semibold text-accent-foreground" : "text-foreground")}
      >
        <span className="truncate">{label}</span>
        <span className={cn("text-xs tabular-nums", on ? "text-accent-foreground" : "text-muted-foreground")}>{formatNumber(count)}</span>
      </Link>
      {extra}
    </div>
  );

  return (
    <aside className="surface p-3">
      <div className="grid gap-0.5">
        {item("all", "All contacts", counts.all, !active.groupId && !active.status)}
        {item("subscribed", "Subscribed", counts.subscribed, active.status === "subscribed")}
        {item("unsubscribed", "Unsubscribed", counts.unsubscribed, active.status === "unsubscribed")}
        {counts.unreachable > 0 && item("unreachable", "Not on WhatsApp", counts.unreachable, active.status === "unreachable")}
      </div>

      <div className="mt-4 mb-1.5 flex items-center justify-between px-3">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Groups</span>
        <button
          type="button"
          onClick={() => setDialog({ mode: "create" })}
          className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-accent"
        >
          <FolderPlus className="size-3.5" /> New
        </button>
      </div>
      <div className="grid gap-0.5">
        {groups.length === 0 && (
          <p className="px-3 py-2 text-[0.82rem] text-muted-foreground">Groups help you send to the right people, like VIP or Old customers.</p>
        )}
        {groups.map((g) =>
          item(
            `g:${g.id}`,
            g.name,
            g.count,
            active.groupId === g.id,
            <Popover>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    aria-label={`Options for ${g.name}`}
                    className="mr-1 grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground opacity-60 hover:bg-background hover:opacity-100 group-hover/item:opacity-100"
                  />
                }
              >
                <MoreHorizontal className="size-4" />
              </PopoverTrigger>
              <PopoverContent align="end" className="w-44 gap-0 p-1">
                <button type="button" onClick={() => setDialog({ mode: "rename", group: g })} className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-sm hover:bg-muted">
                  <Pencil className="size-4" /> Rename
                </button>
                <button type="button" onClick={() => setDialog({ mode: "delete", group: g })} className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-sm text-destructive hover:bg-muted">
                  <Trash2 className="size-4" /> Delete group
                </button>
              </PopoverContent>
            </Popover>,
          ),
        )}
      </div>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="p-0 sm:max-w-md">{dialog && <GroupDialogBody dialog={dialog} onDone={() => setDialog(null)} />}</DialogContent>
      </Dialog>
    </aside>
  );
}

function GroupDialogBody({
  dialog,
  onDone,
}: {
  dialog: { mode: "create" } | { mode: "rename"; group: Group } | { mode: "delete"; group: Group };
  onDone: () => void;
}) {
  const [name, setName] = useState(dialog.mode === "rename" ? dialog.group.name : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (dialog.mode === "delete") {
    return (
      <div>
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-lg font-semibold">Delete “{dialog.group.name}”?</DialogTitle>
          <DialogDescription>The {formatNumber(dialog.group.count)} contacts in it stay in your contacts. Only the group is removed.</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mx-0 mb-0 mt-4 px-6 py-4">
          <Button variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await deleteGroupAction(dialog.group.id);
                toast.success("Group deleted");
                onDone();
              })
            }
          >
            {pending && <Loader2 className="animate-spin" />} Delete group
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = dialog.mode === "create" ? await createGroupAction(name) : await renameGroupAction(dialog.group.id, name);
          if (res.ok) {
            toast.success(dialog.mode === "create" ? "Group created" : "Group renamed");
            onDone();
          } else setError(res.error);
        });
      }}
    >
      <DialogHeader className="px-6 pt-6 pb-2">
        <DialogTitle className="text-lg font-semibold">{dialog.mode === "create" ? "New group" : "Rename group"}</DialogTitle>
        <DialogDescription>Use groups to send campaigns to the right customers.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2 px-6 py-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Diwali leads" autoFocus aria-label="Group name" />
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      </div>
      <DialogFooter className="mx-0 mb-0 mt-3 px-6 py-4">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending && <Loader2 className="animate-spin" />} {dialog.mode === "create" ? "Create group" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}
