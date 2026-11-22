# Backend — ASP.NET Core 10 Web API

See [../docs/technical.md](../docs/technical.md) for the full stack and architecture, and [../docs/vps-backend-deployment.md](../docs/vps-backend-deployment.md) for deployment.

## Stack

- .NET 10, ASP.NET Core Web API (controllers), C#
- Runs in Docker in production (`Dockerfile`), deployed to the VPS by `.github/workflows/backend-deploy.yml`
- Entity Framework Core 10 + Npgsql (PostgreSQL) — data access only; the schema is owned by Flyway in `../database/`
- Custom JWT authentication (`AddJwtBearer`) — **do not use ASP.NET Core Identity** (no `AddIdentity`, `UserManager`, `SignInManager`, `IdentityDbContext`)
  - Short-lived access token (~15 min) returned in the login/refresh response body
  - Rotating refresh token in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie scoped to `/api/v1/auth`; only its hash is stored (`refresh_tokens` table); reuse of a revoked token revokes the whole family
  - JWT signing key, issuer, audience and lifetimes come from configuration/secrets — never hardcoded
- Passwords hashed with Argon2id or BCrypt in a dedicated password hasher service
- Swagger / OpenAPI
- xUnit for tests, Testcontainers for PostgreSQL integration tests
- Serilog for logging

## Commands

```bash
dotnet restore
dotnet build
dotnet test
dotnet run --project src/BoardGames.Api        # http://localhost:5000 (the frontend dev server proxies /api here)

# Production image, run like on the VPS
docker build -t board-games-api:local --build-arg APP_VERSION=local .
docker run --rm -p 127.0.0.1:5000:8080 board-games-api:local
```

Before running the API locally, start Postgres and apply migrations from `../database/` (see [../database/CLAUDE.md](../database/CLAUDE.md)).

## Structure

```
backend/
├── BoardGames.slnx
├── Dockerfile                      production image (sdk:10.0 build → aspnet:10.0 runtime, non-root, port 8080)
├── deploy/                         copied to / used on the VPS
│   ├── docker-compose.yml          production stack in /opt/board-games (API on 127.0.0.1:5000)
│   ├── deploy.sh                   pull + restart + health check (run by GitHub Actions over SSH)
│   ├── nginx/                      api-http.conf (temporary test), api.conf (HTTPS via Cloudflare)
│   └── scripts/cloudflare-ips.sh   nginx real IP + ufw Cloudflare-only rules
├── src/
│   ├── BoardGames.Api/             controllers, auth, middleware, Program.cs
│   ├── BoardGames.Core/            entities, business logic, interfaces (no EF/ASP.NET deps) — to add
│   └── BoardGames.Infrastructure/  DbContext, EF entity mappings, external services — to add
└── tests/
    └── BoardGames.Tests/           xUnit + WebApplicationFactory
```

Dependencies point inward: Api → Infrastructure → Core. Core depends on nothing.

## Rules

- Routes under `/api/v1/`; plural resource names (`/api/v1/sessions/{id}/participants`).
- Controllers stay thin: validate, call a service, map to DTO. Business logic lives in Core.
- Never return EF entities from controllers — use request/response DTOs.
- Errors as `ProblemDetails` (RFC 7807) with correct status codes.
- Use `async`/`await` with `CancellationToken` for all I/O.
- Paging on every list endpoint (`page`, `pageSize`, capped max).
- Authorization via `[Authorize]` and roles/policies (Player, Moderator, Admin); check resource ownership (e.g. only the host edits a session).
- Rate-limit auth endpoints.
- **No EF Core migrations, no `EnsureCreated()`, no `dotnet ef database update`.** Schema changes are Flyway SQL migrations in `../database/migrations/`. If a feature needs a schema change, write the migration there and update the EF mappings here in the same change.
- EF entity configurations must match the real schema (`../database/schema/schema.sql` is the reference). snake_case names via EFCore.NamingConventions.
- Integration tests create the test database by running the Flyway migrations against a Testcontainers Postgres instance.
- Secrets: `dotnet user-secrets` locally; on the VPS in `/opt/board-games/api.env` (env vars, `Section__Key` format). Never put real connection strings or keys in `appsettings.json` or the image.
- Use `DateTimeOffset` / UTC for all timestamps.
- Add unit tests for Core logic and integration tests for endpoints.
- Keep `/api/health` working and reporting `version` (from `APP_VERSION`) — `deploy/deploy.sh` waits for it to report the new git SHA.
- Docker: keep the container listening on 8080 and running as non-root; keep the Compose port bound to `127.0.0.1` (Docker-published ports bypass ufw). If a new project is added under `src/`, update the `Dockerfile` COPY/restore lines.
