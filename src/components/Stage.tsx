import { useRef } from 'react'
import type { PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { clampPoint, controlFromHandle, snapPoint, stateAt } from '../model'
import { useChoreo, useUi } from '../store'
import type { Point } from '../types'
import { StageView } from './StageView'

interface Drag {
  kind: 'dancer' | 'handle'
  id: string
  offset: Point
  moved: boolean
}

export function Stage() {
  const { t } = useTranslation()
  const choreo = useChoreo((s) => s.choreo)
  const { index, selectedId, showPaths, snap, playing, time } = useUi()
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)

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

  const start = (kind: Drag['kind']) => (id: string, e: PointerEvent) => {
    if (playing) return
    e.preventDefault()
    svgRef.current?.setPointerCapture(e.pointerId)
    const f = choreo.formations[shownIndex]
    const p = toPoint(e)
    const origin = kind === 'dancer' ? f.positions[id] : p
    useUi.getState().select(id)
    drag.current = { kind, id, offset: { x: origin.x - p.x, y: origin.y - p.y }, moved: false }
  }

  const onMove = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const st = useChoreo.getState()
    const p = toPoint(e)
    const target = { x: p.x + d.offset.x, y: p.y + d.offset.y }
    if (!d.moved) {
      st.checkpoint()
      d.moved = true
    }
    if (d.kind === 'dancer') {
      st.setPosition(shownIndex, d.id, clampPoint(snapPoint(target, snap), st.choreo.stage), false)
    } else {
      const prev = st.choreo.formations[shownIndex - 1].positions[d.id]
      const cur = st.choreo.formations[shownIndex].positions[d.id]
      st.setControl(shownIndex, d.id, controlFromHandle(prev, cur, target), false)
    }
  }

  const end = () => {
    drag.current = null
  }

  return (
    <div className="stage-wrap">
      <StageView
        choreo={choreo}
        index={shownIndex}
        positions={anim?.positions}
        showPaths={showPaths}
        selectedId={selectedId}
        audienceLabel={t('stage.audience')}
        onDancerDown={playing ? undefined : start('dancer')}
        onHandleDown={start('handle')}
        onHandleReset={(id) => useChoreo.getState().setControl(shownIndex, id, null)}
        svgProps={{
          ref: svgRef,
          className: 'stage-svg',
          onPointerMove: onMove,
          onPointerUp: end,
          onPointerCancel: end,
          onPointerDown: (e) => {
            if (e.target === e.currentTarget || (e.target as Element).tagName === 'rect') useUi.getState().select(null)
          },
        }}
      />
    </div>
  )
}
