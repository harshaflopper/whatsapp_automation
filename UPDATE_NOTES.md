# Client dashboard update

This version turns the app into the client-facing WhatsApp dashboard:
Home, Contacts, Message designs, Send campaign, Campaigns (reports), Chats and Account.
All technical details (API, tokens, limits, error codes) stay hidden from the business.

## Install

1. **Replace the whole `src`, `prisma`, `tests` and `scripts` folders** with the ones in this zip
   (and `package.json`, `package-lock.json`, `.env.example`).
   Keep your own `.env` and `node_modules`.
   These old files must be gone (they no longer exist in this version):
   - `src/app/(dashboard)/settings/` (whole folder)
   - `src/components/app/status-badge.tsx`
   - `src/lib/services/connection.ts`
2. `npm install`  (adds `read-excel-file` and the self-hosted Plus Jakarta Sans font)
3. `npx prisma migrate dev`  (applies `20261021180000_client_dashboard`)
4. Add to `.env` (see `.env.example`):
   - `WA_DAILY_LIMIT=250` — new customers messaged per 24h; extras wait and go out automatically
   - `SUPPORT_PHONE` / `SUPPORT_EMAIL` — your team's contact, shown on Account and login
   - `APP_NAME` — default business name (the client can change it in Account)
5. Optional demo data: `npm run seed` (12 sample customers, 3 groups, 5 draft designs)
6. `npm run dev`, and in a second terminal `npm run worker` (sends queued and scheduled campaigns locally)

## Production

- Webhook URL in Meta: `https://<your-domain>/api/webhooks/whatsapp`
  (subscribe to `messages` and `message_template_status_update`). Delivery ticks, replies,
  STOP and design approvals all come through here.
- Every minute, call `https://<your-domain>/api/cron/process?key=<CRON_SECRET>`
  (cron-job.org on Vercel Hobby). "Send now" also starts sending immediately.

## Notes

- The client's login email is `ADMIN_EMAIL`; they can change the password in Account.
- "Send a test to my phone" creates a contact "Me (test phone)" for the owner's number.
- On the free Meta test number, only verified recipients receive messages.
