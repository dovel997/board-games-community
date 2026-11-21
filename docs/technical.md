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
| Frontend hosting | Cloudflare Pages (free), deployed by GitHub Actions | **Decided** |
| Backend | ASP.NET Core 8 Web API (C#) | **Decided** |
| Data access | Entity Framework Core 8 + Npgsql (queries only, no EF migrations) | _Proposed_ |
| Database | PostgreSQL | **Decided** |
| Schema & migrations | Flyway, plain SQL files in `database/` | **Decided** |
| Auth | Custom auth, **no ASP.NET Core Identity** | **Decided** |
| Auth mechanism | JWT bearer tokens (`Microsoft.AspNetCore.Authentication.JwtBearer`) | **Decided** |
| Token handling | Short-lived access token in memory + rotating refresh token in an HttpOnly cookie | _Proposed_ |
| Password hashing | Argon2id (e.g. `Konscious.Security.Cryptography`) or BCrypt | _Proposed_ |
| API docs | OpenAPI / Swagger (Swashbuckle) | _Proposed_ |
| CI/CD | GitHub Actions | **Decided** |
| Container registry | GitHub Container Registry (GHCR) | _Proposed_ |
| Server | Linux VPS | **Decided** |
| Web server / reverse proxy | nginx | **Decided** |
| TLS | Let's Encrypt (certbot) | _Proposed_ |

## 2. Repository layout

```
/
├── frontend/   React app (Vite)
├── backend/    ASP.NET Core 8 solution (API, domain, tests)
├── database/   Flyway SQL migrations, schema snapshot, seed data, local Postgres, backup scripts
├── docs/       features.md, technical.md, cloudflare-deployment.md
└── .github/    GitHub Actions workflows, Dependabot, templates
```

## 3. Architecture

```
Browser ──► example.com      → Cloudflare Pages (static React build)
        └─► api.example.com  → Cloudflare proxy → VPS: nginx → ASP.NET Core API (Kestrel, localhost:5000)
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
- Production build is static files in `frontend/dist`, hosted on Cloudflare Pages — see [cloudflare-deployment.md](cloudflare-deployment.md).

## 5. Backend

- .NET 8, ASP.NET Core Web API with controllers.
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
| `frontend-deploy.yml` | PR / push touching `frontend/**` | install, lint, test, build, deploy to Cloudflare Pages (preview on PRs, production on `main`) |
| `backend-ci.yml` | PR / push touching `backend/**` | restore, build, test |
| `database-ci.yml` | PR / push touching `database/**` | spin up Postgres service, `flyway migrate` + `validate` on an empty DB |
| `deploy.yml` | push to `main` (or manual) | build backend, run migrations, deploy to VPS |

### Backend deployment flow

1. Publish the backend (`dotnet publish -c Release`) — or build a Docker image and push to GHCR (_to decide_).
2. Copy artifacts and `database/migrations` to the VPS over SSH (key stored in GitHub secrets).
3. Back up the production database (`pg_dump`).
4. Run `flyway migrate` against production (Flyway CLI or the Flyway Docker image on the VPS; credentials from the `production` environment secrets).
5. Restart the API service (systemd) and reload nginx if its config changed.
6. Hit `/api/health` to confirm the deploy.

The frontend deploys separately to Cloudflare Pages, so the API must stay compatible with the previous frontend version during a release.

Migrations run **before** the new API starts, so every migration must stay compatible with the currently running API version.

### Other GitHub features

- **Environments**: `production` with required reviewers and its own secrets.
- **Branch protection** on `main`: PR required, CI must pass.
- **Dependabot** for npm, NuGet and GitHub Actions updates.
- **Issues + Projects** for tracking work; PR and issue templates.
- **Releases / tags** for versioned deploys.

## 9. Server (VPS)

- Linux (e.g. Ubuntu LTS).
- nginx: serves `api.example.com` and reverse-proxies `/api/` to Kestrel on `localhost:5000`. The frontend is not hosted here.
- Behind the Cloudflare proxy with SSL mode **Full (strict)**; nginx should accept web traffic only from Cloudflare IP ranges.
- API runs as a **systemd** service under a dedicated non-root user.
- PostgreSQL installed locally, listening only on localhost.
- Firewall (ufw): allow only 22, 80, 443.
- SSH: key-based only, password login disabled.
- Logs: API logs to journald / files (Serilog), with rotation.

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

- Deploy the backend as a plain `dotnet publish` + systemd, or as a Docker image from GHCR?
- Image/avatar storage: VPS disk or external object storage?
- Email provider for confirmations and notifications.
- Monitoring/alerting (uptime check, error tracking).
