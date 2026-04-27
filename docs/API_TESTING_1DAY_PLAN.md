# API Testing - 1 Day Excellence Plan

**Goal:** Set up API testing foundation with visible results in one day

**Total Time:** ~6-7 hours of focused work

---

## Morning (3 hours)

### 9:00-9:30 - Install OpenAPI Tools (30 min)

```bash
cd server
npm install --save swagger-ui-express swagger-jsdoc
```

Add to `server/src/index.js`:
```javascript
import swaggerUi from 'swagger-ui-express'
import swaggerJsdoc from 'swagger-jsdoc'

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
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
  },
  apis: ['./src/routes/*.js'],
}

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerJsdoc(swaggerOptions)))
```

**Verify:** Visit `http://localhost:3000/api-docs` - should see Swagger UI

---

### 9:30-10:30 - Document 3 Critical Endpoints (1 hour)

Add OpenAPI JSDoc to these files:

**1. `server/src/routes/auth.js` - Login endpoint:**
```javascript
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *       401:
 *         description: Invalid credentials
 */
```

**2. `server/src/routes/auth.js` - Register endpoint:**
```javascript
/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: User registration
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Invalid input or user exists
 */
```

**3. `server/src/routes/sessions.js` - Create session:**
```javascript
/**
 * @swagger
 * /api/sessions:
 *   post:
 *     summary: Create a new AI session
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [prompt]
 *             properties:
 *               prompt:
 *                 type: string
 *               pace:
 *                 type: string
 *                 enum: [steady, fast, thorough]
 *     responses:
 *       201:
 *         description: Session created
 *       401:
 *         description: Unauthorized
 */
```

**Verify:** Refresh `/api-docs` - should see 3 documented endpoints

---

### 10:30-11:30 - Set Up Vitest + Supertest (1 hour)

```bash
cd server
npm install --save-dev vitest @vitest/coverage-v8 supertest
```

Create `server/vitest.config.js`:
```javascript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/tests/setup.js'],
  },
})
```

Update `server/package.json`:
```json
"scripts": {
  "test": "vitest",
  "test:run": "vitest run",
  "test:coverage": "vitest --coverage"
}
```

Create `server/src/tests/setup.js`:
```javascript
import { prisma } from '../db/prisma.js'

export async function cleanupDatabase() {
  await prisma.chatMessage.deleteMany()
  await prisma.aiSession.deleteMany()
  await prisma.user.deleteMany()
}
```

**Verify:** Run `npm run test` - should see Vitest running with 0 tests

---

## Afternoon (3-4 hours)

### 1:00-2:00 - Write First API Test (1 hour)

Create `server/src/tests/api/auth.test.js`:
```javascript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../index.js'
import { cleanupDatabase } from '../setup.js'

describe('Authentication API', () => {
  beforeAll(async () => {
    await cleanupDatabase()
  })

  afterAll(async () => {
    await cleanupDatabase()
  })

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        })

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('user')
      expect(res.body.user.email).toBe('test@example.com')
    })

    it('should reject duplicate email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        })

      expect(res.status).toBe(400)
    })
  })

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('token')
    })

    it('should reject invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        })

      expect(res.status).toBe(401)
    })
  })
})
```

**Verify:** Run `npm run test` - should see 4 passing tests

---

### 2:00-3:00 - Test Session Creation (1 hour)

Create `server/src/tests/api/sessions.test.js`:
```javascript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../index.js'
import { cleanupDatabase } from '../setup.js'

describe('Sessions API', () => {
  let authToken

  beforeAll(async () => {
    await cleanupDatabase()
    
    // Register and login to get token
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      })

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      })

    authToken = loginRes.body.token
  })

  afterAll(async () => {
    await cleanupDatabase()
  })

  describe('POST /api/sessions', () => {
    it('should create a session with valid token', async () => {
      const res = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          prompt: 'Test prompt',
          pace: 'steady',
        })

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('id')
      expect(res.body.prompt).toBe('Test prompt')
    })

    it('should reject without token', async () => {
      const res = await request(app)
        .post('/api/sessions')
        .send({
          prompt: 'Test prompt',
        })

      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/sessions', () => {
    it('should list user sessions', async () => {
      const res = await request(app)
        .get('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })
  })
})
```

**Verify:** Run `npm run test` - should see 7 passing tests

---

### 3:00-4:00 - Document 2 More Endpoints (1 hour)

Add OpenAPI docs to:
- GET /api/sessions (list sessions)
- GET /api/sessions/:id (get single session)

**Verify:** Refresh `/api-docs` - should see 5 documented endpoints

---

### 4:00-4:30 - Add Coverage Reporting (30 min)

Update `server/package.json`:
```json
"scripts": {
  "test:coverage": "vitest --coverage"
}
```

Run coverage:
```bash
npm run test:coverage
```

**Verify:** Coverage report generated in `coverage/` directory

---

### 4:30-5:00 - Documentation & Cleanup (30 min)

Update `README.md` with testing section:
```markdown
## Testing

### Run Tests
```bash
cd server
npm run test
```

### API Documentation
Visit http://localhost:3000/api-docs for interactive API documentation.

### Test Coverage
```bash
npm run test:coverage
```
```

Commit changes with descriptive message:
```
feat: add API testing foundation with OpenAPI and Vitest

- Install swagger-ui-express and swagger-jsdoc for API docs
- Document 5 critical endpoints with OpenAPI specs
- Set up Vitest + Supertest for API testing
- Add tests for authentication and session endpoints
- Add test coverage reporting
```

---

## End of Day Results

✅ **Deliverables:**
- Swagger UI accessible at `/api-docs`
- 5 API endpoints documented with OpenAPI
- Vitest + Supertest configured
- 7 passing API tests (auth + sessions)
- Test coverage reporting set up
- Documentation updated

✅ **Metrics:**
- API endpoint coverage: 5/15 (33%)
- Test count: 7 tests
- Time invested: ~6.5 hours
- Immediate value: Interactive docs + automated tests

---

## Next Day Options

Pick one:
1. **Expand coverage** - Document and test remaining 10 endpoints
2. **Contract validation** - Add OpenAPI request/response validators
3. **CI/CD integration** - Add automated testing to GitHub Actions
4. **Performance testing** - Benchmark critical endpoints

---

## Success Criteria Checklist

- [ ] Swagger UI loads at `/api-docs`
- [ ] 5 endpoints visible in Swagger UI
- [ ] `npm run test` passes with 7 tests
- [ ] `npm run test:coverage` generates report
- [ ] README updated with testing instructions
- [ ] Code committed to git

**If all checked: Excellent day! 🎉**
