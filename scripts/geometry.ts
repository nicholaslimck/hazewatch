// Dependency-free polygon helpers for the one-off zone-generation script.
// Polygons are closed rings: the first point is not repeated at the end.
export type Pt = [number, number]

const COS_LAT = Math.cos((1.35 * Math.PI) / 180)

export function project(lon: number, lat: number): Pt {
  return [(lon - 103.6) * COS_LAT * 1000, (1.48 - lat) * 1000]
}

const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

function signedArea(poly: Pt[]): number {
  let s = 0
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length]
    s += p[0] * q[1] - q[0] * p[1]
  })
  return s / 2
}

export const area = (poly: Pt[]): number => Math.abs(signedArea(poly))

export function contains(poly: Pt[], [x, y]: Pt): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function centroid(poly: Pt[]): Pt {
  let cx = 0
  let cy = 0
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length]
    const w = p[0] * q[1] - q[0] * p[1]
    cx += (p[0] + q[0]) * w
    cy += (p[1] + q[1]) * w
  })
  const a6 = 6 * signedArea(poly)
  return [cx / a6, cy / a6]
}

function dp(pts: Pt[], tol: number): Pt[] {
  const a = pts[0]
  const b = pts[pts.length - 1]
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  let worst = 0
  let idx = -1
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(cross(a, b, pts[i])) / len
    if (d > worst) [worst, idx] = [d, i]
  }
  if (worst <= tol) return [a, b]
  return [...dp(pts.slice(0, idx + 1), tol).slice(0, -1), ...dp(pts.slice(idx), tol)]
}

export function simplify(poly: Pt[], tolerance: number): Pt[] {
  if (poly.length <= 3) return poly
  // Split the ring at point 0 and the point farthest from it, simplify each half.
  let far = 1
  let best = 0
  poly.forEach((p, i) => {
    const d = Math.hypot(p[0] - poly[0][0], p[1] - poly[0][1])
    if (d > best) [best, far] = [d, i]
  })
  const out = [...dp(poly.slice(0, far + 1), tolerance).slice(0, -1), ...dp([...poly.slice(far), poly[0]], tolerance).slice(0, -1)]
  return out.length >= 3 ? out : [poly[0], poly[far], poly[Math.floor((far + poly.length) / 2)]]
}

export function clipCloserTo(poly: Pt[], a: Pt, b: Pt): Pt[] {
  // f > 0 means closer to a; f is linear in p, so edges cross it exactly once.
  const f = (p: Pt) => (p[0] - b[0]) ** 2 + (p[1] - b[1]) ** 2 - ((p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2)
  const out: Pt[] = []
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length]
    const fp = f(p)
    const fq = f(q)
    if (fp >= 0) out.push(p)
    if (fp >= 0 !== fq >= 0) {
      const t = fp / (fp - fq)
      out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])])
    }
  })
  return out
}

export function voronoiCells(sites: Pt[], poly: Pt[]): Pt[][] {
  return sites.map((s, i) => sites.reduce((cell, o, j) => (j === i ? cell : clipCloserTo(cell, s, o)), poly))
}

export const toPath = (poly: Pt[]): string =>
  'M' + poly.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + 'Z'
