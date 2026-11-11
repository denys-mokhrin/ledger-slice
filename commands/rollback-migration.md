---
description: Roll back one applied migration of one context in the Bonus Ledger scaffold with the procedure that actually works on Prisma 7 (down.sql, then remove the history row).
argument-hint: <context> <migration folder name>
allowed-tools: Bash, Read, Glob
---

Roll back the migration `$ARGUMENTS[1]` of the context `$ARGUMENTS[0]`.

Why this command exists: ADR 0002 documents `prisma migrate resolve --rolled-back`, but Prisma
accepts that only for a migration that failed (error P3012). After a successful migration it
leaves the history saying "applied" while the table is gone, and `pnpm db:migrate` then refuses
to re-create it. The procedure below was verified on Prisma 7.10.1.

Facts about this project:

- Contexts and their Postgres schemas: `identity` → `identity`, `integrations` → `integrations`,
  `contribution` → `contribution`, `bonus-review` → `bonus_review`, `billing` → `billing`.
- Migrations live in `src/modules/<context>/db/migrations/` (`contribution`: `infra/db/migrations/`).
- The Prisma CLI needs the environment variable `PRISMA_CONTEXT=<context>`, the flag
  `--config prisma.config.ts`, and `DATABASE_URL`.

Steps:

1. Find the migration folder and check that `down.sql` exists in it. If it does not, stop and say
   so: do not write SQL from memory.
2. Read `down.sql` and say in one line what it drops.
3. Run it: `prisma db execute --file <folder>/down.sql --config prisma.config.ts` with
   `PRISMA_CONTEXT=$ARGUMENTS[0]`.
4. Remove the history row with `prisma db execute --stdin --config prisma.config.ts`
   (same `PRISMA_CONTEXT`) and this SQL:
   `DELETE FROM "<schema>"."_prisma_migrations" WHERE migration_name = '$ARGUMENTS[1]';`
5. Verify: the objects from `down.sql` are gone and the history has no row for `$ARGUMENTS[1]`.
6. Report what was dropped and that `pnpm db:migrate` will now re-apply the migration. Do not
   re-apply it yourself unless asked.

Never run `prisma migrate resolve --rolled-back` and never use `prisma migrate reset`: the
first does not work here, the second wipes the whole schema.
