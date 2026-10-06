import { serve } from '@hono/node-server';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openDb } from './db.ts';
import { createApp } from './app.ts';
import { BACKFILL_DAYS, backfill, ingestOnce, msUntilNext50, neaFetcher, sgtDate } from './ingest.ts';
import type { IngestState } from './ingest.ts';
import { runAlerts } from './alerts.ts';
import { createBot } from './telegram.ts';

const dbPath = process.env.DB_PATH ?? './data/aq.db';
const port = Number(process.env.PORT ?? 8080);
mkdirSync(dirname(dbPath), { recursive: true });

const store = openDb(dbPath);
const state: IngestState = { lastIngestAt: null, lastError: null };
const server = serve({ fetch: createApp(store, state, 'dist').fetch, port }, () => console.log(`listening on :${port}`));

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = token ? createBot({ token, store }) : null;
bot?.start();

// Alerts only follow a successful ingest, so a failed hour never alerts on stale data.
const ingestAndAlert = async () => {
  await ingestOnce(store, neaFetcher, state);
  if (!bot || state.lastError !== null) return;
  try {
    await runAlerts(store, bot.send, Date.now());
  } catch (e) {
    console.error('alert run failed', e);
  }
};

let timer: NodeJS.Timeout;
const tick = async () => {
  timer = setTimeout(tick, msUntilNext50(Date.now()));
  try {
    await ingestAndAlert();
  } catch (e) {
    console.error('hourly ingest failed', e);
  }
};
timer = setTimeout(tick, msUntilNext50(Date.now()));

// Background: first ingest, then history backfill. Never blocks requests.
(async () => {
  await ingestAndAlert();
  const n = await backfill(store, neaFetcher, { days: BACKFILL_DAYS, todaySgt: sgtDate(Date.now()), sleepMs: 1000 });
  console.log(`backfill done: ${n} days fetched`);
})().catch((e) => console.error('startup ingest failed', e));

const shutdown = () => {
  clearTimeout(timer);
  bot?.stop();
  server.close(() => {
    store.close();
    process.exit(0);
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
