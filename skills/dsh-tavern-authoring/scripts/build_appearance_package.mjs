#!/usr/bin/env node
import { readFile, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const options = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (!key?.startsWith('--') || !value || options.has(key.slice(2))) throw new Error('Usage: node build_appearance_package.mjs --name NAME --image atlas.png --out appearance.json [--rig rig.json]');
  options.set(key.slice(2), value);
}
const name = options.get('name')?.trim();
const imagePath = options.get('image');
const outputPath = options.get('out');
const rigPath = options.get('rig');
if (!name || name.length > 80 || !imagePath || !outputPath) throw new Error('Required: --name (≤80 characters), --image PNG, --out JSON.');
if (path.resolve(imagePath) === path.resolve(outputPath)) throw new Error('Output JSON cannot overwrite the source image.');
try { await access(outputPath, constants.F_OK); throw new Error(`Output already exists: ${outputPath}`); }
catch (error) { if (error?.message?.startsWith('Output already exists:')) throw error; }

const image = await readFile(imagePath);
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
if (image.length < 24 || image.length > 12 * 1024 * 1024 || !image.subarray(0, 8).equals(signature) || image.toString('ascii', 12, 16) !== 'IHDR') throw new Error('Image must be a real PNG no larger than 12 MB.');
const width = image.readUInt32BE(16), height = image.readUInt32BE(20);
if (!width || !height || width > 4096 || height > 4096 || width % 4 || height % 4) throw new Error(`PNG dimensions ${width}×${height} must be multiples of 4 and at most 4096.`);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRigPath = path.join(scriptDir, '..', 'assets', 'battle-atlas-rig-template.json');
const rig = JSON.parse((await readFile(rigPath || defaultRigPath, 'utf8')).replace(/^\uFEFF/, ''));
const modes = new Set(['idle', 'attack', 'kick', 'cast', 'hit', 'guard', 'dodge', 'down', 'victory']);
if (rig?.schemaVersion !== 1 || rig.columns !== 4 || rig.rows !== 4 || !Number.isFinite(rig.fps) || rig.fps < 1 || rig.fps > 24 || !rig.clips || typeof rig.clips !== 'object' || Array.isArray(rig.clips)) throw new Error('Rig must be schemaVersion 1, 4×4, and 1–24 FPS.');
const entries = Object.entries(rig.clips);
if (!entries.length || entries.length > modes.size) throw new Error('Rig must have 1–9 action clips.');
for (const [mode, frames] of entries) if (!modes.has(mode) || !Array.isArray(frames) || !frames.length || frames.length > 16 || frames.some(frame => !Number.isInteger(frame) || frame < 0 || frame > 15)) throw new Error(`Invalid clip ${mode}; use a supported mode and 1–16 frame indexes from 0 to 15.`);
const normalizedRig = { schemaVersion: 1, columns: 4, rows: 4, fps: rig.fps, clips: Object.fromEntries(entries.map(([mode, frames]) => [mode, [...frames]])) };
const result = { kind: 'dsh-battle-appearance', schemaVersion: 1, name,
  texture: { mimeType: 'image/png', data: image.toString('base64') }, rig: normalizedRig };
const output = JSON.stringify(result, null, 2);
if (Buffer.byteLength(output, 'utf8') > 16 * 1024 * 1024) throw new Error('Complete appearance JSON exceeds 16 MB; use a smaller optimized PNG.');
await writeFile(outputPath, `${output}\n`, { flag: 'wx' });
console.log(`Created ${outputPath} (${width}×${height} PNG; ${Math.ceil(Buffer.byteLength(output, 'utf8') / 1024)} KB JSON). The plugin will decode-check the image during import.`);
