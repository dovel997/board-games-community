# Frontend — React

See [../docs/technical.md](../docs/technical.md) for the full stack and architecture.

## Stack

- React + TypeScript (strict) with Vite
- React Router for routing
- TanStack Query for server state
- ESLint + Prettier
- Vitest + React Testing Library

## Commands

```bash
npm install        # install dependencies
npm run dev        # dev server (proxies /api to the local backend)
npm run build      # production build → dist/
npm run lint       # lint
npm test           # tests
```

## Structure

```
src/
├── api/          typed API client (single place for fetch calls)
├── components/   shared, reusable UI components
├── features/     one folder per feature (sessions, games, collection, profile, ...)
├── hooks/        shared hooks
├── pages/        route-level components
├── routes/       router setup
└── utils/        helpers
```

## Rules

- TypeScript everywhere; no `any` unless unavoidable and commented.
- Function components and hooks only.
- All backend calls go through `src/api/` — never call `fetch` directly in components.
- API base path is relative (`/api/v1`) — never hardcode hosts; same origin in production, Vite proxy in dev.
- Auth uses JWT: keep the access token **in memory only** (auth context/store) — never in `localStorage` or `sessionStorage`. The API client adds `Authorization: Bearer <token>`.
- The refresh token is an HttpOnly cookie the frontend can't read. On app load and on a 401, call `POST /api/v1/auth/refresh` (with `credentials: 'include'`) once, then retry the request; if refresh fails, log the user out. Make sure parallel 401s share a single refresh call.
- Keep API types in sync with the backend DTOs when contracts change.
- Responsive (mobile first) and accessible: semantic HTML, labels, keyboard navigation.
- UI text should be easy to move into translation files later — avoid scattering strings in logic.
- Environment-specific values via `import.meta.env.VITE_*`; never put secrets in frontend env vars.
- Add tests for components with logic and for hooks.
