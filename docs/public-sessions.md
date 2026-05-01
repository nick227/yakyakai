# Public Sessions — System Design

## The Problem

`isVisible` is used for two unrelated things simultaneously:

| Use | Who sets it |
|---|---|
| Tab tracking (auto-pause) | Heartbeat system |
| Public gallery filter | Same field — unintended |

Result: hiding your browser tab removes your session from the gallery. Returning to the tab adds it back. Sessions flicker in and out of the gallery as the user navigates.

## Design

All sessions are always public. Sessions appear in the gallery based on `isPublic`, a stable field that never changes after creation. The heartbeat system manages `isVisible` independently for auto-pause purposes only.

### New field

```prisma
model AiSession {
  isPublic  Boolean  @default(true)  // gallery visibility — always true, never touched by heartbeat
  isVisible Boolean  @default(true)  // operational: tab tracking / auto-pause
}
```

```sql
ALTER TABLE AiSession ADD COLUMN isPublic BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX AiSession_isPublic_updatedAt_idx ON AiSession (isPublic, updatedAt);
```

### What changes

| Location | Change |
|---|---|
| Gallery query | `WHERE isPublic = true` instead of `WHERE isVisible = true` |
| `canReadSession` | `session.isPublic \|\| owner` instead of `session.isVisible \|\| owner` |
| Fork permission | check `isPublic` not `isVisible` |
| Heartbeat / resume / watchdog | no change to `isPublic` — only touch `isVisible` |
| Session create | `isPublic: true` (already the default) |

No UI changes. No share toggle. No privacy controls.

## Implementation order

1. Schema migration — add column + index
2. Gallery query — swap `isVisible` → `isPublic`
3. `canReadSession` — swap `isVisible` → `isPublic`
4. Fork endpoint — swap `isVisible` → `isPublic`
