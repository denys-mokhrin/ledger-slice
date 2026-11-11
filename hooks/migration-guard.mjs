#!/usr/bin/env node
/**
 * PreToolUse hook for Bash / PowerShell.
 *
 * Blocks two Prisma commands that damage the local database in this project:
 *   - `prisma migrate resolve --rolled-back`: accepted only for a failed migration (P3012); after a
 *     successful one it leaves the history out of sync with the schema;
 *   - `prisma migrate reset`: wipes the whole schema of the context.
 * The working rollback is the /ledger-slice:rollback-migration command.
 */
import { block, logBlock, readPayload } from './lib.mjs';

const payload = await readPayload();
if (!payload) process.exit(0);

// Only what the shell would run counts. Text that a command merely writes somewhere (a heredoc
// or a PowerShell here-string, e.g. the warning in the header of down.sql) and comment lines
// are removed first, otherwise the guard blocks its own documentation.
const command = String(payload.tool_input?.command ?? '')
  .replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/g, ' ')
  .replace(/@(['"])[^\n]*\n[\s\S]*?\n\1@/g, ' ')
  .replace(/^\s*#.*$/gm, ' ');
if (!/\bmigrate\b/.test(command)) process.exit(0);

let reason = null;
if (/\bmigrate\s+resolve\b[^\n;|&]*--rolled-back/.test(command)) {
  reason =
    '`prisma migrate resolve --rolled-back` works only for a failed migration (P3012) and leaves the history out of sync.';
} else if (/\bmigrate\s+reset\b/.test(command)) {
  reason = '`prisma migrate reset` wipes the whole schema of the context.';
}
if (!reason) process.exit(0);

logBlock(payload.cwd, { hook: 'migration-guard', tool: payload.tool_name, command: command.slice(0, 200), reason });
block(
  [
    `[ledger-slice] Blocked: ${reason}`,
    'Use the working procedure instead: /ledger-slice:rollback-migration <context> <migration>',
    '(run down.sql with `prisma db execute`, then delete the row from "<schema>"."_prisma_migrations").',
  ].join('\n'),
);
