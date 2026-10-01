import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { exportJson, formationPng, pngFiles, shareOrDownload } from '../export'
import { MAX_STAGE, MIN_STAGE, createChoreography, parseChoreography } from '../model'
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
  const { index, playing, showPaths } = useUi()
  const ui = useUi.getState
  const go = (i: number) => ui().setIndex(Math.max(0, Math.min(count - 1, i)))
  return (
    <div className="bar">
      <button onClick={() => (playing ? ui().stop() : ui().play())} className="primary">
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
      <label className="check">
        <input type="checkbox" checked={showPaths} onChange={(e) => ui().setShowPaths(e.target.checked)} />
        {t('stage.showPaths')}
      </label>
    </div>
  )
}

export function FormationBar() {
  const { t } = useTranslation()
  const label = useFormationName()
  const formations = useChoreo((s) => s.choreo.formations)
  const st = useChoreo.getState
  const { index, playing } = useUi()
  const setIndex = useUi.getState().setIndex
  const f = formations[index]

  return (
    <section className="panel">
      <h2>{t('formation.title')}</h2>
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
            <NumField value={f.duration} min={0} max={60} step={0.5} disabled={index === 0} onCommit={(v) => st().updateFormation(index, { duration: v })} />
          </label>
          <label>
            {t('formation.hold')}
            <NumField value={f.hold} min={0} max={60} step={0.5} onCommit={(v) => st().updateFormation(index, { hold: v })} />
          </label>
          <div className="row">
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
  const selectedId = useUi((s) => s.selectedId)
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
      <p className="hint">{t('dancers.hint')}</p>
      <ul className="dancers">
        {dancers.map((d, i) => (
          <li key={d.id} className={d.id === selectedId ? 'selected' : ''} onClick={() => useUi.getState().select(d.id)}>
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
      useUi.getState().select(null)
    }
  }

  const create = async () => {
    await storage.save(useChoreo.getState().choreo)
    useChoreo.getState().replace(createChoreography(t('choreo.default')))
    useUi.getState().setIndex(0)
    useUi.getState().select(null)
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
