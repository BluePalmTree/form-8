import { parseChoreography } from './model'
import type { Choreography } from './types'

export interface ChoreoSummary {
  id: string
  name: string
  updatedAt: number
}

/** Persistence boundary. */
export interface ChoreoStorage {
  list(): Promise<ChoreoSummary[]>
  load(id: string): Promise<Choreography | null>
  save(c: Choreography): Promise<void>
  remove(id: string): Promise<void>
}

const PREFIX = 'form8:choreo:'
const CURRENT = 'form8:current'

function read(id: string): Choreography | null {
  try {
    const raw = localStorage.getItem(PREFIX + id)
    if (!raw) return null
    const c = parseChoreography(JSON.parse(raw))
    return { ...c, id }
  } catch {
    return null
  }
}

/** Writes a choreography without marking it as the last opened one. */
export function writeLocal(c: Choreography) {
  localStorage.setItem(PREFIX + c.id, JSON.stringify(c))
}

export const localStorageBackend: ChoreoStorage = {
  async list() {
    const out: ChoreoSummary[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(PREFIX)) continue
      const c = read(key.slice(PREFIX.length))
      if (c) out.push({ id: c.id, name: c.name, updatedAt: c.updatedAt })
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt)
  },
  async load(id) {
    return read(id)
  },
  async save(c) {
    writeLocal(c)
    localStorage.setItem(CURRENT, c.id)
  },
  async remove(id) {
    localStorage.removeItem(PREFIX + id)
    if (localStorage.getItem(CURRENT) === id) localStorage.removeItem(CURRENT)
  },
}

/** Registered by sync.ts so that local writes are mirrored to the cloud. */
export const syncHooks: { onSave?: (c: Choreography) => void; onRemove?: (id: string) => void } = {}

/** Local-first: every write goes to localStorage, the cloud is updated in the background. */
export const storage: ChoreoStorage = {
  ...localStorageBackend,
  async save(c) {
    await localStorageBackend.save(c)
    syncHooks.onSave?.(c)
  },
  async remove(id) {
    await localStorageBackend.remove(id)
    syncHooks.onRemove?.(id)
  },
}

export const lastOpenedId = () => localStorage.getItem(CURRENT)
