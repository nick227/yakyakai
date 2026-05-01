import { logger } from './logger.js'

export function emitMetric(name, value, tags = {}) {
  logger.info('metric', {
    metric: name,
    value,
    ...tags,
  })
}

