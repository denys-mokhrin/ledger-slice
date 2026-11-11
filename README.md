# ledger-slice

A Claude Code plugin for one project: the [Bonus Ledger](https://github.com/denys-mokhrin/module-04-bonus-ledger)
scaffold (NestJS 11, Prisma 7, one Postgres schema per bounded context).

## Purpose

Adding an entity to Bonus Ledger is always the same vertical slice: Prisma model and migration
with a rollback, HTTP endpoints, unit and integration specs. Doing it by hand for the first
entity (`Team`) took five free-form prompts, and most of them repeated the same things: "read the
conventions first", the same four decisions, the same step order, the same four checks.
This plugin carries those decisions and steps, so the next entity takes three commands, and it
stops two mistakes that cost time in the first slice: an import across bounded contexts and the
documented-but-broken migration rollback.

## Install

The plugin is used from a local clone:

```bash
git clone https://github.com/denys-mokhrin/ledger-slice.git
cd module-04-bonus-ledger
claude --plugin-dir ../ledger-slice
```

Inside the session `/reload-plugins` picks up changes to the plugin without a restart.
Requirements: Node.js 22 or newer (the hooks are plain Node scripts, no install step).
Check the hooks with `node --test tests/hooks.test.mjs`.

## Commands

| Command | What it does |
|---|---|
| `/ledger-slice:rollback-migration <context> <migration>` | Rolls back one applied migration with the procedure that works on Prisma 7: runs `down.sql`, then removes the row from `"<schema>"."_prisma_migrations"` so `pnpm db:migrate` can re-apply it. |

Example:

```text
/ledger-slice:rollback-migration identity 20261110182920_create_team
```

## Skills

All three are invoked as commands; each one also triggers on its own when the request matches.

| Skill | Trigger | What it does |
|---|---|---|
| `/ledger-slice:slice-scaffold <context> <Entity> <fields>` | adding a new entity, table or Prisma model to a context | Adds the model by the project's database rules (ids and timestamps set by the application, no defaults, no cross-schema keys), creates the migration, writes `down.sql`, proves the rollback, runs typecheck. |
| `/ledger-slice:slice-build <context> <Entity> <endpoints and rules>` | adding endpoints, a service or a repo for an entity | Writes failing unit and integration specs, shows them red, then implements type, errors, repo, service and controller by mirroring the reference slice `identity/teams`. |
| `/ledger-slice:slice-ship <context> <Entity>` | a slice is implemented and needs the full check | Updates the context README, runs `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:int`, prints `git status` and `git diff --stat`, proposes the commit message. Does not commit. |

Example of a whole slice:

```text
/ledger-slice:slice-scaffold identity Member "teamId, displayName, role (Dev, QA, Lead, PM); displayName unique inside a team"
/ledger-slice:slice-build identity Member "POST /members, GET /members/:id; reject an unknown team"
/ledger-slice:slice-ship identity Member
```

## Hooks

Both hooks are `PreToolUse` and block the tool call with exit code 2 and a message for the agent.
Every block is appended to `.claude/ledger-slice-hook.log` in the project.

| Hook | Event and matcher | Blocks when |
|---|---|---|
| `boundary-guard` | `PreToolUse`, `Write\|Edit\|MultiEdit` | the text written to a file under `src/` imports another context's internals (anything in `src/modules/<other>/` except `public/`), or `src/shared/` imports from `src/modules/`, or a `boundaries` / `no-cycle` lint rule is silenced with `eslint-disable`. Tests and non-TypeScript files are ignored. |
| `migration-guard` | `PreToolUse`, `Bash\|PowerShell` | the command is `prisma migrate resolve --rolled-back` (works only for a failed migration, leaves the history out of sync) or `prisma migrate reset` (wipes the schema). Points to `/ledger-slice:rollback-migration`. |

`pnpm lint` enforces the same import rule later; the hook stops the mistake before the file is
written.

## License

MIT, see [LICENSE](LICENSE).
