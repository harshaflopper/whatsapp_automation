"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { deleteContactsAction, saveContactAction } from "./actions";

export type EditableContact = {
  id: string;
  name: string;
  phone: string;
  city: string | null;
  email: string | null;
  notes: string | null;
  tags: string[];
  groupIds: string[];
  subscribed: boolean;
  unsubscribedByCustomer: boolean;
};

export type GroupOption = { id: string; name: string };

export function ContactDialog({
  open,
  onOpenChange,
  contact,
  groups,
  defaultGroupId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: EditableContact | null;
  groups: GroupOption[];
  defaultGroupId?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto p-0 sm:max-w-lg">
        {open && (
          <ContactForm
            key={contact?.id ?? "new"}
            contact={contact}
            groups={groups}
            defaultGroupId={defaultGroupId}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ContactForm({
  contact,
  groups,
  defaultGroupId,
  onDone,
}: {
  contact: EditableContact | null;
  groups: GroupOption[];
  defaultGroupId?: string;
  onDone: () => void;
}) {
  const [name, setName] = useState(contact?.name ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "+91 ");
  const [city, setCity] = useState(contact?.city ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [notes, setNotes] = useState(contact?.notes ?? "");
  const [tags, setTags] = useState<string[]>(contact?.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const [groupIds, setGroupIds] = useState<string[]>(contact?.groupIds ?? (defaultGroupId ? [defaultGroupId] : []));
  const [subscribed, setSubscribed] = useState(contact ? contact.subscribed : true);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function addTag() {
    const t = tagDraft.trim();
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) setTags([...tags, t]);
    setTagDraft("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const finalTags = tagDraft.trim() ? [...tags, tagDraft.trim()] : tags;
    start(async () => {
      const res = await saveContactAction(contact?.id ?? null, { name, phone, city, email, notes, tags: finalTags, groupIds, subscribed });
      if (res.ok) {
        toast.success(contact ? "Contact updated" : "Contact added");
        onDone();
      } else setError({ field: res.field, message: res.error });
    });
  }

  function remove() {
    if (!contact) return;
    start(async () => {
      await deleteContactsAction([contact.id]);
      toast.success("Contact deleted");
      onDone();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-0">
      <DialogHeader className="border-b px-6 pt-6 pb-4">
        <DialogTitle className="text-lg font-semibold">{contact ? "Edit contact" : "Add contact"}</DialogTitle>
        <DialogDescription>{contact ? "Update this customer's details." : "Save a customer so you can message them on WhatsApp."}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 px-6 py-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="c-name" error={error?.field === "name" ? error.message : undefined}>
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Sharma" autoFocus required />
          </Field>
          <Field label="WhatsApp number" htmlFor="c-phone" error={error?.field === "phone" ? error.message : undefined}>
            <Input id="c-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+91 98765 43210" required />
          </Field>
          <Field label="City" htmlFor="c-city">
            <Input id="c-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Bengaluru" />
          </Field>
          <Field label="Email" htmlFor="c-email">
            <Input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" />
          </Field>
        </div>

        {groups.length > 0 && (
          <div className="grid gap-2">
            <span className="text-sm font-medium">Groups</span>
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => {
                const on = groupIds.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setGroupIds(on ? groupIds.filter((x) => x !== g.id) : [...groupIds, g.id])}
                    className={cn(
                      "h-8 cursor-pointer rounded-full border px-3 text-[0.82rem] font-medium transition-colors",
                      on ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {g.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid gap-2">
          <label htmlFor="c-tag" className="text-sm font-medium">
            Tags
          </label>
          <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border border-input bg-card px-2 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
            {tags.map((t) => (
              <span key={t} className="inline-flex h-7 items-center gap-1 rounded-lg bg-muted pr-1 pl-2.5 text-[0.8rem] font-medium">
                {t}
                <button type="button" aria-label={`Remove ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))} className="grid size-5 cursor-pointer place-items-center rounded-md hover:bg-background">
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <input
              id="c-tag"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag();
                } else if (e.key === "Backspace" && !tagDraft && tags.length) setTags(tags.slice(0, -1));
              }}
              onBlur={addTag}
              placeholder={tags.length ? "" : "VIP, Wholesale… press Enter to add"}
              className="h-7 min-w-[8rem] flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <Field label="Notes" htmlFor="c-notes">
          <Textarea id="c-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Anything worth remembering" />
        </Field>

        <label className={cn("flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-colors", subscribed ? "border-primary/40 bg-accent/60" : "border-border")}>
          <input
            type="checkbox"
            checked={subscribed}
            onChange={(e) => setSubscribed(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[oklch(0.52_0.215_277)]"
          />
          <span>
            <span className="block text-sm font-semibold">This customer agreed to receive WhatsApp messages</span>
            <span className="mt-0.5 block text-[0.8rem] text-muted-foreground">
              {contact?.unsubscribedByCustomer && !subscribed
                ? "This customer unsubscribed themselves. Only tick this if they asked to hear from you again."
                : "Only subscribed contacts receive campaigns. Customers can reply STOP at any time."}
            </span>
          </span>
        </label>

        {error && !error.field && <p className="text-sm font-medium text-destructive">{error.message}</p>}
      </div>

      <DialogFooter className="mx-0 mb-0 items-center px-6 py-4 sm:justify-between">
        {contact ? (
          confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Delete for good?</span>
              <Button type="button" variant="destructive" size="sm" onClick={remove} disabled={pending}>
                Delete
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Keep
              </Button>
            </div>
          ) : (
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 /> Delete
            </Button>
          )
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {contact ? "Save changes" : "Add contact"}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}
