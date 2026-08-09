import fs from 'node:fs';
import path from 'node:path';
import type { DictEntry } from './types';

export function loadCanonicalEntries(): DictEntry[] {
  const root = path.resolve(process.cwd(), '..');
  const full = path.join(root, 'data/canonical/entries.json');
  const enOnly = path.join(root, 'data/canonical/entries.en.json');
  const file = fs.existsSync(full) ? full : enOnly;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as DictEntry[];
}
