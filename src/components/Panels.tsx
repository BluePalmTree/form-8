import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { exportJson, formationPng, pngFiles, shareOrDownload } from '../export'
import { MAX_STAGE, MAX_TEMPO, MIN_STAGE, MIN_TEMPO, textOn, arrivalTime, createChoreography, dancerLabel, effectiveTiming, parseChoreography, partOf, partRanges, rangeBounds } from '../model'
import type { ObjectState, PathStyle } from '../types'
import { storage } from '../storage'
import type { ChoreoSummary } from '../storage'
import { useChoreo, useUi } from '../store'
import { createShareLink, getShareLink, resolveConflict, signIn, signOut, stopSharing, useSync } from '../sync'
import { NumField } from './NumField'

export function useFormationName() {
  const { t } = useTranslation()
  return (name: string, i: number) => name || t('formation.default', { n: i + 1 })
}

export function PlaybackBar() {
  const { t } = useTranslation()
  const choreo = useChoreo((s) => s.choreo)
  const count = choreo.formations.length
  const { index, playing, showPaths, multiSelect, viewPart } = useUi()
  const ui = useUi.getState
  const { from, to } = rangeBounds(choreo, viewPart)
  // Play from the selected formation; from the beginning of the shown range if it is the last one (nothing left to play).
  const startBeat = () => {
    const { choreo } = useChoreo.getState()
    return index >= to ? rangeBounds(choreo, viewPart).start : arrivalTime(choreo, index)
  }
  const go = (i: number) => ui().setIndex(Math.max(from, Math.min(to, i)))
  return (
    <div className="bar">
      <button onClick={() => (playing ? ui().stop() : ui().play(startBeat()))} className="primary">
        {playing ? `■ ${t('play.pause')}` : `▶ ${t('play.play')}`}
      </button>
      <button disabled={playing || index <= from} onClick={() => go(index - 1)} aria-label={t('play.prev')} title={t('play.prev')}>
        ◀
      </button>
      <span className="counter">
        {index + 1} / {count}
      </span>
      <button disabled={playing || index >= to} onClick={() => go(index + 1)} aria-label={t('play.next')} title={t('play.next')}>
        ▶
      </button>
      <button
        className={multiSelect ? 'chip active' : 'chip'}
        aria-pressed={multiSelect}
        disabled={playing}
        onClick={() => ui().setMultiSelect(!multiSelect)}
      >
        {t('play.multiSelect')}
      </button>
      <label className="check">
        <input type="checkbox" checked={showPaths} onChange={(e) => ui().setShowPaths(e.target.checked)} />
        {t('stage.showPaths')}
      </label>
    </div>
  )
}

/** Progress through the planned beats: one segment per formation, plus a playhead. */
export function Timeline() {
  const { t } = useTranslation()
  const label = useFormationName()
  const choreo = useChoreo((s) => s.choreo)
  const index = useUi((s) => s.index)
  const playing = useUi((s) => s.playing)
  const time = useUi((s) => s.time)
  const viewPart = useUi((s) => s.viewPart)
  const { from, to, start, end } = rangeBounds(choreo, viewPart)
  const total = end - start
  const pos = Math.max(0, Math.min(playing ? time : arrivalTime(choreo, index), end) - start)
  const pct = total > 0 ? (pos / total) * 100 : 0
  // Whole beats only; the epsilon guards against float error at segment ends.
  const shown = Math.floor(pos + 1e-9)

  return (
    <div className="timeline-wrap">
      <div
        className="timeline"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={shown}
        aria-valuetext={t('formation.progress', { pos: shown, total })}
      >
        {choreo.formations.map((f, i) => {
          if (i < from || i > to) return null
          // The transition into a part's first formation lies before the window.
          const len = (i > from ? f.duration : 0) + f.hold
          return (
            <button
              key={f.id}
              className={i === index ? 'seg active' : 'seg'}
              style={{ flexGrow: len, flexBasis: 0 }}
              disabled={playing}
              title={label(f.name, i)}
              onClick={() => useUi.getState().setIndex(i)}
            >
              {i + 1}
            </button>
          )
        })}
        <div className="playhead" style={{ left: `${pct}%` }} />
      </div>
      <span className="hint">{t('formation.progress', { pos: shown, total })}</span>
    </div>
  )
}

/** Staggered starts for the selected dancers, in the order they were selected. */
function TimingSection({ index }: { index: number }) {
  const { t } = useTranslation()
  const choreo = useChoreo((s) => s.choreo)
  const selectedIds = useUi((s) => s.selectedIds)
  const f = choreo.formations[index]
  const ids = selectedIds.filter((id) => f.positions[id])
  const [start, setStart] = useState(0)
  const [length, setLength] = useState(f.duration)
  const [gap, setGap] = useState(0)
  const st = useChoreo.getState

  const needed = start + Math.max(ids.length - 1, 0) * gap + length
  const timed = choreo.dancers.map((d, i) => ({ d, i })).filter(({ d }) => f.timing[d.id])

  return (
    <div className="timing">
      <h3>{t('timing.title')}</h3>
      {ids.length === 0 ? (
        <p className="hint">{t('timing.hint')}</p>
      ) : (
        <>
          <div className="fields">
            <label>
              {t('timing.start')}
              <NumField value={start} min={0} max={256} integer onCommit={setStart} />
            </label>
            <label>
              {t('timing.length')}
              <NumField value={length} min={0} max={256} integer onCommit={setLength} />
            </label>
            <label>
              {t('timing.gap')}
              <NumField value={gap} min={0} max={256} integer onCommit={setGap} />
            </label>
          </div>
          <p className={needed > f.duration ? 'hint error' : 'hint'}>
            {t('timing.needed', { count: needed, duration: f.duration })}
          </p>
          <div className="row">
            <button className="primary" onClick={() => st().setTiming(index, ids, start, length, gap)}>
              {t('timing.apply', { count: ids.length })}
            </button>
            <button disabled={!ids.some((id) => f.timing[id])} onClick={() => st().clearTiming(index, ids)}>
              {t('timing.reset')}
            </button>
          </div>
        </>
      )}
      {timed.length > 0 && (
        <ul className="timed">
          {timed.map(({ d, i }) => {
            const e = effectiveTiming(f, d.id)
            return (
              <li key={d.id}>
                <span className="num" style={{ background: d.color, color: textOn(d.color) }}>
                  {dancerLabel(d.name, i)}
                </span>
                {t('timing.entry', { from: e.delay, to: e.delay + e.length })}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** Switch between the whole dance and its parts. */
export function PartChips() {
  const { t } = useTranslation()
  const choreo = useChoreo((s) => s.choreo)
  const playing = useUi((s) => s.playing)
  const viewPart = useUi((s) => s.viewPart)
  const ranges = partRanges(choreo)
  const select = (p: number | null) => {
    const ui = useUi.getState()
    ui.setViewPart(p)
    if (p !== null) ui.setIndex(ranges[p].from)
  }
  return (
    <div className="chips">
      <button className={viewPart === null ? 'chip active' : 'chip'} disabled={playing} onClick={() => select(null)}>
        {t('part.whole')}
      </button>
      {ranges.map((r, i) => (
        <button key={r.from} className={viewPart === i ? 'chip active' : 'chip'} disabled={playing} onClick={() => select(i)}>
          {r.name || t('part.default', { n: i + 1 })}
        </button>
      ))}
    </div>
  )
}

/** Split the dance into parts. */
function PartBar() {
  const { t } = useTranslation()
  const choreo = useChoreo((s) => s.choreo)
  const index = useUi((s) => s.index)
  const playing = useUi((s) => s.playing)
  const st = useChoreo.getState
  const ranges = partRanges(choreo)
  const name = (n: string, i: number) => n || t('part.default', { n: i + 1 })
  const current = partOf(choreo, index)
  const f = choreo.formations[index]
  const startsPart = index === 0 || f?.part !== null

  return (
    <div className="parts">
      <PartChips />
      <div className="fields">
        <label>
          {t('part.name')}
          <input
            value={ranges[current].name}
            placeholder={name('', current)}
            onChange={(e) => st().renamePart(ranges[current].from, e.target.value)}
          />
        </label>
        <div className="row">
          <button disabled={playing || startsPart} onClick={() => st().startPartAt(index)}>
            {t('part.start')}
          </button>
          <button disabled={playing || index === 0 || f?.part === null} onClick={() => st().mergePartWithPrevious(index)}>
            {t('part.merge')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function FormationBar() {
  const { t } = useTranslation()
  const label = useFormationName()
  const choreo = useChoreo((s) => s.choreo)
  const formations = choreo.formations
  const viewPart = useUi((s) => s.viewPart)
  const { from, to } = rangeBounds(choreo, viewPart)
  const tempo = useChoreo((s) => s.choreo.tempo)
  const st = useChoreo.getState
  const index = useUi((s) => s.index)
  const playing = useUi((s) => s.playing)
  const setIndex = useUi.getState().setIndex
  const f = formations[index]

  return (
    <section className="panel">
      <h2>{t('formation.title')}</h2>
      <PartBar />
      <Timeline />
      <div className="fields">
        <label>
          {t('formation.tempo')}
          <NumField value={tempo} min={MIN_TEMPO} max={MAX_TEMPO} step={1} onCommit={(v) => st().setTempo(v)} />
        </label>
      </div>
      <div className="chips">
        {formations.map((x, i) => i < from || i > to ? null : (
          <button
            key={x.id}
            className={i === index ? 'chip active' : 'chip'}
            disabled={playing}
            onClick={() => setIndex(i)}
            title={label(x.name, i)}
          >
            {i + 1}
          </button>
        ))}
        <button className="chip" disabled={playing} onClick={() => { st().duplicateFormation(index); setIndex(index + 1) }} title={t('formation.add')}>
          +
        </button>
      </div>
      {f && (
        <div className="fields">
          <label>
            {t('formation.name')}
            <input value={f.name} placeholder={label('', index)} onChange={(e) => st().updateFormation(index, { name: e.target.value })} />
          </label>
          <label>
            {t('formation.duration')}
            <NumField value={f.duration} min={0} max={256} integer disabled={index === 0} onCommit={(v) => st().updateFormation(index, { duration: v })} />
          </label>
          <label>
            {t('formation.pathStyle')}
            <select value={f.pathStyle} disabled={index === 0} onChange={(e) => st().setPathStyle(index, e.target.value as PathStyle)}>
              <option value="straight">{t('pathStyle.straight')}</option>
              <option value="out">{t('pathStyle.out')}</option>
              <option value="in">{t('pathStyle.in')}</option>
            </select>
          </label>
          <label>
            {t('formation.hold')}
            <NumField value={f.hold} min={0} max={256} integer onCommit={(v) => st().updateFormation(index, { hold: v })} />
          </label>
          {index > 0 && (
            <div className="wide">
              <TimingSection key={f.id} index={index} />
            </div>
          )}
          <label className="wide">
            {t('formation.note')}
            <textarea
              rows={3}
              value={f.note}
              placeholder={t('formation.notePlaceholder')}
              onChange={(e) => st().updateFormation(index, { note: e.target.value })}
            />
          </label>
          <div className="row">
            <button
              disabled={playing || index === 0 || Object.keys(f.controls).length === 0}
              onClick={() => st().setPathStyle(index, f.pathStyle)}
            >
              {t('formation.resetCurves')}
            </button>
            <button disabled={playing || index <= from} onClick={() => { st().moveFormation(index, -1); setIndex(index - 1) }}>
              ← {t('formation.left')}
            </button>
            <button disabled={playing || index >= to} onClick={() => { st().moveFormation(index, 1); setIndex(index + 1) }}>
              {t('formation.right')} →
            </button>
            <button
              className="danger"
              disabled={playing || formations.length <= 1}
              onClick={() => { st().removeFormation(index); setIndex(Math.max(0, index - 1)) }}
            >
              {t('formation.remove')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

export function StagePanel() {
  const { t } = useTranslation()
  const stage = useChoreo((s) => s.choreo.stage)
  const snap = useUi((s) => s.snap)
  return (
    <section className="panel">
      <h2>{t('stage.title')}</h2>
      <div className="fields two">
        <label>
          {t('stage.width')}
          <NumField value={stage.width} min={MIN_STAGE} max={MAX_STAGE} step={0.5} onCommit={(v) => useChoreo.getState().setStage({ ...stage, width: v })} />
        </label>
        <label>
          {t('stage.depth')}
          <NumField value={stage.depth} min={MIN_STAGE} max={MAX_STAGE} step={0.5} onCommit={(v) => useChoreo.getState().setStage({ ...stage, depth: v })} />
        </label>
        <label>
          {t('stage.snap')}
          <select value={snap} onChange={(e) => useUi.getState().setSnap(parseFloat(e.target.value))}>
            <option value={0}>{t('stage.snapOff')}</option>
            <option value={0.25}>0,25 m</option>
            <option value={0.5}>0,5 m</option>
            <option value={1}>1 m</option>
          </select>
        </label>
      </div>
      <p className="hint">{t('stage.resetWarning')}</p>
    </section>
  )
}

export function ObjectPanel() {
  const { t } = useTranslation()
  const objects = useChoreo((s) => s.choreo.objects)
  const stage = useChoreo((s) => s.choreo.stage)
  const index = useUi((s) => s.index)
  const selectedId = useUi((s) => s.selectedObjectId)
  const states = useChoreo((s) => s.choreo.formations[index]?.objectStates)
  const st = useChoreo.getState
  const selected = objects.find((o) => o.id === selectedId)
  const state = selected && states?.[selected.id]
  const set = (patch: Partial<ObjectState>) => selected && st().setObjectState(index, selected.id, patch)

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{t('objects.title', { count: objects.length })}</h2>
        <button
          onClick={() => {
            const id = st().addObject()
            useUi.getState().setSelection([])
            useUi.getState().selectObject(id)
          }}
        >
          {t('objects.add')}
        </button>
      </div>
      {objects.length === 0 && <p className="hint">{t('objects.hint')}</p>}
      {objects.length > 0 && (
        <div className="chips">
          {objects.map((o, i) => (
            <button
              key={o.id}
              className={o.id === selectedId ? 'chip active' : 'chip'}
              onClick={() => {
                useUi.getState().setSelection([])
                useUi.getState().selectObject(o.id)
              }}
            >
              {o.name || i + 1}
            </button>
          ))}
        </div>
      )}
      {selected && state && (
        <>
          <div className="fields">
            <label>
              {t('objects.name')}
              <input value={selected.name} onChange={(e) => st().updateObject(selected.id, { name: e.target.value })} />
            </label>
            <label>
              {t('objects.color')}
              <input type="color" value={selected.color} onChange={(e) => st().updateObject(selected.id, { color: e.target.value })} />
            </label>
            <label>
              {t('objects.x')}
              <NumField value={state.x} min={0} max={stage.width} step={0.5} onCommit={(v) => set({ x: v })} />
            </label>
            <label>
              {t('objects.y')}
              <NumField value={state.y} min={0} max={stage.depth} step={0.5} onCommit={(v) => set({ y: v })} />
            </label>
            <label>
              {t('objects.w')}
              <NumField value={state.w} min={0.2} max={MAX_STAGE} step={0.5} onCommit={(v) => set({ w: v })} />
            </label>
            <label>
              {t('objects.h')}
              <NumField value={state.h} min={0.2} max={MAX_STAGE} step={0.5} onCommit={(v) => set({ h: v })} />
            </label>
            <label>
              {t('objects.rotation')}
              <NumField value={state.rotation} min={-360} max={360} step={5} onCommit={(v) => set({ rotation: v })} />
            </label>
          </div>
          <p className="hint">{t('objects.perFormation')}</p>
          <button
            className="danger"
            onClick={() => {
              st().removeObject(selected.id)
              useUi.getState().selectObject(null)
            }}
          >
            {t('objects.remove')}
          </button>
        </>
      )}
    </section>
  )
}

export function DancerPanel() {
  const { t } = useTranslation()
  const dancers = useChoreo((s) => s.choreo.dancers)
  const selectedIds = useUi((s) => s.selectedIds)
  const st = useChoreo.getState
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{t('dancers.title', { count: dancers.length })}</h2>
        <div className="row">
          <button onClick={() => st().addDancers(1)}>{t('dancers.add')}</button>
          <button onClick={() => st().addDancers(5)}>{t('dancers.add5')}</button>
        </div>
      </div>
      <div className="row">
        <button onClick={() => useUi.getState().setSelection(dancers.map((d) => d.id))}>{t('dancers.selectAll')}</button>
        <button disabled={selectedIds.length === 0} onClick={() => useUi.getState().setSelection([])}>
          {t('dancers.selectNone')}
        </button>
      </div>
      <p className="hint">{t('dancers.hint')}</p>
      <ul className="dancers">
        {dancers.map((d, i) => (
          <li key={d.id} className={selectedIds.includes(d.id) ? 'selected' : ''}
            onClick={(e) => (e.shiftKey || e.ctrlKey || e.metaKey ? useUi.getState().toggleSelect(d.id) : useUi.getState().setSelection([d.id]))}
          >
            <span className="num" style={{ background: d.color, color: textOn(d.color) }}>
              {i + 1}
            </span>
            <input value={d.name} placeholder={t('dancers.name')} aria-label={t('dancers.name')} onChange={(e) => st().updateDancer(d.id, { name: e.target.value })} />
            <input type="color" value={d.color} aria-label={t('dancers.color')} onChange={(e) => st().updateDancer(d.id, { color: e.target.value })} />
            <button className="icon" disabled={dancers.length <= 1} aria-label={t('dancers.remove')} title={t('dancers.remove')} onClick={() => st().removeDancer(d.id)}>
              ✕
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function SharePanel() {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const run = async (all: boolean) => {
    setBusy(true)
    setError(false)
    try {
      const { choreo } = useChoreo.getState()
      const { index, showPaths } = useUi.getState()
      const labels = { audience: t('stage.audience'), formation: (n: number) => t('formation.default', { n }) }
      const indices = all ? choreo.formations.map((_, i) => i) : [index]
      const blobs: Blob[] = []
      for (const i of indices) blobs.push(await formationPng(choreo, i, labels, showPaths))
      const files = pngFiles(choreo, blobs)
      if (!all) {
        // Keep the real formation number in the single-image filename.
        const name = files[0].name.replace(/-1\.png$/, `-${index + 1}.png`)
        await shareOrDownload(choreo, [new File([files[0]], name, { type: 'image/png' })])
      } else {
        await shareOrDownload(choreo, files)
      }
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel">
      <h2>{t('share.title')}</h2>
      <div className="row">
        <button className="primary" disabled={busy} onClick={() => run(false)}>
          {t('share.current')}
        </button>
        <button disabled={busy} onClick={() => run(true)}>
          {t('share.all')}
        </button>
      </div>
      {error && <p className="hint error">{t('share.failed')}</p>}
    </section>
  )
}

export function LibraryPanel() {
  const { t } = useTranslation()
  const id = useChoreo((s) => s.choreo.id)
  const name = useChoreo((s) => s.choreo.name)
  const [items, setItems] = useState<ChoreoSummary[]>([])
  const [error, setError] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const syncRev = useSync((s) => s.rev)

  const refresh = () => void storage.list().then(setItems)
  useEffect(() => {
    // Refresh after the debounced autosave had a chance to run.
    const timer = setTimeout(refresh, 600)
    return () => clearTimeout(timer)
  }, [id, name, syncRev])

  const open = async (target: string) => {
    const c = await storage.load(target)
    if (c) {
      await storage.save(useChoreo.getState().choreo)
      useChoreo.getState().replace(c)
      { useUi.getState().setViewPart(null); useUi.getState().setIndex(0) }
      useUi.getState().setSelection([])
    }
  }

  const create = async () => {
    await storage.save(useChoreo.getState().choreo)
    useChoreo.getState().replace(createChoreography(t('choreo.default')))
    { useUi.getState().setViewPart(null); useUi.getState().setIndex(0) }
    useUi.getState().setSelection([])
  }

  const remove = async () => {
    if (!confirm(t('library.confirmDelete'))) return
    await storage.remove(id)
    const rest = (await storage.list()).filter((x) => x.id !== id)
    const next = rest[0] ? await storage.load(rest[0].id) : null
    useChoreo.getState().replace(next ?? createChoreography(t('choreo.default')))
    { useUi.getState().setViewPart(null); useUi.getState().setIndex(0) }
    refresh()
  }

  const onImport = async (file: File) => {
    try {
      const c = parseChoreography(JSON.parse(await file.text()))
      await storage.save(useChoreo.getState().choreo)
      useChoreo.getState().replace(c)
      { useUi.getState().setViewPart(null); useUi.getState().setIndex(0) }
      setError(false)
    } catch {
      setError(true)
    }
  }

  const known = items.some((x) => x.id === id)
  return (
    <section className="panel">
      <h2>{t('library.title')}</h2>
      <select value={id} onChange={(e) => void open(e.target.value)}>
        {!known && <option value={id}>{name}</option>}
        {items.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name || t('choreo.default')}
          </option>
        ))}
      </select>
      <div className="row">
        <button onClick={() => void create()}>{t('library.new')}</button>
        <button onClick={() => exportJson(useChoreo.getState().choreo)}>{t('library.export')}</button>
        <button onClick={() => fileRef.current?.click()}>{t('library.import')}</button>
        <button className="danger" onClick={() => void remove()}>
          {t('library.delete')}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onImport(f)
          e.target.value = ''
        }}
      />
      {error && <p className="hint error">{t('library.importError')}</p>}
    </section>
  )
}

export function AccountPanel() {
  const { t } = useTranslation()
  const { enabled, email, status, conflicts } = useSync()
  const [address, setAddress] = useState('')
  const [sent, setSent] = useState<{ error: string | null } | null>(null)
  const choreoId = useChoreo((s) => s.choreo.id)
  const [link, setLink] = useState<string | null>(null)
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  useEffect(() => {
    setLink(null)
    setShareMsg(null)
    if (!enabled || !email) return
    let cancelled = false
    getShareLink(choreoId)
      .then((l) => !cancelled && setLink(l))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [enabled, email, choreoId])
  if (!enabled) return null

  const deliver = async (url: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ url })
        return
      } catch {
        /* cancelled or unsupported: fall back to copying */
      }
    }
    await navigator.clipboard.writeText(url)
    setShareMsg(t('account.shareCopied'))
  }
  const share = async () => {
    try {
      const url = link ?? (await createShareLink(useChoreo.getState().choreo))
      setLink(url)
      setShareMsg(null)
      await deliver(url)
    } catch {
      setShareMsg(t('account.shareFailed'))
    }
  }
  const stopShare = async () => {
    try {
      await stopSharing(choreoId)
      setLink(null)
      setShareMsg(null)
    } catch {
      setShareMsg(t('account.shareFailed'))
    }
  }

  const send = async () => setSent({ error: await signIn(address.trim()) })
  return (
    <section className="panel">
      <h2>{t('account.title')}</h2>
      {email ? (
        <>
          <p className="hint">{t('account.signedIn', { email })}</p>
          <p className={status === 'error' ? 'hint error' : 'hint'}>{t(`account.status.${status}`)}</p>
          {conflicts.map((c) => (
            <div key={c.id} className="conflict">
              <p className="hint error">{t('account.conflict', { name: c.name })}</p>
              <div className="row">
                <button onClick={() => void resolveConflict(c.id, 'cloud')}>{t('account.keepCloud')}</button>
                <button onClick={() => void resolveConflict(c.id, 'local')}>{t('account.keepLocal')}</button>
              </div>
            </div>
          ))}
          <p className="hint">{t('account.shareHint')}</p>
          <div className="row">
            <button onClick={() => void share()}>{link ? t('account.shareCopy') : t('account.shareLink')}</button>
            {link && <button onClick={() => void stopShare()}>{t('account.shareStop')}</button>}
          </div>
          {shareMsg && <p className="hint">{shareMsg}</p>}
          <div className="row">
            <button onClick={() => void signOut()}>{t('account.signOut')}</button>
          </div>
        </>
      ) : (
        <>
          <p className="hint">{t('account.hint')}</p>
          <input
            type="email"
            value={address}
            placeholder={t('account.email')}
            aria-label={t('account.email')}
            onChange={(e) => setAddress(e.target.value)}
          />
          <div className="row">
            <button disabled={!address.includes('@')} onClick={() => void send()}>
              {t('account.send')}
            </button>
          </div>
          {sent && (
            <p className={sent.error ? 'hint error' : 'hint'}>
              {sent.error ? `${t('account.failed')} (${sent.error})` : t('account.sent')}
            </p>
          )}
        </>
      )}
    </section>
  )
}
