# Session Routing

This file is now a short index document.

The previous content here was an implementation roadmap. The routing system has since been implemented and evolved.

## Source of Truth

Use this document for current architecture, behavior, and debugging guidance:

- `docs/DEVELOPER_URL_SESSION_ROUTING.md`

## Scope of Current Architecture

- URL/session identity (`/` vs `/:sessionId`)
- Session hydration and history-page behavior
- SSE lifecycle (cursor resume + dedupe)
- Pause/stop determinism and in-flight abort handling
- Session list cursor pagination
- Delete cascade semantics
- Worker startup stale-session recovery

## Notes

- Keep this file as a stable pointer for engineers looking for routing docs.
- Put implementation details and updates in `DEVELOPER_URL_SESSION_ROUTING.md`.
