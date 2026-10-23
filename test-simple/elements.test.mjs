import test from 'node:test';
import assert from 'node:assert/strict';
import { ELEMENTS, TYPE_CHART, elementEffectiveness, sameTypeBonus } from '../simple/elements.mjs';
import { createBattle, act, normalizeActor } from '../simple/engine.mjs';
import { resolveSkill } from '../simple/catalog.mjs';
import { parseGeneratedSkills, parseGenerationResult, generationEffectsPrompt } from '../simple/generation.mjs';
import { encounterFromText, extractMvuParty } from '../simple/context.mjs';
import { parseImportedPack, applySkillAliases } from '../simple/imports.mjs';

const strike = (power = 70, element = 'fire') => ({ name: '测试焰击', baseId: 'fantasy-0-1', power, element, mechanics: ['sureHit'] });
function hit({ power = 70, element = 'fire', types = ['neutral'], actorTypes = ['neutral'], attack = 115, defense = 35 } = {}) {
  const state = createBattle({ packId: 'fantasy', seed: 1,
    party: [{ name: '施术者', hp: 1000, maxHp: 1000, attack, speed: 80, types: actorTypes, skills: [strike(power, element)] }],
    enemies: [{ name: '目标', hp: 1000, maxHp: 1000, attack: 50, defense, speed: 40, types, skills: [] }] });
  const next = act(state, { type: 'skill', skillId: state.party[0].skills[0].id });
  return { damage: next.events.filter(event => event.kind === 'damage' && event.actorId === 'player-1').reduce((sum, event) => sum + event.value, 0), next };
}

test('per-skill power affects actual damage independently of actor attack and defense', () => {
  assert(hit({ power: 120 }).damage > hit({ power: 60 }).damage * 1.8);
  assert(hit({ attack: 220 }).damage > hit({ attack: 90 }).damage);
  assert(hit({ defense: 180 }).damage < hit({ defense: 10 }).damage);
  const actor = normalizeActor({ skills: [strike(60), strike(120)] }, { packId: 'fantasy' });
  assert.equal(actor.skills.length, 2);
  assert.notEqual(actor.skills[0].id, actor.skills[1].id);
  assert.deepEqual(actor.skills.map(skill => skill.power), [60, 120]);
});

test('element matchups, same-type bonus and dual resistance are observable and bounded', () => {
  const neutral = hit();
  const strong = hit({ types: ['nature'] }), resisted = hit({ types: ['water'] });
  assert(strong.damage >= neutral.damage * 1.95);
  assert(resisted.damage <= neutral.damage * 0.52);
  assert(strong.next.events.some(event => event.kind === 'effectiveness' && event.value === 2 && /效果拔群/.test(event.text)));
  assert(resisted.next.events.some(event => event.kind === 'effectiveness' && /效果不佳/.test(event.text)));
  assert(hit({ actorTypes: ['fire'] }).damage > neutral.damage);
  assert.equal(elementEffectiveness('fire', ['water', 'earth']), 0.25);
  assert.equal(elementEffectiveness('fire', ['nature', 'ice']), 4);
  assert.equal(sameTypeBonus('neutral', ['neutral']), 1);
  for (const attack of ELEMENTS) for (const defense of ELEMENTS) assert([0.5, 1, 2].includes(elementEffectiveness(attack.id, [defense.id])));
  assert(Object.isFrozen(TYPE_CHART));
});

test('legacy saves get neutral actor types and preset power while malformed metadata stays safe', () => {
  const actor = normalizeActor({ hp: 0, maxHp: 100, types: ['free-win'], skills: [{ ...strike(), power: 999999, element: 'kill' }] }, { packId: 'fantasy' });
  assert.equal(actor.hp, 0);
  assert.deepEqual(actor.types, ['neutral']);
  assert.equal(actor.skills[0].power, resolveSkill('fantasy-0-1', 'fantasy').power);
  assert.equal(actor.skills[0].element, 'fire');
  assert.equal(resolveSkill({ name: '净化', power: 140 }, 'fantasy').power, 0);
  assert.equal(normalizeActor({ skills: [{ name: '普通攻击', baseId: 'human-0-0', power: 140, element: 'fire' }] }).skills.length, 0);
});

test('AI accepts bounded power/types and rejects non-catalog or invalid attack/support data', () => {
  const attacks = parseGeneratedSkills([strike(105, 'electric')], 'fantasy');
  assert.equal(attacks[0].power, 105); assert.equal(attacks[0].element, 'electric');
  for (const invalid of [{ power: 141 }, { power: 19 }, { power: 50.5 }, { element: 'void' }, { power: 0 }]) assert.throws(() => parseGeneratedSkills([{ ...strike(), ...invalid }], 'fantasy'), /威力|属性/);
  assert.throws(() => parseGeneratedSkills([{ name: '守护', baseId: 'fantasy-0-13', power: 70 }], 'fantasy'), /辅助/);
  const actor = { name: '火法师', types: ['fire', 'spirit'], skills: [strike(75), { name: '冰刃', baseId: 'fantasy-0-1', power: 80, element: 'ice' }, { name: '护盾', baseId: 'fantasy-0-13', power: 0, element: 'spirit' }, { name: '净化', baseId: 'fantasy-0-18', power: 0, element: 'light' }] };
  const parsed = parseGenerationResult(JSON.stringify({ party: [actor], items: [] }), { packId: 'fantasy' });
  assert.deepEqual(parsed.party[0].types, ['fire', 'spirit']);
  assert.throws(() => parseGenerationResult(JSON.stringify({ party: [{ ...actor, types: ['fire', 'fire'] }], items: [] }), { packId: 'fantasy' }), /属性/);
  assert.match(generationEffectsPrompt('fantasy'), /power必须填写20—140/);
});

test('story enemies, MVU and imported packs preserve whitelisted type/power metadata', () => {
  const skill = strike(85, 'wind');
  const marker = encounterFromText(`<dsh_battle>${JSON.stringify({ enemies: [{ name: '飞蜥', types: ['wind', 'earth'], skills: [skill] }] })}</dsh_battle>`);
  assert.deepEqual(marker.enemies[0].types, ['wind', 'earth']);
  assert.equal(marker.enemies[0].skills[0].power, 85);
  assert.equal(marker.enemies[0].skills[0].element, 'wind');
  const mvu = extractMvuParty({ 主角: { name: '修士', hp: 80, types: ['spirit'], skills: [skill] } });
  assert.equal(mvu[0].skills[0].baseId, skill.baseId); assert.deepEqual(mvu[0].types, ['spirit']);
  const source = { schemaVersion: 1, kind: 'dsh-battle-pack', id: 'element-demo', name: '元素包', basePack: 'fantasy', party: [{ name: '修士', types: ['spirit'], skills: [skill] }] };
  const pack = parseImportedPack(source);
  assert.equal(pack.party[0].skills[0].power, 85); assert.deepEqual(pack.party[0].types, ['spirit']);
  assert.throws(() => parseImportedPack({ ...source, party: [{ ...source.party[0], types: ['random'] }] }), /属性/);
  assert.throws(() => parseImportedPack({ ...source, skillAliases: [{ ...skill, power: 999 }] }), /威力/);
});

test('an alias changing the skill kind reconciles inherited power without discarding type', () => {
  const pack = parseImportedPack({ schemaVersion: 1, kind: 'dsh-battle-pack', id: 'alias-kind', name: '符法', basePack: 'fantasy',
    skillAliases: [{ name: '符术', baseId: 'fantasy-0-13', description: '护盾' }] });
  const [actor] = applySkillAliases([{ name: '修士', skills: [{ name: '符术', baseId: 'fantasy-0-1', power: 120, element: 'light' }] }], pack);
  assert.equal(actor.skills[0].power, 0); assert.equal(actor.skills[0].element, 'light');
  const normalized = normalizeActor(actor, { packId: 'fantasy' });
  assert.equal(normalized.skills[0].kind, 'selfStatus'); assert.equal(normalized.skills[0].power, 0);
});

test('MVU metadata extraction never invokes getters and reads dictionary skill power safely', () => {
  let reads = 0;
  const actor = { name: '修士', hp: 80, skills: { 灵火: { power: 100, element: 'fire', baseId: 'fantasy-0-1' } } };
  Object.defineProperty(actor, 'types', { enumerable: true, get() { reads++; throw Error('getter'); } });
  Object.defineProperty(actor.skills.灵火, 'mechanics', { enumerable: true, get() { reads++; throw Error('getter'); } });
  const [result] = extractMvuParty({ 主角: actor });
  assert.equal(reads, 0); assert.equal(result.skills[0].power, 100); assert.equal(result.skills[0].element, 'fire');
});
