import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import path from 'path'
import { fileURLToPath } from 'url'
import swaggerUi from 'swagger-ui-express'
import swaggerJsdoc from 'swagger-jsdoc'
import { prisma } from './db/prisma.js'
import { requireAuth } from './middleware/auth.js'
import { apiRoutes } from './routes/index.js'
import { notFoundHandler, errorHandler } from './middleware/errorMiddleware.js'

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL', 'OPENAI_API_KEY']
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName])

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '))
  console.error('Please set these variables in your .env file before starting the server.')
  process.exit(1)
}

const app = express()
const port = Number(process.env.PORT || 3001)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientDistPath = path.resolve(__dirname, '../../client/dist')

// Railway/other reverse proxies set X-Forwarded-* headers.
// Trust the first proxy so rate limiting and client IP detection work correctly.
app.set('trust proxy', 1)

// Swagger/OpenAPI configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'YakyakAI API',
      version: '1.0.0',
      description: 'API documentation for YakyakAI',
    },
    servers: [
      {
        url: `http://localhost:${port}`,
        description: 'Development server',
      },
    ],
  },
  apis: ['./src/routes/*.js'],
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}))
app.use(compression())
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

// Swagger UI for API documentation
const swaggerSpec = swaggerJsdoc(swaggerOptions)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// ─── V2+ API (auth-gated) ────────────────────────────────────────────────────
app.use('/api', apiRoutes)

app.get('/healthz', (_req, res) => res.json({ ok: true }))
app.get('/health', requireAuth, (_req, res) => res.json({ ok: true }))

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientDistPath))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(clientDistPath, 'index.html'))
  })
}

app.use(notFoundHandler)
app.use(errorHandler)

// Export app for testing
export default app

// Only start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(port, () => console.log(`YakyakAI server listening on http://localhost:${port}`))

  async function gracefulShutdown(signal) {
    console.log(`\n${signal} received. Starting graceful shutdown...`)
    
    server.close(async (err) => {
      if (err) {
        console.error('Error closing HTTP server:', err)
        process.exit(1)
      }
      
      console.log('HTTP server closed')
      
      try {
        await prisma.$disconnect()
        console.log('Database connection closed')
        process.exit(0)
      } catch (err) {
        console.error('Error closing database connection:', err)
        process.exit(1)
      }
    })
    
    setTimeout(() => {
      console.error('Forced shutdown after timeout')
      process.exit(1)
    }, 10000)
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))
}
