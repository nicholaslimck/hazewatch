import { test } from 'node:test'; import assert from 'node:assert/strict';
import { pm25ToAqi, nowcast, aqiBand, aqiVerdict } from './aqi.ts';

test('pm25ToAqi at every 2024 EPA breakpoint edge', () => {
  const cases: [number, number][] = [
    [0, 0], [9.0, 50], [9.1, 51], [35.4, 100], [35.5, 101], [55.4, 150], [55.5, 151],
    [125.4, 200], [125.5, 201], [225.4, 300], [225.5, 301], [325.4, 500], [425.4, 699], // above 500 keeps the same slope (EPA FAQ)
  ];
  for (const [c, want] of cases) assert.equal(pm25ToAqi(c), want, `${c} µg/m³`);
});

test('pm25ToAqi truncates to 0.1 before converting, like EPA', () => {
  assert.equal(pm25ToAqi(9.09), 50); // truncates to 9.0, so still Good
  assert.equal(pm25ToAqi(28.409801), 87); // EPA worked example
});

test('nowcast matches the EPA worked example', () => {
  // Newest hour first; the second hour is missing.
  const hours = [21, undefined, 35, 49.2, 48.6, 53.7, 66.2, 69.2, 64.9, 50, 43, 34.9];
  assert.ok(Math.abs(nowcast(hours)! - 28.409801) < 1e-5);
});

test('nowcast: steady air approaches a 12h mean, a spike leans on recent hours', () => {
  assert.equal(nowcast(Array(12).fill(20)), 20);
  const spike = nowcast([100, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10])!; // weight floors at 0.5
  assert.ok(spike > 50 && spike < 60, String(spike)); // a flat 12h mean would be 17.5
});

test('nowcast needs 2 of the last 3 hours', () => {
  assert.equal(nowcast([undefined, undefined, 30, 30, 30]), null);
  assert.equal(nowcast([undefined, 30, undefined, 30]), null);
  assert.equal(nowcast([30, undefined, undefined, 30]), null); // only 1 of the last 3
  assert.equal(nowcast([30, undefined, 30, 30]), 30);
  assert.equal(nowcast([]), null);
});

test('nowcast of all zeros is 0, not NaN', () => {
  assert.equal(nowcast([0, 0, 0]), 0);
});

test('aqi bands and sky colour keys', () => {
  const cases: [number, string, string][] = [
    [0, 'Good', 'good'], [50, 'Good', 'good'], [51, 'Moderate', 'moderate'], [100, 'Moderate', 'moderate'],
    [101, 'Unhealthy for sensitive groups', 'unhealthy'], [150, 'Unhealthy for sensitive groups', 'unhealthy'],
    [151, 'Unhealthy', 'very_unhealthy'], [200, 'Unhealthy', 'very_unhealthy'],
    [201, 'Very unhealthy', 'severe'], [300, 'Very unhealthy', 'severe'], [301, 'Hazardous', 'hazardous'],
  ];
  for (const [v, label, key] of cases) assert.deepEqual([aqiBand(v).label, aqiBand(v).key], [label, key], `aqi ${v}`);
  // Six bands, six distinct sky colours in both themes.
  const bands = [25, 75, 125, 175, 250, 350].map(aqiBand);
  for (const f of ['color', 'darkColor', 'bar', 'darkBar'] as const) assert.equal(new Set(bands.map((b) => b[f])).size, 6, f);
});

test('aqi verdict boundaries', () => {
  const cases: [number, string][] = [
    [50, 'Clear skies.'], [51, 'A little hazy.'], [100, 'A little hazy.'], [101, 'Hazy.'], [150, 'Hazy.'],
    [151, 'Hazy.'], [200, 'Hazy.'], [201, 'Very hazy.'], [300, 'Very hazy.'], [301, 'Hazardous.'],
  ];
  for (const [v, line1] of cases) assert.equal(aqiVerdict(v)[0], line1, `aqi ${v}`);
  assert.notDeepEqual(aqiVerdict(120), aqiVerdict(180)); // sensitive-groups band reads differently from unhealthy
});
