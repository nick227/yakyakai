import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../../index.js'
import { cleanupDatabase } from '../setup.js'

describe('Planner API', () => {
  let authToken

  beforeAll(async () => {
    // Register and login to get token
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'planner-api@example.com',
        password: 'password123',
        name: 'Planner User',
      })

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'planner-api@example.com',
        password: 'password123',
      })

    authToken = loginRes.headers['set-cookie']
  })

  afterAll(async () => {
    await cleanupDatabase()
  })

  describe('POST /api/planner/diagnose', () => {
    it('should diagnose and refine tasks with valid token', async () => {
      const res = await request(app)
        .post('/api/planner/diagnose')
        .set('Cookie', authToken)
        .send({
          tasks: [
            { title: 'Build a landing page', valueStatement: 'High impact' },
            { title: 'Set up pricing', valueStatement: 'Revenue critical' },
          ],
        })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('ok', true)
      expect(res.body).toHaveProperty('tasks')
      expect(Array.isArray(res.body.tasks)).toBe(true)
    })

    it('should reject without token', async () => {
      const res = await request(app)
        .post('/api/planner/diagnose')
        .send({
          tasks: [],
        })

      expect(res.status).toBe(401)
    })

    it('should handle empty tasks array', async () => {
      const res = await request(app)
        .post('/api/planner/diagnose')
        .set('Cookie', authToken)
        .send({
          tasks: [],
        })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('ok', true)
      expect(Array.isArray(res.body.tasks)).toBe(true)
    })

    it('should handle missing tasks field', async () => {
      const res = await request(app)
        .post('/api/planner/diagnose')
        .set('Cookie', authToken)
        .send({})

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('ok', true)
    })
  })

  describe('POST /api/planner/template', () => {
    it('should generate prompt template with valid token', async () => {
      const res = await request(app)
        .post('/api/planner/template')
        .set('Cookie', authToken)
        .send({
          prompt: 'Build a SaaS product for freelancers',
        })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('ok', true)
      expect(res.body).toHaveProperty('promptTemplate')
      expect(typeof res.body.promptTemplate).toBe('string')
    })

    it('should reject without token', async () => {
      const res = await request(app)
        .post('/api/planner/template')
        .send({
          prompt: 'Test prompt',
        })

      expect(res.status).toBe(401)
    })

    it('should use fallback when prompt is missing', async () => {
      const res = await request(app)
        .post('/api/planner/template')
        .set('Cookie', authToken)
        .send({})

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('ok', true)
      expect(res.body).toHaveProperty('promptTemplate')
    })

    it('should handle long prompts within limit', async () => {
      const longPrompt = 'a'.repeat(24000)
      const res = await request(app)
        .post('/api/planner/template')
        .set('Cookie', authToken)
        .send({
          prompt: longPrompt,
        })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('ok', true)
    })
  })
})
