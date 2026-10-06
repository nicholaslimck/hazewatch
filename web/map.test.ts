import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAP } from './map.ts'
import { area, contains, project } from '../scripts/geometry.ts'
import { REGIONS } from '../shared/types.ts'
import { REGION_CENTRES } from '../shared/regions.ts'

test('map has a zone and label for every region', () => {
  for (const r of REGIONS) {
    assert.ok(MAP.zones[r].startsWith('M'))
    assert.equal(MAP.labels[r].length, 2)
  }
})

test('each label sits inside its own zone', () => {
  for (const r of REGIONS) assert.ok(contains(MAP.zonePolys[r], MAP.labels[r]), r)
})

test('zones cover the outline', () => {
  const sum = REGIONS.reduce((s, r) => s + area(MAP.zonePolys[r]), 0)
  const total = area(MAP.outlinePoly)
  assert.ok(Math.abs(sum - total) / total < 0.005, `${sum} vs ${total}`)
})

test('each station is in its own zone', () => {
  for (const r of REGIONS) {
    const c = REGION_CENTRES[r]
    assert.ok(contains(MAP.zonePolys[r], project(c.lng, c.lat)), r)
  }
})
