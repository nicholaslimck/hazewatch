import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNea, fetchNea, withRetry } from './nea.ts';

const fx = (n: string) => JSON.parse(readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url), 'utf8'));
const wrap = (readings: Record<string, Record<string, unknown>>) => ({
  code: 0,
  data: { items: [{ timestamp: '2026-10-05T18:00:00+08:00', readings }] },
});

test('parses psi fixture', () => {
  const json = fx('psi');
  const r = parseNea(json);
  assert.equal(r.length, 60);
  assert.ok(r.every((x) => x.ts === json.data.items[0].timestamp));
  assert.ok(r.some((x) => x.region === 'central' && x.metric === 'psi_twenty_four_hourly' && x.value === 122));
});

test('parses pm25 day fixture', () => {
  assert.equal(parseNea(fx('pm25')).length, 120);
});

test('skips missing and non-numeric', () => {
  const r = parseNea(wrap({ m: { north: 1, south: 'x', east: 3, west: null } }));
  assert.deepEqual(r.map((x) => x.region).sort(), ['east', 'north']);
});

test('skips unknown region', () => {
  const r = parseNea(wrap({ m: { islandwide: 9, north: 1 } }));
  assert.deepEqual(r.map((x) => x.region), ['north']);
});

test('throws on code != 0', () => {
  assert.throws(() => parseNea({ code: 1, errorMsg: 'boom' }), /boom/);
});

test('withRetry retries then succeeds', async () => {
  let n = 0;
  const v = await withRetry(async () => { if (++n < 3) throw new Error('x'); return 'ok'; }, [0, 0]);
  assert.equal(v, 'ok');
  assert.equal(n, 3);
});

test('withRetry gives up', async () => {
  let n = 0;
  await assert.rejects(withRetry(async () => { n++; throw new Error('nope'); }, [0, 0]), /nope/);
  assert.equal(n, 3);
});

test('fetchNea sends key and date', async () => {
  const saved = { ...process.env };
  try {
    process.env.DATA_GOV_SG_API_KEY = 'k';
    let url = '', headers: any;
    const stub = (async (u: any, init: any) => {
      url = String(u); headers = init.headers;
      return new Response(JSON.stringify(fx('psi')), { status: 200 });
    }) as typeof fetch;
    const r = await fetchNea('psi', '2026-10-04', stub);
    assert.equal(r.length, 60);
    assert.equal(url, 'https://api-open.data.gov.sg/v2/real-time/api/psi?date=2026-10-04');
    assert.equal(headers['x-api-key'], 'k');
  } finally {
    process.env = saved;
  }
});

test('fetchNea omits key when unset and throws on non-2xx', async () => {
  const saved = { ...process.env };
  try {
    delete process.env.DATA_GOV_SG_API_KEY;
    let headers: any;
    const stub = (async (_u: any, init: any) => { headers = init.headers; return new Response('', { status: 429 }); }) as typeof fetch;
    await assert.rejects(fetchNea('pm25', undefined, stub), /pm25.*429/);
    assert.equal(headers['x-api-key'], undefined);
  } finally {
    process.env = saved;
  }
});
