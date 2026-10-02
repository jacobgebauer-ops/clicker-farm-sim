// Formats content JSON as one object per line inside arrays, so diffs stay readable.
// Usage: node scripts/fmt-json.mjs content/crops.json [more files...]
import fs from 'node:fs';

export function formatContent(value, indent = '') {
  if (Array.isArray(value)) {
    if (value.every((v) => v === null || typeof v !== 'object')) return JSON.stringify(value);
    const inner = indent + '  ';
    return '[\n' + value.map((v) => inner + (isFlat(v) ? JSON.stringify(v).replace(/,"/g, ', "').replace(/":/g, '": ') : formatContent(v, inner))).join(',\n') + '\n' + indent + ']';
  }
  if (value && typeof value === 'object') {
    if (isFlat(value)) return JSON.stringify(value).replace(/,"/g, ', "').replace(/":/g, '": ');
    const inner = indent + '  ';
    return '{\n' + Object.entries(value).map(([k, v]) => `${inner}${JSON.stringify(k)}: ${formatContent(v, inner)}`).join(',\n') + '\n' + indent + '}';
  }
  return JSON.stringify(value);
}

function isFlat(v) {
  if (!v || typeof v !== 'object') return true;
  const s = JSON.stringify(v);
  return s.length < 260 && !Object.values(v).some((x) => Array.isArray(x) && x.some((y) => y && typeof y === 'object' && JSON.stringify(y).length > 60));
}

if (process.argv[1] && process.argv[1].endsWith('fmt-json.mjs')) {
  for (const f of process.argv.slice(2)) {
    const data = JSON.parse(fs.readFileSync(f, 'utf8'));
    fs.writeFileSync(f, formatContent(data) + '\n');
  }
}
