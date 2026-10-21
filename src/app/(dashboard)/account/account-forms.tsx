"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Brand } from "@/components/app/brand";
import { Field } from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { changePasswordAction, saveProfileAction } from "./actions";

export function ProfileForm({ initial }: { initial: { businessName: string; logoUrl: string; address: string; testPhone: string } }) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  const err = (f: string) => (error?.field === f ? error.message : undefined);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await saveProfileAction(v);
          if (res.ok) toast.success("Business details saved");
          else setError({ field: res.field, message: res.error });
        });
      }}
      className="grid gap-5"
    >
      <div className="flex items-center gap-4 rounded-xl bg-muted/50 p-4">
        <Brand name={v.businessName || "Your business"} logoUrl={v.logoUrl || null} size="lg" subtitle="How your dashboard looks" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name" htmlFor="a-name" error={err("businessName")}>
          <Input id="a-name" value={v.businessName} onChange={set("businessName")} maxLength={80} />
        </Field>
        <Field label="Logo link" htmlFor="a-logo" error={err("logoUrl")} hint="A link to your logo image (square works best).">
          <Input id="a-logo" value={v.logoUrl} onChange={set("logoUrl")} placeholder="https://…/logo.png" inputMode="url" />
        </Field>
      </div>
      <Field label="Address" htmlFor="a-address">
        <Textarea id="a-address" value={v.address} onChange={set("address")} rows={2} placeholder="Shop address, for your records" />
      </Field>
      <Field label="Your WhatsApp number" htmlFor="a-test" error={err("testPhone")} hint={'Used for "Send a test to my phone" when you create a campaign.'} className="sm:max-w-sm">
        <Input id="a-test" value={v.testPhone} onChange={set("testPhone")} inputMode="tel" placeholder="+91 98765 43210" />
      </Field>
      {error && !error.field && <p className="text-sm font-medium text-destructive">{error.message}</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Save changes
        </Button>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [v, setV] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [pending, start] = useTransition();
  const err = (f: string) => (error?.field === f ? error.message : undefined);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await changePasswordAction(v);
          if (res.ok) {
            toast.success("Password changed");
            setV({ current: "", next: "", confirm: "" });
          } else setError({ field: res.field, message: res.error });
        });
      }}
      className="grid gap-4 sm:max-w-md"
    >
      <Field label="Current password" htmlFor="p-cur" error={err("current")}>
        <Input id="p-cur" type="password" autoComplete="current-password" value={v.current} onChange={(e) => setV({ ...v, current: e.target.value })} required />
      </Field>
      <Field label="New password" htmlFor="p-new" error={err("next")} hint="At least 8 characters.">
        <Input id="p-new" type="password" autoComplete="new-password" value={v.next} onChange={(e) => setV({ ...v, next: e.target.value })} required />
      </Field>
      <Field label="Type it again" htmlFor="p-conf" error={err("confirm")}>
        <Input id="p-conf" type="password" autoComplete="new-password" value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} required />
      </Field>
      <div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Change password
        </Button>
      </div>
    </form>
  );
}
