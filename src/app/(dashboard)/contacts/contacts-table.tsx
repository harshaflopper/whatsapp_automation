"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FolderInput,
  Loader2,
  Search,
  Send,
  Tag,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, EmptyState, NativeSelect } from "@/components/app/kit";
import { ContactStatusPill } from "@/components/app/status";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ContactStatus } from "@/lib/services/contacts";
import { cn } from "@/lib/utils";
import { bulkAction, deleteContactsAction, type BulkAction } from "./actions";
import { ContactDialog, type EditableContact, type GroupOption } from "./contact-dialog";

const EMPTY = new Set<string>();

export type ContactRow = EditableContact & {
  phoneDisplay: string;
  status: ContactStatus;
  groupNames: string[];
  lastActivity: string;
};

export function ContactsTable({
  rows,
  total,
  page,
  pages,
  groups,
  tags,
  cities,
  exportHref,
  emptyBook,
}: {
  rows: ContactRow[];
  total: number;
  page: number;
  pages: number;
  groups: GroupOption[];
  tags: string[];
  cities: string[];
  exportHref: string;
  emptyBook: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  // Selection resets whenever the list changes (new page, filter or refresh).
  const [selection, setSelection] = useState<{ rows: ContactRow[]; ids: Set<string> }>({ rows, ids: new Set() });
  const selected = selection.rows === rows ? selection.ids : EMPTY;
  const setSelected = (ids: Set<string>) => setSelection({ rows, ids });
  const [dialog, setDialog] = useState<{ open: boolean; contact: EditableContact | null }>({ open: params.get("add") === "1", contact: null });
  const [pending, start] = useTransition();

  // Debounced search into the URL, so results are shareable and survive refresh.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if ((params.get("q") ?? "") === q) return;
      const next = new URLSearchParams(params);
      if (q) next.set("q", q);
      else next.delete("q");
      next.delete("page");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }, 300);
    return () => window.clearTimeout(t);
  }, [q, params, pathname, router]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function pageHref(p: number) {
    const next = new URLSearchParams(params);
    next.set("page", String(p));
    return `${pathname}?${next.toString()}`;
  }

  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const ids = useMemo(() => [...selected], [selected]);
  const activeGroup = params.get("group") ?? "";

  function run(action: BulkAction) {
    start(async () => {
      const res = await bulkAction(ids, action);
      toast.success(res.message);
      setSelected(new Set());
    });
  }

  const filtersOn = !!(params.get("q") || params.get("tag") || params.get("city"));

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, number or city" className="pl-9" aria-label="Search contacts" />
        </div>
        {tags.length > 0 && (
          <NativeSelect aria-label="Filter by tag" value={params.get("tag") ?? ""} onChange={(e) => setParam("tag", e.target.value)} className="w-40">
            <option value="">All tags</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </NativeSelect>
        )}
        {cities.length > 0 && (
          <NativeSelect aria-label="Filter by city" value={params.get("city") ?? ""} onChange={(e) => setParam("city", e.target.value)} className="w-40">
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <a href={exportHref} className={buttonVariants({ variant: "outline" })}>
            <Download /> Export
          </a>
          <Link href="/contacts/import" className={buttonVariants({ variant: "outline" })}>
            <Upload /> Import
          </Link>
          <Button onClick={() => setDialog({ open: true, contact: null })}>
            <UserPlus /> Add contact
          </Button>
        </div>
      </div>

      <div className="surface overflow-hidden">
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-accent/70 px-4 py-2.5">
            <span className="mr-1 text-sm font-semibold text-accent-foreground">{selected.size} selected</span>
            <Link
              href={`/campaigns/new?contacts=${ids.join(",")}`}
              className={buttonVariants({ size: "sm" })}
            >
              <Send /> Send campaign
            </Link>
            {groups.length > 0 && (
              <Popover>
                <PopoverTrigger render={<Button variant="outline" size="sm" disabled={pending} />}>
                  <FolderInput /> Add to group
                </PopoverTrigger>
                <PopoverContent align="start" className="w-56 gap-0 p-1">
                  {groups.map((g) => (
                    <button key={g.id} type="button" onClick={() => run({ type: "addToGroup", groupId: g.id })} className="flex h-9 w-full cursor-pointer items-center rounded-lg px-2.5 text-left text-sm hover:bg-muted">
                      {g.name}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            )}
            {activeGroup && (
              <Button variant="outline" size="sm" disabled={pending} onClick={() => run({ type: "removeFromGroup", groupId: activeGroup })}>
                <X /> Remove from this group
              </Button>
            )}
            <TagPopover disabled={pending} onTag={(tag) => run({ type: "addTag", tag })} />
            <Popover>
              <PopoverTrigger render={<Button variant="outline" size="sm" disabled={pending} />}>More</PopoverTrigger>
              <PopoverContent align="start" className="w-56 gap-0 p-1">
                <button type="button" onClick={() => run({ type: "subscribe" })} className="flex h-9 w-full cursor-pointer items-center rounded-lg px-2.5 text-left text-sm hover:bg-muted">
                  Mark as subscribed
                </button>
                <button type="button" onClick={() => run({ type: "unsubscribe" })} className="flex h-9 w-full cursor-pointer items-center rounded-lg px-2.5 text-left text-sm hover:bg-muted">
                  Unsubscribe
                </button>
                <button
                  type="button"
                  onClick={() =>
                    start(async () => {
                      const n = await deleteContactsAction(ids);
                      toast.success(`Deleted ${n} ${n === 1 ? "contact" : "contacts"}`);
                    })
                  }
                  className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left text-sm text-destructive hover:bg-muted"
                >
                  <Trash2 className="size-4" /> Delete
                </button>
              </PopoverContent>
            </Popover>
            {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            <button type="button" onClick={() => setSelected(new Set())} className="ml-auto cursor-pointer text-sm font-medium text-accent-foreground hover:underline">
              Clear
            </button>
          </div>
        )}

        {rows.length === 0 ? (
          emptyBook ? (
            <EmptyState
              icon={Users}
              title="Add your customers"
              description="Import a list from Excel or add customers one by one. Only customers who agreed to hear from you should be added."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Link href="/contacts/import" className={buttonVariants({ variant: "outline" })}>
                    <Upload /> Import from Excel
                  </Link>
                  <Button onClick={() => setDialog({ open: true, contact: null })}>
                    <UserPlus /> Add contact
                  </Button>
                </div>
              }
            />
          ) : (
            <EmptyState
              icon={Search}
              title="No contacts match"
              description={filtersOn ? "Try a different search or clear the filters." : "No one in this list yet."}
              action={
                filtersOn ? (
                  <Link href={pathname} className={buttonVariants({ variant: "outline" })}>
                    Clear filters
                  </Link>
                ) : undefined
              }
            />
          )
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-semibold text-muted-foreground">
                  <th className="w-12 py-3 pl-4">
                    <input
                      type="checkbox"
                      aria-label="Select all on this page"
                      checked={allOnPage}
                      onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
                      className="size-4 cursor-pointer accent-primary"
                    />
                  </th>
                  <th className="py-3 pr-4 font-semibold">Name</th>
                  <th className="py-3 pr-4 font-semibold">WhatsApp</th>
                  <th className="py-3 pr-4 font-semibold">City</th>
                  <th className="py-3 pr-4 font-semibold">Groups & tags</th>
                  <th className="py-3 pr-4 font-semibold">Status</th>
                  <th className="py-3 pr-4 font-semibold">Last message</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const on = selected.has(r.id);
                  return (
                    <tr key={r.id} className={cn("border-b border-border/60 transition-colors last:border-0", on ? "bg-accent/50" : "hover:bg-muted/50")}>
                      <td className="py-3 pl-4">
                        <input
                          type="checkbox"
                          aria-label={`Select ${r.name}`}
                          checked={on}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(r.id);
                            else next.delete(r.id);
                            setSelected(next);
                          }}
                          className="size-4 cursor-pointer accent-primary"
                        />
                      </td>
                      <td className="py-2.5 pr-4">
                        <button type="button" onClick={() => setDialog({ open: true, contact: r })} className="flex cursor-pointer items-center gap-3 text-left">
                          <Avatar name={r.name} size="sm" />
                          <span className="min-w-0">
                            <span className="block max-w-[14rem] truncate font-semibold hover:text-primary">{r.name}</span>
                            {r.notes && <span className="block max-w-[14rem] truncate text-xs text-muted-foreground">{r.notes}</span>}
                          </span>
                        </button>
                      </td>
                      <td className="py-2.5 pr-4 whitespace-nowrap text-muted-foreground tabular-nums">{r.phoneDisplay}</td>
                      <td className="py-2.5 pr-4 whitespace-nowrap">{r.city || <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-2.5 pr-4">
                        <div className="flex max-w-[16rem] flex-wrap gap-1">
                          {r.groupNames.map((g) => (
                            <span key={g} className="rounded-md bg-accent px-2 py-0.5 text-[0.74rem] font-medium text-accent-foreground">
                              {g}
                            </span>
                          ))}
                          {r.tags.map((t) => (
                            <span key={t} className="rounded-md bg-muted px-2 py-0.5 text-[0.74rem] font-medium text-muted-foreground">
                              #{t}
                            </span>
                          ))}
                          {!r.groupNames.length && !r.tags.length && <span className="text-muted-foreground">—</span>}
                        </div>
                      </td>
                      <td className="py-2.5 pr-4">
                        <ContactStatusPill status={r.status} />
                      </td>
                      <td className="py-2.5 pr-4 whitespace-nowrap text-muted-foreground">{r.lastActivity}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
            <span>
              Page {page} of {pages} · {total.toLocaleString("en-IN")} contacts
            </span>
            <div className="flex gap-2">
              <Link aria-disabled={page <= 1} href={pageHref(Math.max(1, page - 1))} className={cn(buttonVariants({ variant: "outline", size: "sm" }), page <= 1 && "pointer-events-none opacity-50")}>
                <ChevronLeft /> Previous
              </Link>
              <Link aria-disabled={page >= pages} href={pageHref(Math.min(pages, page + 1))} className={cn(buttonVariants({ variant: "outline", size: "sm" }), page >= pages && "pointer-events-none opacity-50")}>
                Next <ChevronRight />
              </Link>
            </div>
          </div>
        )}
      </div>

      <ContactDialog
        open={dialog.open}
        onOpenChange={(open) => {
          setDialog({ open, contact: open ? dialog.contact : null });
          if (!open && params.get("add")) setParam("add", "");
        }}
        contact={dialog.contact}
        groups={groups}
        defaultGroupId={activeGroup || undefined}
      />
    </div>
  );
}

function TagPopover({ onTag, disabled }: { onTag: (tag: string) => void; disabled?: boolean }) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" size="sm" disabled={disabled} />}>
        <Tag /> Add tag
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!value.trim()) return;
            onTag(value.trim());
            setValue("");
            setOpen(false);
          }}
          className="grid gap-2"
        >
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. Wholesale" autoFocus aria-label="Tag" />
          <Button type="submit" size="sm" disabled={!value.trim()}>
            Add tag
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
