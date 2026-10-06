import { test } from 'node:test'; import assert from 'node:assert/strict';
import { verdict, bandPosition, dominantPollutant } from './verdict.ts';

test('verdict boundaries', () => {
  const clear = ['Clear skies.', 'A good day to be outside.'];
  const little = ['A little hazy.', 'Fine for a run.'];
  const hazyRun = ['Hazy.', 'Skip the long run today.'];
  const hazyLight = ['Hazy.', 'Keep outdoor exercise light.'];
  const very = ['Very hazy.', 'Avoid exercising outdoors.'];
  const haz = ['Hazardous.', 'Stay indoors as much as you can.'];
  const cases: [number, string[]][] = [
    [0, clear], [50, clear], [51, little], [100, little], [101, hazyRun], [150, hazyRun],
    [151, hazyLight], [200, hazyLight], [201, very], [300, very], [301, haz], [999, haz],
  ];
  for (const [v, want] of cases) assert.deepEqual(verdict(v), want, `psi ${v}`);
});

test('bandPosition thirds', () => {
  const cases: [number, string][] = [
    [0, 'low end'], [16, 'low end'], [17, 'middle'], [34, 'high end'], [50, 'high end'],
    [51, 'low end'], [100, 'high end'],
    [101, 'low end'], [133, 'low end'], [134, 'middle'], [166, 'middle'], [167, 'high end'], [200, 'high end'],
    [201, 'low end'], [300, 'high end'],
    [301, 'low end'], [350, 'middle'], [400, 'high end'], [999, 'high end'],
  ];
  for (const [v, want] of cases) assert.equal(bandPosition(v), want, `psi ${v}`);
});

test('bandPosition with AQI edges', () => {
  const edges = [50, 100, 150, 200, 300, 400];
  const cases: [number, string][] = [
    [101, 'low end'], [117, 'low end'], [118, 'middle'], [133, 'middle'], [134, 'high end'], [150, 'high end'], [151, 'low end'], [200, 'high end'], [201, 'low end'], [999, 'high end'],
  ];
  for (const [v, want] of cases) assert.equal(bandPosition(v, edges), want, `aqi ${v}`);
});

test('dominantPollutant', () => {
  assert.equal(dominantPollutant({ pm25_sub_index: 80, pm10_sub_index: 40, o3_sub_index: 20, psi_twenty_four_hourly: 99 }), 'pm25');
  assert.equal(dominantPollutant({ pm25_sub_index: 30, o3_sub_index: 55, co_sub_index: 10 }), 'o3');
  assert.equal(dominantPollutant({ so2_sub_index: 40, co_sub_index: 40, pm10_sub_index: 40 }), 'pm10'); // tie: first in order
  assert.equal(dominantPollutant({ so2_sub_index: 7, co_sub_index: 7 }), 'co');
  assert.equal(dominantPollutant({}), null);
  assert.equal(dominantPollutant({ pm25_one_hourly: 50 }), null);
});
