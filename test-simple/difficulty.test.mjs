import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createBattle, snapshot, DIFFICULTIES, ENCOUNTER_DIFFICULTIES } from '../simple/engine.mjs';

const actor = (id, skills = ['human-0-0']) => ({ id, name: id, avatarPaletteSeed: id.charCodeAt(0) || 1, hp: 1000, maxHp: 1000, attack: 115, defense: 35, speed: 50, skills });
const make = options => createBattle({ party: [actor('p0', ['human-0-12']), actor('p1', ['human-0-17'])], enemies: [actor('e0', ['human-0-1', 'human-0-17', 'human-0-38'])], seed: 7, ...options });
const guard = { type: 'skill', actorId: 'p0', skillId: 'human-0-12' };
const enemyUse = state => state.events.find(event => event.kind === 'use' && event.side === 'enemy');

test('six intelligence levels change decisions only; independent low/medium/high settings scale enemies', () => {
  assert.deepEqual(DIFFICULTIES.map(level => level.id), ['easy', 'normal', 'hard', 'expert', 'hell', 'ai']);
  assert.deepEqual(ENCOUNTER_DIFFICULTIES.map(level => level.id), ['low', 'medium', 'high']);
  const normal = make();
  for (const level of DIFFICULTIES) {
    const state = make({ difficulty: level.id });
    assert.deepEqual(state.party, normal.party, level.id);
    assert.deepEqual(state.enemies, normal.enemies, level.id);
    assert.match(level.description, /不调整数值/);
  }
  for (const [encounterDifficulty, scale] of [['low', 0.85], ['medium', 1], ['high', 1.2]]) {
    const state = make({ encounterDifficulty });
    assert.deepEqual(state.party, normal.party);
    assert.equal(state.enemies[0].maxHp, 1000 * scale);
    assert.equal(state.enemies[0].hp, 1000 * scale);
    assert.equal(state.enemies[0].attack, 115 * scale);
    assert.equal(state.enemies[0].defense, normal.enemies[0].defense);
    assert.equal(state.enemies[0].speed, normal.enemies[0].speed);
    assert.equal(act(state, guard).enemies[0].maxHp, state.enemies[0].maxHp, 'resume never reapplies scaling');
  }
  assert.throws(() => make({ difficulty: 'arbitrary' }), /difficulty/);
  assert.throws(() => make({ encounterDifficulty: 'arbitrary' }), /encounter difficulty/);
});

test('enemy appearance scaling preserves authored zero HP and current-health ratio within numeric caps', () => {
  const enemies = [{ ...actor('alive'), hp: 500 }, { ...actor('fallen'), hp: 0 }, { ...actor('huge'), hp: 1e9, maxHp: 1e9, attack: 1e9 }];
  const original = structuredClone(enemies);
  const state = make({ enemies, encounterDifficulty: 'high' });
  assert.equal(state.enemies[0].hp, 600); assert.equal(state.enemies[0].maxHp, 1200);
  assert.equal(state.enemies[1].hp, 0); assert(!state.activeEnemies.includes(1));
  assert.equal(state.enemies[2].hp, 1e9); assert.equal(state.enemies[2].maxHp, 1e9); assert.equal(state.enemies[2].attack, 1e9);
  assert.deepEqual(enemies, original);
});

test('ordinary decisions remain reproducible and old saves gain normal/medium settings without rescaling', () => {
  const state = make(), old = structuredClone(state);
  delete old.difficulty; delete old.encounterDifficulty;
  assert.deepEqual(act(state, guard), act(old, guard));
  assert.equal(snapshot(old).difficulty, 'normal'); assert.equal(snapshot(old).encounterDifficulty, 'medium');
  assert.deepEqual(snapshot(old).enemies, old.enemies);
});

test('easy decisions often choose basic attacks while hard opponents recover and cleanse with real effects', () => {
  let basic = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const state = make({ difficulty: 'easy', seed });
    basic += enemyUse(act(state, guard))?.skillId === 'human-0-0';
  }
  assert(basic >= 20);
  let state = make({ difficulty: 'hard' }); state.enemies[0].hp = 200;
  state = act(state, guard);
  assert.equal(enemyUse(state).skillId, 'human-0-17');
  assert(state.events.some(event => event.kind === 'heal' && event.actorId === 'e0' && event.value > 0));
  state = make({ difficulty: 'hard', enemies: [actor('e0', ['human-0-18'])] });
  for (const id of ['poison', 'burn']) state.enemies[0].statuses.push({ id, name: id, turns: 3 });
  state = act(state, guard);
  assert.equal(enemyUse(state).skillId, 'human-0-18');
  assert.equal(state.enemies[0].statuses.length, 0);
});

test('expert decisions inspect player skill configurations and choose a field healer as anti-heal target', () => {
  let state = make({ difficulty: 'expert', enemies: [actor('e0', ['human-0-37', 'human-0-8'])] });
  state = act(state, guard);
  assert.equal(enemyUse(state).skillId, 'human-0-37');
  assert.equal(enemyUse(state).targetId, 'p1');
  assert(!state.events.some(event => event.side === 'enemy' && event.targetId === 'e0' && event.kind === 'damage'));
});

test('hell anticipates the current attack with protection while expert can take a finishing attack', () => {
  const options = { party: [{ ...actor('p0'), hp: 100, speed: 1 }], enemies: [{ ...actor('e0', ['human-0-1', 'human-0-56']), speed: 10000 }] };
  const intent = { type: 'skill', actorId: 'p0', targetId: 'e0', skillId: 'human-0-0' };
  const expert = act(make({ ...options, difficulty: 'expert' }), intent);
  const hell = act(make({ ...options, difficulty: 'hell' }), intent);
  assert.equal(enemyUse(expert).skillId, 'human-0-1');
  assert.equal(enemyUse(hell).skillId, 'human-0-56');
  assert(hell.events.some(event => event.kind === 'absorb' && event.name === '招架'));
  assert.equal(hell.events.filter(event => event.kind === 'use' && event.side === 'enemy').length, 1);
});

test('AI accepts only external equipped available skills and living field targets, with deterministic fallback', () => {
  const state = make({ difficulty: 'ai', party: [actor('p0', ['human-0-12']), actor('p1'), actor('p2'), actor('reserve')], enemies: [actor('e0', ['human-0-1'])] });
  const plan = { actorId: 'e0', skillId: 'human-0-1', targetId: 'p1' };
  for (const enemyPlans of [[plan], { e0: plan }]) {
    const next = act(state, guard, { enemyPlans });
    assert.equal(enemyUse(next).skillId, plan.skillId); assert.equal(enemyUse(next).targetId, plan.targetId);
  }
  const fallback = act(state, guard);
  for (const plan of [
    { actorId: 'e0', skillId: 'human-0-79', targetId: 'p1' },
    { actorId: 'e0', skillId: 'human-0-1', targetId: 'reserve' },
    { actorId: 'e0', skillId: 'human-0-1', targetId: 'e0' },
    { actorId: 'reserveEnemy', skillId: 'human-0-1', targetId: 'p1' },
    { actorId: 'e0', skillId: null, targetId: 'p1' },
  ]) assert.deepEqual(act(state, guard, { enemyPlans: [plan] }), fallback);
  assert.deepEqual(act(state, { ...guard, enemyPlans: [plan] }), fallback, 'client intent cannot inject model plans');
  for (const block of [skill => { skill.usesLeft = 0; }, skill => { skill.cooldownLeft = 1; }, (_skill, state) => { state.enemies[0].resource = 0; }]) {
    const unavailable = structuredClone(state); block(unavailable.enemies[0].skills.find(skill => skill.id === 'human-0-1'), unavailable);
    assert.deepEqual(act(unavailable, guard, { enemyPlans: [plan] }), act(unavailable, guard));
  }
  const dead = structuredClone(state); dead.party[1].hp = 0;
  assert.deepEqual(act(dead, guard, { enemyPlans: [plan] }), act(dead, guard));
  const ordinary = make({ difficulty: 'normal' });
  assert.deepEqual(act(ordinary, guard, { enemyPlans: [plan] }), act(ordinary, guard), 'plans apply only in AI mode');
});

test('AI plans cannot give extra actions or recruit reserves, and all intelligence levels remain bounded', () => {
  const state = make({ difficulty: 'ai', party: [actor('p0', ['human-0-12'])], enemies: Array.from({ length: 6 }, (_, index) => actor(`e${index}`)) });
  const enemyPlans = state.enemies.map(enemy => ({ actorId: enemy.id, skillId: 'human-0-0', targetId: 'p0' }));
  const next = act(state, guard, { enemyPlans });
  const used = next.events.filter(event => event.kind === 'use' && event.side === 'enemy');
  assert.deepEqual(used.map(event => event.actorId), ['e0', 'e1', 'e2']);
  assert(next.enemies.slice(3).every(enemy => enemy.hp === enemy.maxHp));
  for (const difficulty of DIFFICULTIES.map(level => level.id)) {
    let state = make({ difficulty, party: Array.from({ length: 6 }, (_, index) => actor(`p${index}`)), enemies: Array.from({ length: 6 }, (_, index) => actor(`e${index}`, ['human-0-17', 'human-0-19', 'human-0-5'])) }), commands = 0;
    while (!state.outcome) {
      state = act(state, { type: 'skill', actorIndex: state.remainingPlayerActions[0], skillId: 'human-0-0' });
      assert(++commands <= 72); assert(state.round <= 24);
      for (const member of [...state.party, ...state.enemies]) assert(Number.isFinite(member.hp) && member.hp >= 0 && member.hp <= member.maxHp);
    }
  }
});
