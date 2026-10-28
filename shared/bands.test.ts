import { test } from 'node:test'; import assert from 'node:assert/strict';
import { contrast, labelOn, PALETTES, sensitiveAction, psiBand, trend, bandIndex, segments, PSI_EDGES, isWarningBand, pm25HourBand } from './bands.ts';
import { aqiBand } from './aqi.ts';
test('psi band edges', () => {
  const cases: [number, string][] = [[0,'good'],[50,'good'],[51,'moderate'],[100,'moderate'],[101,'unhealthy'],[200,'unhealthy'],[201,'very_unhealthy'],[300,'very_unhealthy'],[301,'hazardous']];
  for (const [v, k] of cases) assert.equal(psiBand(v).key, k, `psi ${v}`);
});
test('sensitive-groups instruction from unhealthy up, tightening with each band', () => {
  assert.equal(psiBand(100).sensitive, '');
  const notes = [150, 250, 350].map((v) => psiBand(v).sensitive);
  for (const n of notes) assert.ok(n.startsWith('Older people, children, pregnant women'), n);
  assert.equal(new Set(notes).size, 3); // each band says something different
  for (const v of [25, 75, 125, 175, 250, 350]) assert.match(aqiBand(v).advice, /\.$/, `aqi ${v} advice ends a sentence`);
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
  assert.equal(psiBand(40).advice, 'Go about your day as normal.');
  assert.equal(psiBand(80).advice, 'Go about your day as normal.');
  assert.equal(psiBand(150).advice, 'Cut back on long or hard exercise outside.');
  assert.equal(psiBand(250).advice, 'Avoid long or hard exercise outside.');
  assert.equal(psiBand(350).advice, 'Spend as little time outside as you can.');
});
test('sky colours per band', () => {
  const want: [number, string, string, string, string, string, string][] = [
    [40, '#BFD9EE', '#1F3346', '#1E3446', '#D6E6F3', '#5381A7', '#5182A9'],
    [80, '#D6DFD8', '#2E3A33', '#2C3631', '#DCE5DE', '#5E6C61', '#7C9181'],
    [150, '#D6C193', '#3A2C10', '#4A3A12', '#EDDFB6', '#6B5303', '#B69853'],
    [250, '#B98552', '#2A180A', '#3A2610', '#F3D9B4', '#653A03', '#D9A16B'],
    [350, '#6E4936', '#FFF4EA', '#271812', '#F6E1D6', '#321102', '#FBC6AE'],
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
});
test('chart band follows the lines it draws', async () => {
  const { SCALES } = await import('./scale.ts');
  assert.equal(SCALES.psi.hourBand(37), 'Normal');
  assert.equal(SCALES.aqi.hourBand(37), 'Unhealthy for sensitive groups'); // 35.5+ µg/m³, where the AQI line sits
  assert.equal(SCALES.aqi.hourBand(101), 'Unhealthy');
});

// Marks escalate by depth, not hue: every fill clears 3:1 on its track, and each worse band steps away
// from the last (darker in light mode, brighter in dark), so the order survives colour blindness and glare.
test('band marks form a lightness ramp', () => {
  const order = ['good', 'moderate', 'unhealthy', 'very_unhealthy', 'severe', 'hazardous'].map((k) => PALETTES.find((p) => p.key === k)!);
  for (const [key, track, step] of [['bar', '#DDE3E6', 1.3], ['darkBar', '#2A3136', 1.2]] as const) {
    order.forEach((b, i) => {
      assert.ok(contrast(b[key], track) >= 3, `${b.key} ${key} vs track`);
      if (i > 0) assert.ok(contrast(b[key], order[i - 1][key]) >= step, `${b.key} ${key} vs ${order[i - 1].key}`);
    });
  }
  // The map's numbers are set large (about 19px+ at 700), so 3:1 is the bar; the better ink must clear it on every fill.
  for (const b of order) for (const f of [b.bar, b.darkBar]) assert.ok(contrast(f, labelOn(f)) >= 3, `label on ${f}`);
});
test('sensitiveAction strips the group list', () => {
  assert.equal(sensitiveAction(psiBand(250)), 'stay indoors as much as you can.');
  assert.equal(sensitiveAction(psiBand(40)), '');
  assert.equal(sensitiveAction({ sensitive: 'If air pollution tends to bother you: keep it short.' }), 'If air pollution tends to bother you: keep it short.');
});
