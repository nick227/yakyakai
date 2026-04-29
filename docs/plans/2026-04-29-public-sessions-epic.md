# Public Sessions Epic Implementation Plan (MVP)

## Overview

Transform YakyakAI from a private chat system to a public discovery platform where all sessions are visible by default, with a public gallery of all user sessions that can be viewed and forked (continued as new sessions by other users).

## Current State

- `AiSession` table has `isVisible` boolean (default: `true`)
- Sessions are owned by `userId` with strict ownership checks via `assertOwnsSession`
- Current `GET /api/sessions` returns only the authenticated user's sessions
- Session access requires authentication and ownership match
- No forking mechanism exists today

## MVP Scope

**Core product change**: Public sessions + public read + fork

**Defer** (not MVP):
- Public SSE (public viewers can refresh for static history)
- Open Graph tags
- SEO
- Fork lineage UI
- View counts
- Moderation system
- Admin tooling
- Redis caching
- Social share buttons
- Complex permission middleware

## Implementation Phases

### Phase 1 — Public Read

**Backend Changes**:
1. Add `GET /api/public/sessions` route
   - No auth required
   - Returns paginated list where `isVisible = true`
   - Include: id, title, status, cycleCount, updatedAt, user.username
   - Sort by `updatedAt desc` (active/interesting sessions float to top)

2. Update `GET /api/sessions/:id` to support public read
   - Use `optionalAuth` middleware instead of `requireAuth`
   - If authenticated + owner: full access
   - If not authenticated or not owner: check `isVisible = true` for read-only
   - Return `accessLevel: 'owner' | 'read-only'` in response

3. Update `GET /api/sessions/:id/messages` to support public read
   - Same logic: allow public read if `isVisible = true`

4. Add helper functions (no complex middleware):
   ```javascript
   function canReadSession(user, session) {
     return session.isVisible || session.userId === user?.id
   }

   function canWriteSession(user, session) {
     return user && session.userId === user.id
   }
   ```

5. Keep all write endpoints (`PATCH`, `DELETE`, `POST /pause`, `POST /resume`, `POST /stop`) behind `requireAuth` + ownership check

**Schema Changes**:
- Add index: `@@index([isVisible, createdAt])` for public listing performance

**Frontend Changes**:
- None in Phase 1 (backend only)

---

### Phase 2 — Fork

**Backend Changes**:
1. Add `parentSessionId String?` column to `AiSession` schema
2. Add index: `@@index([parentSessionId])`
3. Run migration
4. Add `POST /api/sessions/:id/fork` route (requires auth)
   - Validate: original session must be `isVisible = true`
   - Create new session with:
     - `userId` = forker's ID
     - `title` = submitted prompt (truncated to 60 chars)
     - `originalPrompt` = submitted prompt
     - `parentSessionId` = original session ID
     - `isVisible = true`
   - Create fork metadata message as first message:
     ```javascript
     await prisma.chatMessage.create({
       data: {
         sessionId: newSession.id,
         role: 'ASSISTANT',
         content: buildForkHtml({ parentSessionId, username }),
         metadata: JSON.stringify({ isForkMeta: true })
       }
     })
     ```
     - HTML format:
     ```html
     <div class="text-xs text-gray-400">
       Forked from @username • <a href="/SESSION_ID" class="underline">view original</a> • Apr 29
     </div>
     ```
     - Store only `sessionId`, generate URL on render
     - **Critical**: This message must NOT be included in planner context or AI prompts
   - Enqueue `session.start` job
   - Return new `sessionId`

**Frontend Changes**:
- None in Phase 2 (backend only)

---

### Phase 3 — UI

**Frontend Changes**:
1. Create `/public` page with session gallery
   - New component: `PublicGallery.jsx`
   - Reuse pagination logic from `SessionSidebar`
   - Link each item to `/:sessionId`
   - Card structure (minimal, focused on title + recency):
   ```jsx
   <div className="border rounded-lg p-4 hover:shadow-sm cursor-pointer">
     <div className="text-lg font-semibold leading-tight line-clamp-2">
       {title}
     </div>
     <div className="text-xs text-gray-500 mt-2">
       @{username} • {time} • {steps} steps
     </div>
   </div>
   ```
   - No filters, no metadata, no features (title quality + recency only)

2. Update session view for read-only mode
   - Update `useSession.js` to handle `accessLevel` from API
   - Hide action buttons (pause, stop, delete, rename) when `accessLevel !== 'owner'`
   - Update `ChatStream.jsx` to render in read-only mode
   - **Transparent fork UX**: No "fork button" or special controls
   - When user submits a prompt on a public session, automatically call fork API
   - UX is identical between public and owned sessions - user just types and submits
   - On fork success, navigate to new session ID

3. Add "Copy link" button to session header

---

## Database Schema Changes

```prisma
model AiSession {
  id              String        @id @default(cuid())
  userId          String
  title           String?
  originalPrompt  String        @db.Text
  currentPrompt   String?       @db.Text
  status          String        @default("created")
  promptCount     Int           @default(0)
  cycleCount      Int           @default(0)
  pace            String        @default("steady")
  nextEligibleAt  DateTime      @default(now())
  lastHeartbeatAt DateTime?
  isVisible       Boolean       @default(true)
  parentSessionId String?       // NEW: for fork tracking
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  // ... existing relations

  @@index([userId, createdAt])
  @@index([userId, updatedAt, id])
  @@index([status, isVisible, nextEligibleAt])
  @@index([isVisible, createdAt]) // NEW: for public listing
  @@index([parentSessionId]) // NEW: for fork queries
}
```

---

## API Changes Summary

### New Endpoints
- `GET /api/public/sessions` - Public session gallery (no auth)
- `POST /api/sessions/:id/fork` - Fork a session (requires auth)

### Modified Endpoints
- `GET /api/sessions/:id` - Support public read access (optionalAuth)
- `GET /api/sessions/:id/messages` - Support public read access (optionalAuth)

### Unchanged Endpoints (owner-only, requireAuth)
- `PATCH /api/sessions/:id` - Rename
- `DELETE /api/sessions/:id` - Delete
- `POST /api/sessions/:id/pause` - Pause
- `POST /api/sessions/:id/resume` - Resume
- `POST /api/sessions/:id/stop` - Stop
- `GET /api/sessions/:id/events` - SSE (owner-only in MVP)

---

## MVP Success Criteria

- [ ] `/public` shows visible sessions
- [ ] Anyone can open a visible session read-only
- [ ] Owner controls still work (pause, stop, delete, resume)
- [ ] Non-owner cannot pause/stop/delete/resume
- [ ] Logged-in user can fork public session
- [ ] Fork starts a new session with submitted prompt as originalPrompt
