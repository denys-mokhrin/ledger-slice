// Self-test of the two hooks: node --test tests/
// Each case feeds a PreToolUse payload on stdin and checks the exit code (2 = blocked).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const hooksDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'hooks');
const project = mkdtempSync(join(tmpdir(), 'ledger-slice-'));

function run(script, payload) {
  const result = spawnSync(process.execPath, [join(hooksDir, script)], {
    input: JSON.stringify({ cwd: project, ...payload }),
    encoding: 'utf8',
  });
  return { code: result.status, stderr: result.stderr };
}

const write = (file_path, content) => ({ tool_name: 'Write', tool_input: { file_path, content } });
const edit = (file_path, new_string) => ({ tool_name: 'Edit', tool_input: { file_path, old_string: 'x', new_string } });
const bash = (command) => ({ tool_name: 'Bash', tool_input: { command } });

const members = 'D:\\repo\\src\\modules\\identity\\members\\members.service.ts';

test('boundary-guard allows own context and shared imports', () => {
  const body = [
    "import { newId } from '../../../shared/ids';",
    "import { IdentityDb } from '../db/client';",
    "import { TeamsRepo } from '../teams/teams.repo';",
    "import { Injectable } from '@nestjs/common';",
  ].join('\n');
  assert.equal(run('boundary-guard.mjs', write(members, body)).code, 0);
});

test('boundary-guard allows another context through its public facade', () => {
  const body = "import type { CompanyRegistered } from '../../billing/public';";
  assert.equal(run('boundary-guard.mjs', write(members, body)).code, 0);
  const deep = "import { BillingFacade } from '../../billing/public/billing.facade';";
  assert.equal(run('boundary-guard.mjs', write(members, deep)).code, 0);
});

test('boundary-guard blocks another context internals (Write)', () => {
  const body = "import { ContributionDb } from '../../contribution/infra/db/client';";
  const result = run('boundary-guard.mjs', write(members, body));
  assert.equal(result.code, 2);
  assert.match(result.stderr, /reaches into the internals of 'contribution'/);
});

test('boundary-guard blocks another context internals (Edit, forward slashes, src alias)', () => {
  const file = '/repo/src/modules/billing/invoices/invoices.repo.ts';
  const result = run('boundary-guard.mjs', edit(file, "const { IdentityDb } = require('src/modules/identity/db/client');"));
  assert.equal(result.code, 2);
});

test('boundary-guard blocks shared importing a module', () => {
  const file = 'D:\\repo\\src\\shared\\ids\\index.ts';
  const result = run('boundary-guard.mjs', write(file, "import { Team } from '../../modules/identity/teams/team';"));
  assert.equal(result.code, 2);
  assert.match(result.stderr, /src\/shared must not import/);
});

test('boundary-guard blocks silencing the boundary lint rule', () => {
  const body = "// eslint-disable-next-line boundaries/element-types\nimport { x } from './x';";
  assert.equal(run('boundary-guard.mjs', write(members, body)).code, 2);
});

test('boundary-guard ignores tests, non-TypeScript files and broken payloads', () => {
  const spec = 'D:\\repo\\test\\identity\\members.int-spec.ts';
  assert.equal(run('boundary-guard.mjs', write(spec, "import { BillingDb } from '../../src/modules/billing/db/client';")).code, 0);
  assert.equal(run('boundary-guard.mjs', write('D:\\repo\\src\\modules\\identity\\README.md', "from '../../billing/db/client'")).code, 0);
  const broken = spawnSync(process.execPath, [join(hooksDir, 'boundary-guard.mjs')], { input: 'not json', encoding: 'utf8' });
  assert.equal(broken.status, 0);
});

test('migration-guard blocks the two damaging Prisma commands', () => {
  const resolved = run('migration-guard.mjs', bash('pnpm exec prisma migrate resolve --rolled-back 20261110182920_create_team --config prisma.config.ts'));
  assert.equal(resolved.code, 2);
  assert.match(resolved.stderr, /rollback-migration/);
  assert.equal(run('migration-guard.mjs', bash('npx prisma migrate reset --force')).code, 2);
});

test('migration-guard allows the normal database commands', () => {
  for (const command of [
    'pnpm db:migrate',
    'pnpm db:migrate:dev identity create_member',
    'pnpm exec prisma migrate deploy --config prisma.config.ts',
    'pnpm exec prisma db execute --file down.sql --config prisma.config.ts',
    'pnpm exec prisma migrate resolve --applied 0001_init',
    'git status --short',
  ]) {
    assert.equal(run('migration-guard.mjs', bash(command)).code, 0, command);
  }
});

test('migration-guard ignores the forbidden command inside text that is only written to a file', () => {
  const heredoc = [
    "cat > src/modules/identity/db/migrations/x_create_member/down.sql <<'SQL'",
    '-- Never use `prisma migrate resolve --rolled-back` here, it fails with P3012.',
    'DROP TABLE IF EXISTS "identity"."member";',
    'SQL',
  ].join('\n');
  assert.equal(run('migration-guard.mjs', bash(heredoc)).code, 0);
  const hereString = ["@'", '-- prisma migrate reset wipes the schema', "'@ | Set-Content down.sql"].join('\n');
  assert.equal(run('migration-guard.mjs', bash(hereString)).code, 0);
  assert.equal(run('migration-guard.mjs', bash('# prisma migrate reset\npnpm db:migrate')).code, 0);
  const real = heredoc + '\npnpm exec prisma migrate reset --force';
  assert.equal(run('migration-guard.mjs', bash(real)).code, 2);
});

test('every block is written to .claude/ledger-slice-hook.log', () => {
  const log = join(project, '.claude', 'ledger-slice-hook.log');
  assert.ok(existsSync(log));
  const lines = readFileSync(log, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  assert.ok(lines.length >= 6);
  assert.ok(lines.every((line) => line.at && line.hook));
});
