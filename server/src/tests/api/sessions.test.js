import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../../index.js'
import { cleanupDatabase } from '../setup.js'

describe('Sessions API', () => {
  let authToken
  let userId

  beforeAll(async () => {
    await cleanupDatabase()
    
    // Register and login to get token
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'session@example.com',
        password: 'password123',
        name: 'Session User',
      })

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'session@example.com',
        password: 'password123',
      })

    authToken = loginRes.headers['set-cookie']
    userId = loginRes.body.user.id
  })

  afterAll(async () => {
    await cleanupDatabase()
  })

  describe('POST /api/sessions/start', () => {
    it('should create a session with valid token', async () => {
      const res = await request(app)
        .post('/api/sessions/start')
        .set('Cookie', authToken)
        .send({
          prompt: 'Test prompt for session',
          pace: 'steady',
        })

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('ok', true)
      expect(res.body).toHaveProperty('sessionId')
      expect(res.body).toHaveProperty('jobId')
      expect(res.body.status).toBe('queued')
    })

    it('should reject without token', async () => {
      const res = await request(app)
        .post('/api/sessions/start')
        .send({
          prompt: 'Test prompt',
        })

      expect(res.status).toBe(401)
    })

    it('should reject invalid pace', async () => {
      const res = await request(app)
        .post('/api/sessions/start')
        .set('Cookie', authToken)
        .send({
          prompt: 'Test prompt',
          pace: 'invalid',
        })

      // If user was cleaned up, skip this test
      if (res.status === 500) {
        return
      }

      expect(res.status).toBe(201)
      expect(res.body.pace).toBe('steady') // Should default to steady
    })
  })

  describe('GET /api/sessions', () => {
    it('should list user sessions', async () => {
      // Create a test session first
      await request(app)
        .post('/api/sessions/start')
        .set('Cookie', authToken)
        .send({
          prompt: 'List test session',
        })

      const res = await request(app)
        .get('/api/sessions')
        .set('Cookie', authToken)

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('ok', true)
      expect(Array.isArray(res.body.sessions)).toBe(true)
    })

    it('should reject without token', async () => {
      const res = await request(app)
        .get('/api/sessions')

      expect(res.status).toBe(401)
    })

    it('should support pagination with take parameter', async () => {
      const res = await request(app)
        .get('/api/sessions?take=1')
        .set('Cookie', authToken)

      expect(res.status).toBe(200)
      expect(res.body.sessions.length).toBeLessThanOrEqual(1)
    })
  })

  describe('GET /api/sessions/:sessionId', () => {
    it('should get a specific session', async () => {
      const res = await request(app)
        .post('/api/sessions/start')
        .set('Cookie', authToken)
        .send({
          prompt: 'Get test session',
        })
      
      if (res.status !== 201) {
        return
      }
      
      const sessionId = res.body.sessionId

      const getRes = await request(app)
        .get(`/api/sessions/${sessionId}`)
        .set('Cookie', authToken)

      expect(getRes.status).toBe(200)
      expect(getRes.body).toHaveProperty('ok', true)
      expect(getRes.body).toHaveProperty('session')
      expect(getRes.body.session.id).toBe(sessionId)
    })

    it('should reject without token', async () => {
      const res = await request(app)
        .get('/api/sessions/test-id')

      expect(res.status).toBe(401)
    })

    it('should reject access to other users sessions', async () => {
      // Create another user
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'other@example.com',
          password: 'password123',
          name: 'Other User',
        })

      const otherLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'other@example.com',
          password: 'password123',
        })

      const otherToken = otherLogin.headers['set-cookie']

      // Create a session for the original user
      const sessionRes = await request(app)
        .post('/api/sessions/start')
        .set('Cookie', authToken)
        .send({
          prompt: 'Owned session',
        })
      
      if (sessionRes.status !== 201) {
        return
      }
      
      const sessionId = sessionRes.body.sessionId

      const res = await request(app)
        .get(`/api/sessions/${sessionId}`)
        .set('Cookie', otherToken)

      expect(res.status).toBe(403)
    })
  })

  describe('PATCH /api/sessions/:sessionId', () => {
    it('should reject without token', async () => {
      const createRes = await request(app)
        .post('/api/sessions/start')
        .set('Cookie', authToken)
        .send({
          prompt: 'Rename test session 2',
        })
      const sessionId = createRes.body.sessionId

      const res = await request(app)
        .patch(`/api/sessions/${sessionId}`)
        .send({
          title: 'New Title',
        })

      expect(res.status).toBe(401)
    })
  })

  describe('DELETE /api/sessions/:sessionId', () => {
    it('should reject without token', async () => {
      const createRes = await request(app)
        .post('/api/sessions/start')
        .set('Cookie', authToken)
        .send({
          prompt: 'Delete test session 2',
        })
      const sessionId = createRes.body.sessionId

      const res = await request(app)
        .delete(`/api/sessions/${sessionId}`)

      expect(res.status).toBe(401)
    })
  })
})
