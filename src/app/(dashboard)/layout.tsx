import { Brand } from "@/components/app/brand";
import { MobileNav, SidebarNav } from "@/components/app/nav";
import { requireUser } from "@/lib/auth";
import { unreadTotal } from "@/lib/services/chats";
import { getBusinessProfile } from "@/lib/settings";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  await requireUser();
  const [profile, unread] = await Promise.all([getBusinessProfile(), unreadTotal().catch(() => ({ chats: 0, messages: 0 }))]);

  return (
    <div className="flex min-h-svh">
      <SidebarNav
        unread={unread.chats}
        business={<Brand name={profile.businessName} logoUrl={profile.logoUrl} subtitle="WhatsApp Business" dark />}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav
          unread={unread.chats}
          brand={<Brand name={profile.businessName} logoUrl={profile.logoUrl} />}
          business={<Brand name={profile.businessName} logoUrl={profile.logoUrl} subtitle="WhatsApp Business" dark />}
        />
        <main className="mx-auto w-full max-w-[84rem] flex-1 px-4 py-6 sm:px-6 md:py-9 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
