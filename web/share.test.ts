import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCALES } from '../shared/scale.ts';
import { shareText, shareFilename, shareMode, isCancel } from './share.ts';

test('shareText for PSI and AQI', () => {
  assert.equal(shareText(SCALES.psi, 'central', 135), 'Central PSI 135, unhealthy. Skip the long run today.');
  assert.equal(shareText(SCALES.aqi, 'east', 120), 'East AQI 120, unhealthy for sensitive groups. Sensitive groups, take it easy.');
});

test('shareFilename uses the SGT date', () => {
  assert.equal(shareFilename('central', '2026-10-06T23:00:00+08:00'), 'hazecheck-central-2026-10-06.png');
});

test('shareMode picks files when canShare accepts', () => {
  const f = new File([''], 'a.png', { type: 'image/png' });
  assert.equal(shareMode({ canShare: () => true }, f), 'files');
});

test('shareMode picks download without canShare', () => {
  const f = new File([''], 'a.png', { type: 'image/png' });
  assert.equal(shareMode({}, f), 'download');
  assert.equal(shareMode({ canShare: () => false }, f), 'download');
});

test('isCancel recognises AbortError', () => {
  assert.equal(isCancel(new DOMException('x', 'AbortError')), true);
  assert.equal(isCancel(new Error('x')), false);
});
