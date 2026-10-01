import { produce } from 'immer'
import { create } from 'zustand'
import { clampPoint, createChoreography, createDancers, freeSpot, uid } from './model'
import type { Choreography, Dancer, Formation, PathStyle, Point, Stage } from './types'

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
  addDancers: (n: number) => void
  removeDancer: (id: string) => void
  updateDancer: (id: string, patch: Partial<Omit<Dancer, 'id'>>) => void
  duplicateFormation: (index: number) => void
  removeFormation: (index: number) => void
  moveFormation: (index: number, dir: -1 | 1) => void
  updateFormation: (index: number, patch: Partial<Pick<Formation, 'name' | 'duration' | 'hold'>>) => void
  setPosition: (index: number, id: string, p: Point, record?: boolean) => void
  setControl: (index: number, id: string, c: Point | null, record?: boolean) => void
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

    setName: (name) => mutate((d) => void (d.name = name)),

    setStage: (stage) =>
      mutate((d) => {
        d.stage = stage
        for (const f of d.formations) {
          for (const id of Object.keys(f.positions)) f.positions[id] = clampPoint(f.positions[id], stage)
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
        }
      }),

    updateDancer: (id, patch) =>
      mutate((d) => {
        const dancer = d.dancers.find((x) => x.id === id)
        if (dancer) Object.assign(dancer, patch)
      }),

    duplicateFormation: (index) =>
      mutate((d) => {
        const src = d.formations[index]
        d.formations.splice(index + 1, 0, {
          id: uid(),
          name: '',
          duration: src.duration,
          hold: src.hold,
          pathStyle: src.pathStyle,
          positions: { ...src.positions },
          controls: {},
        })
      }),

    removeFormation: (index) =>
      mutate((d) => {
        if (d.formations.length <= 1) return
        d.formations.splice(index, 1)
        // The path into the formation that followed no longer matches its predecessor.
        if (d.formations[index]) d.formations[index].controls = {}
      }),

    moveFormation: (index, dir) =>
      mutate((d) => {
        const target = index + dir
        if (target < 0 || target >= d.formations.length) return
        const [f] = d.formations.splice(index, 1)
        d.formations.splice(target, 0, f)
        for (let i = Math.min(index, target); i <= Math.min(Math.max(index, target) + 1, d.formations.length - 1); i++) {
          d.formations[i].controls = {}
        }
      }),

    updateFormation: (index, patch) =>
      mutate((d) => {
        Object.assign(d.formations[index], patch)
      }),

    setPosition: (index, id, p, record = true) =>
      mutate((d) => {
        const f = d.formations[index]
        if (f?.positions[id]) f.positions[id] = clampPoint(p, d.stage)
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
  selectedId: string | null
  showPaths: boolean
  /** Grid snap in meters; 0 = off. */
  snap: number
  playing: boolean
  time: number
  setIndex: (i: number) => void
  select: (id: string | null) => void
  setShowPaths: (v: boolean) => void
  setSnap: (v: number) => void
  play: () => void
  stop: () => void
  setTime: (t: number) => void
}

export const useUi = create<UiState>((set) => ({
  index: 0,
  selectedId: null,
  showPaths: true,
  snap: 0.5,
  playing: false,
  time: 0,
  setIndex: (index) => set({ index }),
  select: (selectedId) => set({ selectedId }),
  setShowPaths: (showPaths) => set({ showPaths }),
  setSnap: (snap) => set({ snap }),
  play: () => set({ playing: true, time: 0 }),
  stop: () => set({ playing: false }),
  setTime: (time) => set({ time }),
}))
