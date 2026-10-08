import { test } from 'node:test'; import assert from 'node:assert/strict';
import { psiBand, trend, bandIndex, segments, PSI_EDGES } from './bands.ts';
test('psi band edges', () => {
  const cases: [number, string][] = [[0,'good'],[50,'good'],[51,'moderate'],[100,'moderate'],[101,'unhealthy'],[200,'unhealthy'],[201,'very_unhealthy'],[300,'very_unhealthy'],[301,'hazardous']];
  for (const [v, k] of cases) assert.equal(psiBand(v).key, k, `psi ${v}`);
});
test('sensitive note from unhealthy up', () => {
  assert.equal(psiBand(100).sensitiveNote, false); assert.equal(psiBand(101).sensitiveNote, true);
});
test('advice copy', () => {
  assert.equal(psiBand(40).advice, 'Normal activities');
  assert.equal(psiBand(80).advice, 'Normal activities');
  assert.equal(psiBand(150).advice, 'Reduce prolonged or strenuous outdoor physical exertion');
  assert.equal(psiBand(250).advice, 'Avoid prolonged or strenuous outdoor physical exertion');
  assert.equal(psiBand(350).advice, 'Minimise outdoor activity');
});
test('sky colours per band', () => {
  const want: [number, string, string, string, string, string, string][] = [
    [40, '#BFD9EE', '#1F3346', '#1E3446', '#D6E6F3', '#7FAFD6', '#4F7FA6'],
    [80, '#D6DFD8', '#2E3A33', '#2C3631', '#DCE5DE', '#A9B9AD', '#6E8273'],
    [150, '#D6C193', '#3A2C10', '#4A3A12', '#EDDFB6', '#C8A957', '#B39550'],
    [250, '#B98552', '#2A180A', '#3A2610', '#F3D9B4', '#B07A45', '#B07A45'],
    [350, '#6E4936', '#FFF4EA', '#271812', '#F6E1D6', '#7A5240', '#A0705A'],
  ];
  for (const [v, color, onColor, darkColor, darkOnColor, bar, darkBar] of want) {
    const b = psiBand(v);
    assert.deepEqual({ color: b.color, onColor: b.onColor, darkColor: b.darkColor, darkOnColor: b.darkOnColor, bar: b.bar, darkBar: b.darkBar },
      { color, onColor, darkColor, darkOnColor, bar, darkBar }, `psi ${v}`);
  }
});
test('bandIndex and segments', () => {
  for (const [v, i] of [[0,0],[50,0],[51,1],[300,3],[301,4],[999,4]] as const) assert.equal(bandIndex(v, PSI_EDGES), i, `psi ${v}`);
  assert.deepEqual(segments([50, 100], [0.1, 0.2, 0.3]), [
    { from: 0, to: 50, opacity: 0.1 }, { from: 50, to: 100, opacity: 0.2 }, { from: 100, to: 400, opacity: 0.3 },
  ]);
});
test('trend', () => {
  assert.equal(trend(70, 60), 'rising'); assert.equal(trend(50, 60), 'falling'); assert.equal(trend(65, 60), 'steady');
  assert.equal(trend(70, undefined), null); assert.equal(trend(undefined, 60), null);
});
