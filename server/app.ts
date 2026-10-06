import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { readFile } from 'node:fs/promises';
import type { Store } from './db.ts';
import type { IngestState } from './ingest.ts';
import { REGIONS } from '../shared/types.ts';
import type { Region } from '../shared/types.ts';

const RANGES = ['24h', '7d', '90d'] as const;

export function createApp(store: Store, state: IngestState, staticDir?: string, config: { publicUrl: string | null } = { publicUrl: null }): Hono {
  const app = new Hono();

  app.use('/api/*', async (c, next) => {
    await next();
    if (c.res.status === 200 && !c.res.headers.has('Cache-Control')) c.header('Cache-Control', 'max-age=300');
  });

  app.get('/api/health', (c) => {
    c.header('Cache-Control', 'no-store');
    return c.json({ ok: state.lastError === null, lastIngestAt: state.lastIngestAt, lastError: state.lastError });
  });

  app.get('/api/config', (c) => {
    c.header('Cache-Control', 'no-store');
    return c.json(config);
  });

  app.get('/api/now', (c) => c.json(store.now()));

  app.get('/api/history', (c) => {
    const range = c.req.query('range');
    const metric = c.req.query('metric');
    const region = c.req.query('region');
    if (!range || !(RANGES as readonly string[]).includes(range)) return c.json({ error: 'invalid range' }, 400);
    if (!metric || !/^[a-z0-9_]+$/.test(metric)) return c.json({ error: 'invalid metric' }, 400);
    if (region !== undefined && !(REGIONS as readonly string[]).includes(region)) return c.json({ error: 'invalid region' }, 400);
    return c.json({ points: store.history(range as (typeof RANGES)[number], metric, region as Region | undefined) });
  });

  app.all('/api/*', (c) => c.json({ error: 'not found' }, 404));

  if (staticDir) {
    // Stale index.html after a redeploy points at hashed assets that no longer exist.
    app.use('*', async (c, next) => {
      await next();
      if (c.res.headers.get('content-type')?.startsWith('text/html') || c.req.path === '/sw.js') c.header('Cache-Control', 'no-cache');
    });
    app.use('*', serveStatic({ root: staticDir }));
    app.get('*', async (c) => {
      const p = c.req.path;
      if (p.startsWith('/assets/') || /\./.test(p.split('/').pop()!)) return c.text('not found', 404);
      return c.html(await readFile(`${staticDir}/index.html`, 'utf8'));
    });
  }
  return app;
}
