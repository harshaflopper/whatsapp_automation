import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/sonner";
import { getBusinessProfile } from "@/lib/settings";
import "./globals.css";

// Self-hosted (bundled from npm), so builds never depend on reaching Google Fonts.
const sans = localFont({
  variable: "--font-sans",
  display: "swap",
  src: [
    { path: "../../node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2", weight: "200 800", style: "normal" },
    { path: "../../node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-italic.woff2", weight: "200 800", style: "italic" },
  ],
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { businessName } = await getBusinessProfile();
  return {
    title: { default: businessName, template: `%s · ${businessName}` },
    description: "Send WhatsApp campaigns, manage contacts and reply to customers.",
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#1b1a3a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} h-full antialiased`}>
      <body className="min-h-full bg-background font-sans text-foreground">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
