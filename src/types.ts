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

export type PathStyle = 'straight' | 'out' | 'in'

export interface Formation {
  id: string
  name: string
  /** Free-text note for the trainer (counts, arm movements, reminders). */
  note: string
  /** Beats ("Takte") the transition from the previous formation takes (ignored for the first). */
  duration: number
  /** Beats the dancers stand still in this formation. */
  hold: number
  positions: Record<string, Point>
  /** Shape of the paths from the previous formation: straight, or bowed away from / toward the group's center. */
  pathStyle: PathStyle
  /** Manual Bézier control point per dancer; overrides pathStyle for that dancer. */
  controls: Record<string, Point>
}

export interface Choreography {
  id: string
  name: string
  stage: Stage
  /** Beats per minute; one "Takt" is one beat. */
  tempo: number
  dancers: Dancer[]
  formations: Formation[]
  updatedAt: number
}
