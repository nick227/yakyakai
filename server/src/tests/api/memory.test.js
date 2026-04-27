import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../../index.js'
import { cleanupDatabase } from '../setup.js'

describe('Memory API', () => {
  let authToken

  beforeAll(async () => {
    // Register and login to get token
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'memory-api@example.com',
        password: 'password123',
        name: 'Memory User',
      })

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'memory-api@example.com',
        password: 'password123',
      })

    authToken = loginRes.headers['set-cookie']
  })

  afterAll(async () => {
    await cleanupDatabase()
  })

  describe('POST /api/memory/:sessionId/compress', () => {
    it('should compress and save memory with valid token', async () => {
      // Create a session for this test
      const sessionRes = await request(app)
        .post('/api/sessions/start')
        .set('Cookie', authToken)
        .send({
          prompt: 'Memory test session',
        })
      const sessionId = sessionRes.body.sessionId

      const res = await request(app)
        .post(`/api/memory/${sessionId}/compress`)
        .set('Cookie', authToken)
        .send({
          messages: [
            { role: 'user', content: 'Test message 1' },
            { role: 'assistant', content: 'Test response 1' },
          ],
        })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('ok', true)
      expect(res.body).toHaveProperty('memory')
    })

    it('should reject without token', async () => {
      const res = await request(app)
        .post('/api/memory/test-session/compress')
        .send({
          messages: [],
        })

      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/memory/:sessionId/latest', () => {
    it('should reject without token', async () => {
      const res = await request(app)
        .get('/api/memory/test-session/latest')

      expect(res.status).toBe(401)
    })
  })
})
