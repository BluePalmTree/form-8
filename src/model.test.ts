import { describe, expect, it } from 'vitest'
import {
  arrivalTime,
  controlFor,
  controlFromHandle,
  dancerLabel,
  createChoreography,
  defaultSpots,
  handlePos,
  parseChoreography,
  pointAt,
  stateAt,
  totalDuration,
} from './model'

describe('paths', () => {
  const p0 = { x: 0, y: 0 }
  const p1 = { x: 4, y: 0 }

  it('is linear without a control point', () => {
    expect(pointAt(p0, p1, undefined, 0.25)).toEqual({ x: 1, y: 0 })
  })

  it('curve passes through the handle derived from it', () => {
    const h = { x: 2, y: 3 }
    const c = controlFromHandle(p0, p1, h)
    const m = handlePos(p0, p1, c)
    expect(m.x).toBeCloseTo(h.x)
    expect(m.y).toBeCloseTo(h.y)
  })
})

describe('layout', () => {
  it('places 25 dancers inside the stage', () => {
    const stage = { width: 12, depth: 8 }
    const spots = defaultSpots(25, stage)
    expect(spots).toHaveLength(25)
    for (const s of spots) {
      expect(s.x).toBeGreaterThan(0)
      expect(s.x).toBeLessThan(stage.width)
      expect(s.y).toBeGreaterThan(0)
      expect(s.y).toBeLessThan(stage.depth)
    }
  })
})

describe('playback', () => {
  const c = createChoreography('t', 2)
  const [a, b] = c.dancers
  c.formations.push({
    id: 'f2',
    name: '',
    duration: 2,
    hold: 1,
    pathStyle: 'straight',
    positions: { [a.id]: { x: 8, y: 2 }, [b.id]: c.formations[0].positions[b.id] },
    controls: {},
  })
  c.formations[0].hold = 1
  const start = c.formations[0].positions[a.id]

  it('sums hold and transition times', () => {
    expect(totalDuration(c)).toBe(1 + 2 + 1)
  })

  it('computes the beat at which each formation is reached', () => {
    expect(arrivalTime(c, 0)).toBe(0)
    expect(arrivalTime(c, 1)).toBe(1 + 2)
  })

  it('holds, moves, and ends in the last formation', () => {
    expect(stateAt(c, 0.5)).toMatchObject({ index: 0 })
    const mid = stateAt(c, 2)
    expect(mid.index).toBe(1)
    expect(mid.positions[a.id].x).toBeCloseTo((start.x + 8) / 2)
    expect(stateAt(c, 99).positions[a.id]).toEqual({ x: 8, y: 2 })
  })
})

describe('import', () => {
  it('round-trips and fills missing positions', () => {
    const c = createChoreography('x', 3)
    const parsed = parseChoreography(JSON.parse(JSON.stringify(c)))
    expect(parsed.dancers).toHaveLength(3)
    delete (c.formations[0].positions as Record<string, unknown>)[c.dancers[0].id]
    const fixed = parseChoreography(JSON.parse(JSON.stringify(c)))
    expect(fixed.formations[0].positions[c.dancers[0].id]).toBeDefined()
  })

  it('rounds beat counts to whole numbers', () => {
    const c = createChoreography('x', 2)
    c.formations[0].duration = 2.5
    c.formations[0].hold = 1.4
    const parsed = parseChoreography(JSON.parse(JSON.stringify(c)))
    expect(parsed.formations[0].duration).toBe(3)
    expect(parsed.formations[0].hold).toBe(1)
  })

  it('rejects garbage', () => {
    expect(() => parseChoreography({})).toThrow()
  })
})

describe('dancerLabel', () => {
  it('uses the number without a name', () => {
    expect(dancerLabel('', 4)).toBe('5')
    expect(dancerLabel('   ', 0)).toBe('1')
  })
  it('uses one initial for a single name', () => {
    expect(dancerLabel('anna', 0)).toBe('A')
  })
  it('uses two initials for first and last name', () => {
    expect(dancerLabel('Anna  Müller', 0)).toBe('AM')
    expect(dancerLabel('Anna Maria Müller', 0)).toBe('AM')
  })
})

describe('path style', () => {
  // Dancer A moves from the left of the center dancer to the top of it.
  const make = (style: 'straight' | 'out' | 'in') => {
    const c = createChoreography('t', 3)
    const [a, b, center] = c.dancers
    const f0 = c.formations[0]
    f0.positions = { [a.id]: { x: 7, y: 3 }, [b.id]: { x: 9, y: 3 }, [center.id]: { x: 8, y: 3 } }
    c.formations.push({
      ...f0,
      id: 'f1',
      pathStyle: style,
      positions: { [a.id]: { x: 8, y: 2 }, [b.id]: { x: 8, y: 4 }, [center.id]: { x: 8, y: 3 } },
      controls: {},
    })
    return { c, a, center }
  }

  it('has no control point for straight paths or standing dancers', () => {
    const { c, a } = make('straight')
    expect(controlFor(c, 1, a.id)).toBeUndefined()
    const out = make('out')
    expect(controlFor(out.c, 1, out.center.id)).toBeUndefined()
  })

  it('bows away from or toward the group center', () => {
    const dist = (p: { x: number; y: number }) => Math.hypot(p.x - 8, p.y - 3)
    const out = make('out')
    const inn = make('in')
    const mid = (m: ReturnType<typeof make>) => handlePos(m.c.formations[0].positions[m.a.id], m.c.formations[1].positions[m.a.id], controlFor(m.c, 1, m.a.id))
    expect(dist(mid(out))).toBeGreaterThan(dist({ x: 7.5, y: 2.5 }))
    expect(dist(mid(inn))).toBeLessThan(dist({ x: 7.5, y: 2.5 }))
  })

  it('prefers a manual control point', () => {
    const { c, a } = make('out')
    c.formations[1].controls[a.id] = { x: 1, y: 1 }
    expect(controlFor(c, 1, a.id)).toEqual({ x: 1, y: 1 })
  })
})
