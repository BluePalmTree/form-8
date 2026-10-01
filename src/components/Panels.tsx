import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { exportJson, formationPng, pngFiles, shareOrDownload } from '../export'
import { MAX_STAGE, MAX_TEMPO, MIN_STAGE, MIN_TEMPO, arrivalTime, createChoreography, dancerLabel, effectiveTiming, parseChoreography, totalDuration } from '../model'
import type { PathStyle } from '../types'
import { storage } from '../storage'
import type { ChoreoSummary } from '../storage'
import { useChoreo, useUi } from '../store'
import { NumField } from './NumField'

export function useFormationName() {
  const { t } = useTranslation()
  return (name: string, i: number) => name || t('formation.default', { n: i + 1 })
}

export function PlaybackBar() {
  const { t } = useTranslation()
  const count = useChoreo((s) => s.choreo.formations.length)
  const { index, playing, showPaths, multiSelect } = useUi()
  const ui = useUi.getState
  // Play from the selected formation; from the beginning if it is the last one (nothing left to play).
  const startBeat = () => {
    const { choreo } = useChoreo.getState()
    return index >= count - 1 ? 0 : arrivalTime(choreo, index)
  }
  const go = (i: number) => ui().setIndex(Math.max(0, Math.min(count - 1, i)))
  return (
    <div className="bar">
      <button onClick={() => (playing ? ui().stop() : ui().play(startBeat()))} className="primary">
        {playing ? `■ ${t('play.pause')}` : `▶ ${t('play.play')}`}
      </button>
      <button disabled={playing || index === 0} onClick={() => go(index - 1)} aria-label={t('play.prev')} title={t('play.prev')}>
        ◀
      </button>
      <span className="counter">
        {index + 1} / {count}
      </span>
      <button disabled={playing || index >= count - 1} onClick={() => go(index + 1)} aria-label={t('play.next')} title={t('play.next')}>
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
function Timeline() {
  const { t } = useTranslation()
  const label = useFormationName()
  const choreo = useChoreo((s) => s.choreo)
  const index = useUi((s) => s.index)
  const playing = useUi((s) => s.playing)
  const time = useUi((s) => s.time)
  const total = totalDuration(choreo)
  const pos = playing ? Math.min(time, total) : arrivalTime(choreo, index)
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
          const len = (i > 0 ? f.duration : 0) + f.hold
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
                <span className="num" style={{ background: d.color }}>
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

export function FormationBar() {
  const { t } = useTranslation()
  const label = useFormationName()
  const formations = useChoreo((s) => s.choreo.formations)
  const tempo = useChoreo((s) => s.choreo.tempo)
  const st = useChoreo.getState
  const index = useUi((s) => s.index)
  const playing = useUi((s) => s.playing)
  const setIndex = useUi.getState().setIndex
  const f = formations[index]

  return (
    <section className="panel">
      <h2>{t('formation.title')}</h2>
      <Timeline />
      <div className="fields">
        <label>
          {t('formation.tempo')}
          <NumField value={tempo} min={MIN_TEMPO} max={MAX_TEMPO} step={1} onCommit={(v) => st().setTempo(v)} />
        </label>
      </div>
      <div className="chips">
        {formations.map((x, i) => (
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
            <button disabled={playing || index === 0} onClick={() => { st().moveFormation(index, -1); setIndex(index - 1) }}>
              ← {t('formation.left')}
            </button>
            <button disabled={playing || index === formations.length - 1} onClick={() => { st().moveFormation(index, 1); setIndex(index + 1) }}>
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
            <span className="num" style={{ background: d.color }}>
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

  const refresh = () => void storage.list().then(setItems)
  useEffect(() => {
    // Refresh after the debounced autosave had a chance to run.
    const timer = setTimeout(refresh, 600)
    return () => clearTimeout(timer)
  }, [id, name])

  const open = async (target: string) => {
    const c = await storage.load(target)
    if (c) {
      await storage.save(useChoreo.getState().choreo)
      useChoreo.getState().replace(c)
      useUi.getState().setIndex(0)
      useUi.getState().setSelection([])
    }
  }

  const create = async () => {
    await storage.save(useChoreo.getState().choreo)
    useChoreo.getState().replace(createChoreography(t('choreo.default')))
    useUi.getState().setIndex(0)
    useUi.getState().setSelection([])
  }

  const remove = async () => {
    if (!confirm(t('library.confirmDelete'))) return
    await storage.remove(id)
    const rest = (await storage.list()).filter((x) => x.id !== id)
    const next = rest[0] ? await storage.load(rest[0].id) : null
    useChoreo.getState().replace(next ?? createChoreography(t('choreo.default')))
    useUi.getState().setIndex(0)
    refresh()
  }

  const onImport = async (file: File) => {
    try {
      const c = parseChoreography(JSON.parse(await file.text()))
      await storage.save(useChoreo.getState().choreo)
      useChoreo.getState().replace(c)
      useUi.getState().setIndex(0)
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
