import type { Metadata } from "next";
import { KeyRound, LifeBuoy, Mail, Phone, Store } from "lucide-react";
import { IconChip, Section } from "@/components/app/kit";
import { PageHeader } from "@/components/app/page-header";
import { requireUser } from "@/lib/auth";
import { getBusinessProfile } from "@/lib/settings";
import { PasswordForm, ProfileForm } from "./account-forms";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const [session, profile] = await Promise.all([requireUser(), getBusinessProfile()]);
  const supportPhone = process.env.SUPPORT_PHONE?.trim() ?? "";
  const supportEmail = process.env.SUPPORT_EMAIL?.trim() ?? "";
  const waLink = supportPhone ? `https://wa.me/${supportPhone.replace(/\D/g, "")}` : null;

  return (
    <>
      <PageHeader title="Account" description="Your business details and login." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid content-start gap-6">
          <Section title={<span className="flex items-center gap-3"><IconChip icon={Store} className="size-9" /> Business details</span>}>
            <ProfileForm
              initial={{ businessName: profile.businessName, logoUrl: profile.logoUrl ?? "", address: profile.address, testPhone: profile.testPhone }}
            />
          </Section>
          <Section
            title={<span className="flex items-center gap-3"><IconChip icon={KeyRound} tone="violet" className="size-9" /> Login</span>}
            description={`You sign in as ${session.email}.`}
          >
            <PasswordForm />
          </Section>
        </div>
        <div className="grid content-start gap-6">
          <Section title={<span className="flex items-center gap-3"><IconChip icon={LifeBuoy} tone="sky" className="size-9" /> Help</span>}>
            <p className="text-sm text-muted-foreground">Questions, a new number, or something not working? Our team is here to help.</p>
            <div className="mt-4 grid gap-2">
              {waLink && (
                <a href={waLink} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border p-3.5 transition-colors hover:bg-muted/60">
                  <Phone className="size-4 text-primary" />
                  <span className="text-sm">
                    <span className="block font-semibold">WhatsApp us</span>
                    <span className="text-muted-foreground">{supportPhone}</span>
                  </span>
                </a>
              )}
              {supportEmail && (
                <a href={`mailto:${supportEmail}`} className="flex items-center gap-3 rounded-xl border p-3.5 transition-colors hover:bg-muted/60">
                  <Mail className="size-4 text-primary" />
                  <span className="text-sm">
                    <span className="block font-semibold">Email</span>
                    <span className="text-muted-foreground">{supportEmail}</span>
                  </span>
                </a>
              )}
              {!waLink && !supportEmail && <p className="text-sm text-muted-foreground">Contact the team that set up your account.</p>}
            </div>
          </Section>
          <Section title="Good to know">
            <ul className="grid gap-3 text-sm text-muted-foreground">
              <li>Only message customers who agreed to hear from you. Customers can reply STOP at any time and are unsubscribed automatically.</li>
              <li>You can reply to a customer for free for 24 hours after their last message. After that, send a message design.</li>
              <li>New message designs are checked by WhatsApp, usually within a few minutes.</li>
            </ul>
          </Section>
        </div>
      </div>
    </>
  );
}
