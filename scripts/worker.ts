/**
 * Local sender: `npm run worker` keeps the queue moving while you develop
 * (in production the cron route does this every minute).
 */
import "dotenv/config";
import { processQueue } from "../src/lib/services/queue";

async function main() {
  console.log("Queue worker running. Press Ctrl+C to stop.");
  for (;;) {
    try {
      const r = await processQueue({ maxMs: 15_000 });
      if (r.sent || r.failed || r.deferred || r.retried || r.stoppedEarly) console.log(new Date().toLocaleTimeString(), r);
    } catch (e) {
      console.error("Queue run failed:", e instanceof Error ? e.message : e);
    }
    await new Promise((r) => setTimeout(r, 5_000));
  }
}

void main();
