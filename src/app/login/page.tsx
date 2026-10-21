import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BarChart3, MessagesSquare, Send } from "lucide-react";
import { Brand } from "@/components/app/brand";
import { getSession } from "@/lib/auth";
import { getBusinessProfile } from "@/lib/settings";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const POINTS = [
  { icon: Send, title: "Reach every customer", text: "Send offers and reminders to hundreds of customers in one go." },
  { icon: BarChart3, title: "See what works", text: "Know who received, read and replied to every campaign." },
  { icon: MessagesSquare, title: "Reply in one place", text: "Answer customer replies right from your dashboard." },
];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getSession()) redirect("/");
  const { next } = await searchParams;
  const profile = await getBusinessProfile();

  return (
    <main className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -top-40 -left-40 size-[36rem] rounded-full bg-[oklch(0.55_0.22_277/0.45)] blur-3xl" />
        <div className="pointer-events-none absolute -right-32 bottom-0 size-[28rem] rounded-full bg-[oklch(0.6_0.14_236/0.22)] blur-3xl" />
        <div className="relative">
          <Brand name={profile.businessName} logoUrl={profile.logoUrl} subtitle="WhatsApp Business" dark size="lg" />
        </div>
        <div className="relative my-auto max-w-md">
          <h2 className="text-4xl leading-[1.1] font-bold tracking-tight text-white">Your customers are on WhatsApp. Now your business is too.</h2>
          <ul className="mt-10 grid gap-6">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10 text-white ring-1 ring-white/15 ring-inset">
                  <Icon className="size-5" />
                </span>
                <span>
                  <span className="block font-semibold text-white">{title}</span>
                  <span className="mt-0.5 block text-sm text-sidebar-foreground/80">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Brand name={profile.businessName} logoUrl={profile.logoUrl} size="lg" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-muted-foreground">Sign in to manage your WhatsApp campaigns.</p>
          <div className="mt-8">
            <LoginForm next={typeof next === "string" ? next : undefined} />
          </div>
          {(profile.supportPhone || profile.supportEmail) && (
            <p className="mt-8 text-sm text-muted-foreground">
              Trouble signing in? Contact support{profile.supportPhone ? ` on ${profile.supportPhone}` : ""}
              {profile.supportEmail ? `${profile.supportPhone ? " or" : ""} at ${profile.supportEmail}` : ""}.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
