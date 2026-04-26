import express from 'express'
import cookieParser from 'cookie-parser'
import { apiRoutes } from './routes/index.js'
import { optionalAuth } from './middleware/auth.js'
import { errorHandler, notFoundHandler } from './middleware/errorMiddleware.js'

app.use(cookieParser())
app.use(express.json({ limit: '1mb' }))
app.use(optionalAuth)

app.use('/api', apiRoutes)

app.use(notFoundHandler)
app.use(errorHandler)
