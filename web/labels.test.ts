import { test } from 'node:test'; import assert from 'node:assert/strict';
import { placeLabels } from './labels.ts';
test('placeLabels', () => {
  assert.deepEqual(placeLabels([26, 78.6, 93.5], 18, 120), ['above', 'above', 'below']); // AQI: 125/55/35 µg/m³ lines
  assert.deepEqual(placeLabels([40, 90], 18, 120), ['above', 'above']); // room for both
  assert.deepEqual(placeLabels([100, 110], 18, 120), ['above', null]); // no room above or below: dropped
});
