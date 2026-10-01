import type { PointerEvent, SVGProps } from 'react'
import { DANCER_RADIUS, columnLabel, controlFor, dancerLabel, endDirection, handlePos, pathD } from '../model'
import type { Choreography, Dancer, Point } from '../types'

const MARGIN = 1
const TITLE_SPACE = 0.9
/** Invisible touch target around dancers and path handles (fingers are bigger than the visible marks). */
const HIT_RADIUS = 0.5
const HANDLE_HIT_RADIUS = 0.38
/** Light color of the chess-board style grid coordinates. */
const COORD_COLOR = '#b3aa94'

export function viewBoxOf(stage: { width: number; depth: number }, withTitle: boolean) {
  const top = MARGIN + (withTitle ? TITLE_SPACE : 0)
  return { x: -MARGIN, y: -top, w: stage.width + 2 * MARGIN, h: stage.depth + top + MARGIN + 0.4 }
}

interface Props {
  choreo: Choreography
  index: number
  /** Overrides the dancer positions (used while animating). */
  positions?: Record<string, Point>
  showPaths: boolean
  selectedIds?: string[]
  selectedPathId?: string | null
  /** Selection rectangle in stage coordinates. */
  marquee?: { x: number; y: number; w: number; h: number } | null
  audienceLabel: string
  title?: string
  /** Pixel size, set for rasterized export. */
  pixelWidth?: number
  onDancerDown?: (id: string, e: PointerEvent) => void
  onHandleDown?: (id: string, e: PointerEvent) => void
  onPathDown?: (id: string, e: PointerEvent) => void
  onHandleReset?: (id: string) => void
  svgProps?: SVGProps<SVGSVGElement>
}

/**
 * Pure SVG rendering of one formation. Uses only presentation attributes (no CSS),
 * so that the same markup can be serialized and rasterized for sharing.
 */
export function StageView({
  choreo,
  index,
  positions,
  showPaths,
  selectedIds,
  selectedPathId,
  marquee,
  audienceLabel,
  title,
  pixelWidth,
  onDancerDown,
  onHandleDown,
  onPathDown,
  onHandleReset,
  svgProps,
}: Props) {
  const { stage, dancers, formations } = choreo
  const formation = formations[index]
  const prev = index > 0 ? formations[index - 1] : null
  const vb = viewBoxOf(stage, !!title)
  const interactive = !!onDancerDown
  const R = DANCER_RADIUS
  const pos = positions ?? formation.positions

  const gridLines: number[][] = []
  for (let x = 1; x < stage.width; x++) gridLines.push([x, 0, x, stage.depth])
  for (let y = 1; y < stage.depth; y++) gridLines.push([0, y, stage.width, y])

  const showHandles = interactive && showPaths && !!prev
  // Path handles sit behind the dancers, except the one of the selected path, which is drawn on top.
  const handleOf = (d: Dancer) => {
    const p0 = prev?.positions[d.id]
    const p1 = formation.positions[d.id]
    if (!p0 || !p1 || Math.hypot(p1.x - p0.x, p1.y - p0.y) < 0.05) return null
    const h = handlePos(p0, p1, controlFor(choreo, index, d.id))
    return (
      <g
        key={d.id}
        transform={`translate(${h.x} ${h.y})`}
        style={{ cursor: 'move' }}
        onPointerDown={(e) => onHandleDown?.(d.id, e)}
        onDoubleClick={() => onHandleReset?.(d.id)}
      >
        <circle r={HANDLE_HIT_RADIUS} fill="transparent" />
        <circle r={0.17} fill={formation.controls[d.id] ? d.color : '#fff'} stroke={d.color} strokeWidth={0.06} />
      </g>
    )
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      width={pixelWidth}
      height={pixelWidth ? (pixelWidth * vb.h) / vb.w : undefined}
      fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
      {...svgProps}
    >
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="#ffffff" />
      {title && (
        <text x={stage.width / 2} y={-MARGIN - 0.15} fontSize={0.5} fontWeight={600} textAnchor="middle" fill="#222">
          {title}
        </text>
      )}
      <rect x={0} y={0} width={stage.width} height={stage.depth} fill="#f3efe6" stroke="#7a7466" strokeWidth={0.06} />
      {gridLines.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#d9d3c4" strokeWidth={0.03} />
      ))}
      {Array.from({ length: stage.width + 1 }, (_, i) => (
        <text key={`c${i}`} x={i} y={-0.25} fontSize={0.3} textAnchor="middle" fill={COORD_COLOR}>
          {columnLabel(i)}
        </text>
      ))}
      {Array.from({ length: stage.depth + 1 }, (_, i) => (
        <text key={`r${i}`} x={-0.3} y={stage.depth - i} fontSize={0.3} textAnchor="middle" dominantBaseline="central" fill={COORD_COLOR}>
          {i + 1}
        </text>
      ))}
      <line
        x1={stage.width / 2}
        y1={0}
        x2={stage.width / 2}
        y2={stage.depth}
        stroke="#b9b09b"
        strokeWidth={0.04}
        strokeDasharray="0.2 0.15"
      />
      <line x1={0} y1={stage.depth + 0.25} x2={stage.width} y2={stage.depth + 0.25} stroke="#555" strokeWidth={0.1} strokeLinecap="round" />
      <text x={stage.width / 2} y={stage.depth + 0.85} fontSize={0.4} textAnchor="middle" fill="#555">
        {audienceLabel}
      </text>

      {showPaths &&
        prev &&
        dancers.map((d) => {
          const p0 = prev.positions[d.id]
          const p1 = formation.positions[d.id]
          if (!p0 || !p1 || Math.hypot(p1.x - p0.x, p1.y - p0.y) < 0.05) return null
          const c = controlFor(choreo, index, d.id)
          const dir = endDirection(p0, p1, c)
          const tip = { x: p1.x - dir.x * (R + 0.04), y: p1.y - dir.y * (R + 0.04) }
          const base = { x: tip.x - dir.x * 0.4, y: tip.y - dir.y * 0.4 }
          const w = 0.14
          const arrow = [
            `${tip.x},${tip.y}`,
            `${base.x - dir.y * w},${base.y + dir.x * w}`,
            `${base.x + dir.y * w},${base.y - dir.x * w}`,
          ].join(' ')
          return (
            <g key={d.id}>
              <circle cx={p0.x} cy={p0.y} r={R} fill={d.color} fillOpacity={0.2} stroke={d.color} strokeWidth={0.04} strokeDasharray="0.1 0.08" />
              <path d={pathD(p0, p1, c)} fill="none" stroke={d.color} strokeWidth={d.id === selectedPathId ? 0.14 : 0.08} strokeOpacity={0.85} strokeLinecap="round" />
              {interactive && (
                <path
                  d={pathD(p0, p1, c)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={0.6}
                  style={{ cursor: 'pointer' }}
                  onPointerDown={(e) => onPathDown?.(d.id, e)}
                />
              )}
              <polygon points={arrow} fill={d.color} />
            </g>
          )
        })}

      {showHandles && dancers.filter((d) => d.id !== selectedPathId).map(handleOf)}
      {dancers.map((d) => {
        const p = pos[d.id]
        if (!p) return null
        const selected = !!selectedIds?.includes(d.id)
        const label = dancerLabel(d.name, dancers.indexOf(d))
        return (
          <g
            key={d.id}
            transform={`translate(${p.x} ${p.y})`}
            onPointerDown={onDancerDown ? (e) => onDancerDown(d.id, e) : undefined}
            style={interactive ? { cursor: 'grab' } : undefined}
          >
            {interactive && <circle r={HIT_RADIUS} fill="transparent" />}
            <circle r={R} fill={d.color} stroke={selected ? '#111' : '#fff'} strokeWidth={selected ? 0.09 : 0.06} />
            <text fontSize={label.length > 2 ? 0.22 : label.length > 1 ? 0.3 : 0.38} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill="#fff" pointerEvents="none">
              {label}
            </text>
          </g>
        )
      })}

      {showHandles && dancers.filter((d) => d.id === selectedPathId).map(handleOf)}

      {marquee && (
        <rect
          x={marquee.x}
          y={marquee.y}
          width={marquee.w}
          height={marquee.h}
          fill="#5b3fd1"
          fillOpacity={0.12}
          stroke="#5b3fd1"
          strokeWidth={0.04}
          strokeDasharray="0.15 0.1"
          pointerEvents="none"
        />
      )}
    </svg>
  )
}
