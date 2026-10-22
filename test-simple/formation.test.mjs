import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createBattle, snapshot } from '../simple/engine.mjs';
import { TEAM_LIMIT, FIELD_LIMIT } from '../simple/catalog.mjs';

const actors = (prefix, count = 6, skills = ['human-0-0']) => Array.from({ length: count }, (_, index) => ({ id: `${prefix}${index}`, name: `${prefix}${index}`, hp: 1000, maxHp: 1000, speed: 90, skills }));
const make = options => createBattle({ party: actors('p'), enemies: actors('e'), ...options });
const hit = (state, actorIndex, targetIndex = 0) => act(state, { type: 'skill', actorIndex, targetIndex, skillId: 'human-0-0' });

test('real field actors each act once per round, reserves neither attack nor take area damage', () => {
  assert.equal(TEAM_LIMIT, 6); assert.equal(FIELD_LIMIT, 3);
  let state = make({ party: actors('p', 6, ['human-0-25']) });
  const reservedHp = [...state.party.slice(3), ...state.enemies.slice(3)].map(actor => actor.hp);
  const events = [];
  state = act(state, { type: 'skill', actorId: 'p1', targetId: 'e2', skillId: 'human-0-25' }); events.push(...state.events);
  assert.equal(state.round, 1); assert.equal(state.roundOpen, true);
  assert.deepEqual(state.remainingPlayerActions, [0, 2]);
  assert.throws(() => hit(state, 1), /already acted/);
  assert.deepEqual(new Set(state.events.filter(event => event.kind === 'damage' && event.actorId === 'p1').map(event => event.targetId)), new Set(['e0', 'e1', 'e2']));
  state = hit(state, 0); events.push(...state.events);
  state = hit(state, 2); events.push(...state.events);
  assert.equal(state.round, 1); assert.equal(state.roundOpen, false);
  assert.deepEqual(state.remainingPlayerActions, [0, 1, 2]);
  const used = events.filter(event => event.kind === 'use').map(event => event.actorId);
  for (const id of ['p0', 'p1', 'p2', 'e0', 'e1', 'e2']) assert.equal(used.filter(actorId => actorId === id).length, 1, id);
  assert.deepEqual([...state.party.slice(3), ...state.enemies.slice(3)].map(actor => actor.hp), reservedHp);
  assert(!used.some(id => /[345]$/.test(id)));
  assert.equal(hit(state, 0).round, 2);
});

test('commands validate actor, target and reserve identities without mutating input', () => {
  const state = make(), before = structuredClone(state);
  for (const intent of [
    { type: 'skill', actorIndex: 3, targetIndex: 0 },
    { type: 'skill', actorIndex: 0, targetIndex: 3 },
    { type: 'skill', actorId: 'p0', actorIndex: 1, targetId: 'e0' },
    { type: 'skill', actorIndex: 0, targetId: 'p0' },
    { type: 'skill', actorIndex: '0', targetIndex: 0 },
  ]) assert.throws(() => act(state, { skillId: 'human-0-0', ...intent }), /on-field/);
  state.enemies[2].hp = 0;
  assert.throws(() => hit(state, 0, 2), /on-field/);
  state.enemies[2].hp = before.enemies[2].hp;
  assert.deepEqual(state, before);
  const next = act(state, { type: 'skill', actorId: 'p2', targetId: 'e1', skillId: 'human-0-0' });
  assert(next.events.some(event => event.kind === 'damage' && event.actorId === 'p2' && event.targetId === 'e1'));
});

test('switch replaces the chosen field slot, spends its action, and enemies cannot attack reserves', () => {
  let state = make();
  const hp = state.party[1].hp;
  state = act(state, { type: 'switch', actorId: 'p1', index: 4 });
  assert.deepEqual(state.activePlayers, [0, 4, 2]);
  assert.equal(state.party[1].hp, hp);
  assert.throws(() => hit(state, 4), /already acted/);
  assert.throws(() => act(state, { type: 'switch', actorIndex: 0, index: 4 }), /switch target/);
  assert.throws(() => act(state, { type: 'switch', actorIndex: 0, index: 1 }), /switch target/);
  state = hit(state, 0); state = hit(state, 2);
  assert.deepEqual(state.remainingPlayerActions, [0, 4, 2]);
  assert.doesNotThrow(() => hit(state, 4));
});

test('defeated field slots refill without granting reserve actors extra actions', () => {
  let state = make();
  state.party[1].hp = 1;
  state.party[1].statuses.push({ id: 'poison', name: '中毒', turns: 2 });
  state = hit(state, 1);
  assert.equal(state.party[1].hp, 0);
  assert.deepEqual(new Set(state.activePlayers), new Set([0, 2, 3]));
  assert(!state.remainingPlayerActions.includes(3));
  assert.throws(() => hit(state, 3), /already acted/);
  assert(!state.events.some(event => event.kind === 'use' && event.actorId === 'p3'));
});

test('smaller formations remain smaller and all enemy field actors respond once', () => {
  let state = make({ activePlayers: [2], activeEnemies: [0, 2, 4] });
  state = hit(state, 2);
  assert.deepEqual(state.activePlayers, [2]);
  assert.deepEqual(state.activeEnemies, [0, 2, 4]);
  assert.equal(state.roundOpen, false);
  assert.deepEqual(new Set(state.events.filter(event => event.kind === 'use' && event.side === 'enemy').map(event => event.actorId)), new Set(['e0', 'e2', 'e4']));
  for (const selected of [[], [0, 0], [0, 1, 2, 3], [7]]) assert.throws(() => make({ activePlayers: selected }), /1–3/);
});

test('items have bounded charges, target field allies, consume turns and respect healing budget', () => {
  let state = make({ items: { 'healing-potion': 2, 'resource-potion': 1, cleanse: 1 } });
  state.party[2].hp = 500; state.healingBudget.player = 20;
  state = act(state, { type: 'item', actorIndex: 0, targetId: 'p2', itemId: 'healing-potion' });
  assert.equal(state.healingBudget.player, 0);
  assert(state.events.some(event => event.kind === 'heal' && event.targetId === 'p2' && event.value === 20));
  assert.equal(state.inventory.find(item => item.id === 'healing-potion').count, 1);
  assert.throws(() => hit(state, 0), /already acted/);
  assert.throws(() => act(state, { type: 'item', actorIndex: 1, targetIndex: 3, itemId: 'resource-potion' }), /on-field/);
  state.party[2].resource = 0;
  state = act(state, { type: 'item', actorIndex: 1, targetIndex: 2, itemId: 'resource-potion' });
  assert.equal(state.party[2].resource, 30);
  assert.throws(() => act(state, { type: 'item', actorIndex: 2, itemId: 'resource-potion' }), /unavailable/);
  state.party[2].statuses.push({ id: 'poison', name: '中毒', turns: 3 });
  state = act(state, { type: 'item', actorIndex: 2, itemId: 'cleanse' });
  assert(!state.party[2].statuses.some(effect => effect.id === 'poison'));
  assert.equal(state.inventory.find(item => item.id === 'cleanse').count, 0);
  assert.equal(snapshot(state).inventory.find(item => item.id === 'resource-potion').count, 0);
  const defaults = make(); assert.match(defaults.inventorySource, /固定默认/);
  assert.deepEqual(defaults.inventory.map(item => item.count), [1, 1, 0]);
  assert.deepEqual(make({ items: [] }).inventory.map(item => item.count), [0, 0, 0]);
});

test('scalar-only saves preserve single fighter formations and get no new supply charges', () => {
  const old = make();
  for (const key of ['activePlayers', 'activeEnemies', 'fieldCapacity', 'actedPlayers', 'actedEnemies', 'remainingPlayerActions', 'roundOpen', 'inventory', 'inventorySource']) delete old[key];
  old.activePlayer = 2; old.activeEnemy = 1; old.round = 7; old.seq = 7;
  const migrated = snapshot(old);
  assert.deepEqual(migrated.activePlayers, [2]); assert.deepEqual(migrated.activeEnemies, [1]);
  assert.deepEqual(migrated.inventory.map(item => item.count), [0, 0, 0]);
  const next = hit(old, 2, 1);
  assert.equal(next.round, 8); assert.equal(next.seq, 8);
  assert.deepEqual(next.activePlayers, [2]);
  assert(!Object.hasOwn(old, 'activePlayers'));
});

test('round 24 resolves all field actions before ending, and defeated sides have empty fields', () => {
  let state = make(); state.round = 23; state.seq = 69;
  state = hit(state, 0);
  assert.equal(state.round, 24); assert.equal(state.outcome, null);
  state = hit(state, 1); assert.equal(state.outcome, null);
  state = hit(state, 2);
  assert.equal(state.round, 24); assert.equal(state.seq, 72);
  assert.equal(state.outcome.reason, 'round-limit');
  assert.equal(state.roundOpen, false);
  let duel = createBattle({ party: [{ speed: 100 }], enemies: [{ hp: 1, maxHp: 1000, speed: 1 }] });
  duel = hit(duel, 0);
  assert.equal(duel.outcome.winner, 'player');
  assert.deepEqual(duel.activeEnemies, []);
  assert.equal(duel.activeEnemy, -1);
  assert.deepEqual(snapshot(duel).activeEnemies, []);
});

test('multi-active healing, summons and control stay finite through at most 24 rounds and 72 commands', () => {
  const skills = ['human-0-17', 'human-0-19', 'human-0-5'];
  let state = make({ party: actors('p', 6, skills), enemies: actors('e', 6, skills), seed: 733 });
  let commands = 0;
  while (!state.outcome) {
    const index = state.remainingPlayerActions[0], actor = state.party[index];
    const skill = actor.skills.find(entry => entry.usesLeft > 0 && entry.cooldownLeft === 0 && actor.resource >= entry.cost);
    state = skill ? act(state, { type: 'skill', actorIndex: index, targetIndex: state.activeEnemies[0], skillId: skill.id })
      : act(state, { type: 'basic', actorIndex: index, targetIndex: state.activeEnemies[0] });
    assert(++commands <= 72);
    assert(state.activePlayers.length <= 3 && state.activeEnemies.length <= 3);
    for (const member of [...state.party, ...state.enemies]) assert(Number.isFinite(member.hp) && member.hp >= 0 && member.hp <= member.maxHp);
  }
  assert(state.round <= 24);
  assert(state.healingBudget.player >= 0 && state.healingBudget.enemy >= 0);
});
