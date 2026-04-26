export const PACE_LABELS = { fast: 'Fast', steady: 'Steady', deep: 'Deep' }
export const PACE_KEYS = Object.keys(PACE_LABELS)

export const STATUS_LABELS = {
  queued: 'Starting...',
  planning: 'Planning...',
  running: 'Exploring...',
  expanding: 'Finding adjacent angles...',
  cycling: 'Building next section...',
  paused: 'Paused',
  stopped: 'Stopped',
  cancelled: 'Stopped',
  completed: 'Complete',
  failed: 'Session failed',
  idle: 'Ready',
}

export const TERMINAL_STATUSES = new Set(['idle', 'stopped', 'cancelled', 'completed', 'failed'])
