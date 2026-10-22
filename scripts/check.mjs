import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { DEFAULT_AVATARS } from '../simple/looks.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
if (pkg.name !== 'dsh-tavern-game' || pkg.exports['.'] !== './index.mjs' || pkg.exports['./client'] !== './client.js') throw new Error('Invalid package entries');
function walk(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]); }
const files = [join(root, 'index.mjs'), join(root, 'client.js'), ...walk(join(root, 'simple')).filter(p => p.endsWith('.mjs'))];
for (const file of files) {
  const checked = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (checked.status !== 0) throw new Error(checked.stderr || `Syntax error: ${file}`);
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g)) {
    const target = resolve(dirname(file), match[1]);
    if (relative(root, target).startsWith('..') || !existsSync(target)) throw new Error(`Missing/unsafe import: ${file}: ${match[1]}`);
  }
}
for (const retired of ['host', 'engine', 'llm', 'rulesets', 'pack-v2', 'client-src', 'test']) if (existsSync(join(root, retired))) throw new Error(`Retired source still active: ${retired}`);
const manifest = JSON.parse(readFileSync(join(root, 'assets/manifest.json'), 'utf8'));
for (const file of manifest.files) if (file.includes('..') || !existsSync(join(root, 'assets', file))) throw new Error(`Missing asset: ${file}`);
const defaultAvatarPaths = Object.values(DEFAULT_AVATARS).map(avatar => avatar.src);
const defaultAssets = manifest.files.filter(file => /^human\/sprite\/(?:defaults\/.*|adventurer-(?:male|female))-actions-v1\.png$/.test(file));
if (Object.keys(DEFAULT_AVATARS).length !== 54) throw new Error(`Expected 54 built-in looks, got ${Object.keys(DEFAULT_AVATARS).length}`);
for (const file of defaultAvatarPaths) if (!manifest.files.includes(file)) throw new Error(`Default look is not packaged: ${file}`);
if (new Set(defaultAssets).size !== 54 || defaultAssets.length !== 54) throw new Error(`Expected exactly 54 packaged default look atlases, got ${defaultAssets.length}`);
const api = await import(pathToFileURL(join(root, 'index.mjs')).href);
if (api.name !== pkg.name || typeof api.apply !== 'function' || JSON.stringify(api.inject) !== '["tavern"]') throw new Error('Invalid host export');
console.log(`Simple package valid: ${files.length} runtime files; ${manifest.files.length} assets; legacy source excluded.`);
