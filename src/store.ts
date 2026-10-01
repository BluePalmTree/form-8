import { produce } from 'immer'
import { create } from 'zustand'
import {
  OBJECT_COLOR,
  clampObjectState,
  clampPoint,
  createChoreography,
  createDancers,
  defaultObjectState,
  freeSpot,
  uid,
} from './model'
import type { Choreography, Dancer, Formation, ObjectState, PathStyle, Point, Stage, StageObject } from './types'

const HISTORY_LIMIT = 100

interface ChoreoState {
  choreo: Choreography
  past: Choreography[]
  future: Choreography[]

  /** Push the current state onto the undo stack (call once before a drag gesture). */
  checkpoint: () => void
  undo: () => void
  redo: () => void
  replace: (c: Choreography) => void

  setName: (name: string) => void
  setStage: (stage: Stage) => void
  setTempo: (tempo: number) => void
  setPathStyle: (index: number, style: PathStyle) => void
  /** Staggered start: the i-th id starts `start + i * gap` beats in and walks for `length` beats. */
  setTiming: (index: number, ids: string[], start: number, length: number, gap: number) => void
  clearTiming: (index: number, ids: string[]) => void
  addDancers: (n: number) => void
  addObject: () => string
  removeObject: (id: string) => void
  updateObject: (id: string, patch: Partial<Omit<StageObject, 'id'>>) => void
  /** Change the placement of an object in one formation. */
  setObjectState: (index: number, id: string, patch: Partial<ObjectState>, record?: boolean) => void
  removeDancer: (id: string) => void
  updateDancer: (id: string, patch: Partial<Omit<Dancer, 'id'>>) => void
  duplicateFormation: (index: number) => void
  removeFormation: (index: number) => void
  moveFormation: (index: number, dir: -1 | 1) => void
  /** Begin a new part at this formation. */
  startPartAt: (index: number) => void
  /** Remove the part boundary in front of this formation. */
  mergePartWithPrevious: (index: number) => void
  renamePart: (index: number, name: string) => void
  updateFormation: (index: number, patch: Partial<Pick<Formation, 'name' | 'note' | 'duration' | 'hold'>>) => void
  setPositions: (index: number, positions: Record<string, Point>, record?: boolean) => void
  setControl: (index: number, id: string, c: Point | null, record?: boolean) => void
}

let lastTyping = { key: '', at: 0 }

/** Typing in a text field should be one undo step, not one per keystroke. */
function isTypingBurst(key: string): boolean {
  const now = Date.now()
  const burst = lastTyping.key === key && now - lastTyping.at < 1500
  lastTyping = { key, at: now }
  return burst
}

export const useChoreo = create<ChoreoState>((set) => {
  const mutate = (fn: (d: Choreography) => void, record = true) =>
    set((s) => {
      const next = produce(s.choreo, (d) => {
        fn(d)
        d.updatedAt = Date.now()
      })
      return record
        ? { choreo: next, past: [...s.past.slice(-(HISTORY_LIMIT - 1)), s.choreo], future: [] }
        : { choreo: next }
    })

  return {
    choreo: createChoreography(''),
    past: [],
    future: [],

    checkpoint: () => set((s) => ({ past: [...s.past.slice(-(HISTORY_LIMIT - 1)), s.choreo], future: [] })),
    undo: () =>
      set((s) =>
        s.past.length
          ? { choreo: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.choreo, ...s.future] }
          : s,
      ),
    redo: () =>
      set((s) =>
        s.future.length
          ? { choreo: s.future[0], past: [...s.past, s.choreo], future: s.future.slice(1) }
          : s,
      ),
    replace: (c) => set({ choreo: c, past: [], future: [] }),

    setName: (name) => mutate((d) => void (d.name = name), !isTypingBurst('choreo-name')),

    setStage: (stage) =>
      mutate((d) => {
        d.stage = stage
        for (const f of d.formations) {
          for (const id of Object.keys(f.positions)) f.positions[id] = clampPoint(f.positions[id], stage)
          for (const id of Object.keys(f.objectStates)) f.objectStates[id] = clampObjectState(f.objectStates[id], stage)
          f.controls = {}
        }
      }),

    setTempo: (tempo) => mutate((d) => void (d.tempo = tempo)),

    // Changing the general path style discards manual curves of that transition.
    setPathStyle: (index, style) =>
      mutate((d) => {
        d.formations[index].pathStyle = style
        d.formations[index].controls = {}
      }),

    setTiming: (index, ids, start, length, gap) =>
      mutate((d) => {
        const f = d.formations[index]
        if (!f) return
        ids.forEach((id, i) => {
          if (f.positions[id]) f.timing[id] = { delay: start + i * gap, length }
        })
      }),

    clearTiming: (index, ids) =>
      mutate((d) => {
        for (const id of ids) delete d.formations[index]?.timing[id]
      }),

    addObject: () => {
      const id = uid()
      mutate((d) => {
        d.objects.push({ id, name: '', color: OBJECT_COLOR })
        for (const f of d.formations) f.objectStates[id] = defaultObjectState(d.stage)
      })
      return id
    },

    removeObject: (id) =>
      mutate((d) => {
        d.objects = d.objects.filter((o) => o.id !== id)
        for (const f of d.formations) delete f.objectStates[id]
      }),

    updateObject: (id, patch) =>
      mutate((d) => {
        const o = d.objects.find((x) => x.id === id)
        if (o) Object.assign(o, patch)
      }, !('name' in patch && isTypingBurst(`object-${id}`))),

    setObjectState: (index, id, patch, record = true) =>
      mutate((d) => {
        const f = d.formations[index]
        const s = f?.objectStates[id]
        if (s) f.objectStates[id] = clampObjectState({ ...s, ...patch }, d.stage)
      }, record),

    addDancers: (n) =>
      mutate((d) => {
        const added = createDancers(n, d.dancers.length)
        d.dancers.push(...added)
        for (const f of d.formations) {
          const taken = Object.values(f.positions)
          for (const dancer of added) {
            const p = freeSpot(d.stage, taken)
            taken.push(p)
            f.positions[dancer.id] = p
          }
        }
      }),

    removeDancer: (id) =>
      mutate((d) => {
        if (d.dancers.length <= 1) return
        d.dancers = d.dancers.filter((x) => x.id !== id)
        for (const f of d.formations) {
          delete f.positions[id]
          delete f.controls[id]
          delete f.timing[id]
        }
      }),

    updateDancer: (id, patch) =>
      mutate((d) => {
        const dancer = d.dancers.find((x) => x.id === id)
        if (dancer) Object.assign(dancer, patch)
      }, !('name' in patch && isTypingBurst(`dancer-${id}`))),

    duplicateFormation: (index) =>
      mutate((d) => {
        const src = d.formations[index]
        d.formations.splice(index + 1, 0, {
          id: uid(),
          name: '',
          note: '',
          part: null,
          duration: src.duration,
          hold: src.hold,
          pathStyle: src.pathStyle,
          positions: { ...src.positions },
          objectStates: { ...src.objectStates },
          timing: {},
          controls: {},
        })
      }),

    removeFormation: (index) =>
      mutate((d) => {
        if (d.formations.length <= 1) return
        const [removed] = d.formations.splice(index, 1)
        const next = d.formations[index]
        if (next) {
          // The path into the formation that followed no longer matches its predecessor.
          next.controls = {}
          // A part must not vanish with its first formation.
          if (removed.part !== null && next.part === null) next.part = removed.part
        }
      }),

    moveFormation: (index, dir) =>
      mutate((d) => {
        const target = index + dir
        if (target < 0 || target >= d.formations.length) return
        // Part boundaries stay where they are; the formation moves between parts.
        const parts = d.formations.map((x) => x.part)
        const [f] = d.formations.splice(index, 1)
        d.formations.splice(target, 0, f)
        d.formations.forEach((x, i) => void (x.part = parts[i]))
        for (let i = Math.min(index, target); i <= Math.min(Math.max(index, target) + 1, d.formations.length - 1); i++) {
          d.formations[i].controls = {}
        }
      }),

    startPartAt: (index) =>
      mutate((d) => {
        const f = d.formations[index]
        if (f && index > 0 && f.part === null) f.part = ''
      }),

    mergePartWithPrevious: (index) =>
      mutate((d) => {
        const f = d.formations[index]
        if (f && index > 0) f.part = null
      }),

    renamePart: (index, name) =>
      mutate((d) => {
        const f = d.formations[index]
        if (f && (index === 0 || f.part !== null)) f.part = name
      }, !isTypingBurst(`part-${index}`)),

    updateFormation: (index, patch) =>
      mutate((d) => {
        Object.assign(d.formations[index], patch)
      }, !(('name' in patch || 'note' in patch) && isTypingBurst(`formation-${index}-${Object.keys(patch)[0]}`))),

    setPositions: (index, positions, record = true) =>
      mutate((d) => {
        const f = d.formations[index]
        if (!f) return
        for (const [id, p] of Object.entries(positions)) {
          if (f.positions[id]) f.positions[id] = clampPoint(p, d.stage)
        }
      }, record),

    setControl: (index, id, c, record = true) =>
      mutate((d) => {
        const f = d.formations[index]
        if (!f) return
        if (c) f.controls[id] = c
        else delete f.controls[id]
      }, record),
  }
})

interface UiState {
  index: number
  selectedIds: string[]
  /** Tap mode for touch screens: taps add or remove dancers instead of replacing the selection. */
  multiSelect: boolean
  /** Dancer whose path is selected; its curve handle is drawn on top. */
  selectedPathId: string | null
  /** Selected stage object (edited in the objects panel). */
  selectedObjectId: string | null
  showPaths: boolean
  /** Grid snap in meters; 0 = off. */
  snap: number
  playing: boolean
  time: number
  /** Part shown and played (index into partRanges); null = the whole dance. */
  viewPart: number | null
  setViewPart: (p: number | null) => void
  setIndex: (i: number) => void
  setSelection: (ids: string[]) => void
  setMultiSelect: (v: boolean) => void
  selectPath: (id: string | null) => void
  selectObject: (id: string | null) => void
  toggleSelect: (id: string) => void
  setShowPaths: (v: boolean) => void
  setSnap: (v: number) => void
  /** Start playback at the given beat. */
  play: (startBeat: number) => void
  stop: () => void
  setTime: (t: number) => void
}

export const useUi = create<UiState>((set) => ({
  index: 0,
  selectedIds: [],
  multiSelect: false,
  selectedPathId: null,
  selectedObjectId: null,
  showPaths: true,
  snap: 0.5,
  playing: false,
  time: 0,
  viewPart: null,
  setViewPart: (viewPart) => set({ viewPart, selectedPathId: null }),
  setIndex: (index) => set({ index, selectedPathId: null }),
  setSelection: (selectedIds) => set({ selectedIds, selectedPathId: null, selectedObjectId: null }),
  selectObject: (selectedObjectId) => set({ selectedObjectId }),
  selectPath: (selectedPathId) => set({ selectedPathId }),
  setMultiSelect: (multiSelect) => set({ multiSelect }),
  toggleSelect: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id) ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id],
    })),
  setShowPaths: (showPaths) => set({ showPaths }),
  setSnap: (snap) => set({ snap }),
  play: (startBeat) => set({ playing: true, time: startBeat }),
  stop: () => set({ playing: false }),
  setTime: (time) => set({ time }),
}))
