import test from 'node:test'
import assert from 'node:assert/strict'
import { area, centroid, clipCloserTo, contains, project, simplify, toPath, voronoiCells } from './geometry.ts'
import type { Pt } from './geometry.ts'

const sq = (n: number): Pt[] => [[0, 0], [n, 0], [n, n], [0, n]]

test('area of a 10×10 square is 100', () => {
  assert.equal(area(sq(10)), 100)
})

test('contains: centre in, outside point out', () => {
  assert.equal(contains(sq(10), [5, 5]), true)
  assert.equal(contains(sq(10), [15, 5]), false)
})

test('centroid of a square is its centre', () => {
  assert.deepEqual(centroid(sq(10)), [5, 5])
})

test('simplify drops collinear points', () => {
  const ring: Pt[] = [[0, 0], [5, 0], [10, 0], [10, 5], [10, 10], [5, 10], [0, 10], [0, 5]]
  assert.equal(simplify(ring, 0.1).length, 4)
})

test('clipCloserTo halves a square', () => {
  const out = clipCloserTo(sq(10), [2, 5], [8, 5])
  assert.ok(Math.abs(area(out) - 50) < 1e-9)
  assert.ok(out.every(([x]) => x <= 5 + 1e-9))
})

test('voronoi cells partition the polygon', () => {
  const sites: Pt[] = [[20, 20], [80, 20], [50, 50], [20, 80], [80, 80]]
  const cells = voronoiCells(sites, sq(100))
  const total = cells.reduce((s, c) => s + area(c), 0)
  assert.ok(Math.abs(total - 10000) / 10000 < 1e-4)
  sites.forEach((s, i) => assert.ok(contains(cells[i], s)))
})

test('voronoi on a concave U: areas sum, each site in its own cell, bisector cuts both arms', () => {
  const u: Pt[] = [[0, 0], [30, 0], [30, 30], [20, 30], [20, 10], [10, 10], [10, 30], [0, 30]]
  // Left-arm site vs base site: their bisector crosses the left arm and the base.
  const sites: Pt[] = [[5, 25], [25, 25], [8, 3], [27, 3]]
  const cells = voronoiCells(sites, u)
  assert.ok(Math.abs(area(u) - 700) < 1e-9)
  assert.ok(Math.abs(cells.reduce((s, c) => s + area(c), 0) - 700) < 1e-6)
  sites.forEach((s, i) => assert.ok(contains(cells[i], s)))
  assert.equal(contains(cells[0], [15, 20]), false) // the notch is outside every cell
  cells.forEach((c) => assert.equal(contains(c, [15, 20]), false))
})

test('toPath formats a triangle', () => {
  assert.equal(toPath([[0, 0], [1, 0], [0, 1]]), 'M0.0 0.0L1.0 0.0L0.0 1.0Z')
})

test('project puts east of west and north above south', () => {
  assert.ok(project(103.94, 1.35)[0] > project(103.7, 1.35)[0])
  assert.ok(project(103.8, 1.418)[1] < project(103.8, 1.296)[1])
})
