"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  House,
  LogOut,
  Menu,
  MessagesSquare,
  PenLine,
  Plus,
  Settings2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { logout } from "@/app/login/actions";

type NavItem = { href: string; label: string; icon: LucideIcon; badge?: "unread" };

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/designs", label: "Message designs", icon: PenLine },
  { href: "/campaigns", label: "Campaigns", icon: BarChart3 },
  { href: "/chats", label: "Chats", icon: MessagesSquare, badge: "unread" },
  { href: "/account", label: "Account", icon: Settings2 },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/campaigns") return pathname === "/campaigns" || (pathname.startsWith("/campaigns/") && pathname !== "/campaigns/new");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ unread, onNavigate }: { unread: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="grid gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon, badge }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex h-11 items-center gap-3 rounded-xl px-3 text-[0.92rem] font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-white",
            )}
          >
            {active && <span className="absolute top-2.5 bottom-2.5 left-0 w-[3px] rounded-r-full bg-sidebar-primary" />}
            <Icon className={cn("size-[1.15rem]", active ? "text-white" : "text-sidebar-foreground/70 group-hover:text-white")} strokeWidth={2} />
            {label}
            {badge === "unread" && unread > 0 && (
              <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-[oklch(0.75_0.15_70)] px-1.5 text-[0.7rem] font-bold text-[oklch(0.25_0.05_60)]">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function NewCampaignButton({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <Link
      href="/campaigns/new"
      onClick={onNavigate}
      className={cn(
        "flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[oklch(0.6_0.2_277)] to-[oklch(0.52_0.23_292)] text-[0.92rem] font-semibold text-white shadow-[0_8px_24px_-10px_oklch(0.6_0.22_285/0.9)] transition hover:brightness-110",
        pathname === "/campaigns/new" && "ring-2 ring-white/30",
      )}
    >
      <Plus className="size-4" strokeWidth={2.4} />
      New campaign
    </Link>
  );
}

function Footer({ business }: { business: React.ReactNode }) {
  return (
    <div className="grid gap-2 border-t border-sidebar-border pt-4">
      <div className="px-1">{business}</div>
      <form action={logout}>
        <button
          type="submit"
          className="flex h-10 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-white"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </form>
    </div>
  );
}

export function SidebarNav({ business, unread }: { business: React.ReactNode; unread: number }) {
  return (
    <aside className="sticky top-0 hidden h-svh w-[17rem] shrink-0 flex-col gap-6 overflow-y-auto bg-sidebar p-4 text-sidebar-foreground lg:flex">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(70%_100%_at_20%_0%,oklch(0.55_0.2_277/0.35),transparent)]" />
      <div className="relative grid gap-5 pt-2">
        <NewCampaignButton />
        <NavLinks unread={unread} />
      </div>
      <div className="relative mt-auto">
        <Footer business={business} />
      </div>
    </aside>
  );
}

export function MobileNav({ business, brand, unread }: { business: React.ReactNode; brand: React.ReactNode; unread: number }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-xl lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="outline" size="icon" aria-label="Open menu" className="relative" />}>
          <Menu />
          {unread > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-[oklch(0.75_0.15_70)]" />}
        </SheetTrigger>
        <SheetContent side="left" className="w-[18rem] gap-6 border-none bg-sidebar p-4 text-sidebar-foreground">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="grid gap-5 pt-10">
            <NewCampaignButton onNavigate={() => setOpen(false)} />
            <NavLinks unread={unread} onNavigate={() => setOpen(false)} />
          </div>
          <div className="mt-auto">
            <Footer business={business} />
          </div>
        </SheetContent>
      </Sheet>
      <div className="min-w-0">{brand}</div>
    </header>
  );
}
