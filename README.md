# WhatsApp Broadcast & Automation Dashboard

<div align="center">

[![Next.js](https://img.shields.io/badge/Next.js-16.4-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-7.1-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Meta Cloud API](https://img.shields.io/badge/Meta_Cloud_API-v26.0-0081FB?style=for-the-badge&logo=meta&logoColor=white)](https://developers.facebook.com/docs/whatsapp/cloud-api)
[![Vitest](https://img.shields.io/badge/Vitest-5.0-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)

An enterprise-ready WhatsApp Broadcast, Campaign Automation, and Conversational Inbox dashboard engineered directly on **Meta's Official WhatsApp Cloud API (Graph API v26.0)**. Built with Next.js 16, PostgreSQL, Prisma 7, and a high-performance transactional outbox queue.

[Explore Features](#feature-tour) • [Architecture](#architecture) • [Quickstart](#local-development) • [Meta Setup](#meta-developer-setup)

<br/>

<img src="docs/screenshots/02_dashboard.png" alt="WhatsApp Automation Dashboard Overview" width="100%" style="border-radius: 14px; box-shadow: 0 20px 40px rgba(0,0,0,0.18);" />

</div>

---

## Highlights

- **Direct Meta Cloud API Integration**: Zero third-party markups (Gupshup, Wati, AiSensy). Runs natively on Meta's official Graph API infrastructure.
- **Transactional Outbox & Safe Queue**: Concurrent queue processing using PostgreSQL `SELECT ... FOR UPDATE OF m SKIP LOCKED`. Never double-sends, drops, or duplicates a message.
- **Automated Compliance Engine**: Strict server-side enforcement of Meta's 24-hour customer service window, explicit opt-in verifications, and automated keyword handling (`STOP`, `UNSUBSCRIBE`, `START`).
- **Real-Time Funnel Analytics**: Granular tracking across every broadcast: `Sent` -> `Delivered` -> `Read` -> `Replied` -> `Failed` with reason breakdowns.
- **Interactive Design Studio with Live Preview**: Visual template builder with parameter mapping and an interactive smartphone simulator reflecting approved formatting in real time.
- **Conversational 2-Way Inbox**: Responsive chat interface with customer service countdown timer, status badges, and quick-reply presets.
- **Executive Titanium UI**: Tailored burnished bronze & dark titanium design system with white-label business customization.

---

## Feature Tour

### 1. Executive Dashboard & Real-Time Overview
A bird's-eye view of your business messaging pipeline. Track active subscribers, monthly transmission volume, delivery ratios, pending action items (unread customer chats, templates under review, failed deliveries), and recent broadcast history.

<p align="center">
  <img src="docs/screenshots/02_dashboard.png" alt="Executive Home Dashboard" width="95%" style="border-radius: 10px; border: 1px solid rgba(0,0,0,0.1);" />
</p>

---

### 2. Contact Management & Segmentation
Comprehensive address book with international E.164 phone sanitization, opt-in status auditing, custom tags, and dynamic group segmentation. Features a high-speed CSV/Excel spreadsheet import wizard with column-mapping intelligence and deduplication.

<p align="center">
  <img src="docs/screenshots/03_contacts.png" alt="Contacts and Audience Manager" width="95%" style="border-radius: 10px; border: 1px solid rgba(0,0,0,0.1);" />
</p>

---

### 3. Message Design Studio & Template Library
Create, organize, and sync pre-approved WhatsApp templates across Marketing, Utility, and Authentication categories. Displays live submission review statuses (`Approved`, `Under Review`, `Needs Changes`) directly from Meta's review network.

<p align="center">
  <img src="docs/screenshots/04_designs.png" alt="Message Designs Catalog" width="95%" style="border-radius: 10px; border: 1px solid rgba(0,0,0,0.1);" />
</p>

---

### 4. Visual Template Editor with Live Smartphone Preview
Author dynamic templates with headers, body variables (`{{1}}`, `{{2}}`), footers, URL buttons, and quick-reply triggers. The real-time interactive preview renders exact mobile bubble sizing, fonts, and button behaviors as customers will see them on WhatsApp.

<p align="center">
  <img src=";" />
</p>

---

### 5. Multi-Step Campaign Broadcast Wizard
A guided campaign dispatch system: select target groups, pick approved templates, map personalizing dynamic fields (Customer Name, City, Custom Values), schedule for future dispatch or trigger instant sending with real-time cost estimation.

<p align="center">
  <img src="docs/screenshots/07_wizard.png" alt="Campaign Broadcast Wizard" width="95%" style="border-radius: 10px; border: 1px solid rgba(0,0,0,0.1);" />
</p>

---

### 6. Broadcast Reports & Delivery Funnel Analytics
Inspect completed and in-flight campaigns down to the individual recipient. View delivery conversion funnels, filter by status, search by customer name, export CSV audit logs, or pause/resume queued transmissions.

<p align="center">
  <img src="docs/screenshots/06_campaigns.png" alt="Campaign Analytics and Funnel Report" width="95%" style="border-radius: 10px; border: 1px solid rgba(0,0,0,0.1);" />
</p>

---

### 7. Conversational 2-Way Inbox
Engage with customer replies directly from the dashboard. Displays the 24-hour customer service window timer, past campaign interaction badges, delivery ticks (sent, delivered, read), and customer unsubscribe status.

<p align="center">
  <img src="docs/screenshots/08_chats.png" alt="Conversational 2-Way WhatsApp Inbox" width="95%" style="border-radius: 10px; border: 1px solid rgba(0,0,0,0.1);" />
</p>

---

### 8. White-Label Account & Branding Settings
Configure the business profile, custom brand logo, contact coordinates, test recipient phone numbers, and administrative security credentials.

<p align="center">
  <img src="docs/screenshots/09_account.png" alt="Account and Branding Settings" width="95%" style="border-radius: 10px; border: 1px solid rgba(0,0,0,0.1);" />
</p>

---

### 9. Secure Authenticated Gateway
Protected dashboard routes with signed HTTP-only cookies (`jose` webcrypto HMAC), timing-safe constant-time string comparisons, and route protection proxy.

<p align="center">
  <img src="docs/screenshots/01_login.png" alt="Authentication Gateway" width="95%" style="border-radius: 10px; border: 1px solid rgba(0,0,0,0.1);" />
</p>

---

## Architecture

```mermaid
flowchart TD
    subgraph Client["Client Browser"]
        UI["Next.js 16 App Router UI"]
    end

    subgraph Server["Next.js Application Layer"]
        Proxy["Proxy Gateway (Route Guard)"]
        Services["Service Layer (Campaigns, Contacts, Chats)"]
        Queue["Queue Engine (SKIP LOCKED Worker)"]
        Provider["MessagingProvider Seam"]
        MetaProvider["MetaCloudProvider (Graph API v26.0)"]
    end

    subgraph Data["Persistence Layer"]
        DB[("PostgreSQL Database\n(Prisma ORM 7)")]
    end

    subgraph Meta["Meta Cloud Infrastructure"]
        GraphAPI["Meta Graph API\n(Messages & Templates)"]
        Webhooks["Webhook Ingestion\n(HMAC-SHA256 Signed)"]
    end

    UI --> Proxy --> Services
    Services --> DB
    Services --> Queue
    Queue --> DB
    Queue --> Provider
    Provider --> MetaProvider
    MetaProvider --> GraphAPI
    Webhooks --> Services
    Services --> DB
```

### Key Technical Mechanisms

- **PostgreSQL Outbox Concurrency**: Message rows are drafted as `QUEUED`. The queue processor claims batches via `SELECT ... FOR UPDATE OF m SKIP LOCKED`, preventing race conditions across concurrent workers or cron jobs.
- **Monotonic Status Transitions**: Webhook delivery updates enforce state ranking (`QUEUED` -> `SENDING` -> `SENT` -> `DELIVERED` -> `READ`). Out-of-order webhook deliveries from Meta can never downgrade or corrupt message states.
- **Credential Sanitization**: Access tokens are isolated to HTTP request headers and redacted from error strings, database tables, and client responses.
- **Automatic Opt-Out**: Immediate detection of keywords like `STOP`, `UNSUBSCRIBE`, and `CANCEL` cancels all in-flight outbound messages for that contact and logs compliance audit entries.

---

## Local Development

### Prerequisites

- **Node.js**: v20 or newer
- **Database**: PostgreSQL (Docker, local instance, or Supabase/Neon)
- **Meta Developer Account**: Free test number & access token

### 1. Clone & Install

```bash
git clone https://github.com/harshaflopper/whatsapp_automation.git
cd whatsapp_automation
npm install
```

### 2. Configure Environment

Copy the example environment configuration:

```bash
cp .env.example .env
```

Set the database connection and administrator credentials in `.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/whatsapp_db
ADMIN_EMAIL=owner@example.com
ADMIN_PASSWORD=admin123
AUTH_SECRET=super-secret-random-32-character-string
```

### 3. Database Migration & Seed

Run migrations to create the schema, then optionally load demo seed contacts and templates:

```bash
npm run db:migrate
npm run seed
```

### 4. Start Development Server & Worker

In your primary terminal:

```bash
npm run dev
```

Open `http://localhost:3000` and sign in with your `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

To process scheduled campaigns and queued outbound messages locally:

```bash
npm run worker
```

---

## Project Structure

```
├── docs/screenshots/            # High-resolution feature captures
├── prisma/
│   ├── schema.prisma            # PostgreSQL data model (Prisma 7)
│   ├── migrations/              # Migration history
│   └── seed.ts                  # Demo seed generator
├── scripts/
│   └── worker.ts                # Standalone queue daemon
├── src/
│   ├── app/
│   │   ├── (dashboard)/         # Authenticated dashboard views
│   │   │   ├── page.tsx         # Overview metrics & quick tasks
│   │   │   ├── contacts/        # Address book & CSV import
│   │   │   ├── designs/         # Template builder & phone preview
│   │   │   ├── campaigns/       # Broadcast wizard & reports
│   │   │   ├── chats/           # 2-way live inbox
│   │   │   └── account/         # White-label settings
│   │   ├── api/
│   │   │   ├── brand-logo/      # Dynamic brand logo streamer
│   │   │   ├── cron/process/    # Vercel/cron-job queue trigger
│   │   │   └── webhooks/        # Meta webhook ingestion
│   │   ├── login/               # Sign-in portal
│   │   └── proxy.ts             # Gateway security layer
│   ├── components/
│   │   ├── app/                 # Domain UI: phone-preview, kit, nav, status
│   │   └── ui/                  # Primitives: button, dialog, table, input
│   └── lib/
│       ├── messaging/           # Meta Cloud Provider seam & compliance
│       ├── services/            # Business operations & queue processor
│       ├── auth.ts              # Session verification
│       └── db.ts                # Prisma client singleton
└── tests/                       # Unit test suites (compliance, signatures, payloads)
```

---

## Meta Developer Setup

1. **Meta Developers**: Visit [developers.facebook.com](https://developers.facebook.com) and create an app with use case **Connect with customers through WhatsApp**.
2. **API Setup**: Under **WhatsApp -> API Setup**, obtain your **Phone Number ID** and **WhatsApp Business Account ID**.
3. **Verified Recipients**: For sandbox test numbers, add your demo recipient numbers under *Manage phone number list*.
4. **Permanent Token**: Create a System User in [Business Manager](https://business.facebook.com/settings) with `whatsapp_business_messaging` and `whatsapp_business_management` permissions, and assign Full Control of the app and WABA.
5. **Webhooks**: Configure `https://<your-domain>/api/webhooks/whatsapp`, verify with your `WA_WEBHOOK_VERIFY_TOKEN`, and subscribe to `messages` and `message_template_status_update`.

---

## Test Suite

Run the Vitest test suite covering webhook signature validation, phone normalization, the 24-hour customer window, and opt-out enforcement:

```bash
npm test
```

---

## License

Private & Proprietary. All rights reserved.
