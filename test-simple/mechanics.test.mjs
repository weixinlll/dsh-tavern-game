import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSkill, MECHANICS, STATUSES } from '../simple/catalog.mjs';
import { createBattle, normalizeActor, act, snapshot } from '../simple/engine.mjs';

const make = (skill, seed = 1) => createBattle({ seed,
  party: [{ id: 'p', name: '甲', hp: 1000, maxHp: 1000, attack: 115, defense: 35, speed: 60, skills: [skill] }],
  enemies: [{ id: 'e', name: '乙', hp: 1000, maxHp: 1000, attack: 115, defense: 35, speed: 50, skills: ['human-0-0'] }],
});
const special = state => state.party[0].skills.find(s => s.id !== 'human-0-0');
const play = state => act(state, { type: 'skill', skillId: special(state)?.id || 'human-0-0' });
const add = (actor, id, turns = STATUSES[id].duration) => actor.statuses.push({ id, name: STATUSES[id].name, turns, sourceId: 'p' });
const damageTo = (state, target) => state.events.filter(e => e.kind === 'damage' && e.targetId === target && e.actorId === 'p').reduce((sum, e) => sum + e.value, 0);

test('six-person rosters deploy three fighters, retain three reserves, and equip at most four skills', () => {
  const members = Array.from({ length: 6 }, (_, i) => ({ id: 'p' + i, name: '队友' + i, skills: Array.from({ length: 8 }, (_, j) => `human-0-${j}`) }));
  let state = createBattle({ party: members, enemies: [{ name: '敌人' }] });
  assert.equal(state.activePlayer, 0);
  assert.equal(state.party.length, 6);
  assert.deepEqual(state.activePlayers, [0, 1, 2]);
  assert(state.party.every(actor => actor.skills.length <= 4));
  state = act(state, { type: 'switch', actorIndex: 0, index: 3 });
  assert.equal(state.activePlayer, 3);
  assert.deepEqual(state.activePlayers, [3, 1, 2]);
  assert.deepEqual(state.remainingPlayerActions, [1, 2]);
  assert.equal(state.round, 1, 'switch consumes this action');
  assert(state.events.some(event => event.kind === 'use' && event.side === 'enemy'));
  assert.throws(() => createBattle({ party: [...members, { name: '第七人' }], enemies: [{}] }), /1–6/);
  assert.throws(() => createBattle({ party: [{}], enemies: [...members, { name: '第七敌人' }] }), /1–6/);
});

test('one source skill compiles several mechanics and status effects without losing them on save/rebuild', () => {
  const input = { name: '风雷连毒击', description: '必定先攻击，必中，必定暴击，连续攻击三次，穿透护盾，附加中毒和麻痹并吸血' };
  const spec = resolveSkill(input);
  for (const id of ['first', 'sureHit', 'critical', 'multiHit', 'shieldPierce', 'drain']) assert(spec.mechanics.includes(id), id);
  assert(spec.extraStatuses.includes('poison'));
  assert(spec.extraStatuses.includes('paralysis'));
  assert.match(spec.description, /暴击/);
  assert(spec.cost <= 30);
  const actor = normalizeActor({ name: '甲', skills: [input] });
  const rebuilt = normalizeActor(actor);
  assert.deepEqual(rebuilt.skills.map(s => [s.id, s.mechanics, s.extraStatuses]), actor.skills.map(s => [s.id, s.mechanics, s.extraStatuses]));
  const edited = resolveSkill({ name: '拳击', mechanics: ['critical', 'eval(code)', 'first'], power: Infinity, extraStatuses: ['poison', '__proto__'] });
  assert(!edited.mechanics.includes('eval(code)'));
  assert(edited.notes.some(note => note.includes('未支持')));
  assert(Number.isFinite(edited.power));
});

test('guaranteed first strike overrides speed; equal priority uses speed and control still applies', () => {
  let state = make({ name: '先制拳', mechanics: ['first', 'sureHit'] });
  state.party[0].speed = 1; state.enemies[0].speed = 10000;
  assert.equal(play(state).events.find(e => e.kind === 'use').actorId, 'p');
  const rival = normalizeActor({ id: 'e', name: '乙', skills: [{ name: '先制拳', mechanics: ['first'] }] }, { id: 'e', side: 'enemy' });
  state.enemies[0].skills = rival.skills.filter(s => s.mechanics.includes('first'));
  assert.equal(play(state).events.find(e => e.kind === 'use').actorId, 'e');
  state = make({ name: '先制拳', mechanics: ['first'] });
  add(state.party[0], 'stun');
  const controlled = play(state);
  assert(controlled.events.some(e => e.kind === 'skip' && e.actorId === 'p'));
  assert(!controlled.events.some(e => e.kind === 'use' && e.actorId === 'p'));
});

test('sure hit ignores blindness and evasion; guaranteed crit multiplies damage and crit guard blocks it', () => {
  for (let seed = 1; seed <= 80; seed++) {
    const state = make({ name: '拳击', mechanics: ['sureHit', 'critical'] }, seed);
    add(state.party[0], 'blind'); add(state.enemies[0], 'evasion');
    const next = play(state);
    assert(!next.events.some(e => e.kind === 'miss' && e.actorId === 'p'));
    assert(next.events.some(e => e.kind === 'critical' && e.actorId === 'p'));
  }
  const normal = make({ name: '拳击', mechanics: ['sureHit'] });
  const critical = make({ name: '拳击', mechanics: ['sureHit', 'critical'] });
  assert(damageTo(play(critical), 'e') > damageTo(play(normal), 'e'));
  add(critical.enemies[0], 'critGuard');
  const guarded = play(critical);
  assert(!guarded.events.some(e => e.kind === 'critical'));
  assert.equal(damageTo(guarded, 'e'), damageTo(play(normal), 'e'));
});

test('multi-hit shares one damage budget; piercing bypasses ward but never bypasses protect', () => {
  const multi = make({ name: '拳击', mechanics: ['multiHit', 'sureHit', 'critical'] });
  const next = play(multi);
  const hits = next.events.filter(e => e.kind === 'damage' && e.actorId === 'p' && e.targetId === 'e');
  assert.equal(hits.length, 3);
  assert(damageTo(next, 'e') <= 270);
  assert.equal(special(next).usesLeft, special(multi).usesLeft - 1);
  const warded = make({ name: '拳击', mechanics: ['shieldPierce', 'sureHit'] });
  add(warded.enemies[0], 'ward'); warded.enemies[0].statuses.find(s => s.id === 'ward').shield = 999;
  assert(damageTo(play(warded), 'e') > 0);
  add(warded.enemies[0], 'protect');
  assert.equal(damageTo(play(warded), 'e'), 0);
  const protectedPoison = make({ name: '毒拳', mechanics: ['sureHit'] }); add(protectedPoison.enemies[0], 'protect');
  assert(!play(protectedPoison).events.some(e => e.kind === 'status' && e.name === '中毒'));
});

test('combined drains, cleanse, dispel, counter, shield, healing and recoil execute once per action', () => {
  const state = make({ name: '拳击', mechanics: ['sureHit', 'drain', 'resourceDrain', 'cleanseSelf', 'dispelTarget', 'healSelf', 'counter', 'shieldSelf', 'recoil'] });
  state.party[0].hp = 500; state.party[0].resource = 80;
  add(state.party[0], 'poison'); add(state.party[0], 'bleed');
  add(state.enemies[0], 'fortify'); add(state.enemies[0], 'focus');
  const next = play(state);
  for (const kind of ['resource', 'cleanse', 'dispel', 'heal']) assert(next.events.some(e => e.kind === kind), kind);
  assert(next.events.some(e => e.kind === 'damage' && e.name === '舍身反冲'));
  assert(next.party[0].statuses.some(s => s.id === 'ward'));
  assert(next.party[0].statuses.some(s => s.id === 'reflect'));
  assert(!next.party[0].statuses.some(s => ['poison', 'bleed'].includes(s.id)));
  assert(next.healingBudget.player < state.healingBudget.player);
});

test('priority/crit/accuracy preparation, mana shield, rage, thorns and parasitism have actual effects', () => {
  let state = make('human-0-0'); add(state.party[0], 'initiative'); state.party[0].speed = 1;
  assert.equal(play(state).events.find(e => e.kind === 'use').actorId, 'p');
  assert(!play(state).party[0].statuses.some(s => s.id === 'initiative'));
  state = make('human-0-0'); add(state.party[0], 'critReady'); add(state.party[0], 'sureHit');
  const prepared = play(state);
  assert(prepared.events.some(e => e.kind === 'critical'));
  assert(!prepared.party[0].statuses.some(s => ['critReady', 'sureHit'].includes(s.id)));
  const baseline = make('human-0-0'), shielded = snapshot(baseline);
  add(shielded.party[0], 'manaShield');
  assert(play(shielded).party[0].hp > play(baseline).party[0].hp);
  assert(play(shielded).party[0].resource < 100);
  state = make('human-0-0'); state.party[0].hp = 300;
  const enraged = snapshot(state); add(enraged.party[0], 'rage');
  assert(damageTo(play(enraged), 'e') > damageTo(play(state), 'e'));
  state = make('human-0-0'); add(state.party[0], 'bramble');
  assert(play(state).events.some(e => e.skillId === 'bramble' && e.value === 30));
  state = make('human-0-0'); state.party[0].hp = 500; add(state.enemies[0], 'sap');
  const sapped = play(state);
  assert(sapped.events.some(e => e.skillId === 'sap' && e.kind === 'damage'));
  assert(sapped.events.some(e => e.skillId === 'sap' && e.kind === 'heal'));
});

test('resistance and effect amplification change real status probabilities', () => {
  const counts = { normal: 0, resistant: 0, amplified: 0 };
  for (let seed = 1; seed <= 120; seed++) for (const key of Object.keys(counts)) {
    const state = make({ name: '毒拳', mechanics: ['sureHit'] }, seed);
    if (key === 'resistant') add(state.enemies[0], 'resistance');
    if (key === 'amplified') add(state.party[0], 'amplify');
    counts[key] += play(state).events.some(e => e.kind === 'status' && e.name === '中毒');
  }
  assert(counts.resistant < counts.normal);
  assert(counts.amplified > counts.normal);
});

test('all-mechanics combinations stay finite and end by round 24', () => {
  for (let seed = 1; seed <= 30; seed++) {
    let state = make({ name: '复合拳', mechanics: Object.keys(MECHANICS), extraStatuses: ['poison', 'paralysis'] }, seed);
    while (!state.outcome && state.round < 24) {
      const actor = state.party[state.activePlayer];
      const candidate = actor.skills.find(skill => skill.id !== 'human-0-0' && skill.usesLeft > 0 && !skill.cooldownLeft && actor.resource >= skill.cost);
      try { state = act(state, { type: 'skill', skillId: candidate?.id || 'human-0-0' }); }
      catch (error) { assert.match(error.message, /unavailable/); state = act(state, { type: 'skill', skillId: 'human-0-0' }); }
      for (const member of [...state.party, ...state.enemies]) assert(Number.isFinite(member.hp) && member.hp >= 0 && member.hp <= member.maxHp);
      assert(state.events.length <= 36);
    }
    assert(state.outcome);
  }
});
