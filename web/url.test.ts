import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readState, writeSearch, deepLink } from './url.ts';

test('readState reads a full set of params', () => {
  assert.deepEqual(readState('?region=west&view=numbers&scale=aqi'), { region: 'west', view: 'numbers', scale: 'aqi' });
});

test('readState ignores unknown values and an empty search', () => {
  assert.deepEqual(readState('?region=atlantis&view=bogus&scale=zzz'), { region: null, view: null, scale: null });
  assert.deepEqual(readState(''), { region: null, view: null, scale: null });
  assert.deepEqual(readState('?utm_source=x'), { region: null, view: null, scale: null });
});

test('readState takes the params it knows and ignores the rest', () => {
  assert.deepEqual(readState('?foo=1&region=east'), { region: 'east', view: null, scale: null });
});

test('writeSearch writes the region and omits the defaults', () => {
  assert.equal(writeSearch({ region: 'west', view: 'simple', scale: 'psi' }), '?region=west');
});

test('writeSearch writes only what differs from the defaults', () => {
  assert.equal(writeSearch({ region: null, view: 'numbers', scale: 'aqi' }), '?view=numbers&scale=aqi');
  assert.equal(writeSearch({ region: null, view: 'simple', scale: 'psi' }), '');
});

test('writeSearch round-trips through readState', () => {
  for (const s of [
    { region: 'north', view: 'numbers', scale: 'aqi' },
    { region: 'central', view: 'simple', scale: 'psi' },
    { region: null, view: 'numbers', scale: 'psi' },
  ] as const) {
    const r = readState(writeSearch(s));
    assert.deepEqual({ region: r.region, view: r.view ?? 'simple', scale: r.scale ?? 'psi' }, s);
  }
});

test('deepLink appends the state to a base and is null without a base', () => {
  assert.equal(deepLink('https://hazewatch.limspot.org', { region: 'east', view: 'numbers', scale: 'aqi' }),
    'https://hazewatch.limspot.org?region=east&view=numbers&scale=aqi');
  assert.equal(deepLink('https://hazewatch.limspot.org', { region: 'east', view: 'simple', scale: 'psi' }),
    'https://hazewatch.limspot.org?region=east');
  assert.equal(deepLink(null, { region: 'east', view: 'simple', scale: 'psi' }), null);
});
