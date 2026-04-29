import { Router } from 'express'

import { authRoutes } from './authRoutes.js'
import { creditRoutes } from './creditRoutes.js'
import { usageRoutes } from './usageRoutes.js'
import { jobRoutes } from './jobRoutes.js'
import { sessionRoutes } from './sessionRoutes.js'
import { adminRoutes } from './adminRoutes.js'
import { dashboardRoutes } from './dashboardRoutes.js'
import { exportRoutes } from './exportRoutes.js'
import { intelligenceRoutes } from './intelligenceRoutes.js'
import { memoryRoutes } from './memoryRoutes.js'
import { plannerRoutesV36 } from './plannerRoutes.v3_6.js'
import { recoveryRoutes } from './recoveryRoutes.js'
import { topicAdjacentRoutes } from './topicAdjacentRoutes.js'
import { runtimeRoutesV5 } from './runtimeRoutes.v5.js'

export const apiRoutes = Router()

apiRoutes.use('/auth', authRoutes)
apiRoutes.use('/credits', creditRoutes)
apiRoutes.use('/usage', usageRoutes)
apiRoutes.use('/jobs', jobRoutes)
apiRoutes.use('/sessions', sessionRoutes)
apiRoutes.use('/public', sessionRoutes)
apiRoutes.use('/admin', adminRoutes)
apiRoutes.use('/dashboard', dashboardRoutes)
apiRoutes.use('/export', exportRoutes)
apiRoutes.use('/intelligence', intelligenceRoutes)
apiRoutes.use('/memory', memoryRoutes)
apiRoutes.use('/planner', plannerRoutesV36)
apiRoutes.use('/recovery', recoveryRoutes)
apiRoutes.use('/topic-shift', topicAdjacentRoutes)
apiRoutes.use('/runtime', runtimeRoutesV5)

apiRoutes.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'yakyakai-api', time: new Date().toISOString() })
})
