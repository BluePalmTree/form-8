export interface Point {
  x: number
  y: number
}

/** Stage size in meters. The audience is at the bottom edge (y = depth). */
export interface Stage {
  width: number
  depth: number
}

/** A rectangular prop on the stage (set piece, platform, …). Its placement is stored per formation. */
export interface StageObject {
  id: string
  name: string
  color: string
}

/** Center position and size in meters, rotation in degrees. */
export interface ObjectState {
  x: number
  y: number
  w: number
  h: number
  rotation: number
}

export interface Dancer {
  id: string
  name: string
  color: string
}

/** When a dancer moves within a transition: starts `delay` beats in and walks for `length` beats. */
export interface Timing {
  delay: number
  length: number
}

export type PathStyle = 'straight' | 'out' | 'in'

export interface Formation {
  id: string
  name: string
  /** Free-text note for the trainer (counts, arm movements, reminders). */
  note: string
  /** Name of the part that starts at this formation; null = continues the previous part. Never null for the first. */
  part: string | null
  /** Beats ("Takte") the transition from the previous formation takes (ignored for the first). */
  duration: number
  /** Beats the dancers stand still in this formation. */
  hold: number
  positions: Record<string, Point>
  /** Placement of every stage object in this formation. */
  objectStates: Record<string, ObjectState>
  /** Shape of the paths from the previous formation: straight, or bowed away from / toward the group's center. */
  pathStyle: PathStyle
  /** Per-dancer start delay and walking time within the transition; absent = moves the whole transition. */
  timing: Record<string, Timing>
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
  objects: StageObject[]
  formations: Formation[]
  updatedAt: number
}
