export interface Point {
  x: number
  y: number
}

/** Stage size in meters. The audience is at the bottom edge (y = depth). */
export interface Stage {
  width: number
  depth: number
}

export interface Dancer {
  id: string
  name: string
  color: string
}

export interface Formation {
  id: string
  name: string
  /** Seconds the transition from the previous formation takes (ignored for the first). */
  duration: number
  /** Seconds the dancers stand still in this formation. */
  hold: number
  positions: Record<string, Point>
  /** Optional Bézier control point per dancer for the path from the previous formation. */
  controls: Record<string, Point>
}

export interface Choreography {
  id: string
  name: string
  stage: Stage
  dancers: Dancer[]
  formations: Formation[]
  updatedAt: number
}
