# Database — PostgreSQL + Flyway

See [../docs/technical.md](../docs/technical.md) for the data model and architecture.

**This folder owns the database schema.** All tables, indexes, constraints, views and functions are created and changed here via Flyway SQL migrations. The backend only maps to the schema — it never creates or migrates it.

## Layout

```
database/
├── migrations/          versioned migrations: V1__create_users.sql, V2__create_games.sql, ...
├── repeatable/          repeatable migrations: R__views.sql, R__functions.sql
├── seed/                dev-only seed data (separate Flyway location, never used in production)
├── schema/schema.sql    generated snapshot of the current schema — reference only, never edit by hand
├── scripts/             backup / restore / schema snapshot scripts
├── flyway.toml          Flyway config; connection details come from environment variables
├── docker-compose.yml   local PostgreSQL 16 + Flyway
└── .env.example         placeholder local credentials (copy to .env)
```

## Commands

```bash
docker compose -f database/docker-compose.yml up -d                  # start local Postgres
docker compose -f database/docker-compose.yml run --rm flyway migrate  # apply migrations
docker compose -f database/docker-compose.yml run --rm flyway info     # show migration status
docker compose -f database/docker-compose.yml run --rm flyway validate # check applied vs. files
docker compose -f database/docker-compose.yml down -v                 # stop and wipe local data
```

## Writing migrations

- File name: `V<next number>__<snake_case_description>.sql` (two underscores). Check `migrations/` for the highest number first.
- One logical change per migration.
- **Never edit or rename a migration that is on `main` or applied to production.** Fix forward with a new migration.
- Use repeatable `R__*.sql` only for objects that can be fully recreated (views, functions); write them with `CREATE OR REPLACE`.
- Migrations run before the new API version starts, so they must not break the currently running API. Split destructive changes (rename/drop column) into several releases: add new → backfill → switch code → drop old.
- Large data backfills go in their own migration, batched where needed.
- After adding a migration, apply it locally and regenerate `schema/schema.sql` (`pg_dump --schema-only`).
- When a table or column changes, tell the user the backend EF Core mappings and DTOs need matching updates (or update them in the same change).

## Schema conventions

- snake_case names; plural table names (`users`, `game_sessions`, `session_participants`).
- Primary keys: `id` (`uuid` or `bigint generated always as identity` — follow whatever existing tables use).
- Foreign keys named `<table_singular>_id`, always with an explicit `FOREIGN KEY` constraint and an index.
- Timestamps as `timestamptz`, stored in UTC; `created_at` / `updated_at` with defaults.
- Use `CHECK` constraints and `NOT NULL` to enforce rules in the database, not only in the API.
- Enums as `text` + `CHECK` constraint (easier to migrate than Postgres enum types).
- Auth is custom (no ASP.NET Core Identity): `users` stores email (unique, case-insensitive), password hash, role; `user_tokens` stores hashed email-confirmation / password-reset tokens with expiry; `refresh_tokens` stores hashed JWT refresh tokens (family id, expiry, revoked at, replaced by). Never store plain-text passwords or tokens.

## Rules

- Local credentials live in `database/.env` (gitignored). Keep `.env.example` committed with placeholders.
- Seed scripts must be idempotent (`INSERT ... ON CONFLICT DO NOTHING`) and dev-only.
- Production PostgreSQL listens on localhost only; never expose port 5432.
- Backup scripts use `pg_dump` and read passwords from environment variables or `~/.pgpass` — never hardcode them.
- Never commit dumps, backups or real user data.
