---
name: slice-ship
description: Final step of an entity slice in the Bonus Ledger scaffold. Use when a slice is implemented and needs the full check before a commit, or when the user runs /ledger-slice:slice-ship <context> <Entity>. Runs typecheck, lint, unit and integration tests, updates the context README, and prepares the commit message and summary.
argument-hint: <context> <Entity>
---

# slice-ship: full checks, README, commit message

Arguments: `$ARGUMENTS` — the context and the entity in PascalCase.

This is step 3 of 3, after `/ledger-slice:slice-scaffold` and `/ledger-slice:slice-build`.

## Steps

1. Update `src/modules/<context>/README.md`: in the Features section add the entity, its table
   and rules, the endpoints with their error codes. Mirror the entry that exists for `Team`.
2. Run the four checks, in this order, and keep the exit codes:
   - `pnpm typecheck`
   - `pnpm lint`
   - `pnpm test`
   - `pnpm test:int`
3. If one fails: fix the code (not the check), then run all four again. Never add
   `eslint-disable`, never skip or weaken a spec.
4. Run `git status --short` and `git diff --stat`.

## Report

Answer in this shape and stop:

- the four checks with exit code and test counts;
- what you had to fix in this step, or "nothing";
- `git status --short` and `git diff --stat` output, plus the number of new files and lines;
- the proposed commit message, Conventional Commits, with this body line so the history shows
  how the slice was built:

  ```
  feat(<context>): add <Entity> with <endpoints>

  Built with the ledger-slice plugin: /ledger-slice:slice-scaffold, /ledger-slice:slice-build, /ledger-slice:slice-ship
  ```

Do not commit. The project owner commits after reading the report.
