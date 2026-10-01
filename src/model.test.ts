import { describe, expect, it } from 'vitest'
import {
  arrivalTime,
  PALETTE,
  clampObjectState,
  colorFor,
  hslToHex,
  isLight,
  lineColor,
  textOn,
  columnLabel,
  defaultObjectState,
  effectiveTiming,
  moveProgress,
  controlFor,
  controlFromHandle,
  dancerLabel,
  createChoreography,
  defaultSpots,
  handlePos,
  parseChoreography,
  partRanges,
  rangeBounds,
  pointAt,
  stateAt,
  totalDuration,
} from './model'
import { useChoreo } from './store'

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
    note: '',
    part: null,
    objectStates: {},
    duration: 2,
    hold: 1,
    pathStyle: 'straight',
    timing: {},
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

describe('formation notes', () => {
  it('round-trips and defaults to an empty note', () => {
    const c = createChoreography('x', 2)
    c.formations[0].note = 'Arme hoch auf 3'
    expect(parseChoreography(JSON.parse(JSON.stringify(c))).formations[0].note).toBe('Arme hoch auf 3')
    delete (c.formations[0] as { note?: string }).note
    expect(parseChoreography(JSON.parse(JSON.stringify(c))).formations[0].note).toBe('')
  })

  it('undoes a burst of typing in one step', () => {
    const st = useChoreo.getState()
    st.replace(createChoreography('x', 2))
    for (const text of ['A', 'Ar', 'Arm']) useChoreo.getState().updateFormation(0, { note: text })
    expect(useChoreo.getState().choreo.formations[0].note).toBe('Arm')
    useChoreo.getState().undo()
    expect(useChoreo.getState().choreo.formations[0].note).toBe('')
  })
})

describe('columnLabel', () => {
  it('counts like a chess board and then like a spreadsheet', () => {
    expect(columnLabel(0)).toBe('A')
    expect(columnLabel(7)).toBe('H')
    expect(columnLabel(25)).toBe('Z')
    expect(columnLabel(26)).toBe('AA')
    expect(columnLabel(60)).toBe('BI')
  })
})

describe('per-dancer timing', () => {
  const make = () => {
    const c = createChoreography('t', 2)
    const [a, b] = c.dancers
    const f0 = c.formations[0]
    f0.hold = 0
    c.formations.push({
      ...f0,
      id: 'f1',
      duration: 10,
      hold: 0,
      timing: { [b.id]: { delay: 4, length: 4 } },
      positions: { [a.id]: { x: f0.positions[a.id].x + 4, y: f0.positions[a.id].y }, [b.id]: { x: f0.positions[b.id].x + 4, y: f0.positions[b.id].y } },
      controls: {},
    })
    return { c, a, b }
  }

  it('defaults to moving the whole transition', () => {
    const { c, a } = make()
    expect(effectiveTiming(c.formations[1], a.id)).toEqual({ delay: 0, length: 10 })
  })

  it('clamps the walking time to the transition', () => {
    const { c, b } = make()
    c.formations[1].timing[b.id] = { delay: 8, length: 10 }
    expect(effectiveTiming(c.formations[1], b.id)).toEqual({ delay: 8, length: 2 })
  })

  it('keeps a delayed dancer in place, then walks, then waits', () => {
    const { c, a, b } = make()
    const f = c.formations[1]
    expect(moveProgress(f, b.id, 3)).toBe(0)
    expect(moveProgress(f, b.id, 6)).toBeCloseTo(0.5)
    expect(moveProgress(f, b.id, 9)).toBe(1)
    // The other dancer is unaffected and still moves from the start.
    expect(moveProgress(f, a.id, 5)).toBeCloseTo(0.5)
    const start = c.formations[0].positions[b.id]
    expect(stateAt(c, 3).positions[b.id]).toEqual(start)
    expect(stateAt(c, 6).positions[b.id].x).toBeCloseTo(start.x + 2)
  })
})

describe('stage objects', () => {
  it('are placed in every formation and can differ per formation', () => {
    useChoreo.getState().replace(createChoreography('x', 2))
    useChoreo.getState().duplicateFormation(0)
    const id = useChoreo.getState().addObject()
    useChoreo.getState().setObjectState(1, id, { x: 8, rotation: 90 })
    const [f0, f1] = useChoreo.getState().choreo.formations
    expect(f0.objectStates[id]).toEqual(defaultObjectState({ width: 10, depth: 8 }))
    expect(f1.objectStates[id]).toMatchObject({ x: 8, rotation: 90 })
  })

  it('are copied with a duplicated formation and removed everywhere', () => {
    useChoreo.getState().replace(createChoreography('x', 2))
    const id = useChoreo.getState().addObject()
    useChoreo.getState().setObjectState(0, id, { x: 3 })
    useChoreo.getState().duplicateFormation(0)
    expect(useChoreo.getState().choreo.formations[1].objectStates[id].x).toBe(3)
    useChoreo.getState().removeObject(id)
    expect(useChoreo.getState().choreo.objects).toHaveLength(0)
    expect(Object.keys(useChoreo.getState().choreo.formations[1].objectStates)).toHaveLength(0)
  })

  it('stay inside the stage', () => {
    expect(clampObjectState({ x: 99, y: -4, w: 0, h: 2, rotation: 0 }, { width: 10, depth: 8 })).toMatchObject({ x: 10, y: 0, w: 0.2 })
  })

  it('glide between formations during playback', () => {
    const c = createChoreography('x', 2)
    useChoreo.getState().replace(c)
    const id = useChoreo.getState().addObject()
    useChoreo.getState().duplicateFormation(0)
    useChoreo.getState().setObjectState(1, id, { x: 9, rotation: 90 })
    const cur = useChoreo.getState().choreo
    const mid = stateAt(cur, cur.formations[0].hold + cur.formations[1].duration / 2).objects[id]
    expect(mid.x).toBeCloseTo((5 + 9) / 2)
    expect(mid.rotation).toBeCloseTo(45)
  })

  it('load from older files without objects', () => {
    const c = createChoreography('x', 2)
    const raw = JSON.parse(JSON.stringify(c))
    delete raw.objects
    expect(parseChoreography(raw).objects).toEqual([])
  })
})

describe('dancer colors', () => {
  it('uses a fixed palette of 20 distinct colors for the first dancers', () => {
    expect(PALETTE).toHaveLength(20)
    expect(new Set(PALETTE).size).toBe(20)
    expect(colorFor(0)).toBe('#e6194b')
    expect(colorFor(19)).toBe(PALETTE[19])
    expect(colorFor(20)).not.toBe(colorFor(21))
  })

  it('picks readable text and darker lines for light colors', () => {
    expect(textOn('#e6194b')).toBe('#ffffff')
    expect(textOn('#ffe119')).toBe('#222222')
    expect(isLight('#ffe119')).toBe(true)
    expect(lineColor('#e6194b')).toBe('#e6194b')
    expect(lineColor('#ffe119')).not.toBe('#ffe119')
  })

  it('migrates automatic legacy colors but keeps custom ones', () => {
    const c = createChoreography('x', 3)
    c.dancers[0].color = hslToHex(0, 65, 42) // legacy color of dancer 0
    c.dancers[1].color = hslToHex((1 * 137.508) % 360, 65, 42) // legacy color of dancer 1
    c.dancers[2].color = '#123456' // chosen by the user
    const parsed = parseChoreography(JSON.parse(JSON.stringify(c)))
    expect(parsed.dancers.map((d) => d.color)).toEqual([colorFor(0), colorFor(1), '#123456'])
  })
})

describe('parts', () => {
  /** Four formations (hold 2, transitions 4): parts start at 0 and 2. */
  const make = () => {
    useChoreo.getState().replace(createChoreography('t', 2))
    for (let i = 0; i < 3; i++) useChoreo.getState().duplicateFormation(i)
    useChoreo.getState().startPartAt(2)
    useChoreo.getState().renamePart(0, 'Intro')
    useChoreo.getState().renamePart(2, 'Verse')
    return () => useChoreo.getState().choreo
  }

  it('derives ranges and playback windows', () => {
    const get = make()
    expect(partRanges(get())).toEqual([
      { name: 'Intro', from: 0, to: 1 },
      { name: 'Verse', from: 2, to: 3 },
    ])
    expect(rangeBounds(get(), null)).toMatchObject({ from: 0, to: 3, start: 0, end: totalDuration(get()) })
    expect(rangeBounds(get(), 0)).toMatchObject({ from: 0, to: 1, start: 0, end: 2 + 4 + 2 })
    expect(rangeBounds(get(), 1)).toMatchObject({ from: 2, to: 3, start: arrivalTime(get(), 2), end: totalDuration(get()) })
  })

  it('loads files without parts as a single part', () => {
    const old = JSON.parse(JSON.stringify(createChoreography('t', 2)))
    for (const f of old.formations) delete f.part
    old.formations.push({ ...old.formations[0], part: 42 })
    const c = parseChoreography(old)
    expect(partRanges(c)).toHaveLength(1)
    expect(c.formations[0].part).toBe('')
  })

  it('round-trips parts', () => {
    const get = make()
    expect(partRanges(parseChoreography(JSON.parse(JSON.stringify(get()))))).toEqual(partRanges(get()))
  })

  it('merges and undoes', () => {
    const get = make()
    useChoreo.getState().mergePartWithPrevious(2)
    expect(partRanges(get())).toHaveLength(1)
    useChoreo.getState().undo()
    expect(partRanges(get())).toHaveLength(2)
  })

  it('keeps a part when its first formation is removed', () => {
    const get = make()
    useChoreo.getState().removeFormation(2)
    expect(partRanges(get())).toEqual([
      { name: 'Intro', from: 0, to: 1 },
      { name: 'Verse', from: 2, to: 2 },
    ])
  })

  it('keeps boundaries in place when a formation moves across them', () => {
    const get = make()
    const id = get().formations[1].id
    useChoreo.getState().moveFormation(1, 1)
    expect(get().formations[2].id).toBe(id)
    expect(partRanges(get()).map((r) => [r.from, r.to])).toEqual([[0, 1], [2, 3]])
  })
})
