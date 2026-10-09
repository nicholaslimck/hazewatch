import { test } from 'node:test'; import assert from 'node:assert/strict';
import { psiBand, trend, bandIndex, segments, PSI_EDGES, isWarningBand, pm25HourBand, pm25HourPalette } from './bands.ts';
import { aqiBand } from './aqi.ts';
test('psi band edges', () => {
  const cases: [number, string][] = [[0,'good'],[50,'good'],[51,'moderate'],[100,'moderate'],[101,'unhealthy'],[200,'unhealthy'],[201,'very_unhealthy'],[300,'very_unhealthy'],[301,'hazardous']];
  for (const [v, k] of cases) assert.equal(psiBand(v).key, k, `psi ${v}`);
});
test('sensitive note from unhealthy up', () => {
  assert.equal(psiBand(100).sensitiveNote, false); assert.equal(psiBand(101).sensitiveNote, true);
});
// The badge and the hero's colour must never disagree, and 100 is the top of Moderate — not a warning.
test('warning bands: badge on from Unhealthy up, on both scales', () => {
  const psi: [number, boolean][] = [[0, false], [50, false], [100, false], [101, true], [200, true], [201, true], [300, true], [350, true]];
  for (const [v, w] of psi) assert.equal(isWarningBand(psiBand(v)), w, `psi ${v}`);
  // AQI 101–150 is "Unhealthy for sensitive groups": a warning colour below AQI's first alert edge.
  const aqi: [number, boolean][] = [[0, false], [50, false], [100, false], [101, true], [150, true], [151, true], [200, true], [300, true], [400, true]];
  for (const [v, w] of aqi) assert.equal(isWarningBand(aqiBand(v)), w, `aqi ${v}`);
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
// The caption's band name and the chip's colour both key on NEA's hourly PM2.5 edges, and those edges
// are where a band STARTS — 55 is the bottom of Elevated, 150 the bottom of High. An off-by-one here
// would name the air differently from the "Elevated 55+" line the caption sits under.
test('pm25 hourly band name and palette', () => {
  const names: [number, string][] = [[0,'Normal'],[54,'Normal'],[55,'Elevated'],[149,'Elevated'],[150,'High'],[249,'High'],[250,'Very high'],[400,'Very high']];
  for (const [v, n] of names) assert.equal(pm25HourBand(v), n, `pm2.5 ${v}`);
  assert.equal(pm25HourPalette(54).key, 'good');
  assert.equal(pm25HourPalette(82).key, 'moderate');
  assert.equal(pm25HourPalette(160).key, 'unhealthy');
  assert.equal(pm25HourPalette(300).key, 'very_unhealthy');
});
