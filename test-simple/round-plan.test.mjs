import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, act, snapshot } from '../simple/engine.mjs';

const actor = (name, speed, skills = ['普通攻击']) => ({ name, hp: 800, maxHp: 1000, attack: 40, defense: 10, speed, skills });
const make = () => createBattle({ packId: 'human', seed: 8,
  party: [actor('甲', 30), actor('乙', 90), actor('丙', 50), actor('后备', 500)],
  enemies: [actor('敌甲', 70), actor('敌乙', 20), actor('敌丙', 60)],
  items: [{ id: 'healing-potion', name: '还阳散', count: 1 }, { id: 'resource-potion', name: '凝气丸', count: 1 }] });
const commands = state => state.activePlayers.filter(index => !state.actedPlayers.includes(index)).map(index => {
  const actor = state.party[index], skill = actor.skills.find(entry => entry.usesLeft > 0 && entry.cooldownLeft === 0 && actor.resource >= entry.cost);
  return skill ? { type: 'skill', actorIndex: index, skillId: skill.id, targetIndex: state.activeEnemies[0] }
    : { type: 'basic', actorIndex: index, targetIndex: state.activeEnemies[0] };
});
const round = state => act(state, { type: 'round', commands: commands(state) });

test('a complete planned round runs all six actors in global speed order and mutates no input', () => {
  const state = make(), before = snapshot(state), next = round(state);
  assert.deepEqual(state, before);
  assert.equal(next.seq, 1); assert.equal(next.round, 1); assert.equal(next.roundOpen, false);
  const uses = next.events.filter(event => event.kind === 'use').map(event => event.actorId);
  assert.deepEqual(uses, ['player-2', 'enemy-1', 'enemy-3', 'player-3', 'player-1', 'enemy-2']);
  assert.equal(new Set(uses).size, 6);
});

test('a planned basic attack works independently of the four special-skill slots', () => {
  const state = make();
  const list = commands(state);
  state.party[0].skills = state.party[0].skills.filter(skill => skill.id !== 'human-0-0');
  state.party[0].skills = [];
  list[0] = { type: 'basic', actorIndex: 0, targetIndex: state.activeEnemies[0] };
  const next = act(state, { type: 'round', commands: list });
  assert(next.events.some(event => event.kind === 'use' && event.actorId === 'player-1' && event.skillId === 'human-0-0'));
});

test('incomplete, duplicate and invalid final commands reject the whole round without mutation', () => {
  const state = make(), before = snapshot(state), all = commands(state);
  for (const list of [all.slice(0, 1), [all[0], all[0], all[2]], [...all.slice(0, 2), { ...all[2], type: 'skill', skillId: 'not-equipped' }], [...all.slice(0, 2), { ...all[2], actorIndex: 3 }]]) {
    assert.throws(() => act(state, { type: 'round', commands: list }));
    assert.deepEqual(state, before);
  }
});

test('items reserve their real count, keep names and descriptions, and can target living reserves', () => {
  const state = make(), all = commands(state);
  assert.equal(state.inventory[0].name, '还阳散'); assert.match(state.inventory[0].description, /25%/);
  all[0] = { type: 'item', actorIndex: 0, itemId: 'healing-potion', targetIndex: 3 };
  const invalid = [...all]; invalid[1] = { ...all[0], actorIndex: 1 };
  assert.throws(() => act(state, { type: 'round', commands: invalid }), /Not enough items/);
  const next = act(state, { type: 'round', commands: all });
  assert.equal(next.party[3].hp, 1000); assert.equal(next.inventory[0].count, 0);
  assert.equal(next.events.find(event => event.kind === 'item').name, '还阳散');
});

test('switches take priority, reserve enters once and cannot attack in the same round', () => {
  const state = make(), all = commands(state);
  all[0] = { type: 'switch', actorIndex: 0, index: 3 };
  const next = act(state, { type: 'round', commands: all });
  assert.equal(next.events[0].kind, 'switch'); assert(next.activePlayers.includes(3));
  assert(!next.events.some(event => event.kind === 'use' && ['player-1', 'player-4'].includes(event.actorId)));
  const duplicate = [...all]; duplicate[1] = { type: 'switch', actorIndex: 1, index: 3 };
  assert.throws(() => act(state, { type: 'round', commands: duplicate }), /duplicate switch/);
});

test('queued defeated actors never attack, and targets retarget living field members', () => {
  const state = make(); state.party[1].attack = 10000; state.enemies[0].hp = 1;
  state.party[1].statuses.push({ id: 'sureHit', name: '必中', turns: 1 });
  const next = round(state);
  assert.equal(next.enemies[0].hp, 0);
  assert(!next.events.some(event => event.kind === 'use' && event.actorId === 'enemy-1'));
  assert(next.events.some(event => event.kind === 'use' && event.side === 'player' && event.targetId !== 'enemy-1'));
});

test('six-versus-six planned rounds remain finite and end by the round limit', () => {
  const roster = prefix => Array.from({ length: 6 }, (_, index) => actor(prefix + index, 20 + index, ['普通攻击', '治疗', '召唤灵兽']));
  let state = createBattle({ packId: 'fantasy', party: roster('队友'), enemies: roster('敌人') });
  for (let count = 0; !state.outcome && count < 24; count++) {
    state = round(state);
    assert(state.activePlayers.length <= 3 && state.activeEnemies.length <= 3);
    for (const member of [...state.party, ...state.enemies]) assert(Number.isFinite(member.hp) && member.hp >= 0);
  }
  assert(state.outcome); assert(state.round <= 24);
});
