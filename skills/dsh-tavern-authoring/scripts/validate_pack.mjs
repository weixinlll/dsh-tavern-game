#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const file = process.argv[2];
if (!file) throw new Error('Usage: node validate_pack.mjs <battle-pack.json>');
const raw = await readFile(file, 'utf8');
const source = JSON.parse(raw.replace(/^\uFEFF/, ''));
const fail = message => { throw new Error(message); };
const obj = value => value && typeof value === 'object' && !Array.isArray(value);
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
const mechanics = new Set(['first', 'critical', 'sureHit', 'multiHit', 'shieldPierce', 'armorPierce', 'execute', 'recoil', 'highCrit', 'drain', 'resourceDrain', 'cleanseSelf', 'dispelTarget', 'healSelf', 'counter', 'shieldSelf']);
const baseIdPattern = /^(?:human|fantasy)-0-(?:[1-9]|[1-7][0-9]|80)$/;
const sourceBytes = Buffer.byteLength(JSON.stringify(source), 'utf8');
if (sourceBytes > 256 * 1024) fail('Battle pack exceeds 256 KB.');
if (!obj(source) || source.schemaVersion !== 1 || source.kind !== 'dsh-battle-pack') fail('Expected schemaVersion 1 and kind dsh-battle-pack.');
if (!/^[a-z][a-z0-9-]{0,47}$/.test(source.id || '') || ['human', 'fantasy'].includes(source.id)) fail('id must be a unique lowercase slug and cannot be human or fantasy.');
if (!text(source.name, 48) || !['human', 'fantasy'].includes(source.basePack)) fail('name (≤48 chars) and basePack human|fantasy are required.');
if (source.description !== undefined && (typeof source.description !== 'string' || source.description.length > 200)) fail('description must be at most 200 characters.');
for (const key of ['script', 'scripts', 'code', 'javascript', 'html', 'css', 'modules', 'plugins']) if (Object.hasOwn(source, key)) fail(`Imported battle packs cannot contain ${key}.`);

const validateSkill = (skill, where) => {
  if (typeof skill === 'string') {
    if (!text(skill, 60)) fail(`${where} has an invalid skill name.`);
    return { name: skill.trim() };
  }
  if (!obj(skill) || !text(skill.name, 60)) fail(`${where} needs a named skill.`);
  if (skill.description !== undefined && (typeof skill.description !== 'string' || skill.description.length > 400)) fail(`${where} description exceeds 400 characters.`);
  if (skill.baseId !== undefined && (!text(skill.baseId, 80) || !baseIdPattern.test(skill.baseId) || !skill.baseId.startsWith(`${source.basePack}-`))) fail(`${where} baseId must be a special effect ID from ${source.basePack}.`);
  if (skill.mechanics !== undefined && (!Array.isArray(skill.mechanics) || skill.mechanics.some(id => !mechanics.has(id)) || new Set(skill.mechanics).size !== skill.mechanics.length)) fail(`${where} contains an unsupported or duplicate mechanic ID.`);
  return skill;
};

const aliases = source.skillAliases ?? [];
if (!Array.isArray(aliases) || aliases.length > 64) fail('skillAliases must contain at most 64 entries.');
const aliasNames = new Set();
for (const [index, alias] of aliases.entries()) {
  const skill = validateSkill(alias, `skillAliases[${index}]`);
  if (typeof skill === 'string' || aliasNames.has(skill.name)) fail('skillAliases require unique named entries.');
  aliasNames.add(skill.name);
  if (!skill.baseId) fail(`skillAliases[${index}] needs a catalog baseId.`);
}

const normalized = { schemaVersion: 1, kind: 'dsh-battle-pack', id: source.id, name: source.name.trim(), basePack: source.basePack,
  description: (source.description || '').trim(), items: [], party: [], opponents: [], skillAliases: aliases };
const validateActors = (actors, key) => {
  if (actors === undefined) return [];
  if (!Array.isArray(actors) || actors.length > 6) fail(`${key} must contain no more than 6 actors.`);
  const names = new Set();
  return actors.map((actor, index) => {
    if (!obj(actor) || !text(actor.name, 48)) fail(`${key}[${index}] needs a name of at most 48 characters.`);
    const name = actor.name.trim();
    if (names.has(name)) fail(`${key} contains duplicate actor name ${name}.`);
    names.add(name);
    const skills = actor.skills ?? [];
    if (!Array.isArray(skills) || skills.length > 4) fail(`${name} must have at most 4 skills.`);
    const checkedSkills = skills.map(skill => validateSkill(skill, `${name}.skills`));
    for (const skill of checkedSkills) {
      const skillName = typeof skill === 'string' ? skill.trim() : skill.name.trim();
      const hasId = typeof skill !== 'string' && !!skill.baseId;
      const alias = aliases.find(item => item && typeof item.name === 'string' && item.name.trim() === skillName);
      if (!hasId && !alias?.baseId) fail(`${name} skill “${skillName}” needs a matching skillAliases entry with a supported baseId.`);
    }
    const normalizedActor = { name, skills: checkedSkills };
    for (const field of ['level', 'hp', 'maxHp', 'attack', 'defense', 'speed', 'resource', 'maxResource']) {
      if (actor[field] === undefined) continue;
      if (typeof actor[field] !== 'number' || !Number.isFinite(actor[field]) || actor[field] < 0 || actor[field] > 1e9) fail(`${name}.${field} must be a finite value from 0 through 1,000,000,000.`);
      normalizedActor[field] = actor[field];
    }
    if (normalizedActor.maxHp !== undefined && normalizedActor.maxHp < 1) fail(`${name}.maxHp must be at least 1.`);
    if (normalizedActor.hp !== undefined && normalizedActor.maxHp !== undefined && normalizedActor.hp > normalizedActor.maxHp) fail(`${name}.hp cannot exceed maxHp.`);
    if (['male', 'female'].includes(actor.gender)) normalizedActor.gender = actor.gender;
    if (typeof actor.species === 'string' && actor.species.trim()) normalizedActor.species = actor.species.trim().slice(0, 32);
    if (typeof actor.kind === 'string' && actor.kind.trim()) normalizedActor.kind = actor.kind.trim().slice(0, 32);
    return normalizedActor;
  });
};
normalized.party = validateActors(source.party, 'party');
normalized.opponents = validateActors(source.opponents, 'opponents');
const itemCaps = new Map([['healing-potion', 2], ['resource-potion', 1], ['cleanse', 1]]);
if (source.items !== undefined && !Array.isArray(source.items)) fail('items must be an array.');
if ((source.items || []).length > 3) fail('items may contain at most 3 entries.');
normalized.items = (source.items || []).map((item, index) => {
  if (!obj(item) || !itemCaps.has(item.id) || !Number.isInteger(item.count) || item.count < 0 || item.count > itemCaps.get(item.id)) fail(`items[${index}] must use a supported item ID and its per-battle count cap.`);
  return { id: item.id, count: item.count };
});

const normalizedBytes = Buffer.byteLength(JSON.stringify(normalized), 'utf8');
if (normalizedBytes > 12 * 1024) fail('Normalized battle pack exceeds 12 KB; shorten descriptions or split the content.');

// When this skill is run inside the plugin repository, use the production parser too.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const pluginParser = path.join(repoRoot, 'simple', 'imports.mjs');
if (existsSync(pluginParser)) {
  const { parseImportedPack } = await import(pathToFileURL(pluginParser).href);
  parseImportedPack(source);
}
console.log(`Valid DSH battle pack: ${source.name} (${normalizedBytes}/12288 normalized bytes, ${normalized.party.length} teammates, ${normalized.opponents.length} opponents, ${aliases.length} skill aliases).`);
