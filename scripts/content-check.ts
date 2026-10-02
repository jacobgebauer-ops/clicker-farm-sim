// Validates every content file against its Zod schema, cross-checks ids, and reports
// content ids that have no final art yet (they will use placeholders, which is fine).
// Run: npm run content:check  (also runs as part of npm run build; exits 1 on invalid content)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRaw, RAW_FILES } from '../src/core/content';
import { Personal } from '../content/schema';
import { buildManifest } from './manifest.mjs';

// fileURLToPath (not URL.pathname) so Windows drive letters resolve correctly
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { data, issues } = validateRaw(RAW_FILES);
let failed = false;

for (const file of ['personal.json', 'public.json']) {
  const res = Personal.safeParse(JSON.parse(fs.readFileSync(path.join(root, 'content/personal', file), 'utf8')));
  if (!res.success) for (const i of res.error.issues) issues.push({ file: `content/personal/${file}`, message: `${i.path.join('.')}: ${i.message}` });
}

// no em dashes in any player-facing text
const EM = String.fromCharCode(0x2014);
for (const f of fs.readdirSync(path.join(root, 'content')).filter((x) => x.endsWith('.json'))) {
  const txt = fs.readFileSync(path.join(root, 'content', f), 'utf8');
  if (txt.includes(EM)) issues.push({ file: `content/${f}`, message: 'contains an em dash; use commas, semicolons, or parentheses' });
}

if (issues.length) {
  failed = true;
  console.error(`\nContent check failed with ${issues.length} problem(s):\n`);
  for (const i of issues) console.error(`  ${i.file}: ${i.message}`);
  console.error('');
}

if (data) {
  const manifest = buildManifest();
  const ids = new Set(manifest.map((e: { id: string }) => e.id));
  const expect: string[] = [
    ...data.crops.map((c) => `crop_${c.id}`),
    ...data.decor.map((d) => `decor_${d.id}`),
    ...data.buildings.flatMap((b) => ['ruined', 'repair', 'restored'].map((s) => `bld_${b.id}_${s}`)),
  ];
  const noSlot = expect.filter((id) => !ids.has(id));
  if (noSlot.length) {
    failed = true;
    console.error(`Missing manifest slots: ${noSlot.join(', ')}`);
  }
  const missingArt = manifest.filter((e: { path: string }) => !fs.existsSync(path.join(root, 'public', e.path)));
  const byCat = new Map<string, number>();
  for (const e of missingArt) byCat.set(e.category, (byCat.get(e.category) ?? 0) + 1);
  console.log(`Content OK: ${data.crops.length} crops, ${data.recipes.length} recipes, ${data.wines.length} wines, ${data.decor.length} decor, ${data.cosmetics.length} cosmetics, ${data.quests.length} quests, ${data.achievements.length} achievements, ${data.dialogue.lines.length} dialogue lines.`);
  console.log(`Art: ${manifest.length - missingArt.length}/${manifest.length} slots have final art; the rest use placeholders.`);
  if (missingArt.length && process.argv.includes('--verbose')) {
    for (const e of missingArt) console.log(`  missing art: ${e.id} (${e.path})`);
  } else if (missingArt.length) {
    console.log(`  missing by category: ${[...byCat].map(([k, v]) => `${k} ${v}`).join(', ')}  (use --verbose to list ids)`);
  }
}

process.exit(failed ? 1 : 0);
