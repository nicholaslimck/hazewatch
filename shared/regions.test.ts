import { test } from 'node:test'; import assert from 'node:assert/strict';
import { nearestRegion, parseSavedRegion } from './regions.ts';
test('nearestRegion', () => {
  assert.equal(nearestRegion(1.333, 103.742), 'west');    // Jurong East
  assert.equal(nearestRegion(1.436, 103.786), 'north');   // Woodlands
  assert.equal(nearestRegion(1.354, 103.945), 'east');    // Tampines
  assert.equal(nearestRegion(1.283, 103.86), 'south');    // Marina Bay
  assert.equal(nearestRegion(1.351, 103.848), 'central'); // Bishan
});
test('parseSavedRegion', () => {
  assert.equal(parseSavedRegion('east'), 'east');
  for (const raw of [null, '', 'East ', '{"r":1}', 'islandwide']) assert.equal(parseSavedRegion(raw), null, String(raw));
});
