import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageTitle } from './title.ts';

test('pageTitle names the region, scale and reading', () => {
  assert.equal(pageTitle('west', 'PSI', 148), 'West PSI 148 — HazeWatch');
  assert.equal(pageTitle('central', 'AQI', 173.4), 'Central AQI 173 — HazeWatch');
});

test('pageTitle falls back to the bare name without a reading', () => {
  assert.equal(pageTitle(null, 'PSI', 148), 'HazeWatch');
  assert.equal(pageTitle('west', 'PSI', undefined), 'HazeWatch');
});
