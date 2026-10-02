import { useEffect } from 'react'
import { rangeBounds } from './model'
import { useChoreo, useUi } from './store'

/** Advances the playhead with requestAnimationFrame while playing. */
export function usePlayback() {
  const playing = useUi((s) => s.playing)
  useEffect(() => {
    if (!playing) return
    let raf = 0
    const startedAt = performance.now()
    const startBeat = useUi.getState().time
    const tick = (now: number) => {
      const { choreo } = useChoreo.getState()
      // Playhead in beats ("Takte"): seconds × beats per minute / 60.
      const t = startBeat + ((now - startedAt) / 1000) * (choreo.tempo / 60)
      const { to, end } = rangeBounds(choreo, useUi.getState().viewPart)
      if (t >= end) {
        const ui = useUi.getState()
        ui.setIndex(to)
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
