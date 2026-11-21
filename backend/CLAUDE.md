# Backend — ASP.NET Core 8 Web API

See [../docs/technical.md](../docs/technical.md) for the full stack and architecture.

## Stack

- .NET 8, ASP.NET Core Web API (controllers), C#
- Entity Framework Core 8 + Npgsql (PostgreSQL) — data access only; the schema is owned by Flyway in `../database/`
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
dotnet run --project src/BoardGames.Api
```

Before running the API locally, start Postgres and apply migrations from `../database/` (see [../database/CLAUDE.md](../database/CLAUDE.md)).

## Structure

```
backend/
├── BoardGames.sln
├── src/
│   ├── BoardGames.Api/             controllers, auth, middleware, Program.cs
│   ├── BoardGames.Core/            entities, business logic, interfaces (no EF/ASP.NET deps)
│   └── BoardGames.Infrastructure/  DbContext, EF entity mappings, external services
└── tests/
    └── BoardGames.Tests/
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
- Secrets: `dotnet user-secrets` locally, environment variables on the server. Never put real connection strings or keys in `appsettings.json`.
- Use `DateTimeOffset` / UTC for all timestamps.
- Add unit tests for Core logic and integration tests for endpoints.
- Keep `/api/health` working — the deploy workflow depends on it.
