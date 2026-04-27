# API Testing Implementation Plan - Max Value, Easy Effort

**Focus:** High-impact, low-effort API testing improvements

## Quick Wins (Week 1)

### 1. Install OpenAPI Tools (1 hour)
```bash
cd server
npm install --save swagger-ui-express swagger-jsdoc
```
- Add Swagger UI endpoint `/api-docs`
- Auto-generate OpenAPI spec from JSDoc comments
- Immediate value: Interactive API documentation

### 2. Document Critical Endpoints (2-3 hours)
Priority order:
1. POST /api/auth/login
2. POST /api/auth/register
3. POST /api/sessions
4. GET /api/sessions/:id
5. POST /api/sessions/:id/start

Add JSDoc comments with OpenAPI tags to route handlers. Example:
```javascript
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 */
```

### 3. Set Up Vitest + Supertest (1 hour)
```bash
cd server
npm install --save-dev vitest @vitest/coverage-v8 supertest
```

Add to `server/package.json`:
```json
"scripts": {
  "test": "vitest",
  "test:coverage": "vitest --coverage"
}
```

Create `vitest.config.js`:
```javascript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
})
```

### 4. Write First API Test (1-2 hours)
Create `server/src/tests/api/auth.test.js`:
```javascript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../index.js'

describe('POST /api/auth/login', () => {
  it('should login with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password' })
    
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
  })

  it('should reject invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrong' })
    
    expect(res.status).toBe(401)
  })
})
```

### 5. Add Test Database Setup (1 hour)
Add test environment variable to `server/.env.test`:
```
DATABASE_URL="postgresql://user:pass@localhost:5432/yakyakai_test"
```

Add test cleanup helper:
```javascript
// server/src/tests/setup.js
import { prisma } from '../db/prisma.js'

export async function cleanupDatabase() {
  await prisma.chatMessage.deleteMany()
  await prisma.aiSession.deleteMany()
  await prisma.user.deleteMany()
}
```

## Medium Wins (Week 2)

### 6. Document All Endpoints (4-6 hours)
- Add OpenAPI JSDoc to remaining 10 endpoints
- Group by route file (auth, sessions, billing, users)
- Focus on request/response schemas

### 7. Test Authentication Flow (2-3 hours)
- Register → Login → Token refresh → Logout
- Test protected route access
- Test expired token handling

### 8. Test Session CRUD (2-3 hours)
- Create session
- Get session
- List sessions (pagination)
- Update session
- Delete session (cascade)

### 9. Add Contract Validation (2 hours)
```bash
npm install --save-dev openapi-request-validator openapi-response-validator
```

Add validation middleware to tests:
```javascript
import { OpenApiValidator } from 'express-openapi-validator'

// Validate requests/responses against OpenAPI spec
```

## High Wins (Week 3-4)

### 10. Test AI Generation Endpoints (3-4 hours)
- Start generation
- Get status
- Stream output (SSE)
- Cancel generation
- Credit deduction validation

### 11. Test Billing/Credits (2-3 hours)
- Get balance
- Purchase credits
- Transaction history
- Usage analytics

### 12. Add CI/CD Integration (2 hours)
- Add test script to GitHub Actions
- Run tests on every PR
- Fail PR if tests fail
- Upload coverage reports

### 13. Performance Baseline (2 hours)
- Measure response times for critical endpoints
- Add performance assertions to tests
- Document baseline metrics

## Optional Future Enhancements

- Load testing with k6 or Artillery
- Security scanning with OWASP ZAP
- API versioning strategy
- Mock external APIs (OpenAI, Google OAuth)
- Test data factories with faker.js

## Effort vs Value Matrix

| Task | Effort | Value | Priority |
|------|--------|-------|----------|
| Install OpenAPI tools | 1h | High | 🔥 |
| Document 5 critical endpoints | 3h | High | 🔥 |
| Set up Vitest + Supertest | 1h | High | 🔥 |
| Write first API test | 2h | High | 🔥 |
| Test database setup | 1h | High | 🔥 |
| Document remaining endpoints | 6h | Medium | ⚡ |
| Test auth flow | 3h | High | ⚡ |
| Test session CRUD | 3h | Medium | ⚡ |
| Contract validation | 2h | Medium | ⚡ |
| Test AI generation | 4h | High | 📋 |
| Test billing/credits | 3h | Medium | 📋 |
| CI/CD integration | 2h | High | 📋 |
| Performance baseline | 2h | Medium | 📋 |

**Legend:** 🔥 Week 1 (Quick Wins) | ⚡ Week 2 (Medium Wins) | 📋 Week 3-4 (High Wins)

## Total Effort Estimate

- **Week 1:** ~8 hours (Quick wins, immediate value)
- **Week 2:** ~14 hours (Expand coverage)
- **Week 3-4:** ~11 hours (Comprehensive testing)

**Total:** ~33 hours for solid API testing foundation

## Success Criteria

After Week 1:
- ✅ Swagger UI accessible at `/api-docs`
- ✅ 5 critical endpoints documented
- ✅ First API test passing
- ✅ Test runner configured

After Week 2:
- ✅ All 15 endpoints documented
- ✅ Auth flow tested
- ✅ Session CRUD tested
- ✅ Contract validation in place

After Week 3-4:
- ✅ All API endpoints tested
- ✅ CI/CD automated testing
- ✅ Performance baseline documented
- ✅ >80% API layer coverage
