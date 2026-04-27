# Yakyakai V2 UI/UX Overlay

Changed-files-only overlay focused on UI/UX, spacing, DRY CSS, responsive layout, and centralized design tokens.

## Goals

- Centralize design values as CSS tokens
- Split CSS into logical files
- Prefer simple reusable classes
- Keep page-level identity scoped to `.page-yakyakai`
- Avoid heavy shadows and 2D animation gimmicks
- Add subtle, classy micro-interactions
- Improve mobile/desktop layout
- Keep Tailwind available for local one-off layout only, but use CSS classes for the design system

## Suggested import order

In `client/src/main.jsx` or `client/src/App.jsx`:

```js
import './styles/index.css'
```

This file imports:

```css
tokens.css
base.css
layout.css
components.css
pages/yakyakai.css
utilities.css
```

## Suggested component usage

Replace or merge your current app shell with:

- `client/src/components/ui/AppShell.jsx`
- `client/src/components/ui/TopBar.jsx`
- `client/src/components/ui/RunControls.jsx`
- `client/src/components/ui/PromptComposer.jsx`
- `client/src/components/ui/StreamRiver.jsx`
- `client/src/components/ui/UsagePill.jsx`

These are intentionally generic and low-dependency.
