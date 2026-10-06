import { test } from 'node:test'; import assert from 'node:assert/strict';
import { psiBand, pm25Band, trend } from './bands.ts';
test('psi band edges', () => {
  const cases: [number, string][] = [[0,'good'],[50,'good'],[51,'moderate'],[100,'moderate'],[101,'unhealthy'],[200,'unhealthy'],[201,'very_unhealthy'],[300,'very_unhealthy'],[301,'hazardous']];
  for (const [v, k] of cases) assert.equal(psiBand(v).key, k, `psi ${v}`);
});
test('sensitive note from unhealthy up', () => {
  assert.equal(psiBand(100).sensitiveNote, false); assert.equal(psiBand(101).sensitiveNote, true);
});
test('advice copy', () => {
  assert.equal(psiBand(40).advice, 'Normal activities');
  assert.equal(psiBand(150).advice, 'Reduce prolonged or strenuous outdoor exertion');
  assert.equal(psiBand(250).advice, 'Avoid prolonged or strenuous outdoor exertion');
  assert.equal(psiBand(350).advice, 'Minimise outdoor activity');
});
test('pm25 bands', () => {
  for (const [v, b] of [[55,1],[56,2],[150,2],[151,3],[250,3],[251,4]] as const) assert.equal(pm25Band(v), b);
});
test('trend', () => {
  assert.equal(trend(70, 60), 'rising'); assert.equal(trend(50, 60), 'falling'); assert.equal(trend(65, 60), 'steady');
  assert.equal(trend(70, undefined), null); assert.equal(trend(undefined, 60), null);
});
