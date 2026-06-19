// Minimal, dependency-free syntax checker for our ES modules.
// Runs `node --check` on every .js/.mjs under src/ and tools/. This validates
// SYNTAX only (it does not resolve imports or run code), which is exactly what we
// want for a zero-build project whose runtime deps (three) live on a CDN.
//
// Usage: node tools/check-syntax.mjs   (or: npm run check)

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out; // directory may not exist yet
  }
  for (const name of entries) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.js') || p.endsWith('.mjs')) out.push(p);
  }
  return out;
}

const files = [...walk('src'), ...walk('tools')];
let failed = 0;

for (const f of files) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    console.log('ok    ' + f);
  } catch (e) {
    failed++;
    console.error('FAIL  ' + f);
    console.error((e.stderr || e.stdout || Buffer.from(e.message)).toString().trim());
  }
}

console.log('');
if (failed) {
  console.error(`${failed} file(s) failed syntax check.`);
  process.exit(1);
}
console.log(`All ${files.length} file(s) passed syntax check.`);
