import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";

export async function GET() {
  try {
    let configured: string | null = null;
    try {
      const row = await db.appSetting.findUnique({ where: { key: "logoUrl" } });
      if (row?.value?.trim()) configured = row.value.trim();
    } catch {
      // Ignore db errors, fall back to env
    }

    if (!configured) {
      configured = process.env.APP_LOGO_URL?.trim() || null;
    }

    const candidates: string[] = [];

    if (configured) {
      // 1. Direct path as configured
      candidates.push(configured);
      // 2. Relative to process.cwd()
      candidates.push(path.resolve(process.cwd(), configured.replace(/^[/\\]+/, "")));
      // 3. Basename in cwd
      const base = path.basename(configured);
      if (base) {
        candidates.push(path.resolve(process.cwd(), base));
        candidates.push(path.resolve(process.cwd(), "public", base));
      }
    }

    // Default project logo files
    candidates.push(path.resolve(process.cwd(), "image.png"));
    candidates.push(path.resolve(process.cwd(), "logo.png"));
    candidates.push(path.resolve(process.cwd(), "public", "image.png"));
    candidates.push(path.resolve(process.cwd(), "public", "logo.png"));

    for (const file of candidates) {
      if (file && fs.existsSync(file)) {
        try {
          const stat = fs.statSync(file);
          if (stat.isFile()) {
            const ext = path.extname(file).toLowerCase();
            const contentType =
              ext === ".png"
                ? "image/png"
                : ext === ".jpg" || ext === ".jpeg"
                  ? "image/jpeg"
                  : ext === ".svg"
                    ? "image/svg+xml"
                    : ext === ".webp"
                      ? "image/webp"
                      : "image/png";

            const buffer = fs.readFileSync(file);

            // Also replicate to public/ directory for direct Next.js static asset serving
            try {
              const publicDir = path.resolve(process.cwd(), "public");
              if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
              const target = path.resolve(publicDir, "image.png");
              if (!fs.existsSync(target)) fs.writeFileSync(target, buffer);
            } catch {
              // Ignore public cache write failure
            }

            return new NextResponse(buffer, {
              headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
              },
            });
          }
        } catch {
          // Try next candidate
        }
      }
    }

    return new NextResponse("Logo not found", { status: 404 });
  } catch (err) {
    return new NextResponse(err instanceof Error ? err.message : "Error", { status: 500 });
  }
}
