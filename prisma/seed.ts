/**
 * Demo data for a fresh dashboard: `npm run seed`.
 * Creates sample customers, groups and a few draft message designs. Safe to run twice.
 * Put your own verified phones in DEMO_RECIPIENTS (comma-separated) so test sends reach you.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { STARTERS, toMetaBody } from "../src/lib/designs/text";
import { normalizePhone } from "../src/lib/phone";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const PEOPLE: [string, string, string, string[]][] = [
  ["Priya Sharma", "9845012345", "Jayanagar", ["VIP"]],
  ["Ravi Kumar", "9900112233", "Rajajinagar", []],
  ["Ananya Rao", "8123456780", "Malleswaram", ["VIP"]],
  ["Mohammed Irfan", "9731100223", "Indiranagar", []],
  ["Kavitha N", "9008877665", "Basavanagudi", []],
  ["Suresh Gowda", "6362233445", "Yelahanka", ["Wholesale"]],
  ["Lakshmi Prasad", "7411223344", "HSR Layout", []],
  ["Arjun Shetty", "8892001122", "Whitefield", []],
  ["Deepa Hegde", "7022334455", "Vijayanagar", ["VIP"]],
  ["Nikhil Joshi", "9611223344", "Koramangala", []],
  ["Shwetha Murthy", "9886655443", "JP Nagar", []],
  ["Rahul Menon", "9535544332", "Electronic City", ["Wholesale"]],
];

async function main() {
  const groups: Record<string, string> = {};
  for (const name of ["Diwali leads", "Old customers", "VIP"]) {
    const g = await db.group.upsert({ where: { name }, update: {}, create: { name } });
    groups[name] = g.id;
  }

  const demo = (process.env.DEMO_RECIPIENTS ?? "")
    .split(",")
    .map((s) => normalizePhone(s))
    .filter((p): p is { ok: true; e164: string } => p.ok)
    .map((p) => p.e164);

  const rows = PEOPLE.map(([name, phone, city, tags], i) => ({
    name,
    phone: demo[i] ?? (normalizePhone(phone) as { ok: true; e164: string }).e164,
    city,
    tags,
  }));

  let n = 0;
  for (const [i, r] of rows.entries()) {
    const c = await db.contact.upsert({
      where: { phone: r.phone },
      update: {},
      create: {
        name: r.name,
        phone: r.phone,
        city: r.city,
        tags: r.tags,
        optedIn: true,
        optedInAt: new Date(),
        optEvents: { create: { type: "OPT_IN", source: "SEED", note: "Demo data" } },
      },
    });
    const gs = [i % 2 === 0 ? "Diwali leads" : "Old customers", ...(r.tags.includes("VIP") ? ["VIP"] : [])];
    await db.contactGroup.createMany({ data: gs.map((g) => ({ contactId: c.id, groupId: groups[g] })), skipDuplicates: true });
    n++;
  }

  for (const s of STARTERS) {
    const { body, variables } = toMetaBody(s.body, s.samples);
    const name = s.id.replace(/-/g, "_");
    await db.template.upsert({
      where: { name_language: { name, language: "en" } },
      update: {},
      create: {
        title: s.title,
        name,
        language: "en",
        category: s.category,
        header: s.header || null,
        body,
        footer: s.footer || null,
        variables: variables as unknown as object,
        examples: { body: variables.map((v) => v.sample) },
      },
    });
  }

  console.log(`Seeded ${n} contacts, ${Object.keys(groups).length} groups and ${STARTERS.length} draft designs.`);
  if (demo.length) console.log(`The first ${demo.length} contacts use your DEMO_RECIPIENTS numbers.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
