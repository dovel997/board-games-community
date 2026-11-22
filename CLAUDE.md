# Board Games Community

Web platform for board game players: profiles, game catalog, personal collections, game sessions, groups and discussions.

## Read first

- [docs/features.md](docs/features.md) — what we're building (requirements with IDs like `F-4.1`).
- [docs/technical.md](docs/technical.md) — stack, architecture, deployment, conventions.

Keep both docs up to date when a change affects requirements or technical decisions.

## Layout

| Folder | What | Own instructions |
|--------|------|------------------|
| `frontend/` | React + TypeScript (Vite) | [frontend/CLAUDE.md](frontend/CLAUDE.md) |
| `backend/` | ASP.NET Core 10 Web API (C#), Docker | [backend/CLAUDE.md](backend/CLAUDE.md) |
| `database/` | PostgreSQL schema: Flyway SQL migrations, seed data, local setup, backup scripts | [database/CLAUDE.md](database/CLAUDE.md) |
| `docs/` | Project documentation | — |
| `.github/` | GitHub Actions workflows, Dependabot | — |

## Architecture rules

- Frontend talks to the backend only via `/api/v1/...`. Never access the database from the frontend.
- Only the backend connects to PostgreSQL.
- Production: frontend on Cloudflare Workers static assets (`board-games-community.com`); API and PostgreSQL on a VPS behind nginx (`api.board-games-community.com`). JWT auth (access token in memory, refresh token in an HttpOnly cookie); the API needs CORS for the frontend origin.
- The schema is owned by `database/`: changes only through Flyway SQL migrations (`database/migrations/V<n>__*.sql`). The backend uses EF Core for data access only — no EF migrations. Never edit a production schema by hand.
- A schema change usually touches `database/` (migration) **and** `backend/` (EF mappings, DTOs) — do both in the same change.

## Working rules

- Keep changes scoped to one part (frontend / backend / database) where possible; if an API contract changes, update both sides in the same change.
- Never commit secrets, `.env` files, connection strings with passwords, or `appsettings.*.local.json`.
- Each folder has its own `.gitignore`; the root `.gitignore` covers repo-wide files (e.g. `.vs/`).
- Branches: `feature/...`, `fix/...`, PR into `main`. CI must pass.
- Commit messages: short imperative summary.
- Add or update tests with every behaviour change.
