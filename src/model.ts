import type { Choreography, Dancer, Formation, PathStyle, Point, Stage } from './types'

/** Dancer radius in meters. */
export const DANCER_RADIUS = 0.32
export const MIN_STAGE = 4
export const MAX_STAGE = 60
export const MIN_TEMPO = 20
export const MAX_TEMPO = 300
export const DEFAULT_TEMPO = 120
/** How far a bowed path bulges, as a fraction of the path length. */
export const PATH_BULGE = 0.2

export const uid = () => Math.random().toString(36).slice(2, 10)

export function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100
  const lig = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sat * Math.min(lig, 1 - lig)
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const hex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`
}

/** Label inside the dancer circle: initials of the first two name parts, else the number. */
export function dancerLabel(name: string, index: number): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return String(index + 1)
  return parts
    .slice(0, 2)
    .map((p) => Array.from(p)[0].toUpperCase())
    .join('')
}

export const colorFor = (i: number) => hslToHex((i * 137.508) % 360, 65, 42)

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

export function clampPoint(p: Point, stage: Stage): Point {
  return {
    x: clamp(p.x, DANCER_RADIUS, stage.width - DANCER_RADIUS),
    y: clamp(p.y, DANCER_RADIUS, stage.depth - DANCER_RADIUS),
  }
}

export function snapPoint(p: Point, step: number): Point {
  if (step <= 0) return p
  return { x: Math.round(p.x / step) * step, y: Math.round(p.y / step) * step }
}

const round1 = (v: number) => Math.round(v * 10) / 10

/** Evenly spaced rows centered on the stage. */
export function defaultSpots(n: number, stage: Stage): Point[] {
  if (n === 0) return []
  const cols = Math.max(1, Math.ceil(Math.sqrt((n * stage.width) / stage.depth)))
  const rows = Math.ceil(n / cols)
  const sx = Math.min(1.5, (stage.width - 2) / Math.max(cols - 1, 1))
  const sy = Math.min(1.5, (stage.depth - 2) / Math.max(rows - 1, 1))
  const spots: Point[] = []
  for (let r = 0; r < rows; r++) {
    const inRow = Math.min(cols, n - r * cols)
    for (let c = 0; c < inRow; c++) {
      spots.push(
        clampPoint(
          {
            x: round1(stage.width / 2 + (c - (inRow - 1) / 2) * sx),
            y: round1(stage.depth / 2 + (r - (rows - 1) / 2) * sy),
          },
          stage,
        ),
      )
    }
  }
  return spots
}

/** First 1 m grid spot that is not too close to an existing dancer. */
export function freeSpot(stage: Stage, taken: Point[]): Point {
  for (let y = 1; y <= stage.depth - 1; y++) {
    for (let x = 1; x <= stage.width - 1; x++) {
      if (taken.every((t) => Math.hypot(t.x - x, t.y - y) >= 0.9)) return { x, y }
    }
  }
  return { x: stage.width / 2 + Math.random() - 0.5, y: stage.depth / 2 + Math.random() - 0.5 }
}

export function createDancers(n: number, offset = 0): Dancer[] {
  return Array.from({ length: n }, (_, i) => ({ id: uid(), name: '', color: colorFor(offset + i) }))
}

export function createChoreography(name: string, dancerCount = 8): Choreography {
  const stage: Stage = { width: 10, depth: 8 }
  const dancers = createDancers(dancerCount)
  const spots = defaultSpots(dancerCount, stage)
  const formation: Formation = {
    id: uid(),
    name: '',
    duration: 4,
    hold: 2,
    pathStyle: 'straight',
    positions: Object.fromEntries(dancers.map((d, i) => [d.id, spots[i]])),
    controls: {},
  }
  return { id: uid(), name, stage, tempo: DEFAULT_TEMPO, dancers, formations: [formation], updatedAt: Date.now() }
}

const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
})

/** Point on the path p0 → p1 (quadratic Bézier if a control point is given). */
export function pointAt(p0: Point, p1: Point, c: Point | undefined, t: number): Point {
  if (!c) return lerp(p0, p1, t)
  const u = 1 - t
  return {
    x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
    y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
  }
}

/** Where the drag handle of a path sits (its midpoint). */
export const handlePos = (p0: Point, p1: Point, c?: Point) => pointAt(p0, p1, c, 0.5)

/** Control point so that the curve passes through the handle at t = 0.5. */
export const controlFromHandle = (p0: Point, p1: Point, h: Point): Point => ({
  x: 2 * h.x - (p0.x + p1.x) / 2,
  y: 2 * h.y - (p0.y + p1.y) / 2,
})

export function pathD(p0: Point, p1: Point, c?: Point): string {
  const f = (v: number) => v.toFixed(3)
  return c
    ? `M ${f(p0.x)} ${f(p0.y)} Q ${f(c.x)} ${f(c.y)} ${f(p1.x)} ${f(p1.y)}`
    : `M ${f(p0.x)} ${f(p0.y)} L ${f(p1.x)} ${f(p1.y)}`
}

/** Unit direction in which the path arrives at p1. */
export function endDirection(p0: Point, p1: Point, c?: Point): Point {
  const from = c ?? p0
  const dx = p1.x - from.x
  const dy = p1.y - from.y
  const len = Math.hypot(dx, dy) || 1
  return { x: dx / len, y: dy / len }
}

/**
 * Control point of a dancer's path into formation `i`: the manual one if set, otherwise derived
 * from the formation's path style (bowed away from / toward the center of the group).
 */
export function controlFor(c: Choreography, i: number, id: string): Point | undefined {
  const f = c.formations[i]
  const manual = f.controls[id]
  if (manual || i === 0 || f.pathStyle === 'straight') return manual
  const prev = c.formations[i - 1]
  const p0 = prev.positions[id]
  const p1 = f.positions[id]
  if (!p0 || !p1) return undefined
  const chord = Math.hypot(p1.x - p0.x, p1.y - p0.y)
  if (chord < 0.05) return undefined
  const all = Object.values(prev.positions)
  const cx = all.reduce((s, p) => s + p.x, 0) / all.length
  const cy = all.reduce((s, p) => s + p.y, 0) / all.length
  const mx = (p0.x + p1.x) / 2
  const my = (p0.y + p1.y) / 2
  let dx = mx - cx
  let dy = my - cy
  let len = Math.hypot(dx, dy)
  if (len < 0.05) {
    // The path passes the center: bulge to the right of the travel direction instead.
    dx = -(p1.y - p0.y)
    dy = p1.x - p0.x
    len = chord
  }
  const k = ((f.pathStyle === 'out' ? 1 : -1) * PATH_BULGE * chord) / len
  return controlFromHandle(p0, p1, { x: mx + dx * k, y: my + dy * k })
}

export const ease = (t: number) => t * t * (3 - 2 * t)

export function totalDuration(c: Choreography): number {
  return c.formations.reduce((sum, f, i) => sum + f.hold + (i > 0 ? f.duration : 0), 0)
}

/** Beat at which formation `i` is reached (end of its transition). */
export function arrivalTime(c: Choreography, i: number): number {
  let t = 0
  for (let k = 0; k <= i; k++) {
    if (k > 0) t += c.formations[k].duration
    if (k < i) t += c.formations[k].hold
  }
  return t
}

/** Dancer positions and formation index (the target while moving) at a time in beats. */
export function stateAt(c: Choreography, time: number): { index: number; positions: Record<string, Point> } {
  const fs = c.formations
  let t = time
  if (t < fs[0].hold) return { index: 0, positions: fs[0].positions }
  t -= fs[0].hold
  for (let i = 1; i < fs.length; i++) {
    const f = fs[i]
    if (t < f.duration) {
      const e = ease(f.duration > 0 ? t / f.duration : 1)
      const positions: Record<string, Point> = {}
      for (const d of c.dancers) {
        const p0 = fs[i - 1].positions[d.id]
        const p1 = f.positions[d.id]
        positions[d.id] = pointAt(p0, p1, controlFor(c, i, d.id), e)
      }
      return { index: i, positions }
    }
    t -= f.duration
    if (t < f.hold) return { index: i, positions: f.positions }
    t -= f.hold
  }
  const last = fs.length - 1
  return { index: last, positions: fs[last].positions }
}

/** Validate and normalize imported JSON; throws if it is not a choreography. */
export function parseChoreography(data: unknown): Choreography {
  const d = data as Partial<Choreography> | null
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
  if (
    !d ||
    typeof d !== 'object' ||
    !d.stage ||
    !Array.isArray(d.dancers) ||
    !Array.isArray(d.formations) ||
    d.formations.length === 0
  ) {
    throw new Error('invalid choreography')
  }
  const stage: Stage = {
    width: clamp(num(d.stage.width, 10), MIN_STAGE, MAX_STAGE),
    depth: clamp(num(d.stage.depth, 8), MIN_STAGE, MAX_STAGE),
  }
  const dancers: Dancer[] = d.dancers.map((x, i) => ({
    id: String(x?.id ?? uid()),
    name: String(x?.name ?? ''),
    color: typeof x?.color === 'string' ? x.color : colorFor(i),
  }))
  const formations: Formation[] = d.formations.map((f) => {
    const positions: Record<string, Point> = {}
    const controls: Record<string, Point> = {}
    for (const dancer of dancers) {
      const p = f?.positions?.[dancer.id]
      positions[dancer.id] =
        p && Number.isFinite(p.x) && Number.isFinite(p.y)
          ? clampPoint(p, stage)
          : freeSpot(stage, Object.values(positions))
      const c = f?.controls?.[dancer.id]
      if (c && Number.isFinite(c.x) && Number.isFinite(c.y)) controls[dancer.id] = c
    }
    return {
      id: String(f?.id ?? uid()),
      name: String(f?.name ?? ''),
      duration: Math.max(0, num(f?.duration, 4)),
      hold: Math.max(0, num(f?.hold, 0)),
      pathStyle: (['straight', 'out', 'in'] as PathStyle[]).includes(f?.pathStyle as PathStyle)
        ? (f.pathStyle as PathStyle)
        : 'straight',
      positions,
      controls,
    }
  })
  return {
    id: uid(),
    name: String(d.name ?? ''),
    stage,
    tempo: clamp(num(d.tempo, DEFAULT_TEMPO), MIN_TEMPO, MAX_TEMPO),
    dancers,
    formations,
    updatedAt: Date.now(),
  }
}
