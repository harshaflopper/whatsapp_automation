"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, CircleCheck, Download, FileSpreadsheet, Loader2, TriangleAlert, Upload } from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";
import { NativeSelect } from "@/components/app/kit";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ImportRow, ImportSummary } from "@/lib/services/contacts";
import { importContactsAction } from "../actions";

type FieldKey = keyof ImportRow;
const FIELDS: { key: FieldKey; label: string; required?: boolean; guesses: RegExp }[] = [
  { key: "name", label: "Name", required: true, guesses: /^(full\s*)?name|customer|contact\s*name|naam/i },
  { key: "phone", label: "WhatsApp number", required: true, guesses: /phone|mobile|whats\s*app|number|contact\s*no|cell|ph\.?/i },
  { key: "city", label: "City", guesses: /city|town|area|location|place/i },
  { key: "email", label: "Email", guesses: /e-?mail/i },
  { key: "notes", label: "Notes", guesses: /note|remark|comment/i },
  { key: "tags", label: "Tags", guesses: /tag|label|category/i },
];

type Sheet = { fileName: string; header: string[]; rows: string[][] };

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  return String(v).trim();
}

function guessMapping(header: string[]): Record<FieldKey, number> {
  const map = {} as Record<FieldKey, number>;
  const used = new Set<number>();
  for (const f of FIELDS) {
    const idx = header.findIndex((h, i) => !used.has(i) && f.guesses.test(h));
    map[f.key] = idx;
    if (idx >= 0) used.add(idx);
  }
  return map;
}

const STEPS = ["Upload file", "Match columns", "Confirm"];

export function ImportWizard({ groups }: { groups: { id: string; name: string }[] }) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [step, setStep] = useState(0);
  const [mapping, setMapping] = useState<Record<FieldKey, number>>({} as Record<FieldKey, number>);
  const [groupChoice, setGroupChoice] = useState<string>("");
  const [newGroup, setNewGroup] = useState("");
  const [consent, setConsent] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function readFile(file: File) {
    setParsing(true);
    try {
      let table: string[][];
      if (/\.(xlsx|xlsm)$/i.test(file.name)) {
        const { default: readXlsxFile } = await import("read-excel-file");
        const rows = await readXlsxFile(file);
        table = rows.map((r) => r.map(cellText));
      } else if (/\.(csv|txt)$/i.test(file.name)) {
        const text = await file.text();
        const parsed = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
        table = parsed.data.map((r) => r.map(cellText));
      } else {
        toast.error("Use an Excel (.xlsx) or CSV file.", { description: "Old .xls files: open in Excel and Save As .xlsx first." });
        return;
      }
      table = table.filter((r) => r.some((c) => c));
      if (table.length < 2) {
        toast.error("That file looks empty.", { description: "Keep column names in the first row and one customer per row." });
        return;
      }
      const [header, ...rows] = table;
      const width = Math.max(header.length, ...rows.map((r) => r.length));
      const fullHeader = Array.from({ length: width }, (_, i) => header[i] || `Column ${i + 1}`);
      setSheet({ fileName: file.name, header: fullHeader, rows });
      setMapping(guessMapping(fullHeader));
      setStep(1);
    } catch {
      toast.error("Couldn't read this file.", { description: "Try saving it again as .xlsx or .csv." });
    } finally {
      setParsing(false);
    }
  }

  const mapped: ImportRow[] = useMemo(() => {
    if (!sheet) return [];
    return sheet.rows.map((r) => {
      const o: ImportRow = {};
      for (const f of FIELDS) {
        const idx = mapping[f.key];
        if (idx !== undefined && idx >= 0) o[f.key] = r[idx] ?? "";
      }
      return o;
    });
  }, [sheet, mapping]);

  const canContinue = mapping.phone >= 0 && mapping.name >= 0;

  function downloadSample() {
    const csv = "Name,WhatsApp number,City,Tags\nPriya Sharma,9876543210,Bengaluru,VIP\nRavi Kumar,+91 99001 12345,Mysuru,\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function runImport() {
    start(async () => {
      const res = await importContactsAction(mapped, {
        groupId: groupChoice && groupChoice !== "__new" ? groupChoice : undefined,
        newGroupName: groupChoice === "__new" ? newGroup : undefined,
        subscribed: consent,
        updateExisting,
      });
      if (res.ok) {
        setResult(res.summary);
        setStep(3);
      } else toast.error(res.error);
    });
  }

  if (step === 3 && result) {
    return (
      <div className="surface mx-auto max-w-2xl p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
            <CircleCheck className="size-6" />
          </span>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Import finished</h2>
            <p className="text-sm text-muted-foreground">{sheet?.fileName}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Added", value: result.added },
            { label: "Updated", value: result.updated },
            { label: "Skipped duplicates", value: result.duplicates },
            { label: "Invalid numbers", value: result.invalid.length },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-muted/70 p-4">
              <div className="text-2xl font-bold tabular-nums">{s.value.toLocaleString("en-IN")}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
        {result.invalid.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold">Rows we couldn’t add</h3>
            <div className="scrollbar-thin mt-2 max-h-56 overflow-y-auto rounded-xl border">
              <table className="w-full text-sm">
                <tbody>
                  {result.invalid.slice(0, 200).map((r) => (
                    <tr key={r.row} className="border-b last:border-0">
                      <td className="w-20 px-3 py-2 text-muted-foreground">Row {r.row}</td>
                      <td className="px-3 py-2 font-medium">{r.value || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="mt-8 flex flex-wrap gap-2">
          <Link href="/contacts" className={buttonVariants()}>
            View contacts <ArrowRight />
          </Link>
          <Button
            variant="outline"
            onClick={() => {
              setSheet(null);
              setResult(null);
              setConsent(false);
              setStep(0);
            }}
          >
            Import another file
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <ol className="flex flex-wrap items-center gap-2 text-sm">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className={cn(
                "grid size-7 place-items-center rounded-full text-xs font-bold",
                i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-accent text-accent-foreground ring-2 ring-primary/40" : "bg-muted text-muted-foreground",
              )}
            >
              {i + 1}
            </span>
            <span className={cn("font-medium", i === step ? "text-foreground" : "text-muted-foreground")}>{s}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-8 bg-border" />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="surface p-6 sm:p-8">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void readFile(f);
            }}
            className={cn(
              "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors",
              dragging ? "border-primary bg-accent/60" : "border-border bg-muted/30",
            )}
          >
            <span className="grid size-14 place-items-center rounded-2xl bg-card text-primary shadow-soft">
              {parsing ? <Loader2 className="size-6 animate-spin" /> : <FileSpreadsheet className="size-6" />}
            </span>
            <h2 className="mt-4 text-lg font-semibold">Drop your Excel or CSV file here</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              One customer per row, with column names in the first row. Numbers without +91 are treated as Indian numbers.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xlsm,.csv,.txt"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void readFile(f);
                e.target.value = "";
              }}
            />
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button onClick={() => inputRef.current?.click()} disabled={parsing}>
                <Upload /> Choose file
              </Button>
              <Button variant="outline" onClick={downloadSample}>
                <Download /> Sample file
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 1 && sheet && (
        <div className="surface p-6 sm:p-8">
          <h2 className="text-lg font-semibold">Match your columns</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            We found {sheet.rows.length.toLocaleString("en-IN")} rows in {sheet.fileName}. Tell us which column holds what.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.map((f) => (
              <div key={f.key} className="grid gap-1.5">
                <label htmlFor={`map-${f.key}`} className="text-sm font-medium">
                  {f.label} {f.required && <span className="text-destructive">*</span>}
                </label>
                <NativeSelect
                  id={`map-${f.key}`}
                  value={String(mapping[f.key] ?? -1)}
                  onChange={(e) => setMapping({ ...mapping, [f.key]: Number(e.target.value) })}
                >
                  <option value="-1">{f.required ? "Choose a column" : "Don't import"}</option>
                  {sheet.header.map((h, i) => (
                    <option key={i} value={i}>
                      {h}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-semibold">Preview</h3>
            <div className="scrollbar-thin mt-2 overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                    {FIELDS.filter((f) => mapping[f.key] >= 0).map((f) => (
                      <th key={f.key} className="px-3 py-2 font-semibold">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mapped.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      {FIELDS.filter((f) => mapping[f.key] >= 0).map((f) => (
                        <td key={f.key} className="max-w-[14rem] truncate px-3 py-2">
                          {r[f.key] || <span className="text-muted-foreground">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8 flex justify-between gap-2">
            <Button variant="outline" onClick={() => setStep(0)}>
              <ArrowLeft /> Back
            </Button>
            <Button onClick={() => setStep(2)} disabled={!canContinue}>
              Continue <ArrowRight />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && sheet && (
        <div className="surface p-6 sm:p-8">
          <h2 className="text-lg font-semibold">Almost done</h2>
          <div className="mt-6 grid gap-6">
            <div className="grid gap-2 sm:max-w-md">
              <label htmlFor="imp-group" className="text-sm font-medium">
                Add these contacts to a group <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <NativeSelect id="imp-group" value={groupChoice} onChange={(e) => setGroupChoice(e.target.value)}>
                <option value="">No group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
                <option value="__new">+ Create a new group</option>
              </NativeSelect>
              {groupChoice === "__new" && <Input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="New group name" aria-label="New group name" autoFocus />}
            </div>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={updateExisting}
                onChange={(e) => setUpdateExisting(e.target.checked)}
                className="mt-0.5 size-4 cursor-pointer accent-primary"
              />
              <span className="text-sm">
                <span className="font-medium">Update customers I already have</span>
                <span className="block text-muted-foreground">Fills in missing names and cities. Nobody is added twice.</span>
              </span>
            </label>

            <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-4", consent ? "border-primary/40 bg-accent/60" : "border-[oklch(0.87_0.09_75)] bg-[oklch(0.98_0.025_80)]")}>
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 size-4 cursor-pointer accent-primary"
              />
              <span className="text-sm">
                <span className="font-semibold">These customers agreed to receive WhatsApp messages from my business</span>
                <span className="mt-0.5 block text-muted-foreground">
                  Only subscribed customers receive campaigns. Messaging people who didn’t agree leads to blocks and can stop your account from sending.
                </span>
              </span>
            </label>
            {!consent && (
              <p className="flex items-center gap-2 text-[0.82rem] text-muted-foreground">
                <TriangleAlert className="size-4 text-[oklch(0.72_0.15_70)]" />
                Without this, contacts are saved as “Not subscribed” and won’t receive campaigns until you mark them.
              </p>
            )}
          </div>

          <div className="mt-8 flex justify-between gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft /> Back
            </Button>
            <Button onClick={runImport} disabled={pending || (groupChoice === "__new" && !newGroup.trim())}>
              {pending && <Loader2 className="animate-spin" />}
              Import {sheet.rows.length.toLocaleString("en-IN")} rows
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
