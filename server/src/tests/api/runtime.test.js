import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../../index.js'
import { cleanupDatabase } from '../setup.js'

describe('Runtime API', () => {
  let authToken

  beforeAll(async () => {
    // Register and login to get token
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'runtime-api@example.com',
        password: 'password123',
        name: 'Runtime User',
      })

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'runtime-api@example.com',
        password: 'password123',
      })

    authToken = loginRes.headers['set-cookie']
  })

  afterAll(async () => {
    await cleanupDatabase()
  })

  describe('POST /api/runtime/start', () => {
    it('should start runtime state with valid token', async () => {
      const res = await request(app)
        .post('/api/runtime/start')
        .set('Cookie', authToken)
        .send({
          prompt: 'Build a SaaS product for freelancers',
        })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('ok', true)
      expect(res.body).toHaveProperty('state')
      expect(res.body).toHaveProperty('batch')
      expect(typeof res.body.state).toBe('object')
      expect(Array.isArray(res.body.batch)).toBe(true)
    })

    it('should reject without token', async () => {
      const res = await request(app)
        .post('/api/runtime/start')
        .send({
          prompt: 'Test prompt',
        })

      expect(res.status).toBe(401)
    })

    it('should reject without prompt', async () => {
      const res = await request(app)
        .post('/api/runtime/start')
        .set('Cookie', authToken)
        .send({})

      expect(res.status).toBe(400)
    })

    it('should handle long prompts within limit', async () => {
      const longPrompt = 'a'.repeat(24000)
      const res = await request(app)
        .post('/api/runtime/start')
        .set('Cookie', authToken)
        .send({
          prompt: longPrompt,
        })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('ok', true)
    })
  })

  describe('POST /api/runtime/shift', () => {
    it('should generate shift batch with valid token', async () => {
      const res = await request(app)
        .post('/api/runtime/shift')
        .set('Cookie', authToken)
        .send({
          originalPrompt: 'Build a SaaS product',
          cycle: 1,
          outputs: [],
        })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('ok', true)
      expect(res.body).toHaveProperty('batch')
      expect(Array.isArray(res.body.batch)).toBe(true)
    })

    it('should reject without token', async () => {
      const res = await request(app)
        .post('/api/runtime/shift')
        .send({})

      expect(res.status).toBe(401)
    })

    it('should handle empty state object', async () => {
      const res = await request(app)
        .post('/api/runtime/shift')
        .set('Cookie', authToken)
        .send({})

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('ok', true)
      expect(res.body).toHaveProperty('batch')
    })

    it('should handle complex state object', async () => {
      const complexState = {
        originalPrompt: 'Build a SaaS product',
        cycle: 5,
        outputs: [
          { title: 'Landing page', content: '...' },
          { title: 'Pricing page', content: '...' },
        ],
        completedTasks: ['task1', 'task2'],
      }

      const res = await request(app)
        .post('/api/runtime/shift')
        .set('Cookie', authToken)
        .send(complexState)

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('ok', true)
    })
  })
})
