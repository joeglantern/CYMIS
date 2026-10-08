#!/usr/bin/env node
// Fails if any tracked text file contains an em dash, an en dash, or a word
// from the banned list. Run with: pnpm check:text
//
// The dash characters are built from their codes so this file passes its own check.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

const DASHES = [
  { char: String.fromCharCode(0x2014), name: 'em dash' },
  { char: String.fromCharCode(0x2013), name: 'en dash' },
];

// Filler words that make writing sound like marketing copy. Keep this short
// and obvious. Matching is case insensitive and on whole words only.
const BANNED_WORDS = [
  'delve',
  'delves',
  'seamless',
  'seamlessly',
  'robust',
  'leverage',
  'leverages',
  'leveraging',
  'elevate',
  'elevates',
  'empower',
  'empowers',
  'cutting-edge',
  'streamline',
  'streamlines',
  "in today's world",
];

const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.md', '.yml', '.yaml',
  '.py', '.toml', '.txt', '.prisma', '.sql', '.html', '.css', '.env', '.example',
  '.sh', '.dockerfile', '',
]);

const WORD_CHECK_EXEMPT = new Set(['scripts/check-text.mjs', 'CONTRIBUTING.md']);

const SKIP_PATHS = [/^pnpm-lock\.yaml$/, /(^|\/)generated\//, /^docs\/reference\//];

function listFiles() {
  // Tracked plus untracked-but-not-ignored files, so it works before the first commit.
  const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    encoding: 'utf8',
  });
  return out.split('\n').filter(Boolean);
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const wordPatterns = BANNED_WORDS.map((w) => ({
  word: w,
  re: new RegExp(`(^|[^\\p{L}])${escapeRegex(w)}(?=$|[^\\p{L}])`, 'iu'),
}));

const problems = [];

for (const file of listFiles()) {
  if (SKIP_PATHS.some((re) => re.test(file))) continue;
  const ext = extname(file).toLowerCase();
  const base = file.split('/').pop() ?? '';
  if (!TEXT_EXTENSIONS.has(ext) && base !== 'Dockerfile' && base !== 'Caddyfile') continue;

  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  const lines = content.split('\n');
  lines.forEach((line, i) => {
    for (const d of DASHES) {
      if (line.includes(d.char)) {
        problems.push(`${file}:${i + 1}  ${d.name}`);
      }
    }
    // These files list the banned words on purpose, so only check them for dashes.
    if (WORD_CHECK_EXEMPT.has(file)) return;
    for (const { word, re } of wordPatterns) {
      if (re.test(line)) {
        problems.push(`${file}:${i + 1}  banned word "${word}"`);
      }
    }
  });
}

if (problems.length > 0) {
  console.error('Text check failed:\n');
  for (const p of problems) console.error(`  ${p}`);
  console.error(`\n${problems.length} problem(s). Use a comma, colon, full stop or brackets instead of dashes.`);
  process.exit(1);
}

console.log('Text check passed.');
