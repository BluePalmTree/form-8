import { describe, expect, it } from 'vitest'
import {
  controlFromHandle,
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
    positions: { [a.id]: { x: 8, y: 2 }, [b.id]: c.formations[0].positions[b.id] },
    controls: {},
  })
  const start = c.formations[0].positions[a.id]

  it('sums hold and transition times', () => {
    expect(totalDuration(c)).toBe(1 + 2 + 1)
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

  it('rejects garbage', () => {
    expect(() => parseChoreography({})).toThrow()
  })
})
