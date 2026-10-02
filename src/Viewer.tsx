import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PartChips, Timeline } from './components/Panels'
import { StageView } from './components/StageView'
import { parseChoreography, rangeBounds, stateAt } from './model'
import { usePlayback } from './playback'
import { useChoreo, useUi } from './store'
import { supabase } from './supabase'

type Load = 'loading' | 'ready' | 'invalid' | 'unavailable'

/**
 * Read-only fullscreen view of a shared choreography. Deliberately separate from App:
 * nothing is persisted or synced, so opening a link never touches the viewer's own data.
 */
export function Viewer({ token }: { token: string }) {
  const { t } = useTranslation()
  const choreo = useChoreo((s) => s.choreo)
  const { index, playing, time, showPaths, viewPart } = useUi()
  const [state, setState] = useState<Load>(supabase ? 'loading' : 'unavailable')
  usePlayback()

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    void supabase.rpc('get_shared_choreo', { token }).then(({ data, error }) => {
      if (cancelled) return
      try {
        if (error || !data) throw new Error('invalid')
        useChoreo.getState().replace(parseChoreography(data))
        useUi.getState().setShowPaths(false)
        setState('ready')
      } catch {
        setState('invalid')
      }
    })
    return () => {
      cancelled = true
    }
  }, [token])

  if (state !== 'ready') return <p className="viewer-msg">{t(`viewer.${state === 'loading' ? 'loading' : state}`)}</p>

  const anim = playing ? stateAt(choreo, time) : null
  const shownIndex = Math.min(anim ? anim.index : index, choreo.formations.length - 1)
  const toggle = () => {
    const ui = useUi.getState()
    if (ui.playing) {
      // Pausing shows the formation reached so far.
      ui.setIndex(stateAt(choreo, ui.time).index)
      return ui.stop()
    }
    const { to, start } = rangeBounds(choreo, viewPart)
    // Start over when the end was reached.
    ui.play(ui.index >= to ? start : ui.time)
  }

  const note = choreo.formations[shownIndex].note
  const hasNotes = choreo.formations.some((f) => f.note.trim())

  return (
    <div className="viewer">
      <div className="viewer-top">
        <PartChips />
      </div>
      <div className="stage-wrap" onPointerUp={toggle}>
        <StageView
          choreo={choreo}
          index={shownIndex}
          positions={anim?.positions}
          objectStates={anim?.objects}
          showPaths={showPaths}
          audienceLabel={t('stage.audience')}
          svgProps={{ className: 'stage-svg' }}
        />
      </div>
      {/* Reserve the space as soon as any formation has a note, so the stage doesn't jump while playing. */}
      {hasNotes && (
        <p className="viewer-note" aria-live="polite">
          {note}
        </p>
      )}
      <div className="viewer-bottom">
        <Timeline />
        <div className="row">
          <button className="primary" onClick={toggle}>
            {playing ? `■ ${t('play.pause')}` : `▶ ${t('play.play')}`}
          </button>
          <label className="check">
            <input type="checkbox" checked={showPaths} onChange={(e) => useUi.getState().setShowPaths(e.target.checked)} />
            {t('stage.showPaths')}
          </label>
        </div>
      </div>
    </div>
  )
}
