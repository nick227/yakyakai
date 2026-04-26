# Yakyakai V3.5 Overlay

Commercial-readiness and intelligence overlay.

Focus:
- prompt intelligence
- adaptive run decisions
- memory compression
- failure recovery
- user dashboard scaffolds
- lightweight analytics
- export helpers
- admin health views

No Redis. No extra infrastructure.

## Apply

Extract over the existing project.

Merge `prisma/schema.prisma.v3_5-additions` into your existing Prisma schema.

```bash
cd server
npx prisma migrate dev --name v3_5_intelligence
```

## Suggested Route Mounts

See:

```js
server/src/app.v3_5.patch.example.js
```
