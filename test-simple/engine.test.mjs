import test from 'node:test';
import assert from 'node:assert/strict';
import { BASIC_SKILL_ID, PACKS, SKILLS, STATUSES, resolveSkill } from '../simple/catalog.mjs';
import { createBattle, act, normalizeActor, snapshot, summary } from '../simple/engine.mjs';

const make = (packId, playerSkills, enemySkills = [`${packId}-0-0`], seed = 1) => createBattle({
  packId, seed,
  party: [{ name: '甲', hp: 1000, maxHp: 1000, attack: 115, defense: 35, speed: 60, skills: playerSkills }],
  enemies: [{ name: '乙', hp: 1000, maxHp: 1000, attack: 115, defense: 35, speed: 50, skills: enemySkills }],
});

test('exactly two fixed packs, large playable catalog, semantic story mapping', () => {
  assert.deepEqual(PACKS.map(pack => pack.id), ['human', 'fantasy']);
  assert.equal(SKILLS.length, 2 * 16 * 81);
  assert.equal(new Set(SKILLS.map(skill => skill.id)).size, SKILLS.length);
  assert.equal(Object.keys(STATUSES).length, 60);
  assert.deepEqual(BASIC_SKILL_ID, { human: 'human-0-0', fantasy: 'fantasy-0-0' });
  assert.equal(resolveSkill({ name: '七星魅惑', description: '让敌人沉迷' }, 'fantasy').status, 'charm');
  assert.equal(resolveSkill({ name: '故事中的召唤术', description: '招来援手' }, 'fantasy').kind, 'summon');
  const actor = normalizeActor({ hp: 1e9, maxHp: 1e9, attack: NaN, skills: [{ name: '火焰风暴', power: 999999 }] }, { packId: 'fantasy' });
  assert.equal(actor.maxHp, 1e9);
  assert.equal(actor.attack, 115_000_000);
  const fireSkill = actor.skills.find(skill => skill.name === '火焰风暴');
  assert.ok(fireSkill);
  assert.equal(fireSkill.usesLeft, resolveSkill('火焰风暴', 'fantasy').uses);
  const support = normalizeActor({ skills: [17, 18, 19, 22, 26, 27].map(index => `human-0-${index}`) });
  assert.equal(support.skills.length, 4);
  assert(!support.skills.some(skill => skill.id === BASIC_SKILL_ID.human));
  assert.equal(resolveSkill('一击必杀', 'fantasy').kind, 'damage');
  assert.equal(resolveSkill('时间停止', 'fantasy').status, 'stun');
  assert.equal(resolveSkill('绝对免疫', 'fantasy').status, 'fortify');
  assert.equal(resolveSkill('免控', 'fantasy').status, 'controlImmune');
});

test('every preset executes with finite bounded state and action events', () => {
  for (const preset of SKILLS) {
    const state = make(preset.packId, [preset.id]);
    const next = act(state, { type: 'skill', skillId: preset.id });
    assert.ok(next.events.length <= 36, preset.id);
    assert.equal(next.round, 1, preset.id);
    assert.ok(next.events.some(event => event.kind === 'use' && event.skillId === preset.id), preset.id);
    for (const actor of [...next.party, ...next.enemies]) {
      assert.ok(Number.isFinite(actor.hp) && actor.hp >= 0 && actor.hp <= actor.maxHp, preset.id);
      assert.ok(Number.isFinite(actor.resource), preset.id);
    }
    assert.deepEqual(snapshot(next), next);
    assert.equal(summary(next).seq, 1);
  }
});

test('charm skips and harms; repeated control cannot lock forever', () => {
  let state = make('fantasy', ['fantasy-0-5', 'fantasy-0-0'], ['fantasy-0-0'], 2);
  state.enemies[0].statuses.push({ id: 'charm', name: '魅惑', turns: 2, sourceId: 'player-1' });
  state = act(state, { type: 'skill', skillId: 'fantasy-0-0' });
  assert.ok(state.events.some(event => event.kind === 'skip' && event.actorId === 'enemy-1'));
  assert.ok(state.events.some(event => event.kind === 'damage' && event.name === '魅惑反噬'));
  state.enemies[0].statuses.push({ id: 'charm', name: '魅惑', turns: 2, sourceId: 'player-1' });
  state = act(state, { type: 'skill', skillId: 'fantasy-0-5' });
  assert.ok(state.events.some(event => event.kind === 'use' && event.actorId === 'enemy-1'));
});

test('blind changes hit chance, summon assists three rounds, cleanse removes poison', () => {
  let blindMisses = 0, normalMisses = 0;
  for (let seed = 1; seed <= 80; seed++) {
    const normal = make('human', ['human-0-0'], ['human-0-0'], seed);
    const blinded = snapshot(normal);
    blinded.party[0].statuses.push({ id: 'blind', name: '致盲', turns: 2, sourceId: 'enemy-1' });
    normalMisses += act(normal, { type: 'skill', skillId: 'human-0-0' }).events.some(e => e.kind === 'miss' && e.actorId === 'player-1') ? 1 : 0;
    blindMisses += act(blinded, { type: 'skill', skillId: 'human-0-0' }).events.some(e => e.kind === 'miss' && e.actorId === 'player-1') ? 1 : 0;
  }
  assert.ok(blindMisses > normalMisses);
  let state = make('fantasy', ['fantasy-0-19', 'fantasy-0-18', 'fantasy-0-0']);
  state.party[0].statuses.push({ id: 'poison', name: '中毒', turns: 3, sourceId: 'enemy-1' });
  state = act(state, { type: 'skill', skillId: 'fantasy-0-19' });
  assert.ok(state.events.some(e => e.kind === 'summon'));
  assert.ok(state.events.some(e => e.kind === 'damage' && e.skillId === 'summon'));
  state = act(state, { type: 'skill', skillId: 'fantasy-0-18' });
  assert.ok(state.events.some(e => e.kind === 'cleanse' && e.value >= 1));
  assert.ok(!state.party[0].statuses.some(s => s.id === 'poison'));
  state = act(state, { type: 'skill', skillId: 'fantasy-0-0' });
  assert.equal(state.summons.player, null);
});

test('healer, control, summon and reflect battles terminate within 24 rounds', () => {
  const builds = [
    ['human-0-17', 'human-0-0'],
    ['fantasy-0-5', 'fantasy-0-6', 'fantasy-0-7', 'fantasy-0-0'],
    ['fantasy-0-19', 'fantasy-0-16', 'fantasy-0-17', 'fantasy-0-0'],
  ];
  for (const ids of builds) {
    const packId = ids[0].startsWith('human-') ? 'human' : 'fantasy';
    let state = make(packId, ids, ids, 777);
    while (!state.outcome) {
      const available = state.party[state.activePlayer].skills.find(skill => skill.usesLeft > 0 && skill.cooldownLeft === 0 && state.party[state.activePlayer].resource >= resolveSkill(skill.id, packId).cost);
      state = act(state, { type: 'skill', skillId: available?.id ?? ids.at(-1) });
    }
    assert.ok(state.round <= 24);
    assert.ok(['player', 'enemy', 'draw'].includes(state.outcome.winner));
    assert.ok(state.healingBudget.player >= 0 && state.healingBudget.enemy >= 0);
  }
});

test('life and resource drains, bounded area attack, revive, and dispel execute', () => {
  let state = make('fantasy', ['fantasy-0-23', 'fantasy-0-24', 'fantasy-0-25', 'fantasy-0-27'], ['fantasy-0-0']);
  state.party[0].hp = 500;
  state = act(state, { type: 'skill', skillId: 'fantasy-0-23' });
  assert.ok(state.events.some(e => e.kind === 'heal' && e.actorId === 'player-1' && e.value > 0));
  state = act(state, { type: 'skill', skillId: 'fantasy-0-24' });
  assert.ok(state.events.some(e => e.kind === 'resource' && e.value > 0));

  state = createBattle({ packId: 'fantasy', seed: 1, party: [{ speed: 90, skills: ['fantasy-0-25'] }], enemies: Array.from({ length: 3 }, (_, i) => ({ id: `foe-${i}`, skills: ['fantasy-0-0'] })) });
  state = act(state, { type: 'skill', skillId: 'fantasy-0-25' });
  assert.equal(new Set(state.events.filter(e => e.kind === 'damage' && e.actorId === 'player-1').map(e => e.targetId)).size, 3);

  state = createBattle({ packId: 'fantasy', seed: 1, party: [{ id: 'leader', speed: 90, skills: ['fantasy-0-26', 'fantasy-1-26'] }, { id: 'ally', hp: 0, maxHp: 1000 }], enemies: [{ skills: ['fantasy-0-0'] }] });
  const initialBudget = state.healingBudget.player;
  state = act(state, { type: 'skill', skillId: 'fantasy-0-26' });
  assert.equal(state.party[1].hp, 200);
  assert.equal(state.healingBudget.player, initialBudget - 200);
  assert.ok(state.reviveUsed);
  state.party[1].hp = 0;
  state = act(state, { type: 'skill', skillId: 'fantasy-1-26' });
  assert.equal(state.party[1].hp, 0);
  assert.ok(state.events.some(e => e.kind === 'miss' && e.skillId === 'fantasy-1-26'));

  state = make('fantasy', ['fantasy-0-27']);
  state.enemies[0].statuses.push({ id: 'ward', name: '护盾', turns: 2, shield: 100 });
  state = act(state, { type: 'skill', skillId: 'fantasy-0-27' });
  assert.ok(state.events.some(e => e.kind === 'dispel' && e.value === 1));
});

test('new control and debuff statuses have bounded real effects', () => {
  for (const id of ['confusion', 'sleep', 'freeze', 'stun', 'petrify']) {
    let state = make('human', ['human-0-0']);
    state.enemies[0].statuses.push({ id, name: STATUSES[id].name, turns: 1 });
    state = act(state, { type: 'skill', skillId: 'human-0-0' });
    assert.ok(state.events.some(e => e.kind === 'skip' && e.actorId === 'enemy-1'), id);
  }
  for (const id of ['taunt', 'disarm']) {
    let state = make('human', ['human-0-1']);
    state.party[0].statuses.push({ id, name: STATUSES[id].name, turns: 1 });
    assert.throws(() => act(state, { type: 'skill', skillId: 'human-0-1' }), /unavailable/);
    state = act(state, { type: 'basic' });
    assert.ok(state.events.some(e => e.kind === 'use' && e.actorId === 'player-1' && e.skillId === BASIC_SKILL_ID.human), id);
  }
  let state = createBattle({ party: [{ id: 'one', skills: ['human-0-0'] }, { id: 'two' }], enemies: [{}] });
  state.party[0].statuses.push({ id: 'root', name: '束缚', turns: 2 });
  assert.throws(() => act(state, { type: 'switch', index: 1 }), /Rooted/);

  const plain = make('human', ['human-0-17']);
  plain.party[0].hp = 400;
  const blocked = snapshot(plain);
  blocked.party[0].statuses.push({ id: 'antiHeal', name: '禁疗', turns: 2 });
  const normalHeal = act(plain, { type: 'skill', skillId: 'human-0-17' }).events.find(e => e.kind === 'heal' && e.actorId === 'player-1').value;
  const blockedHeal = act(blocked, { type: 'skill', skillId: 'human-0-17' }).events.find(e => e.kind === 'heal' && e.actorId === 'player-1').value;
  assert.ok(blockedHeal < normalHeal);
  const cursed = make('human', ['human-0-0']);
  cursed.party[0].statuses.push({ id: 'curse', name: '诅咒', turns: 2 });
  assert.ok(act(cursed, { type: 'skill', skillId: 'human-0-0' }).events.some(e => e.kind === 'damage' && e.skillId === 'curse'));

  const normal = make('human', ['human-0-0']);
  const empowered = snapshot(normal);
  empowered.party[0].statuses.push({ id: 'empower', name: '鼓舞', turns: 2 });
  const fortified = snapshot(normal);
  fortified.enemies[0].statuses.push({ id: 'fortify', name: '壁垒', turns: 2 });
  const dealt = battle => act(battle, { type: 'skill', skillId: 'human-0-0' }).events.find(e => e.kind === 'damage' && e.actorId === 'player-1')?.value ?? 0;
  assert.ok(dealt(empowered) > dealt(normal));
  assert.ok(dealt(fortified) < dealt(normal));
});

test('four special skills remain equipped while basic attack is an independent action', () => {
  let state = createBattle({
    textVersion: 'v-current-abc',
    party: [{ resource: 0, skills: [
      { name: '烈焰袭击', description: '施加灼伤' },
      { name: '火焰斩击', description: '灼伤敌人' },
      { name: '急救', description: '治疗自身' },
      { name: '复苏', description: '复活队友' },
      { name: '护盾', description: '保护自身' },
      { name: '迅捷', description: '提高速度' },
    ] }],
    enemies: [{}],
  });
  assert.equal(state.textVersion, 'v-current-abc');
  assert.ok(state.party[0].skills.length <= 4);
  assert.equal(state.party[0].skills.length, 4);
  assert(!state.party[0].skills.some(skill => skill.id === BASIC_SKILL_ID.human));
  assert.equal(new Set(state.party[0].skills.map(skill => skill.id)).size, state.party[0].skills.length);
  assert.equal(state.party[0].skills.find(skill => skill.id === 'human-0-10').name, '烈焰袭击');
  assert.ok(state.party[0].warnings.some(warning => warning.includes('合并')));
  assert.ok(state.party[0].warnings.some(warning => warning.includes('省略')));
  for (const skill of state.party[0].skills) skill.usesLeft = 0;
  state = act(state, { type: 'basic' });
  assert.equal(state.textVersion, 'v-current-abc');
  assert.ok(state.events.some(event => event.kind === 'use' && event.skillId === BASIC_SKILL_ID.human && event.actorId === 'player-1'));

  const healOnly = normalizeActor({ resource: 0, skills: ['human-0-17', 'human-1-17', 'human-2-17', 'human-3-17'] });
  assert.equal(healOnly.skills.length, 4);
  assert.notEqual(healOnly.skills[0].id, BASIC_SKILL_ID.human);
});

test('immunity, cleansing, one-hit protection, and once-per-battle survival execute', () => {
  const add = (actor, id, turns = 3) => actor.statuses.push({ id, name: STATUSES[id].name, turns });
  let immune = make('human', ['human-0-42']);
  add(immune.party[0], 'poison');
  immune = act(immune, { type: 'skill', skillId: 'human-0-42' });
  assert(!immune.party[0].statuses.some(s => s.id === 'poison'), 'antidote also cures existing poison');
  for (let seed = 1; seed < 40; seed++) {
    let state = make('human', ['human-0-9'], ['human-0-0'], seed);
    add(state.enemies[0], 'poisonImmune');
    state = act(state, { type: 'skill', skillId: 'human-0-9' });
    assert(!state.enemies[0].statuses.some(s => s.id === 'poison'));
  }
  let protectedState = make('human', ['human-0-56']);
  protectedState = act(protectedState, { type: 'skill', skillId: 'human-0-56' });
  assert.equal(protectedState.party[0].hp, 1000);
  assert(protectedState.events.some(e => e.kind === 'absorb' && e.name === '招架'));
  assert(!protectedState.party[0].statuses.some(s => s.id === 'protect'));
  let sturdy = make('human', ['human-0-0']);
  sturdy.party[0].hp = 2; add(sturdy.party[0], 'sturdy');
  sturdy = act(sturdy, { type: 'skill', skillId: 'human-0-0' });
  assert.equal(sturdy.party[0].hp, 1);
  assert.equal(sturdy.party[0].sturdyUsed, true);
  add(sturdy.party[0], 'sturdy');
  sturdy = act(sturdy, { type: 'skill', skillId: 'human-0-0' });
  assert.equal(sturdy.party[0].hp, 0, 'reapplying sturdy cannot restore its battle allowance');
});

test('new damage modifiers, resources, delayed effects and healing remain bounded', () => {
  const add = (actor, id, turns = 3) => actor.statuses.push({ id, name: STATUSES[id].name, turns });
  const dealt = battle => act(battle, { type: 'skill', skillId: 'human-0-0' }).events.find(e => e.kind === 'damage' && e.actorId === 'player-1')?.value ?? 0;
  const baseline = make('human', ['human-0-0']);
  for (const id of ['berserk', 'charge', 'armorPierce']) {
    const modified = snapshot(baseline); add(modified.party[0], id);
    assert(dealt(modified) > dealt(baseline), id);
  }
  for (const id of ['vulnerable', 'mark']) {
    const modified = snapshot(baseline); add(modified.enemies[0], id);
    assert(dealt(modified) > dealt(baseline), id);
  }
  let charged = snapshot(baseline); add(charged.party[0], 'charge'); add(charged.party[0], 'armorPierce');
  charged = act(charged, { type: 'skill', skillId: 'human-0-0' });
  assert(!charged.party[0].statuses.some(s => ['charge', 'armorPierce'].includes(s.id)));
  const healValue = id => {
    const state = make('human', ['human-0-17']); state.party[0].hp = 300;
    if (id) add(state.party[0], id);
    return act(state, { type: 'skill', skillId: 'human-0-17' }).events.find(e => e.kind === 'heal')?.value ?? 0;
  };
  assert.equal(healValue('healBlock'), 0);
  assert(healValue('healBoost') > healValue(null));
  const exhausted = make('human', ['human-0-1']); add(exhausted.party[0], 'exhaustion');
  assert.equal(act(exhausted, { type: 'skill', skillId: 'human-0-1' }).party[0].resource, 90);
  const resourceValue = id => { const state = snapshot(baseline); state.party[0].resource = 50; if (id) add(state.party[0], id); return act(state, { type: 'skill', skillId: 'human-0-0' }).party[0].resource; };
  assert(resourceValue('resourceRegen') > resourceValue(null));
  assert(resourceValue('resourceLeak') < resourceValue(null));
  assert(resourceValue('electrified') < resourceValue(null));
  let delayed = snapshot(baseline); add(delayed.party[0], 'delayedBlast', 2);
  delayed = act(delayed, { type: 'skill', skillId: 'human-0-0' });
  assert(!delayed.events.some(e => e.skillId === 'delayedBlast'));
  delayed = act(delayed, { type: 'skill', skillId: 'human-0-0' });
  assert(delayed.events.some(e => e.skillId === 'delayedBlast' && e.value === 120));
  for (const id of ['lifesteal', 'frostbite']) {
    const state = snapshot(baseline); state.party[0].hp = 500; add(state.party[0], id);
    const next = act(state, { type: 'skill', skillId: 'human-0-0' });
    assert(next.events.some(e => id === 'lifesteal' ? e.kind === 'heal' && e.value > 0 : e.skillId === 'frostbite'));
  }
  let normalHits = 0, evadingHits = 0;
  for (let seed = 1; seed <= 80; seed++) {
    const normal = make('human', ['human-0-0'], ['human-0-0'], seed), evading = snapshot(normal); add(evading.enemies[0], 'evasion');
    normalHits += dealt(normal) > 0; evadingHits += dealt(evading) > 0;
  }
  assert(evadingHits < normalHits);
});
