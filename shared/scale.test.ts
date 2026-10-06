import { test } from 'node:test'; import assert from 'node:assert/strict';
import { SCALES } from './scale.ts';

test('chart lines derive from the band edges', () => {
  assert.deepEqual(SCALES.psi.trendLines, [{ v: 55, label: 'Elevated' }, { v: 150, label: 'High' }, { v: 250, label: 'Very high' }]);
  assert.deepEqual(SCALES.aqi.trendLines, [{ v: 35.4, label: 'Sensitive groups' }, { v: 55.4, label: 'Unhealthy' }, { v: 125.4, label: 'Very unhealthy' }]);
});

test('each scale has one segment, legend entry and verdict tier per band', () => {
  for (const [name, s] of Object.entries(SCALES)) {
    assert.equal(s.segments.length, s.legend.length, name);
    assert.equal(s.segments[0].from, 0, name);
    assert.equal(s.segments[s.segments.length - 1].to, 400, name);
    // Each segment's band (sampled just inside it) matches the legend's colour key, in order.
    s.segments.forEach((seg, i) => assert.equal(s.band(seg.from + 1).key, s.legend[i].key, `${name} segment ${i}`));
  }
});
