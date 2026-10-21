import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center p-6 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-accent text-accent-foreground">
        <Compass className="size-6" />
      </span>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-1.5 text-muted-foreground">This page doesn’t exist or was removed.</p>
      <Link href="/" className={buttonVariants({ className: "mt-6" })}>
        Go to Home
      </Link>
    </main>
  );
}
