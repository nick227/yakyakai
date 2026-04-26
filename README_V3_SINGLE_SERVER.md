# Yakyakai V3 Single-Server Overlay

Focused on single-server excellence:

- Durable MySQL job queue
- Worker polling loop
- Single AI governor pipe
- Restartable sessions
- Token budgeting hooks
- Admin queue endpoints
- SSE-ready state model

No Redis required.

## Apply

Overlay these files onto the existing project.

## Run

```bash
cd server
npm install
npx prisma migrate dev --name v3_job_queue
npm run dev
```

Run a second terminal for worker if desired:

```bash
node src/worker.js
```

## Architecture

React UI
Node API
Prisma + MySQL
Worker Loop
AI Governor
SSE Stream
