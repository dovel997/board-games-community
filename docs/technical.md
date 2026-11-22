# Technical

> Status: **Draft**. Items marked **Decided** are fixed; items marked _Proposed_ are suggestions that can still change.
> Product requirements live in [features.md](features.md).

## 1. Stack

| Area | Choice | Status |
|------|--------|--------|
| Frontend | React | **Decided** |
| Frontend language / build | TypeScript + Vite | **Decided** |
| Frontend UI / routing | Mantine, React Router | **Decided** |
| Frontend server state | TanStack Query | _Proposed_ |
| Frontend hosting | Cloudflare Workers static assets (free), deployed by GitHub Actions | **Decided** |
| Backend | ASP.NET Core 10 Web API (C#, .NET 10) | **Decided** |
| Data access | Entity Framework Core 10 + Npgsql (queries only, no EF migrations) | _Proposed_ |
| Database | PostgreSQL | **Decided** |
| Schema & migrations | Flyway, plain SQL files in `database/` | **Decided** |
| Auth | Custom auth, **no ASP.NET Core Identity** | **Decided** |
| Auth mechanism | JWT bearer tokens (`Microsoft.AspNetCore.Authentication.JwtBearer`) | **Decided** |
| Token handling | Short-lived access token in memory + rotating refresh token in an HttpOnly cookie | _Proposed_ |
| Password hashing | Argon2id (e.g. `Konscious.Security.Cryptography`) or BCrypt | _Proposed_ |
| API docs | OpenAPI / Swagger (Swashbuckle) | _Proposed_ |
| CI/CD | GitHub Actions | **Decided** |
| Container registry | GitHub Container Registry (GHCR) | **Decided** |
| Backend hosting | Docker container (Compose) on the VPS, deployed by GitHub Actions over SSH | **Decided** |
| Server | Linux VPS | **Decided** |
| Web server / reverse proxy | nginx | **Decided** |
| TLS | Let's Encrypt (certbot) | _Proposed_ |

## 2. Repository layout

```
/
├── frontend/   React app (Vite)
├── backend/    ASP.NET Core 10 solution (API, domain, tests), Dockerfile, deploy/ (compose, nginx, scripts)
├── database/   Flyway SQL migrations, schema snapshot, seed data, local Postgres, backup scripts
├── docs/       features.md, technical.md, cloudflare-deployment.md, vps-backend-deployment.md
└── .github/    GitHub Actions workflows, Dependabot, templates
```

## 3. Architecture

```
Browser ──► example.com      → Cloudflare Worker (static React build)
        └─► api.example.com  → Cloudflare proxy → VPS: nginx → API container (127.0.0.1:5000)
                                                                └── PostgreSQL (localhost:5432, not public)
```

- The frontend talks to the backend only through `https://api.example.com/api/v1/...`.
- Frontend and API are on different origins but the **same site**, so the API needs CORS for the frontend origin (with credentials), and the `SameSite=Strict` refresh cookie still works.
- Only the backend connects to the database. PostgreSQL is never exposed to the internet.

## 4. Frontend

- Vite + React + TypeScript, strict mode.
- Feature-based folders (`src/features/<feature>/`), shared UI in `src/components/`.
- API calls go through one typed client module; server state via TanStack Query.
- In development, Vite proxies `/api` to the local backend.
- UI: Mantine. Routing: React Router.
- Lint: oxlint. Tests: Vitest + React Testing Library.
- Production build is static files in `frontend/dist`, hosted on Cloudflare Workers (static assets, config in `frontend/wrangler.jsonc`) — see [cloudflare-deployment.md](cloudflare-deployment.md).

## 5. Backend

- .NET 10, ASP.NET Core Web API with controllers. Runs in Docker in production (`backend/Dockerfile`).
- Proposed solution structure:
  - `BoardGames.Api` — controllers, auth, startup, middleware
  - `BoardGames.Core` — domain entities, business logic, interfaces
  - `BoardGames.Infrastructure` — EF Core `DbContext` and entity mappings (to the Flyway-managed schema), external services
  - `BoardGames.Tests` — xUnit unit + integration tests (Testcontainers for Postgres, schema created by running the Flyway migrations)
- REST + JSON, versioned under `/api/v1/`.
- List endpoints support paging, filtering and sorting.
- Errors returned as RFC 7807 `ProblemDetails`.
- Request validation with FluentValidation or data annotations.
- Configuration via `appsettings.json` + environment variables; secrets never committed (use `dotnet user-secrets` locally).
- Health check endpoint: `/api/health`.

## 6. Database

- PostgreSQL 16.
- Schema is owned by the `database/` folder and managed with **Flyway** using plain SQL migrations. No manual schema changes on servers.
- The backend uses EF Core only to read/write data; it maps entities to the existing schema and never creates or migrates it (no `EnsureCreated`, no EF migrations).
- Naming: snake_case tables and columns, plural table names (EF Core mapped via `EFCore.NamingConventions`).

### `database/` layout

```
database/
├── migrations/          Flyway versioned migrations: V1__create_users.sql, V2__create_games.sql, ...
├── repeatable/          Flyway repeatable migrations: R__views.sql, R__functions.sql
├── seed/                dev-only seed data (applied as a separate Flyway location)
├── schema/schema.sql    generated snapshot of the current schema (reference only, never edited by hand)
├── scripts/             backup / restore / schema snapshot scripts
├── flyway.toml          Flyway config (connection read from environment variables)
├── docker-compose.yml   local Postgres + Flyway
└── .env.example         placeholder local credentials
```

### Migration rules

- Versioned files: `V<number>__<description>.sql`, e.g. `V3__add_session_visibility.sql`. Numbers only go up.
- Never edit a migration that has been applied anywhere shared (main, production). Fix forward with a new migration.
- Flyway `validate` runs in CI so edited or missing migrations fail the build.
- Destructive changes (drop/rename column) are done in steps so the running API keeps working during deploys.
- After adding a migration, regenerate `schema/schema.sql` (`pg_dump --schema-only`) so reviewers can see the full current schema.

### Backups

- Daily automated backups (`pg_dump`) on the VPS, kept off-server as well.
- A backup is taken right before every production migration.

### Initial data model

- **User** — email, email confirmed, password hash, role, display name, avatar, area, bio, created at, last login
- **UserToken** — user, type (email confirmation / password reset), token hash, expires at, used at
- **RefreshToken** — user, token hash, family id, expires at, revoked at, replaced by, created at, user agent / IP
- **Game** — name, description, image, min/max players, play time, min age, categories
- **CollectionItem** — user, game, status (owned / wishlist / want to play)
- **Session** — host, title, date/time, location, max players, visibility
- **SessionGame** — session, game
- **SessionParticipant** — session, user, status (joined / waitlisted / left)
- **PlayResult** — session, game, user, score, is winner
- **Group**, **GroupMember** — group info, member role
- **Comment** — author, target (session / game / group), text
- **Review** — user, game, rating, text
- **Notification** — user, type, payload, read at

## 7. Security

- Custom authentication (no ASP.NET Core Identity):
  - Passwords hashed with Argon2id or BCrypt; never stored or logged in plain text.
  - Login returns a **JWT access token** (HS256 or RS256, ~15 min lifetime) with user id (`sub`) and role as claims. The API validates it with `AddAuthentication().AddJwtBearer()`.
  - Login also issues a **refresh token** (random, ~14–30 days) in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie scoped to `/api/v1/auth`. Only its hash is stored in `refresh_tokens`.
  - `POST /api/v1/auth/refresh` rotates the refresh token (old one revoked, new one issued). Reuse of a revoked token revokes the whole token family (theft detection).
  - Logout revokes the refresh token and clears the cookie. Password change / reset revokes all of the user's refresh tokens.
  - Signing key comes from configuration/secrets, never committed; issuer, audience and lifetime are validated.
  - Email confirmation and password reset use single-use, expiring random tokens; only a hash of the token is stored.
  - Generic error messages on login/reset so they don't reveal whether an email is registered.
  - Account lockout or increasing delay after repeated failed logins.
- Frontend keeps the access token **in memory only** (never `localStorage`/`sessionStorage`) and sends it as `Authorization: Bearer <token>`. On page load or a 401 it calls the refresh endpoint to get a new one.
- Role-based authorization: Player, Moderator, Admin.
- Rate limiting on login, registration and password reset (ASP.NET Core rate limiter).
- HTTPS only; nginx redirects HTTP → HTTPS and sets security headers (HSTS, CSP, X-Content-Type-Options).
- Secrets in GitHub Actions secrets / environment variables on the VPS; never in the repo.
- Exact user addresses are never shown publicly — only area/city.

## 8. CI/CD (GitHub)

### Workflows (`.github/workflows/`)

| Workflow | Trigger | Does |
|----------|---------|------|
| `frontend-deploy.yml` | PR / push touching `frontend/**` | install, lint, test, build, deploy to Cloudflare Workers (preview on PRs, production on `main`) |
| `backend-deploy.yml` | PR / push touching `backend/**` | test; on `main`: build Docker image → GHCR → deploy to VPS |
| `database-ci.yml` | PR / push touching `database/**` | spin up Postgres service, `flyway migrate` + `validate` on an empty DB (_to add_) |

### Backend deployment flow

Setup guide: [vps-backend-deployment.md](vps-backend-deployment.md).

1. `dotnet test` (also on PRs).
2. Build the Docker image from `backend/Dockerfile` and push it to GHCR as `ghcr.io/<owner>/board-games-community-api:<git-sha>` (+ `latest`).
3. SSH to the VPS as the `administrator` user (key + pinned host key from the `production` environment secrets); copy `backend/deploy/docker-compose.yml` and `deploy.sh` to `/opt/board-games/`.
4. Log in to GHCR with the job's short-lived token, run `deploy.sh`: write the image tag to `.env`, `docker compose pull && up -d`, log out.
5. `deploy.sh` polls `http://127.0.0.1:5000/api/health` until it reports the new git SHA; otherwise the job fails and prints the container logs.
6. _To add with the database:_ back up (`pg_dump`) and run `flyway migrate` before step 4.

The frontend deploys separately to Cloudflare Workers, so the API must stay compatible with the previous frontend version during a release.

Migrations run **before** the new API starts, so every migration must stay compatible with the currently running API version.

### Other GitHub features

- **Environments**: `production` with required reviewers and its own secrets.
- **Branch protection** on `main`: PR required, CI must pass.
- **Dependabot** for npm, NuGet and GitHub Actions updates.
- **Issues + Projects** for tracking work; PR and issue templates.
- **Releases / tags** for versioned deploys.

## 9. Server (VPS)

- Linux (e.g. Ubuntu LTS).
- nginx (on the host): serves `api.example.com` and reverse-proxies `/api/` to the API container on `127.0.0.1:5000`. The frontend is not hosted here. Configs in `backend/deploy/nginx/`.
- Behind the Cloudflare proxy with SSL mode **Full (strict)** and a Cloudflare Origin Certificate; ufw allows 80/443 only from Cloudflare IP ranges (`backend/deploy/scripts/cloudflare-ips.sh`).
- API runs as a **Docker container** (Docker Compose, project in `/opt/board-games`), image from GHCR, as a non-root user inside the container. Port published on `127.0.0.1` only — Docker-published ports bypass ufw.
- App secrets in `/opt/board-games/api.env` on the VPS (loaded by Compose), never in the repo.
- GitHub Actions deploys as the existing `administrator` user (member of the `docker` group), with a dedicated SSH key.
- PostgreSQL: on the VPS, not exposed to the internet (_to decide: container in the same Compose project vs. host install_).
- Firewall (ufw): SSH + 80/443 (Cloudflare only).
- SSH: key-based only, password login disabled.
- Logs: container logs via Docker's json-file driver with rotation (`docker compose logs api`).

## 10. Local development

| Part | Command |
|------|---------|
| Database | `docker compose -f database/docker-compose.yml up -d` |
| Migrations | `docker compose -f database/docker-compose.yml run --rm flyway migrate` |
| Backend | `dotnet run --project backend/src/BoardGames.Api` |
| Frontend | `cd frontend && npm install && npm run dev` |

## 11. Conventions

- Branches: `feature/...`, `fix/...`; PR into `main`.
- Commit messages: short imperative summary (e.g. "Add session join endpoint").
- Code style: `.editorconfig` for C#, oxlint for TypeScript.
- Every feature has tests at the level that makes sense (unit for logic, integration for API).

## 12. Open questions

- Run PostgreSQL as a container in the same Compose project, or installed on the VPS host?
- Image/avatar storage: VPS disk or external object storage?
- Email provider for confirmations and notifications.
- Monitoring/alerting (uptime check, error tracking).
