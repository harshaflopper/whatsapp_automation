# WhatsApp Broadcast & Automation Dashboard

Our own WhatsApp dashboard on **Meta's official WhatsApp Cloud API**: contacts, segments, template manager,
broadcasts with live delivery ticks, and a simple inbox. It runs on Meta's free test number for demos, and a
client's real number is just an environment change.

> **Status:** Phase 1 of 6 (setup, auth, settings, Meta provider, test send). Later sections are marked *(coming)*.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 + shadcn/ui · PostgreSQL + Prisma 7 · Vitest

---

## 1. Run it locally

**You need:** Node.js 20+ and a Postgres database (any of the options below).

```bash
npm install
cp .env.example .env          # then fill it in (see "Environment variables" below)
```

Start a local Postgres. Pick **one**:

| Option | Command | `DATABASE_URL` |
| --- | --- | --- |
| A. Docker | `docker compose up -d` | `postgresql://wa:wa@localhost:5433/wa_dashboard` |
| B. No Docker | `npx prisma dev --name wa-dashboard --detach --db-port 51214` | `postgres://postgres:postgres@localhost:51214/template1?sslmode=disable` |
| C. Supabase | create a project | pooled URL (port 6543, `?pgbouncer=true`) in `DATABASE_URL`, direct URL (5432) in `DIRECT_URL` |

Then:

```bash
npm run db:migrate            # creates the tables
npm run dev                   # http://localhost:3000
```

Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from your `.env`.

### Useful scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm test` | Unit tests (webhook signature, phone normalisation, 24h window, opt-out, Meta payloads) |
| `npm run typecheck` | TypeScript check |
| `npm run db:migrate` | Apply schema changes in development |
| `npm run db:deploy` | Apply migrations in production |
| `npm run db:studio` | Browse the database |

---

## 2. Environment variables

All credentials come from the environment. Nothing is hard-coded, and secrets are masked in the UI.

| Variable | Where to get it |
| --- | --- |
| `DATABASE_URL`, `DIRECT_URL` | Your Postgres (see above). `DIRECT_URL` is only needed for Supabase. |
| `WA_GRAPH_VERSION` | Graph API version. Default `v26.0` (latest stable as of Oct 2026). |
| `WA_PHONE_NUMBER_ID` | Meta → your app → WhatsApp → **API Setup** → "Phone number ID" |
| `WA_BUSINESS_ACCOUNT_ID` | Same page → "WhatsApp Business Account ID" |
| `WA_ACCESS_TOKEN` | A **permanent System User token** (step 6 below). The token on the API Setup page expires in 24h. |
| `WA_APP_SECRET` | Meta → your app → **App settings → Basic** → App secret (used to verify webhooks) |
| `WA_WEBHOOK_VERIFY_TOKEN` | Any random string you choose; you'll paste the same value into Meta (Phase 2) |
| `WA_SEND_RATE_PER_SEC` | Queue throttle (default 10/s) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Dashboard login |
| `AUTH_SECRET` | 32+ random chars: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `APP_NAME`, `APP_LOGO_URL` | White-label branding per client |
| `CRON_SECRET` | Protects the queue endpoint *(Phase 5)* |
| `DEMO_RECIPIENTS` | Your verified test phones, comma-separated, used by the seed *(Phase 6)* |

---

## 3. Meta developer setup (step by step)

You need a personal Facebook account and about 20 minutes.

1. **Create a Meta developer account** at <https://developers.facebook.com> (log in → *Get started*).
2. **Create an app**: *My Apps → Create app* → use case **"Connect with customers through WhatsApp"** (or type
   *Business*) → give it a name → link or create a **Business portfolio**.
3. **Add the WhatsApp product** if it isn't added automatically: app dashboard → *Add product → WhatsApp → Set up*.
4. **Get the test number**: *WhatsApp → API Setup*. Meta gives you a free **test phone number** and a test
   WhatsApp Business Account. Copy the **Phone number ID** and **WhatsApp Business Account ID** into `.env`.
5. **Add up to 5 recipient numbers**: on the same page, under **"To"** → *Manage phone number list* → add each
   demo phone (with country code) and enter the code WhatsApp sends to it. Only these numbers can receive
   messages from the test number.
6. **Create a permanent token (System User)**:
   1. Go to <https://business.facebook.com/settings> → your business → **Users → System users → Add**.
      Name it e.g. `wa-dashboard`, role **Admin**.
   2. **Assign assets**: select the system user → *Assign assets* → **Apps** → your app → *Full control*;
      and **WhatsApp accounts** → your WABA → *Full control*.
   3. **Generate new token** → choose your app → expiry **Never** → tick
      `whatsapp_business_messaging` and `whatsapp_business_management` → *Generate*.
   4. Copy it into `WA_ACCESS_TOKEN`. (It's shown only once. Store it in your password manager.)
7. **App secret**: *App settings → Basic → App secret → Show* → copy into `WA_APP_SECRET`.
8. **Restart** `npm run dev`, open **Settings**: it should show **Connected** with the test number.
9. **Webhook** (callback URL, verify token, subscribe to `messages` and `message_template_status_update`):
   *(Phase 2: instructions will be added here, including ngrok/cloudflared for local development.)*

### Phase 1 check: send `hello_world`

Settings → **Send a test message** → enter one of your verified recipient numbers → *Send test message*.
The phone should get Meta's "Hello World" message within seconds. Common errors are explained in plain English;
for example **"This number isn't added as a test recipient in Meta yet"** means step 5 is missing for that number.

---

## 4. Architecture notes

```
src/
  app/
    login/                  sign-in (server action, signed httpOnly cookie)
    (dashboard)/            authenticated pages (sidebar on desktop, drawer on mobile)
      settings/             connection status, masked credentials, test send
  lib/
    messaging/
      provider.ts           MessagingProvider interface (provider-neutral types)
      meta/                 MetaCloudProvider, error-code table, webhook parser
      compliance.ts         opt-in / opt-out / 24h-window rules (enforced server-side)
      index.ts              getProvider(): picks the provider from env
    services/               business operations used by pages, worker and API routes
    phone.ts                E.164 normalisation (+91 default)
    env.ts  db.ts  auth.ts  session.ts
  proxy.ts                  route protection (Next 16's replacement for middleware)
prisma/schema.prisma        full data model for all phases
tests/                      Vitest unit tests
```

- **Provider seam**: UI and business logic only use `MessagingProvider`. Supporting Gupshup or AiSensy later
  means adding a class in `lib/messaging/` and setting `MESSAGING_PROVIDER`.
- **Every outbound message is a `Message` row** with its `wamid`, so status webhooks can update it. Queued rows
  will double as the send queue (Phase 5).
- **Compliance is enforced in the send layer**: templates need an opt-in; free text needs an open 24h window;
  opted-out contacts are blocked everywhere.
- **Secrets**: the access token is sent only in the `Authorization` header (never in URLs), and Meta's error
  messages are scrubbed of anything token-like before they reach logs, the database or the UI.

---

## 5. Deploying to Vercel *(coming in a later phase)*
## 6. 5-minute client demo script *(coming in Phase 6)*
