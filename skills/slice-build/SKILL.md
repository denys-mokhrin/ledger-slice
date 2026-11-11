---
name: slice-build
description: Tests-first build step of an entity slice in the Bonus Ledger scaffold. Use after the model and migration exist, when adding HTTP endpoints, a service or a repo for an entity under src/modules, or when the user runs /ledger-slice:slice-build <context> <Entity> <endpoints and rules>. Writes failing unit and integration specs, shows them red, then implements controller, service and repo until they are green.
argument-hint: <context> <Entity> <endpoints and business rules>
---

# slice-build: failing specs, then handler / service / repo

Arguments: `$ARGUMENTS` — the context, the entity in PascalCase, then the endpoints and the
business rules in plain words.

This is step 2 of 3. The model and the migration already exist (`/ledger-slice:slice-scaffold`).
The final checks and the summary are step 3 (`/ledger-slice:slice-ship`).

## Reference slice

`src/modules/identity/teams/` and `test/identity/teams.int-spec.ts` are the reference. Read those
files once and mirror them: same file names, same structure, same helper functions in the specs.
Do not re-read AGENTS.md, ARCHITECTURE.md or the ADRs; the rules that matter are below.

## Decisions that are already made

The project owner settled these while building the first slice. Do not stop to re-confirm them.
Stop and ask only about something this list does not cover.

Files, for an entity `Thing` in `<context>` (feature folder is the plural, kebab-case):

| File | Role |
|---|---|
| `src/modules/<context>/things/thing.ts` | the `Thing` type and `CreateThingInput` |
| `.../things/thing.errors.ts` | errors extending `DomainError`, fixed `code` (`THING_NOT_FOUND`) and `httpStatus` |
| `.../things/things.repo.ts` | the only code touching the context's Prisma client |
| `.../things/things.service.ts` | use cases and rules; throws only `DomainError` subclasses |
| `.../things/things.controller.ts` | handlers only, no logic |
| `.../things/things.service.spec.ts` | unit spec, no database, in-memory repo, `FixedClock` |
| `test/<context>/things.int-spec.ts` | Supertest against `AppModule` and real Postgres |
| `src/modules/<context>/<context>.module.ts` | register controller, repo, service |

Rules:

- Ids from `newId()` (`src/shared/ids`), time from `@Inject(CLOCK)` (`src/shared/clock`).
- `companyId` comes in the request body until auth exists; keep the same one-line comment as in
  `teams.controller.ts`.
- Request body and `:id` both go through `ZodValidationPipe` (`src/shared/validation`). Never use
  Nest's `ParseUUIDPipe` or `ValidationPipe`: the error code must be `VALIDATION_FAILED`.
- Write a zod schema used only in a parameter decorator inline in the decorator
  (ESLint `no-useless-assignment` flags it otherwise). Never add `eslint-disable`.
- The controller never throws `HttpException`; the global filter builds the envelope
  `{ error: { code, message, details? } }`.
- The service repeats the important input rules (callers may not come through HTTP).
- The repo maps a unique-index violation (`P2002`) to the same conflict error the service throws.
- Imports: own context files and `src/shared/**` only. Another context is reachable only through
  `src/modules/<other>/public/`. A hook blocks anything else.
- Integration specs are `*.int-spec.ts` (never `*.e2e-spec.ts`: those run without Docker). Each
  run uses fresh fake ids and deletes only its own rows in `afterAll`.
- No real names, tokens or salaries in test data.

## Steps

1. Read the reference slice (the files listed above for `teams`) and the entity's model in
   `schema.prisma`.
2. Write the unit spec and the integration spec for the requested endpoints and rules. Cover at
   least: happy path, invalid body (`VALIDATION_FAILED`), each business rule's error code, unknown
   id (`*_NOT_FOUND`), non-uuid id, error envelope shape.
3. Run both specs once and confirm they fail because the implementation is missing, not because
   of a typo:
   `pnpm test src/modules/<context>/things/things.service.spec.ts` and
   `pnpm test:int test/<context>/things.int-spec.ts`.
4. Implement type, errors, repo, service, controller; register them in the module.
5. Run the two specs again until they pass. Do not weaken a spec to make it pass; if a spec is
   wrong, say so in the report and fix the spec openly.

## Report

Answer in this shape and stop:

- endpoints added, with the status and error code of every non-200 path;
- test counts: unit and integration, red before and green after;
- every place where you deviated from the reference slice, with the reason;
- cases the code handles that no spec covers.

Nothing is committed in this step.
