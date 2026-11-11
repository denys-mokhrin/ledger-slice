#!/usr/bin/env node
/**
 * PreToolUse hook for Write / Edit / MultiEdit.
 *
 * Blocks a change to a file under src/ that would break the dependency rule of the scaffold:
 *   - src/modules/<A>/** may import another context only through src/modules/<B>/public/**;
 *   - src/shared/** imports nothing from src/modules/**;
 *   - a boundaries / no-cycle lint error is never silenced with eslint-disable.
 *
 * `pnpm lint` enforces the same rule later; this hook stops the mistake before it is written.
 * Only the text being written is checked, so the hook is fast and needs no project install.
 */
import path from 'node:path';
import { block, logBlock, readPayload } from './lib.mjs';

const payload = await readPayload();
if (!payload) process.exit(0);

const input = payload.tool_input ?? {};
const filePath = String(input.file_path ?? '').replaceAll('\\', '/');
if (!/\.(ts|tsx|mts|cts)$/.test(filePath)) process.exit(0);

const inSrc = filePath.match(/(^|\/)src\/(.*)$/);
if (!inSrc) process.exit(0); // tests and scripts may reach into any context

const relFile = 'src/' + inSrc[2];
const ownContext = relFile.match(/^src\/modules\/([^/]+)\//)?.[1] ?? null;
const inShared = relFile.startsWith('src/shared/');
if (!ownContext && !inShared) process.exit(0);

const text = [input.content, input.new_string, ...(input.edits ?? []).map((e) => e.new_string)]
  .filter((part) => typeof part === 'string')
  .join('\n');
if (!text) process.exit(0);

const problems = [];

// 1. Imports.
const specifiers = new Set();
const importPattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)(['"])([^'"\n]+)\1/g;
for (const match of text.matchAll(importPattern)) specifiers.add(match[2]);

for (const specifier of specifiers) {
  let target = null;
  if (specifier.startsWith('.')) {
    target = path.posix.normalize(path.posix.join(path.posix.dirname(relFile), specifier));
  } else if (specifier.startsWith('src/')) {
    target = specifier;
  } else if (specifier.includes('/src/modules/')) {
    target = 'src/modules/' + specifier.split('/src/modules/')[1];
  }
  if (!target) continue; // npm package

  const targetModule = target.match(/^src\/modules\/([^/]+)(?:\/(.*))?$/);
  if (!targetModule) continue;
  const [, otherContext, rest = ''] = targetModule;

  if (inShared) {
    problems.push(`'${specifier}': src/shared must not import from src/modules (it holds technical primitives only).`);
  } else if (otherContext !== ownContext && !/^public(\/|$)/.test(rest)) {
    problems.push(
      `'${specifier}': context '${ownContext}' reaches into the internals of '${otherContext}'. ` +
        `Import from src/modules/${otherContext}/public/ or react to its domain event instead.`,
    );
  }
}

// 2. Silencing the lint rules that enforce the same boundary.
if (/eslint-disable[^\n]*(boundaries|import-x\/no-cycle)/.test(text)) {
  problems.push('eslint-disable for a boundaries / no-cycle rule: fix the dependency, do not silence the rule.');
}

if (problems.length === 0) process.exit(0);

logBlock(payload.cwd, { hook: 'boundary-guard', tool: payload.tool_name, file: relFile, problems });
block(
  [
    `[ledger-slice] Blocked ${payload.tool_name ?? 'edit'} of ${relFile}: it breaks the dependency rule (AGENTS.md, Architecture).`,
    ...problems.map((p) => `  - ${p}`),
    'A new cross-context dependency needs docs/bc-map.md and an ADR first.',
  ].join('\n'),
);
