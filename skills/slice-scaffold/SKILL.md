---
name: slice-scaffold
description: Database step of a new entity slice in the Bonus Ledger scaffold. Use when adding a new entity, table or Prisma model to a bounded context under src/modules, or when the user runs /ledger-slice:slice-scaffold <context> <Entity> <fields>. Adds the model, creates the migration with a hand-written down.sql and proves the rollback.
argument-hint: <context> <Entity> <field list and rules>
---

# slice-scaffold: model + migration + proven rollback

Arguments: `$ARGUMENTS` — the context (`identity`, `integrations`, `contribution`, `bonus-review`,
`billing`), the entity name in PascalCase, then the fields and rules in plain words.

This is step 1 of 3. Steps 2 and 3 are `/ledger-slice:slice-build` and `/ledger-slice:slice-ship`.
Do only the database step here: no controller, service, repo or specs.

## Decisions that are already made

The project owner settled these while building the first slice (`identity/teams`). Do not stop to
re-confirm them and do not re-read AGENTS.md, ARCHITECTURE.md or the ADRs to rediscover them.
Stop and ask only about something this list does not cover.

- The model lives only in the context's own `schema.prisma`
  (`src/modules/<context>/db/schema.prisma`; `contribution` uses `infra/db/`).
- `id String @id @db.Uuid`, no `@default`. The application sets it with `newId()`.
- `companyId String @db.Uuid` on every table: every record belongs to one tenant.
- `createdAt DateTime @db.Timestamptz(3)`, no `@default(now())`. The application sets it from the
  injected `Clock`. No database defaults, triggers or business CHECK constraints at all.
- References to other entities are ids only. A relation or foreign key is allowed only to a table
  of the same Postgres schema; never across contexts.
- Table name: `@@map("<snake_case singular>")`, e.g. `team`, `member`.
- Enums are Prisma enums inside the same schema file.
- Doc comments (`///`) on the model and on every non-obvious field, as in `Team`.
- Provider data (Jira keys, ids, DTO field names) never goes into a model outside
  `integrations`. If the request asks for it, leave the field out and say so in the report.
- Domain terms exactly as in `docs/bc-map.md`.

## Steps

1. Read only: the target `schema.prisma`, and `docs/bc-map.md` section of that context for the
   term definitions. Nothing else is needed.
2. Add the model (and enums). Mirror the style of the existing `Team` model.
3. Create the migration:
   `pnpm db:migrate:dev <context> create_<snake_case entity>`.
   Just run it: assume `DATABASE_URL` is set in the shell and Postgres is reachable. Do not
   check Docker, do not run `docker compose` and do not look for `.env` first (the database may run
   in a Docker engine that the host `docker` CLI does not see, for example inside WSL). Stop only if the
   command itself fails to connect, and then quote its error.
4. Write `down.sql` next to the generated `migration.sql`. Start it with the same header as
   `src/modules/identity/db/migrations/*_create_team/down.sql`: what it reverts and the working
   rollback procedure. Body: `DROP TABLE IF EXISTS "<schema>"."<table>";` and
   `DROP TYPE IF EXISTS "<schema>"."<Enum>";` for every enum the migration created.
5. Run `pnpm db:generate`.
6. Prove the rollback once, with the procedure of `/ledger-slice:rollback-migration`:
   run `down.sql`, check the table is gone, delete the history row, run `pnpm db:migrate`,
   check the table is back. Never use `prisma migrate resolve --rolled-back` (see that command).
7. Run `pnpm typecheck`.

## Report

Answer in this shape and stop:

- the table: columns with type and nullability, indexes and unique constraints;
- the migration folder name;
- one line each: migrate applied, rollback proven, typecheck result;
- anything you left out or changed against the request, with the rule that made you do it.

Nothing is committed in this step.
