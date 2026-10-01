import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Stage } from './components/Stage'
import { DancerPanel, FormationBar, LibraryPanel, PlaybackBar, SharePanel, StagePanel } from './components/Panels'
import { createChoreography, totalDuration } from './model'
import { lastOpenedId, storage } from './storage'
import { useChoreo, useUi } from './store'

/** Advances the playhead with requestAnimationFrame while playing. */
function usePlayback() {
  const playing = useUi((s) => s.playing)
  useEffect(() => {
    if (!playing) return
    let raf = 0
    const startedAt = performance.now()
    const tick = (now: number) => {
      const t = (now - startedAt) / 1000
      const total = totalDuration(useChoreo.getState().choreo)
      if (t >= total) {
        const ui = useUi.getState()
        ui.setIndex(useChoreo.getState().choreo.formations.length - 1)
        ui.stop()
        return
      }
      useUi.getState().setTime(t)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])
}

/** Loads the last opened choreography and saves changes (debounced). Returns true once loaded. */
function usePersistence(defaultName: string) {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const id = lastOpenedId()
      const c = id ? await storage.load(id) : null
      if (cancelled) return
      useChoreo.getState().replace(c ?? createChoreography(defaultName))
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!loaded) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsub = useChoreo.subscribe((s, prev) => {
      if (s.choreo === prev.choreo) return
      clearTimeout(timer)
      timer = setTimeout(() => void storage.save(useChoreo.getState().choreo), 400)
    })
    // Save once so a fresh default choreography shows up in the list.
    void storage.save(useChoreo.getState().choreo)
    return () => {
      unsub()
      clearTimeout(timer)
    }
  }, [loaded])

  return loaded
}

export default function App() {
  const { t, i18n } = useTranslation()
  const choreo = useChoreo((s) => s.choreo)
  const canUndo = useChoreo((s) => s.past.length > 0)
  const canRedo = useChoreo((s) => s.future.length > 0)
  const loaded = usePersistence(t('choreo.default'))
  usePlayback()

  // Keep the selected formation valid when formations are removed or a choreography is replaced.
  const index = useUi((s) => s.index)
  useEffect(() => {
    const last = choreo.formations.length - 1
    if (index > last) useUi.getState().setIndex(Math.max(0, last))
  }, [choreo, index])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT') return
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return
      e.preventDefault()
      if (e.shiftKey) useChoreo.getState().redo()
      else useChoreo.getState().undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!loaded) return null

  const lang = i18n.language === 'en' ? 'en' : 'de'
  return (
    <div className="app">
      <header className="top">
        <h1>{t('app.title')}</h1>
        <input
          className="title-input"
          value={choreo.name}
          placeholder={t('choreo.name')}
          aria-label={t('choreo.name')}
          onChange={(e) => useChoreo.getState().setName(e.target.value)}
        />
        <div className="row">
          <button disabled={!canUndo} onClick={() => useChoreo.getState().undo()} title={t('common.undo')} aria-label={t('common.undo')}>
            ↶
          </button>
          <button disabled={!canRedo} onClick={() => useChoreo.getState().redo()} title={t('common.redo')} aria-label={t('common.redo')}>
            ↷
          </button>
          <button onClick={() => void i18n.changeLanguage(lang === 'de' ? 'en' : 'de')} title={t('common.language')} aria-label={t('common.language')}>
            {lang === 'de' ? 'EN' : 'DE'}
          </button>
        </div>
      </header>
      <main className="main">
        <div className="stage-col">
          <Stage />
          <PlaybackBar />
          <FormationBar />
        </div>
        <aside className="side">
          <SharePanel />
          <StagePanel />
          <DancerPanel />
          <LibraryPanel />
        </aside>
      </main>
      <footer className="footer">v{__APP_VERSION__}</footer>
    </div>
  )
}
