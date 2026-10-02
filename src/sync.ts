import { create } from 'zustand'
import i18n from './i18n'
import { parseChoreography } from './model'
import { localStorageBackend, syncHooks, writeLocal } from './storage'
import { makeToken, shareUrl } from './share'
import { useChoreo } from './store'
import { supabase } from './supabase'
import type { Choreography } from './types'

/**
 * Cloud sync (Supabase). Local-first: localStorage stays the source the UI reads from.
 * The choreography's own `updatedAt` is the sync version; `form8:synced:<id>` remembers
 * the version both sides last agreed on, which is how conflicts are detected.
 */

export type SyncStatus = 'idle' | 'syncing' | 'pending' | 'error'

interface SyncState {
  enabled: boolean
  email: string | null
  status: SyncStatus
  conflicts: { id: string; name: string }[]
  /** Bumped whenever sync changed the local library, so lists can refresh. */
  rev: number
}

export const useSync = create<SyncState>(() => ({
  enabled: supabase !== null,
  email: null,
  status: 'idle',
  conflicts: [],
  rev: 0,
}))

const set = (p: Partial<SyncState>) => useSync.setState(p)

const PUSH_DELAY = 2000
const SYNCED = 'form8:synced:'
const DELETED = 'form8:deleted'
const UPLOAD_ASKED = 'form8:upload-asked:'

const getSynced = (id: string) => Number(localStorage.getItem(SYNCED + id) ?? 0)
const setSynced = (id: string, at: number) => localStorage.setItem(SYNCED + id, String(at))

const getDeleted = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(DELETED) ?? '[]') as string[]
  } catch {
    return []
  }
}
const setDeleted = (ids: string[]) => localStorage.setItem(DELETED, JSON.stringify(ids))

const table = () => supabase!.from('choreos')
const iso = (ms: number) => new Date(ms).toISOString()

let userId: string | null = null
const pending = new Map<string, Choreography>()
let timer: ReturnType<typeof setTimeout> | undefined

function addConflict(c: { id: string; name: string }) {
  const rest = useSync.getState().conflicts.filter((x) => x.id !== c.id)
  set({ conflicts: [...rest, c] })
}

async function upsert(c: Choreography) {
  const { error } = await table().upsert({
    id: c.id,
    user_id: userId,
    name: c.name,
    data: c,
    schema_version: 1,
    updated_at: iso(c.updatedAt),
  })
  if (error) throw error
  setSynced(c.id, c.updatedAt)
}

/** Pushes one choreography unless the cloud copy changed independently. Returns false on conflict. */
async function push(c: Choreography): Promise<boolean> {
  const { data, error } = await table().select('updated_at').eq('id', c.id).maybeSingle()
  if (error) throw error
  const cloudAt = data ? Date.parse(data.updated_at) : 0
  if (cloudAt === c.updatedAt) {
    setSynced(c.id, cloudAt)
    return true
  }
  if (cloudAt && cloudAt !== getSynced(c.id)) return false
  await upsert(c)
  return true
}

async function download(id: string, at: number): Promise<void> {
  const { data, error } = await table().select('data').eq('id', id).single()
  if (error) throw error
  const c = { ...parseChoreography(data.data), id, updatedAt: at }
  writeLocal(c)
  setSynced(id, at)
  const open = useChoreo.getState().choreo
  if (open.id === id) useChoreo.getState().replace(c)
}

async function flush() {
  if (!userId || pending.size === 0) return
  set({ status: 'syncing' })
  for (const [id, c] of [...pending]) {
    try {
      if (await push(c)) {
        if (pending.get(id) === c) pending.delete(id)
      } else {
        pending.delete(id)
        addConflict({ id, name: c.name })
      }
    } catch {
      set({ status: 'error' })
      return
    }
  }
  set({ status: pending.size ? 'pending' : 'idle' })
}

function schedulePush(c: Choreography) {
  if (!userId) return
  pending.set(c.id, c)
  set({ status: 'pending' })
  clearTimeout(timer)
  timer = setTimeout(() => void flush(), PUSH_DELAY)
}

async function removeRemote(id: string) {
  if (!userId) return
  try {
    const { error } = await table().delete().eq('id', id)
    if (error) throw error
    setDeleted(getDeleted().filter((x) => x !== id))
  } catch {
    set({ status: 'error' })
  }
}

/** Brings local and cloud copies together after login / app start / coming back online. */
export async function pull() {
  if (!userId) return
  set({ status: 'syncing' })
  try {
    // Deletions made while offline or logged out.
    for (const id of getDeleted()) await removeRemote(id)
    const { data: rows, error } = await table().select('id,name,updated_at')
    if (error) throw error
    const local = await localStorageBackend.list()
    const cloudIds = new Set(rows.map((r) => r.id))
    let changed = false

    for (const r of rows) {
      const at = Date.parse(r.updated_at)
      const l = local.find((x) => x.id === r.id)
      const synced = getSynced(r.id)
      if (!l) {
        await download(r.id, at)
        changed = true
      } else if (l.updatedAt === at) {
        setSynced(r.id, at)
      } else if (synced === l.updatedAt) {
        await download(r.id, at)
        changed = true
      } else if (synced === at) {
        const c = await localStorageBackend.load(r.id)
        if (c) pending.set(c.id, c)
      } else {
        addConflict({ id: r.id, name: l.name || r.name })
      }
    }

    const localOnly = local.filter((l) => !cloudIds.has(l.id) && !getDeleted().includes(l.id))
    if (localOnly.length) {
      const asked = localStorage.getItem(UPLOAD_ASKED + userId)
      const ok = asked || confirm(i18n.t('account.uploadLocal', { count: localOnly.length }))
      localStorage.setItem(UPLOAD_ASKED + userId, '1')
      if (ok) {
        for (const l of localOnly) {
          const c = await localStorageBackend.load(l.id)
          if (c) pending.set(c.id, c)
        }
      }
    }

    if (changed) set({ rev: useSync.getState().rev + 1 })
    set({ status: 'idle' })
    await flush()
  } catch {
    set({ status: 'error' })
  }
}

/** Resolves a conflict by keeping either the cloud or the local version. */
export async function resolveConflict(id: string, keep: 'cloud' | 'local') {
  try {
    if (keep === 'local') {
      const c = await localStorageBackend.load(id)
      if (c) await upsert(c)
    } else {
      const { data, error } = await table().select('updated_at').eq('id', id).single()
      if (error) throw error
      await download(id, Date.parse(data.updated_at))
    }
    set({ conflicts: useSync.getState().conflicts.filter((x) => x.id !== id), rev: useSync.getState().rev + 1 })
  } catch {
    set({ status: 'error' })
  }
}

/** Returns null on success, otherwise the error message from Supabase. */
export async function getShareLink(id: string): Promise<string | null> {
  const { data, error } = await table().select('share_token').eq('id', id).maybeSingle()
  if (error) throw error
  return data?.share_token ? shareUrl(data.share_token) : null
}

/** Creates (or returns the existing) read-only link; the choreography is uploaded first so the row exists. */
export async function createShareLink(c: Choreography): Promise<string> {
  const existing = await getShareLink(c.id).catch(() => null)
  if (existing) return existing
  if (!(await push(c))) throw new Error('conflict')
  const token = makeToken()
  const { error } = await table().update({ share_token: token }).eq('id', c.id)
  if (error) throw error
  return shareUrl(token)
}

export async function stopSharing(id: string) {
  const { error } = await table().update({ share_token: null }).eq('id', id)
  if (error) throw error
}

export async function signIn(email: string): Promise<string | null> {
  if (!supabase) return 'not configured'
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + location.pathname },
  })
  return error ? error.message : null
}

export async function signOut() {
  await supabase?.auth.signOut()
}

let started = false

/** Registers the storage hooks and starts listening to the auth session. Call once after the app loaded. */
export function initSync() {
  if (!supabase || started) return
  started = true
  syncHooks.onSave = schedulePush
  syncHooks.onRemove = (id) => {
    pending.delete(id)
    setDeleted([...new Set([...getDeleted(), id])])
    void removeRemote(id)
  }
  window.addEventListener('online', () => void pull())
  supabase.auth.onAuthStateChange((_event, session) => {
    const next = session?.user.id ?? null
    set({ email: session?.user.email ?? null })
    if (next === userId) return
    userId = next
    if (userId) void pull()
    else {
      pending.clear()
      set({ status: 'idle', conflicts: [] })
    }
  })
}
