// Authorable data only: imported packs select bounded mechanics; they never execute code.
import { getPack, MECHANICS } from './catalog.mjs';
import { validDefaultAvatarId } from './looks.mjs';

const fail = message => { throw Object.assign(new Error(message), { code: 'INVALID_PACK' }); };
const text = (value, limit = 80) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const object = value => value && typeof value === 'object' && !Array.isArray(value);
function skill(value) {
  if (typeof value === 'string') return text(value, 60);
  if (!object(value) || !text(value.name)) fail('技能需要名称。');
  if (value.mechanics && (!Array.isArray(value.mechanics) || value.mechanics.some(key => !Object.hasOwn(MECHANICS, key)))) fail('技能含未知机制标签，请使用模板中的标签。');
  return { name: text(value.name, 60), description: text(value.description, 400),
    ...(typeof value.baseId === 'string' ? { baseId: text(value.baseId) } : {}),
    ...(Array.isArray(value.mechanics) ? { mechanics: [...new Set(value.mechanics)].slice(0, 16) } : {}) };
}
function actors(value, field) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 6) fail(`${field}最多6人。`);
  const names = new Set();
  return value.map(actor => {
    if (!object(actor) || !text(actor.name)) fail(`${field}中每人都需要姓名。`);
    const name = text(actor.name, 48);
    if (names.has(name)) fail(`${field}的姓名重复。`);
    names.add(name);
    if (actor.skills && (!Array.isArray(actor.skills) || actor.skills.length > 4)) fail('每人最多4个技能。');
    const result = { name, skills: (actor.skills || []).map(skill) };
    for (const key of ['level', 'hp', 'maxHp', 'attack', 'defense', 'speed', 'resource', 'maxResource']) {
      if (actor[key] === undefined) continue;
      if (typeof actor[key] !== 'number' || !Number.isFinite(actor[key]) || actor[key] < 0 || actor[key] > 1e9) fail(`${name}的${key}数值无效。`);
      result[key] = actor[key];
    }
    if (result.maxHp !== undefined && result.maxHp < 1) fail('生命上限至少为1。');
    if (result.hp !== undefined && result.maxHp !== undefined && result.hp > result.maxHp) fail('当前生命不能高于上限。');
    if (['male', 'female'].includes(actor.gender)) result.gender = actor.gender;
    if (typeof actor.species === 'string' && actor.species.trim()) result.species = text(actor.species, 32);
    if (typeof actor.kind === 'string' && actor.kind.trim()) result.kind = text(actor.kind, 32);
    if (validDefaultAvatarId(actor.avatarId)) result.avatarId = actor.avatarId;
    return result;
  });
}

export function parseImportedPack(input) {
  if (!object(input) || input.schemaVersion !== 1 || input.kind !== 'dsh-battle-pack') fail('这不是玩法包，请使用 schemaVersion:1、kind:"dsh-battle-pack" 的JSON模板。');
  if (Buffer.byteLength(JSON.stringify(input), 'utf8') > 256 * 1024) fail('玩法包JSON不能超过256KB。');
  if (!/^[a-z][a-z0-9-]{0,47}$/.test(input.id || '') || ['human', 'fantasy'].includes(input.id)) fail('玩法包id须为小写英文开头的短名称，且不能占用内置包id。');
  if (!getPack(input.basePack) || !text(input.name)) fail('需要包名称，以及 human 或 fantasy 的 basePack。');
  for (const key of ['script', 'scripts', 'code', 'javascript', 'html', 'css', 'modules', 'plugins']) if (Object.hasOwn(input, key)) fail('玩法包只支持数据，不能附带可执行脚本或页面代码。');
  const aliases = input.skillAliases ?? [];
  if (!Array.isArray(aliases) || aliases.length > 64) fail('skillAliases最多64条。');
  const pack = { schemaVersion: 1, kind: 'dsh-battle-pack', id: input.id, name: text(input.name, 48), basePack: input.basePack,
    description: text(input.description, 200), items: Array.isArray(input.items) ? input.items.slice(0, 3).map(item => {
      if (!object(item) || !['healing-potion', 'resource-potion', 'cleanse'].includes(item.id) || !Number.isInteger(item.count) || item.count < 0 || item.count > (item.id === 'healing-potion' ? 2 : 1)) fail('道具只支持模板中的治疗/资源/净化药，每场数量有限。');
      return { id: item.id, count: item.count };
    }) : [], party: actors(input.party, '队友'), opponents: actors(input.opponents, '敌人'), skillAliases: aliases.map(skill) };
  if (Buffer.byteLength(JSON.stringify(pack), 'utf8') > 12 * 1024) fail('整理后的玩法定义超过12KB，请缩短说明或拆成多个包；图片音乐请用单独导入。');
  return pack;
}

export function applySkillAliases(party, importedPack) {
  const aliases = importedPack?.skillAliases || [];
  return party.map(actor => ({ ...actor, skills: (actor.skills || []).map(value => {
    const name = typeof value === 'string' ? value : value?.name;
    const alias = aliases.find(item => typeof item !== 'string' && item.name === name);
    return alias ? { ...(typeof value === 'string' ? { name } : value), ...alias } : value;
  }) }));
}
