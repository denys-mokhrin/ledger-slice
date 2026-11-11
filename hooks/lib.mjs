import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/** Reads the hook payload Claude Code sends on stdin. Returns null when it is not valid JSON. */
export async function readPayload() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Appends one JSON line to <project>/.claude/ledger-slice-hook.log. Never throws. */
export function logBlock(cwd, entry) {
  try {
    const dir = join(cwd || process.cwd(), '.claude');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({ at: new Date().toISOString(), ...entry });
    appendFileSync(join(dir, 'ledger-slice-hook.log'), line + '\n');
  } catch {
    // Logging must never change the hook's verdict.
  }
}

/** Blocks the tool call: exit code 2 makes Claude Code show the message to the agent. */
export function block(message) {
  process.stderr.write(message + '\n');
  process.exit(2);
}
