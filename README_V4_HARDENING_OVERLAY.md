# Yakyakai V4 Hardening Overlay

Overlay-safe update focused on consolidation, predictable naming, route hardening, and production cleanup.

## Focus

- route consolidation + consistent naming
- centralized error handling
- auth + permission hardening
- input validation guards
- safer job state transitions
- duplicate route cleanup
- logging + diagnostics improvements
- session/recovery reliability
- DRY shared helpers
- production-readiness cleanup

## Apply

Extract over the existing project.

Then mount routes through:

```js
import { apiRoutes } from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/errorMiddleware.js'

app.use('/api', apiRoutes)
app.use(notFoundHandler)
app.use(errorHandler)
```

## Main Convention

Routes should be thin:

```js
router.post('/thing', requireAuth, route(async (req, res) => {
  const input = requireString(req.body.name, 'name')
  const thing = await service.createThing({ userId: req.user.id, input })
  res.json({ thing })
}))
```

No repeated try/catch in route files.
