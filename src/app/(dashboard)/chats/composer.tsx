"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Loader2, Lock, MessageSquareText, PenLine, Plus, SendHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/app/kit";
import { MessageBubble } from "@/components/app/phone-preview";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { renderMetaText, type DesignVariable } from "@/lib/designs/text";
import type { TemplateButton } from "@/lib/messaging/provider";
import { cn } from "@/lib/utils";
import { deleteQuickReplyAction, saveQuickReplyAction, sendDesignToContactAction, sendReplyAction } from "./actions";

export type ComposerDesign = {
  id: string;
  title: string;
  header: string | null;
  body: string;
  footer: string | null;
  buttons: TemplateButton[];
  variables: DesignVariable[];
};

export function Composer({
  contactId,
  firstName,
  windowOpen,
  unsubscribed,
  quickReplies,
  designs,
}: {
  contactId: string;
  firstName: string;
  windowOpen: boolean;
  unsubscribed: boolean;
  quickReplies: { id: string; title: string; body: string }[];
  designs: ComposerDesign[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [designOpen, setDesignOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  function send() {
    const t = text.trim();
    if (!t) return;
    start(async () => {
      const res = await sendReplyAction(contactId, t);
      if (res.ok) {
        setText("");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  if (unsubscribed) {
    return (
      <div className="flex items-center gap-3 border-t bg-muted/50 px-5 py-4 text-sm text-muted-foreground">
        <Lock className="size-4 shrink-0" />
        This customer unsubscribed. You can’t message them unless they write to you again.
      </div>
    );
  }

  return (
    <div className="border-t bg-card">
      {!windowOpen ? (
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-start gap-3 text-sm">
            <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">
              It’s been more than 24 hours since {firstName || "this customer"} wrote to you. Send a message design to restart the chat.
            </span>
          </div>
          <Button onClick={() => setDesignOpen(true)} disabled={!designs.length}>
            <PenLine /> Send a message design
          </Button>
        </div>
      ) : (
        <div className="flex items-end gap-2 p-3 sm:p-4">
          <div className="flex gap-1">
            <QuickReplies
              replies={quickReplies}
              onPick={(body) => {
                setText((t) => (t ? `${t}\n${body}` : body));
                ref.current?.focus();
              }}
            />
            <Button variant="ghost" size="icon" aria-label="Send a message design" onClick={() => setDesignOpen(true)} disabled={!designs.length}>
              <PenLine />
            </Button>
          </div>
          <Textarea
            ref={ref}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Type a reply"
            aria-label="Reply"
            className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl bg-background py-2.5"
          />
          <Button size="icon-lg" className="rounded-2xl" aria-label="Send" onClick={send} disabled={pending || !text.trim()}>
            {pending ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
          </Button>
        </div>
      )}
      <SendDesignDialog open={designOpen} onOpenChange={setDesignOpen} contactId={contactId} firstName={firstName} designs={designs} />
    </div>
  );
}

function QuickReplies({ replies, onPick }: { replies: { id: string; title: string; body: string }[]; onPick: (body: string) => void }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setAdding(false);
      }}
    >
      <PopoverTrigger render={<Button variant="ghost" size="icon" aria-label="Quick replies" />}>
        <MessageSquareText />
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-80 gap-1 p-2">
        <div className="px-2 pt-1 pb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Quick replies</div>
        {!adding && (
          <>
            <ul className="scrollbar-thin grid max-h-64 gap-0.5 overflow-y-auto">
              {replies.length === 0 && <li className="px-2 py-3 text-sm text-muted-foreground">Save answers you send often, like your address or timings.</li>}
              {replies.map((r) => (
                <li key={r.id} className="group flex items-start rounded-lg hover:bg-muted">
                  <button
                    type="button"
                    onClick={() => {
                      onPick(r.body);
                      setOpen(false);
                    }}
                    className="min-w-0 flex-1 cursor-pointer px-2.5 py-2 text-left"
                  >
                    <span className="block text-sm font-semibold">{r.title}</span>
                    <span className="line-clamp-2 block text-[0.8rem] text-muted-foreground">{r.body}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${r.title}`}
                    onClick={() => start(async () => void (await deleteQuickReplyAction(r.id)))}
                    className="m-1.5 grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-background hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setAdding(true)} className="mt-1 flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-sm font-semibold text-primary hover:bg-accent">
              <Plus className="size-4" /> New quick reply
            </button>
          </>
        )}
        {adding && (
          <form
            className="grid gap-2 p-1"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await saveQuickReplyAction({ title, body });
                if (res.ok) {
                  setTitle("");
                  setBody("");
                  setAdding(false);
                  toast.success("Quick reply saved");
                } else toast.error(res.error);
              });
            }}
          >
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short name, e.g. Shop timings" aria-label="Quick reply name" autoFocus />
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="We're open 10 am to 8 pm, Monday to Saturday." aria-label="Reply text" />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={pending || !title.trim() || !body.trim()}>
                Save
              </Button>
            </div>
          </form>
        )}
      </PopoverContent>
    </Popover>
  );
}

function SendDesignDialog({
  open,
  onOpenChange,
  contactId,
  firstName,
  designs,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contactId: string;
  firstName: string;
  designs: ComposerDesign[];
}) {
  const router = useRouter();
  const [designId, setDesignId] = useState(designs[0]?.id ?? "");
  const design = designs.find((d) => d.id === designId);
  const [values, setValues] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();
  const current = design ? (values[design.id] ?? design.variables.map((v) => (v.kind === "name" ? firstName : ""))) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle className="text-lg font-semibold">Send a message design</DialogTitle>
          <DialogDescription>Approved messages can be sent any time, even when the chat is closed.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 px-6 py-5 sm:grid-cols-[1fr_17rem]">
          <div className="grid content-start gap-4">
            <div className="grid gap-2">
              <span className="text-sm font-medium">Message</span>
              <div className="grid gap-1.5">
                {designs.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDesignId(d.id)}
                    aria-pressed={d.id === designId}
                    className={cn(
                      "flex h-10 cursor-pointer items-center rounded-xl border px-3 text-left text-sm font-medium transition-colors",
                      d.id === designId ? "border-primary bg-accent/60" : "border-border hover:bg-muted/50",
                    )}
                  >
                    {d.title}
                  </button>
                ))}
              </div>
            </div>
            {design?.variables.map((v, i) => (
              <Field key={`${design.id}-${i}`} label={v.label} htmlFor={`sv-${i}`}>
                <Input
                  id={`sv-${i}`}
                  value={current[i] ?? ""}
                  placeholder={v.sample}
                  onChange={(e) => {
                    const next = [...current];
                    next[i] = e.target.value;
                    setValues({ ...values, [design.id]: next });
                  }}
                />
              </Field>
            ))}
          </div>
          {design && (
            <div className="chat-wallpaper self-start rounded-xl p-3">
              <MessageBubble header={design.header} body={renderMetaText(design.body, current, design.variables.map((v) => v.label))} footer={design.footer} buttons={design.buttons} />
            </div>
          )}
        </div>
        <DialogFooter className="mx-0 mb-0 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!design || pending}
            onClick={() =>
              start(async () => {
                const res = await sendDesignToContactAction(contactId, design!.id, current);
                if (res.ok) {
                  toast.success("Message sent");
                  onOpenChange(false);
                  router.refresh();
                } else toast.error(res.error);
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : <SendHorizontal />} Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
