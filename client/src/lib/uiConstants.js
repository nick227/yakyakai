export const PACE = {
  FAST: 'fast',
  STEADY: 'steady',
  DEEP: 'deep',
}

export const PACE_LABELS = { [PACE.FAST]: 'Fast', [PACE.STEADY]: 'Steady', [PACE.DEEP]: 'Deep' }
export const PACE_KEYS = Object.keys(PACE_LABELS)

export const RUN_STATUS = {
  IDLE: 'idle',
  QUEUED: 'queued',
  PLANNING: 'planning',
  RUNNING: 'running',
  EXPANDING: 'expanding',
  CYCLING: 'cycling',
  PAUSED: 'paused',
  STOPPED: 'stopped',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  FAILED: 'failed',
}

export const STATUS_LABELS = {
  [RUN_STATUS.QUEUED]: 'Starting...',
  [RUN_STATUS.PLANNING]: 'Planning...',
  [RUN_STATUS.RUNNING]: 'Exploring...',
  [RUN_STATUS.EXPANDING]: 'Finding adjacent angles...',
  [RUN_STATUS.CYCLING]: 'Building next section...',
  [RUN_STATUS.PAUSED]: 'Paused',
  [RUN_STATUS.STOPPED]: 'Stopped',
  [RUN_STATUS.CANCELLED]: 'Stopped',
  [RUN_STATUS.COMPLETED]: 'Complete',
  [RUN_STATUS.FAILED]: 'Interrupted',
  [RUN_STATUS.IDLE]: 'Ready',
}

export const TERMINAL_STATUSES = new Set([
  RUN_STATUS.IDLE,
  RUN_STATUS.STOPPED,
  RUN_STATUS.CANCELLED,
  RUN_STATUS.COMPLETED,
  RUN_STATUS.FAILED,
])
