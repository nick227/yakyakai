// Merge into your server entry file.

import cookieParser from 'cookie-parser'
import { authRoutes } from './routes/authRoutes.js'
import { usageRoutes } from './routes/usageRoutes.js'
import { optionalAuth } from './middleware/auth.js'

// after app creation:
app.use(cookieParser())
app.use(express.json({ limit: '1mb' }))
app.use(optionalAuth)

app.use('/api/auth', authRoutes)
app.use('/api/usage', usageRoutes)

// Error handler should preserve usage/paywall errors:
app.use((error, _req, res, _next) => {
  const status = error.status || 500
  res.status(status).json({
    error: error.code || 'SERVER_ERROR',
    message: error.message || 'Unexpected server error',
  })
})
