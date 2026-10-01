import { useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { DANCER_RADIUS, clamp, controlFromHandle, snapPoint, stateAt } from '../model'
import { useChoreo, useUi } from '../store'
import type { Point } from '../types'
import { StageView } from './StageView'

type Drag =
  | { kind: 'dancers'; id: string; offset: Point; starts: Record<string, Point>; moved: boolean; tapToggle: boolean }
  | { kind: 'handle'; id: string; offset: Point; moved: boolean }
  /** A tap or shift-click that only changes the selection. */
  | { kind: 'none' }

interface Marquee {
  a: Point
  b: Point
  additive: boolean
}

const isAdditive = (e: PointerEvent) => e.shiftKey || e.ctrlKey || e.metaKey

export function Stage() {
  const { t } = useTranslation()
  const choreo = useChoreo((s) => s.choreo)
  const { index, selectedIds, selectedPathId, showPaths, snap, playing, time } = useUi()
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)
  const marqueeRef = useRef<Marquee | null>(null)
  const [marquee, setMarquee] = useState<Marquee | null>(null)

  const anim = playing ? stateAt(choreo, time) : null
  const shownIndex = Math.min(anim ? anim.index : index, choreo.formations.length - 1)

  const toPoint = (e: PointerEvent): Point => {
    const svg = svgRef.current!
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    return { x: p.x, y: p.y }
  }

  const startDancer = (id: string, e: PointerEvent) => {
    if (playing) return
    e.preventDefault()
    svgRef.current?.setPointerCapture(e.pointerId)
    const ui = useUi.getState()
    // Touch has no Shift key: in multi-select mode a tap toggles, but a selected dancer can still be dragged.
    const tapMode = ui.multiSelect
    if (isAdditive(e) || (tapMode && !ui.selectedIds.includes(id))) {
      ui.toggleSelect(id)
      drag.current = { kind: 'none' }
      return
    }
    // Dragging a selected dancer moves the whole selection; an unselected one replaces it.
    const ids = ui.selectedIds.includes(id) ? ui.selectedIds : [id]
    if (ids !== ui.selectedIds) ui.setSelection(ids)
    const positions = choreo.formations[shownIndex].positions
    const starts = Object.fromEntries(ids.filter((i) => positions[i]).map((i) => [i, positions[i]]))
    const p = toPoint(e)
    drag.current = {
      kind: 'dancers',
      id,
      offset: { x: positions[id].x - p.x, y: positions[id].y - p.y },
      starts,
      moved: false,
      tapToggle: tapMode,
    }
  }

  const startHandle = (id: string, e: PointerEvent) => {
    if (playing) return
    e.preventDefault()
    svgRef.current?.setPointerCapture(e.pointerId)
    useUi.getState().setSelection([])
    useUi.getState().selectPath(id)
    drag.current = { kind: 'handle', id, offset: { x: 0, y: 0 }, moved: false }
  }

  // Selecting a path brings its curve handle to the front. Works with a tap as well as a click.
  const startPath = (id: string, e: PointerEvent) => {
    if (playing) return
    e.preventDefault()
    svgRef.current?.setPointerCapture(e.pointerId)
    useUi.getState().setSelection([])
    useUi.getState().selectPath(id)
    drag.current = { kind: 'none' }
  }

  const startMarquee = (e: PointerEvent) => {
    if (playing || drag.current) return
    svgRef.current?.setPointerCapture(e.pointerId)
    const p = toPoint(e)
    marqueeRef.current = { a: p, b: p, additive: isAdditive(e) || useUi.getState().multiSelect }
  }

  const onMove = (e: PointerEvent) => {
    const m = marqueeRef.current
    if (m) {
      m.b = toPoint(e)
      setMarquee({ ...m })
      return
    }
    const d = drag.current
    if (!d || d.kind === 'none') return
    const st = useChoreo.getState()
    const p = toPoint(e)
    const target = { x: p.x + d.offset.x, y: p.y + d.offset.y }
    if (!d.moved) {
      st.checkpoint()
      d.moved = true
    }
    if (d.kind === 'dancers') {
      const { stage } = st.choreo
      const snapped = snapPoint(target, snap)
      const origin = d.starts[d.id]
      const pts = Object.values(d.starts)
      // Clamp the group's shift so that no selected dancer leaves the stage.
      const dx = clamp(
        snapped.x - origin.x,
        Math.max(...pts.map((s) => DANCER_RADIUS - s.x)),
        Math.min(...pts.map((s) => stage.width - DANCER_RADIUS - s.x)),
      )
      const dy = clamp(
        snapped.y - origin.y,
        Math.max(...pts.map((s) => DANCER_RADIUS - s.y)),
        Math.min(...pts.map((s) => stage.depth - DANCER_RADIUS - s.y)),
      )
      const moved = Object.fromEntries(Object.entries(d.starts).map(([id, s]) => [id, { x: s.x + dx, y: s.y + dy }]))
      st.setPositions(shownIndex, moved, false)
    } else {
      const prev = st.choreo.formations[shownIndex - 1].positions[d.id]
      const cur = st.choreo.formations[shownIndex].positions[d.id]
      st.setControl(shownIndex, d.id, controlFromHandle(prev, cur, target), false)
    }
  }

  const end = () => {
    const m = marqueeRef.current
    if (m) {
      marqueeRef.current = null
      setMarquee(null)
      const [x1, x2] = [Math.min(m.a.x, m.b.x), Math.max(m.a.x, m.b.x)]
      const [y1, y2] = [Math.min(m.a.y, m.b.y), Math.max(m.a.y, m.b.y)]
      const ui = useUi.getState()
      if (x2 - x1 < 0.1 && y2 - y1 < 0.1) {
        // A plain click on the empty stage clears the selection.
        if (!m.additive) ui.setSelection([])
        return
      }
      const positions = useChoreo.getState().choreo.formations[shownIndex].positions
      const inside = Object.entries(positions)
        .filter(([, p]) => p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2)
        .map(([id]) => id)
      ui.setSelection(m.additive ? [...new Set([...ui.selectedIds, ...inside])] : inside)
      return
    }
    const d = drag.current
    if (d?.kind === 'dancers' && d.tapToggle && !d.moved) useUi.getState().toggleSelect(d.id)
    drag.current = null
  }

  const rect = marquee && {
    x: Math.min(marquee.a.x, marquee.b.x),
    y: Math.min(marquee.a.y, marquee.b.y),
    w: Math.abs(marquee.a.x - marquee.b.x),
    h: Math.abs(marquee.a.y - marquee.b.y),
  }

  return (
    <div className="stage-wrap">
      <StageView
        choreo={choreo}
        index={shownIndex}
        positions={anim?.positions}
        showPaths={showPaths}
        selectedIds={selectedIds}
        selectedPathId={selectedPathId}
        marquee={rect}
        audienceLabel={t('stage.audience')}
        onDancerDown={playing ? undefined : startDancer}
        onHandleDown={startHandle}
        onPathDown={startPath}
        onHandleReset={(id) => useChoreo.getState().setControl(shownIndex, id, null)}
        svgProps={{
          ref: svgRef,
          className: 'stage-svg',
          onPointerMove: onMove,
          onPointerUp: end,
          onPointerCancel: end,
          onPointerDown: startMarquee,
        }}
      />
    </div>
  )
}
