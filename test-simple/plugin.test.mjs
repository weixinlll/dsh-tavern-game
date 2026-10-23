import test from 'node:test';
import assert from 'node:assert/strict';
import { apply } from '../simple/plugin.mjs';
import { MECHANICS } from '../simple/catalog.mjs';

const copy = value => JSON.parse(JSON.stringify(value));
const marker = enemies => `<dsh_battle>${JSON.stringify({ enemies })}</dsh_battle>`;
const partyMvu = () => ({
  主角: { 姓名: '沈砚', 当前生命: 0, 最大生命: 1000, 攻击: 115, 防御: 35, 速度: 70, 技能: ['刀斩', '护盾'] },
  同伴: [{ 姓名: '阿青', 当前生命: 1000, 最大生命: 1000, 攻击: 115, 防御: 35, 速度: 75, 技能: ['快剑', '治疗'] }],
  敌人: [{ 姓名: '山贼', 当前生命: 99999, 最大生命: 99999, 攻击: 99999 }],
});

function makeHost({ variables = {}, text = '当前正文', turn = 7, textVersion = 'v-current-abc', runTask, llm, model, input = '' } = {}) {
  const routes = new Map(), storage = new Map(), sections = new Map();
  const calls = { saves: [], tasks: [], getTurn: 0, getHistory: 0 };
  let branch = 'main';
  let head = { turn, textVersion, settled: true, busy: false, generating: false, settling: false };
  let story = { turn, text, rawText: text, input, variables };
  let settledHandler, timelineHandler, removedHandler;
  const key = atTurn => `${branch}:${atTurn}`;
  const tavern = {
    apiVersion: 2,
    ...(model ? { backgroundModel: async () => model } : {}),
    handle(route, handler) { routes.set(route, handler); },
    promptSection(section) { sections.set('prompt', section); },
    turnSection(section) { sections.set('turn', section); },
    settlementSection(section) { sections.set('settlement', section); },
    onTurnSettled(handler) { settledHandler = handler; },
    onTimelineChanged(handler) { timelineHandler = handler; },
    onGameRemoved(handler) { removedHandler = handler; },
    async getTurnState() { return copy(head); },
    async getTurn() { calls.getTurn++; return copy(story); },
    async getHistory() { calls.getHistory++; return [copy(story)]; },
    async readTurnData({ turn: atTurn }) { const data = storage.get(key(atTurn)); return data ? { data: copy(data) } : null; },
    async saveTurnData({ turn: atTurn, textVersion: version, data }) {
      assert.equal(atTurn, head.turn);
      assert.equal(version, head.textVersion);
      calls.saves.push({ branch, turn: atTurn, textVersion: version, data: copy(data) });
      storage.set(key(atTurn), copy(data));
    },
    async runTask(options) {
      calls.tasks.push(options);
      if (runTask) return runTask(options);
      throw new Error('Unexpected background model call');
    },
  };
  apply({ tavern, get: () => llm || null });
  return {
    calls, routes, sections, tavern,
    call(route, args = {}) { return routes.get(`dsh-tavern-game/${route}`)({ gameId: 'g1', ...args }); },
    setHead(patch) { head = { ...head, ...patch }; },
    setStory(patch) { story = { ...story, ...patch }; },
    settle(payload = {}) { return settledHandler({ gameId: 'g1', turn: head.turn, textVersion: head.textVersion, ...copy(story), ...payload }); },
    timeline() { timelineHandler?.({ gameId: 'g1' }); },
    remove(gameId = 'g1') { return removedHandler?.({ gameId }); },
    setBranch(next) { branch = next; timelineHandler?.({ gameId: 'g1' }); },
    copyCurrentToTurn(nextTurn, nextVersion) {
      const prior = storage.get(key(head.turn));
      head = { ...head, turn: nextTurn, textVersion: nextVersion };
      story = { ...story, turn: nextTurn, text: '下一轮正文', rawText: '下一轮正文' };
      if (prior) storage.set(key(nextTurn), copy(prior));
    },
    saved() { return copy(storage.get(key(head.turn))); },
  };
}

async function rejectsCode(promise, code) {
  await assert.rejects(promise, error => error?.code === code, `Expected ${code}`);
}

test('public mount is passive and registers fixed-pack and import routes', async () => {
  const host = makeHost();
  assert.deepEqual([...host.routes.keys()].sort(), [
    'battle-act', 'battle-state', 'check-update', 'demo-start', 'design-actor', 'fill-party', 'generate-party', 'import-pack', 'install-update', 'install-update-full', 'list-update-backups', 'rollback-update', 'manual-start', 'model-options', 'save-party', 'select-options', 'select-pack', 'state', 'summary',
  ].map(route => `dsh-tavern-game/${route}`).sort());
  assert.equal(host.calls.saves.length, 0);
  assert.equal(host.calls.tasks.length, 0);
  const state = await host.call('state');
  assert.deepEqual(state.packs.map(pack => pack.id), ['human', 'fantasy']);
  assert.equal(Object.keys(state.avatarCatalog).length, 60);
  assert.deepEqual(state.avatarCatalog['starter-male'], { name: '徒手冒险者（男）', gender: 'male', category: 'human' });
  assert.deepEqual(state.avatarCatalog['starter-female'], { name: '徒手冒险者（女）', gender: 'female', category: 'human' });
  assert.deepEqual(state.avatarCatalog['qilin'], { name: '麒麟', gender: 'animal', category: 'animal' });
  assert.deepEqual(state.avatarCatalog['moon-elf-archer'], { name: '精灵弓手', gender: 'female', category: 'human' });
  assert.equal(host.calls.saves.length, 0);
  // The fixture intentionally exposes no card/file/worldbook APIs: public source reads suffice.
  assert.equal(host.tavern.getCharacter, undefined);
  assert.equal(host.tavern.getWorldbook, undefined);
  assert.equal(host.tavern.readFile, undefined);
  const battlePrompt = await host.sections.get('prompt').text({ gameId: 'g1' });
  assert.match(battlePrompt, /<dsh_battle>/);
  assert.match(battlePrompt, /玩家本轮明确要求.*必须在本轮启动并写标记/);
});

test('public party editing rejects a seventh participant', async () => {
  const host = makeHost({ variables: partyMvu() });
  const view = await host.call('fill-party');
  const party = Array.from({ length: 7 }, (_, i) => ({ name: '队友' + i, hp: 50, maxHp: 100, attack: 12, defense: 5, speed: 50, skills: [] }));
  await rejectsCode(host.call('save-party', { turn: 7, textVersion: 'v-current-abc', baseRevision: view.revision, party }), 'INVALID_PARTY');
  assert.equal((await host.call('state')).party.length, 2);
});

test('pack selection is exact; MVU fills only teammates and keeps zero HP', async () => {
  const host = makeHost({ variables: partyMvu() });
  await rejectsCode(host.call('select-pack', { turn: 7, textVersion: 'v-current-abc', baseRevision: 0, packId: 'creature' }), 'INVALID_PACK');
  const selected = await host.call('select-pack', { turn: 7, textVersion: 'v-current-abc', baseRevision: 0, packId: 'fantasy' });
  assert.equal(selected.packId, 'fantasy');
  assert.equal(selected.revision, 1);
  const filled = await host.call('fill-party');
  assert.equal(filled.party.length, 2);
  assert.deepEqual(filled.party.map(actor => actor.name), ['沈砚', '阿青']);
  assert.equal(filled.party[0].hp, 0);
  assert.equal(filled.party[0].maxHp, 1000);
  assert.ok(filled.party.every(actor => actor.skills.length <= 4));
  assert.ok(filled.party.every(actor => Number.isInteger(actor.avatarPaletteSeed) && actor.avatarPaletteSeed >= 0 && actor.avatarPaletteSeed <= 0xffff_ffff));
  assert.equal(host.calls.tasks.length, 0);
  assert.equal(host.saved().source.kind, 'mvu');
  assert.equal(host.saved().source.textVersion, 'v-current-abc');
});

test('fallback asks the model once without tools and only accepts catalog-backed skills', async () => {
  const host = makeHost({ variables: {}, runTask: async () => ({ text: JSON.stringify({ party: [{ name: '阿青', hp: 75, maxHp: 100, skills: [{ name: '挥剑', baseId: 'human-0-1', extraStatuses: [], mechanics: [] }] }] }) }) });
  const first = await host.call('fill-party');
  assert.equal(first.party[0].name, '阿青');
  assert.equal(host.calls.tasks.length, 1);
  assert.deepEqual(host.calls.tasks[0].tools, []);
  assert.match(host.calls.tasks[0].prompt, /不生成敌人/);
  assert.match(host.calls.tasks[0].prompt, /固定技能效果目录/);
  assert.equal(first.party[0].skills[0].baseId, 'human-0-1');
  assert.match(first.party[0].skills[0].description, /造成一次直接伤害/);
  const saved = host.saved();
  host.tavern.runTask = async options => { host.calls.tasks.push(options); return { text: JSON.stringify({ party: [{ name: '阿青', skills: [{ name: '挥剑', baseId: 'not-a-real-id', extraStatuses: [], mechanics: [] }] }] }) }; };
  await assert.rejects(host.call('fill-party'), /固定效果|效果ID/);
  assert.deepEqual(host.saved(), saved);
  assert.equal(host.calls.tasks.length, 2);
});

test('busy, stale timeline, and revision conflict leave persisted party untouched', async () => {
  const host = makeHost({ variables: partyMvu() });
  await host.call('fill-party');
  const saved = host.saved();
  host.setHead({ settled: false });
  await rejectsCode(host.call('fill-party'), 'TURN_BUSY');
  host.setHead({ settled: true });
  await rejectsCode(host.call('select-pack', { turn: 7, textVersion: 'v-old', baseRevision: saved.revision, packId: 'fantasy' }), 'STALE_TURN');
  await rejectsCode(host.call('select-pack', { turn: 7, textVersion: 'v-current-abc', baseRevision: saved.revision - 1, packId: 'fantasy' }), 'REVISION_CONFLICT');
  assert.deepEqual(host.saved(), saved);
});

test('timeline change during a pending model fill cancels and keeps prior party', async () => {
  let resolveModel;
  const host = makeHost({ variables: partyMvu(), runTask: () => new Promise(resolve => { resolveModel = resolve; }) });
  await host.call('fill-party');
  const saved = host.saved();
  host.setStory({ variables: {} });
  const pending = host.call('fill-party');
  while (!resolveModel) await new Promise(resolve => setTimeout(resolve, 0));
  host.setHead({ textVersion: 'v-next-branch' });
  host.timeline();
  resolveModel({ text: JSON.stringify({ party: [{ name: '错误覆盖', hp: 100, maxHp: 100 }] }) });
  await rejectsCode(pending, 'TIMELINE_CHANGED');
  assert.deepEqual(host.saved(), saved);
});

test('story marker alone creates bounded enemies and no model request', async () => {
  const host = makeHost({ variables: partyMvu() });
  await host.call('fill-party');
  const names = Array.from({ length: 3 }, (_, i) => ({ name: `敌人${i + 1}`, level: 999, skills: ['即死', '时间停止', '绝对免疫', '治疗'] }));
  await host.settle({ rawText: `交战开始。${marker(names)}` });
  const view = await host.call('state');
  assert.equal(view.battle.enemies.length, 3);
  assert.equal(view.battle.textVersion, 'v-current-abc');
  assert.equal(view.battle.turn, 7);
  assert.ok(view.battle.enemies.every(actor => actor.skills.length <= 4 && actor.maxHp <= 1160));
  assert.equal(host.calls.tasks.length, 0);
  assert.equal(host.saved().consumedEncounter, '7:v-current-abc');
});

test('settled visible narrative starts current opponents once and never retrieves or calls AI', async () => {
  const host = makeHost({ variables: partyMvu() });
  await host.call('fill-party');
  const before = { turn: host.calls.getTurn, history: host.calls.getHistory };
  const payload = { text: '沈砚和阿青正在与守卫切磋。', rawText: '<think>未进行的计划。</think>',
    variables: { ...partyMvu(), 当前对手: [{ name: '守卫', hp: 30, skills: ['重拳', '格挡'] }] } };
  await host.settle(payload);
  const view = await host.call('state');
  assert.equal(view.battle.enemies[0].name, '守卫');
  assert.deepEqual(view.battle.enemies[0].skills.map(skill => skill.name), ['重拳', '格挡']);
  assert.equal(view.battle.party[0].hp, 0, 'settlement never revives a defeated teammate');
  assert.equal(view.battle.textVersion, 'v-current-abc');
  assert.match(view.notice, /本轮正文.*固定包默认值/);
  const saves = host.calls.saves.length;
  await host.settle(payload);
  await host.settle({ ...payload, turn: 6, textVersion: 'old-version' });
  host.setHead({ settled: false });
  await host.settle(payload);
  host.setHead({ settled: true });
  assert.equal(host.calls.saves.length, saves, 'repeated, stale and busy callbacks cannot write');
  assert.equal(host.calls.getTurn, before.turn);
  assert.equal(host.calls.getHistory, before.history);
  assert.equal(host.calls.tasks.length, 0);
  assert.equal((await host.call('state')).battle.id, view.battle.id);
});

test('negative, historical and completed narrative never starts a battle', async () => {
  for (const text of ['我不想决斗。', '昨天与山贼的决斗已经结束。', '如果和守卫对战就会受伤。', '我们尚未开始战斗。', '双方比武结束，正在喝茶。', '你与张三开始决斗。数招后，决斗已经结束。']) {
    const host = makeHost({ variables: partyMvu() });
    await host.call('fill-party');
    await host.settle({ text, rawText: text });
    const view = await host.call('state');
    assert.equal(view.battle, null, text);
    assert.equal(host.saved().pendingEncounter, null);
    assert.equal(host.calls.tasks.length, 0);
    const saves = host.calls.saves.length;
    await host.settle({ text, rawText: text });
    assert.equal(host.calls.saves.length, saves, 'noncombat settlement is also idempotent');
  }
});

test('markerless encounter queues until party is ready, survives pack choice and resumes on manual save', async () => {
  const host = makeHost();
  await host.settle({ text: '双方开始战斗。', rawText: '双方开始战斗。' });
  assert.equal((await host.call('state')).battle, null);
  assert.equal(host.saved().pendingEncounter.enemies[0].name, '剧情对手');
  const saves = host.calls.saves.length;
  await host.settle({ text: '双方开始战斗。', rawText: '双方开始战斗。' });
  assert.equal(host.calls.saves.length, saves);
  let view = await host.call('state');
  view = await host.call('select-pack', { turn: 7, textVersion: 'v-current-abc', baseRevision: view.revision, packId: 'fantasy' });
  const selectedSaves = host.calls.saves.length;
  await host.settle({ text: '双方开始战斗。', rawText: '双方开始战斗。' });
  assert.equal(host.calls.saves.length, selectedSaves, 'pack choice preserves the processed settlement ticket');
  view = await host.call('save-party', { turn: 7, textVersion: 'v-current-abc', baseRevision: view.revision,
    party: [{ name: '林青', hp: 80, maxHp: 100, attack: 20, defense: 5, speed: 30, skills: ['火球术'] }] });
  assert.equal(view.battle.enemies.length, 1);
  assert.equal(view.battle.enemies[0].name, '剧情对手');
  assert.match(view.notice, /没有明确对手资料.*固定包默认值/);
  assert.equal(host.saved().pendingEncounter, null);
  assert.equal(host.calls.tasks.length, 0);
});

test('a queued narrative rechecks allies when the previously missing party becomes ready', async () => {
  const host = makeHost();
  await host.settle({ text: '林青与张三展开决斗。', rawText: '林青与张三展开决斗。' });
  assert.deepEqual(host.saved().pendingEncounter.enemies.map(actor => actor.name), ['张三', '林青']);
  const view = await host.call('state');
  const ready = await host.call('save-party', { turn: 7, textVersion: 'v-current-abc', baseRevision: view.revision,
    party: [{ name: '林青', hp: 80, maxHp: 100, attack: 20, defense: 5, speed: 30, skills: ['挥剑'] }] });
  assert.deepEqual(ready.battle.enemies.map(actor => actor.name), ['张三']);
  assert.equal(host.calls.tasks.length, 0);
});

test('current enemy MVU zero HP stays down; a later turn creates a new encounter with at most three active enemies', async () => {
  const host = makeHost({ variables: partyMvu() });
  await host.call('fill-party');
  await host.settle({ text: '双方开始战斗。', variables: { 当前对手: Array.from({ length: 8 }, (_, index) => ({ name: `守卫${index}`, hp: index ? 100 : 0, skills: ['挥剑'] })) } });
  const first = (await host.call('state')).battle;
  assert.equal(first.enemies.length, 6);
  assert.equal(first.enemies[0].hp, 0);
  assert.equal(first.activeEnemies.length, 3);
  assert.ok(!first.activeEnemies.includes(0));
  host.copyCurrentToTurn(8, 'new-version');
  await host.settle({ text: '你与张三开始决斗。', rawText: '', variables: {} });
  const next = (await host.call('state')).battle;
  assert.notEqual(next.id, first.id);
  assert.equal(next.turn, 8);
  assert.equal(next.textVersion, 'new-version');
  assert.deepEqual(next.enemies.map(actor => actor.name), ['张三']);
  const saves = host.calls.saves.length;
  await host.settle({ turn: 7, textVersion: 'v-current-abc', text: '旧对手与你交战。' });
  assert.equal(host.calls.saves.length, saves);
  assert.equal(host.calls.tasks.length, 0);
  const defeated = makeHost({ variables: partyMvu() });
  await defeated.call('fill-party');
  await defeated.settle({ text: '你与守卫交战。', variables: { 当前对手: [{ name: '守卫', hp: 0 }] } });
  assert.equal((await defeated.call('state')).battle, null);
  assert.match((await defeated.call('state')).notice, /生命均为0/);
});

test('battle rejects late identities and duplicate sequence; simultaneous actions serialize', async () => {
  const host = makeHost({ variables: partyMvu() });
  await host.call('fill-party');
  await host.settle({ rawText: marker([{ name: '山贼', skills: ['刀斩'] }]) });
  const battle = (await host.call('state')).battle;
  const skillId = battle.party[battle.activePlayer].skills[0].id;
  const action = { turn: 7, textVersion: 'v-current-abc', battleId: battle.id, seq: battle.seq, action: { type: 'skill', skillId } };
  const before = host.calls.saves.length;
  const results = await Promise.allSettled([host.call('battle-act', action), host.call('battle-act', action)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected' && result.reason?.code === 'STALE_BATTLE').length, 1);
  assert.equal(host.calls.saves.length, before + 1);
  assert.equal(host.saved().battle.seq, battle.seq + 1);
  await rejectsCode(host.call('battle-act', { ...action, battleId: 'wrong-battle' }), 'STALE_BATTLE');
  await rejectsCode(host.call('battle-act', action), 'STALE_BATTLE');
});

test('demo lives in memory, never saves, and cannot produce story summary', async () => {
  const host = makeHost();
  const before = host.calls.saves.length;
  const demo = (await host.call('demo-start')).battle;
  assert.ok(demo.demo);
  assert.equal(demo.party[0].avatarId, 'starter-male');
  assert.equal(demo.enemies[0].avatarId, 'starter-female');
  assert.notEqual(demo.party[0].avatarPaletteSeed, demo.enemies[0].avatarPaletteSeed);
  assert.equal(host.calls.saves.length, before);
  const skillId = demo.party[demo.activePlayer].skills[0].id;
  const next = (await host.call('battle-act', { turn: 7, textVersion: 'v-current-abc', battleId: demo.id, seq: demo.seq, action: { type: 'skill', skillId } })).battle;
  assert.equal(next.seq, 1);
  assert.equal(host.calls.saves.length, before);
  await rejectsCode(host.call('summary', { turn: 7, textVersion: 'v-current-abc', battleId: next.id, seq: next.seq }), 'NO_RESULT');
});

test('basic actions finish a story battle and a completed marker is not respawned by fill', async () => {
  const host = makeHost({ variables: { 主角: { 姓名: '阿青', 当前生命: 1000, 最大生命: 1000, 攻击: 115, 防御: 35, 速度: 70, 技能: ['挥剑'] } }, text: '山贼出现' });
  await host.call('fill-party');
  const text = marker([{ name: '山贼', skills: ['挥剑'] }]);
  await host.settle({ rawText: text });
  let battle = (await host.call('state')).battle;
  const id = battle.id;
  while (!battle.outcome) {
    const skillId = battle.party[battle.activePlayer].skills[0].id;
    battle = (await host.call('battle-act', { turn: 7, textVersion: 'v-current-abc', battleId: id, seq: battle.seq, action: { type: 'skill', skillId } })).battle;
    assert.ok(battle.round <= 24);
  }
  const summary = await host.call('summary', { turn: 7, textVersion: 'v-current-abc', battleId: id, seq: battle.seq });
  assert.match(summary.text, /回合制战果/);
  host.setStory({ rawText: text, text });
  const again = await host.call('fill-party');
  assert.equal(again.battle, null);
  assert.equal(host.saved().consumedEncounter, '7:v-current-abc');
});

test('pending old marker expires next turn and rollback reads current branch data', async () => {
  const host = makeHost({ variables: {}, text: '战斗将至' });
  await host.settle({ rawText: marker([{ name: '旧敌人' }]) });
  assert.equal((await host.call('state')).battle, null);
  assert.ok(host.saved().pendingEncounter);
  host.copyCurrentToTurn(8, 'v-next');
  host.setStory({ variables: partyMvu() });
  const filled = await host.call('fill-party');
  assert.equal(filled.battle, null);
  assert.equal(host.saved().pendingEncounter, undefined);
  const main = host.saved();
  await host.call('select-pack', { turn: 8, textVersion: 'v-next', baseRevision: main.revision, packId: 'fantasy' });
  assert.equal((await host.call('state')).packId, 'fantasy');
  host.setBranch('alternate');
  assert.equal((await host.call('state')).packId, 'human');
  host.setBranch('main');
  assert.equal((await host.call('state')).packId, 'fantasy');
});

test('one click enriches unknown skill effects once, preserves MVU numbers, and reuses the same-version result', async () => {
  const variables = { 主角: { name: '沈砚', hp: 0, maxHp: 100, skills: [] }, 同伴: [{ name: '阿青', hp: 75, maxHp: 100, skills: ['霜华诀'] }] };
  const host = makeHost({ variables, text: '阿青的霜华诀必定先攻、必中、必定暴击，并附加中毒和麻痹。', runTask: async () => ({ text: JSON.stringify({ party: [
    { name: '沈砚', skills: [] },
    { name: '阿青', skills: [{ name: '霜华诀', baseId: 'human-0-1', extraStatuses: ['poison', 'paralysis'], mechanics: ['first', 'sureHit', 'critical'] }] },
  ] }) }) });
  host.tavern.backgroundModel = async () => ({ provider: 'fixture', model: 'fixture' });
  let view = await host.call('fill-party');
  assert.equal(host.calls.tasks.length, 1);
  assert.equal(view.party.length, 2);
  assert.equal(view.party[0].hp, 0);
  assert.equal(view.party[1].hp, 75);
  const skill = view.party[1].skills.find(skill => skill.name === '霜华诀');
  for (const id of ['first', 'sureHit', 'critical']) assert(skill.mechanics.includes(id));
  assert.deepEqual(new Set(skill.extraStatuses), new Set(['poison', 'paralysis']));
  assert.match(skill.description, /必定暴击/);
  const again = await host.call('fill-party');
  assert.equal(host.calls.tasks.length, 1, 'same version and same MVU skills do not call the model again');
  assert.deepEqual(again.party[1].skills.map(skill => skill.id), view.party[1].skills.map(skill => skill.id));
  await host.settle({ rawText: marker([{ name: '守卫', skills: ['挥剑'] }]), variables });
  view = await host.call('state');
  const live = view.battle.party[view.battle.activePlayer].skills.find(item => item.name === '霜华诀');
  assert(live?.mechanics.includes('critical'), 'enriched effects survive story battle assembly');
});

test('malformed enrichment keeps MVU values and discloses unresolved effects', async () => {
  const host = makeHost({ variables: { 主角: { name: '甲', hp: 12, maxHp: 30, skills: ['无说明秘法'] } }, runTask: async () => ({ text: '{bad-json' }) });
  host.tavern.backgroundModel = async () => ({ provider: 'fixture', model: 'fixture' });
  const view = await host.call('fill-party');
  assert.equal(view.party[0].hp, 12);
  assert.equal(host.calls.tasks.length, 1);
  assert(view.warnings.some(text => /未完整|未识别/.test(text)));
});

test('invalid enrichment effect IDs are rejected without replacing the original skill', async () => {
  const host = makeHost({ variables: { 主角: { name: '甲', hp: 12, maxHp: 30, skills: ['无说明秘法'] } }, runTask: async () => ({ text: JSON.stringify({ party: [
    { name: '甲', skills: [{ name: '无说明秘法', baseId: 'outside-the-catalog', extraStatuses: [], mechanics: [] }] },
  ] }) }) });
  host.tavern.backgroundModel = async () => ({ provider: 'fixture', model: 'fixture' });
  const view = await host.call('fill-party');
  assert.equal(host.calls.tasks.length, 1);
  assert.equal(view.party[0].skills[0].name, '无说明秘法');
  assert(view.warnings.some(text => /技能说明补充未完整/.test(text)));
});

test('ordinary skill names also receive explicit story effects instead of silently staying basic', async () => {
  const host = makeHost({ variables: { 主角: { name: '剑士', hp: 80, maxHp: 100, skills: ['剑斩'] } },
    text: '剑士的剑斩必定先攻击、必定暴击。', runTask: async () => ({ text: JSON.stringify({ party: [{ name: '剑士', skills: [{ name: '剑斩', baseId: 'human-0-1', extraStatuses: [], mechanics: ['first', 'critical'] }] }] }) }) });
  host.tavern.backgroundModel = async () => ({ provider: 'fixture', model: 'fixture' });
  const view = await host.call('fill-party');
  const skill = view.party[0].skills.find(skill => skill.name === '剑斩');
  assert(skill.mechanics.includes('first'));
  assert(skill.mechanics.includes('critical'));
  assert.equal(host.calls.tasks.length, 1);
  assert.equal(view.party[0].hp, 80);
});

test('six-versus-six rosters with four elemental compound skills fit public turn storage throughout a battle', async () => {
  const skills = ['拳', '剑', '弓', '枪'].map(theme => ({ name: theme + '复合秘技', power: 100, element: 'fire', description: '必定先攻、必中、必定暴击、多段攻击，附加中毒和麻痹，并吸血。'.repeat(8), mechanics: Object.keys(MECHANICS) }));
  const members = Array.from({ length: 6 }, (_, i) => ({ name: '队友' + i, hp: 1000, maxHp: 1000, attack: 115, defense: 35, speed: 50, types: ['fire', 'water'], skills }));
  const host = makeHost({ variables: { 队伍: members } });
  await host.call('fill-party');
  await host.settle({ rawText: marker(Array.from({ length: 6 }, (_, i) => ({ name: '敌人' + i, types: ['nature', 'wind'], skills: skills.map(skill => ({ ...skill, description: skill.description.slice(0, 40) })) }))) });
  let view = await host.call('state');
  assert(view.battle);
  while (!view.battle.outcome && view.battle.round < 24) {
    const actor = view.battle.party[view.battle.activePlayer];
    view = await host.call('battle-act', { turn: 7, textVersion: 'v-current-abc', battleId: view.battle.id, seq: view.battle.seq, action: { type: 'basic' } });
    assert(Buffer.byteLength(JSON.stringify(host.saved()), 'utf8') <= 63 * 1024);
  }
  assert(view.battle.outcome);
  assert.equal(host.calls.tasks.length, 0);
  assert.equal(host.saved().party[0].skills[0].description, undefined, 'generated effect prose is reconstructed instead of duplicating it in storage');
});

const authoredPack = () => ({ schemaVersion: 1, kind: 'dsh-battle-pack', id: 'river-school', name: '江湖演练', basePack: 'fantasy',
  party: Array.from({ length: 6 }, (_, i) => ({ name: `同门${i}`, hp: 80, maxHp: 100, attack: 15, defense: 5, speed: 50, skills: ['灵火指'] })),
  opponents: [{ name: '守关人', hp: 90, maxHp: 100, attack: 13, defense: 4, speed: 40, skills: ['挥剑'] }],
  skillAliases: [{ name: '灵火指', description: '必中，并灼烧目标', mechanics: ['sureHit'] }] });
const currentTicket = view => ({ turn: view.turnState.turn, textVersion: view.turnState.textVersion, baseRevision: view.revision });

test('import author pack, six-person manual battle, spent-turn guard and terminal persistence', async () => {
  const host = makeHost();
  let view = await host.call('state');
  view = await host.call('import-pack', { ...currentTicket(view), pack: authoredPack() });
  assert.equal(view.selectedPackId, 'river-school');
  assert.equal(view.party.length, 6);
  assert(view.party.every(actor => actor.skills.some(skill => skill.name === '灵火指' && skill.mechanics.includes('sureHit'))));
  assert.equal(host.calls.tasks.length, 0);
  await rejectsCode(host.call('manual-start', { ...currentTicket(view), textVersion: 'old', enemyName: '守关人', teamCount: 6 }), 'STALE_TURN');
  view = await host.call('manual-start', { ...currentTicket(view), enemyName: '守关人', teamCount: 6 });
  assert.equal(view.battle.enemies.length, 6);
  assert.equal(view.battle.activePlayers.length, 3);
  assert.equal(view.battle.activeEnemies.length, 3);
  await rejectsCode(host.call('import-pack', { ...currentTicket(view), pack: authoredPack() }), 'ACTIVE_BATTLE');
  let commands = 0;
  while (!view.battle.outcome && commands++ < 80) {
    const battle = view.battle;
    const index = battle.remainingPlayerActions[0];
    view = await host.call('battle-act', { ...currentTicket(view), battleId: battle.id, seq: battle.seq,
      action: { type: 'basic', actorIndex: index, targetIndex: battle.activeEnemies[0] } });
  }
  assert(view.battle.outcome);
  assert(view.battle.round <= 24);
  const restored = await host.call('battle-state');
  assert.equal(restored.battle.id, view.battle.id);
  assert.deepEqual(restored.battle.outcome, view.battle.outcome);
  assert.match((await host.call('summary', { ...currentTicket(restored), battleId: restored.battle.id, seq: restored.battle.seq })).text, /回合制战果/);
});

test('invalid executable pack is rejected atomically; import survives fill and pack selection', async () => {
  const host = makeHost({ variables: partyMvu() });
  const initial = await host.call('state');
  await rejectsCode(host.call('import-pack', { ...currentTicket(initial), pack: { ...authoredPack(), scripts: ['bad()'] } }), 'INVALID_PACK');
  assert.equal(host.calls.saves.length, 0);
  let view = await host.call('import-pack', { ...currentTicket(initial), pack: authoredPack() });
  view = await host.call('fill-party');
  assert.equal(view.selectedPackId, 'river-school');
  assert.equal(view.selectedPack.name, '江湖演练');
  view = await host.call('select-pack', { ...currentTicket(view), packId: 'human' });
  assert.equal(view.packId, 'human');
  view = await host.call('select-pack', { ...currentTicket(view), packId: 'river-school' });
  assert.equal(view.packId, 'fantasy');
  assert.equal(view.selectedPackId, 'river-school');
});


test('real battles use only MVU supplies and keep consumed counts after escape', async () => {
  const variables = partyMvu(); variables.同伴[0].背包 = { 生命药水: { 数量: 1 } };
  const host = makeHost({ variables });
  let view = await host.call('fill-party');
  view = await host.call('manual-start', { ...currentTicket(view), enemyName: '山匪', teamCount: 1 });
  assert.equal(view.battle.inventory.find(item => item.id === 'healing-potion').count, 1);
  const b = view.battle;
  view = await host.call('battle-act', { ...currentTicket(view), battleId: b.id, seq: b.seq,
    action: { type: 'item', actorIndex: b.activePlayer, targetIndex: b.activePlayer, itemId: 'healing-potion' } });
  assert.equal(view.battle.inventory.find(item => item.id === 'healing-potion').count, 0);
  view = await host.call('battle-act', { ...currentTicket(view), battleId: view.battle.id, seq: view.battle.seq, action: { type: 'flee' } });
  view = await host.call('manual-start', { ...currentTicket(view), enemyName: '山匪', teamCount: 1 });
  assert.equal(view.battle.inventory.find(item => item.id === 'healing-potion').count, 0);
  const noItems = makeHost({ variables: partyMvu() });
  let empty = await noItems.call('fill-party');
  empty = await noItems.call('manual-start', { ...currentTicket(empty), enemyName: '山匪' });
  assert(empty.battle.inventory.every(item => item.count === 0));
});


function aiFixture({ malformed = false, onRequest } = {}) {
  const calls = [];
  const llm = {
    listProviders: () => [{ id: 'fixture-provider', name: '测试供应商' }],
    listModels: async () => [{ id: 'fixture-model', name: '测试模型', inputModalities: ['text'] }],
    resolveModelInfo: async () => ({ reasoning: { efforts: [{ id: 'low', name: '低' }, { id: 'high', name: '高' }] } }),
    prepareCall: async config => ({ config, stream: async function* (options) {
      calls.push(options); onRequest?.(options);
      const observation = JSON.parse(options.messages[0].content[0].text);
      const choices = observation.opponents.map(actor => ({ actorId: actor.id, skillId: actor.skills[0].id, targetId: observation.targets[0].id }));
      yield { type: 'text-delta', text: malformed ? '{' : JSON.stringify({ choices }) };
      yield { type: 'finish', reason: { kind: 'stop' } };
    } }),
  };
  return { llm, calls };
}

test('model preselection and reasoning use host catalog; intelligence and spawn strength stay independent', async () => {
  const ai = aiFixture(); const host = makeHost({ variables: partyMvu(), llm: ai.llm });
  let view = await host.call('fill-party');
  const catalog = await host.call('model-options', { provider: 'fixture-provider', model: 'fixture-model' });
  assert.equal(catalog.providers[0].models[0].id, 'fixture-model');
  assert.deepEqual(catalog.efforts.map(effort => effort.id), ['low', 'high']);
  await rejectsCode(host.call('select-options', { ...currentTicket(view), aiModel: { provider: 'fixture-provider', model: 'fixture-model', reasoningEffort: 'unsupported' } }), 'INVALID_MODEL');
  view = await host.call('select-options', { ...currentTicket(view), difficulty: 'ai', encounterDifficulty: 'low',
    aiModel: { provider: 'fixture-provider', model: 'fixture-model', reasoningEffort: 'high' } });
  assert.equal(view.difficulty, 'ai'); assert.equal(view.encounterDifficulty, 'low');
  view = await host.call('manual-start', { ...currentTicket(view), enemyName: '守卫' });
  const before = view.battle;
  await rejectsCode(host.call('select-options', { ...currentTicket(view), difficulty: 'easy' }), 'ACTIVE_BATTLE');
  view = await host.call('battle-act', { ...currentTicket(view), battleId: before.id, seq: before.seq,
    action: { type: 'skill', actorIndex: before.activePlayer, targetIndex: before.activeEnemy, skillId: before.party[before.activePlayer].skills[0].id } });
  assert.equal(ai.calls.length, 1); assert.equal(ai.calls[0].model, 'fixture-model'); assert.equal(ai.calls[0].sessionId, 'g1');
  assert.equal(ai.calls[0].reasoningEffort, 'high'); assert.equal(ai.calls[0].maxTokens, 450);
  assert.equal(ai.calls[0].tools, undefined); assert.equal(ai.calls[0].history, undefined);
  assert.match(ai.calls[0].messages[0].id, /^[0-9a-f-]{36}$/i);
  assert.deepEqual(ai.calls[0].messages[0].source, { kind: 'plugin:dsh-tavern' });
  const obs = JSON.parse(ai.calls[0].messages[0].content[0].text);
  assert(obs.targets.every(actor => !('skills' in actor) && !('attack' in actor) && !('defense' in actor)));
  assert(!('intent' in obs)); assert.equal(view.battle.aiNotice, undefined);
  assert.equal(view.battle.difficulty, 'ai'); assert.equal(view.battle.encounterDifficulty, 'low');
});

test('party, backpack, actor editing and enemy creation share one model while tactical choice stays separate', async () => {
  const ai = aiFixture(), requests = [];
  const llm = { ...ai.llm, prepareCall: async config => ({ config, stream: async function* (options) {
    requests.push(options);
    const prompt = options.messages[0].content[0].text;
    const output = prompt.startsWith('玩家明确要求') ? { enemies: [{ name: '守关剑士', gender: 'male', avatarId: 'jade-swordsman', skills: [{ name: '先手剑', baseId: 'human-0-60', mechanics: ['first'] }] }] }
      : prompt.startsWith('你要概括') ? { winner: 'fled', rounds: 0, summary: '阿青带着失去战斗能力的沈砚撤离，对手仍有余力。' }
      : prompt.includes('只设计一个角色草稿') ? { actor: { name: '阿青', avatarId: 'azure-healer', skills: [
        { name: '七星剑阵', baseId: 'human-0-25' }, { name: '迷踪步', baseId: 'human-0-40' },
        { name: '寒星诀', baseId: 'human-0-58' }, { name: '护体灵光', baseId: 'human-0-13' },
      ] } }
      : { party: [
        { name: '沈砚', avatarId: 'lingxiao-cultivator', skills: [
          { name: '七星剑阵', baseId: 'human-0-25' }, { name: '烈焰斩', baseId: 'human-0-10' },
          { name: '迷心诀', baseId: 'human-0-5' }, { name: '金钟护体', baseId: 'human-0-13' },
        ] },
        { name: '阿青', avatarId: 'azure-healer', skills: [
          { name: '清心回春', baseId: 'human-0-17' }, { name: '霜华术', baseId: 'human-0-4' },
          { name: '护体灵光', baseId: 'human-0-13' }, { name: '迷踪步', baseId: 'human-0-40' },
        ] },
      ], items: [] };
    yield { type: 'text-delta', text: JSON.stringify(output) }; yield { type: 'finish', reason: { kind: 'stop' } };
  } }) };
  const host = makeHost({ variables: partyMvu(), llm });
  let view = await host.call('fill-party');
  const base = { provider: 'fixture-provider', model: 'fixture-model' };
  await rejectsCode(host.call('select-options', { ...currentTicket(view), generationModel: { ...base, reasoningEffort: 'impossible' } }), 'INVALID_MODEL');
  view = await host.call('select-options', { ...currentTicket(view), generationModel: { ...base, reasoningEffort: 'low' }, aiModel: { ...base, reasoningEffort: 'high' } });
  assert.equal(view.aiModel.reasoningEffort, 'high'); assert.equal(view.generationModel.reasoningEffort, 'low'); assert(!('enemyModel' in view));
  requests.length = 0;
  view = await host.call('generate-party', currentTicket(view));
  assert.equal(requests.length, 1); assert.equal(requests[0].reasoningEffort, 'low'); assert.equal(requests[0].sessionId, 'g1');
  assert.equal(view.party[0].avatarId, 'lingxiao-cultivator'); assert.equal(view.party[0].hp, 0);
  const draft = await host.call('design-actor', { ...currentTicket(view), actorId: view.party[1].id, requirements: '保留快剑，精简描述' });
  assert.equal(requests.at(-1).reasoningEffort, 'low'); assert.equal(draft.actor.name, '阿青');
  view = await host.call('manual-start', { ...currentTicket(view), battleText: '挑战一名守关剑士', injectStory: true });
  assert.equal(requests.at(-1).reasoningEffort, 'low'); assert.equal(view.battle.enemies[0].avatarId, 'jade-swordsman');
  view = await host.call('battle-act', { ...currentTicket(view), battleId: view.battle.id, seq: view.battle.seq, action: { type: 'flee' } });
  const recap = await host.call('summary', { ...currentTicket(view), battleId: view.battle.id, seq: view.battle.seq });
  assert.equal(recap.aiGenerated, true); assert.equal(requests.at(-1).reasoningEffort, 'low'); assert.equal(requests.at(-1).maxTokens, 1200);
  view = await host.call('select-pack', { ...currentTicket(view), packId: 'fantasy' });
  assert.equal(view.generationModel.reasoningEffort, 'low'); assert.equal(view.aiModel.reasoningEffort, 'high'); assert(!('enemyModel' in host.saved()));
  // An old client can still save its setting, but it updates the same unified choice.
  view = await host.call('select-options', { ...currentTicket(view), enemyModel: { ...base, reasoningEffort: 'high' } });
  assert.equal(view.generationModel.reasoningEffort, 'high'); assert(!('enemyModel' in host.saved()));
  const catalog = await host.call('model-options', { scope: 'enemyModel' });
  assert.equal(catalog.selection.reasoningEffort, 'high');
});

test('unified generation model migrates an old enemy choice without overriding an explicit host-default selection', async () => {
  const ai = aiFixture(), host = makeHost({ variables: partyMvu(), llm: ai.llm });
  let view = await host.call('fill-party');
  const prior = host.saved(), selected = { provider: 'fixture-provider', model: 'fixture-model', reasoningEffort: 'high' };
  delete prior.generationModel; prior.enemyModel = selected;
  await host.tavern.saveTurnData({ ...currentTicket(view), data: prior });
  view = await host.call('state'); assert.deepEqual(view.generationModel, selected); assert(!('enemyModel' in view));
  view = await host.call('select-options', { ...currentTicket(view), generationModel: null });
  assert.equal(view.generationModel, null); assert(!('enemyModel' in host.saved()));
  const explicitDefault = { ...host.saved(), enemyModel: selected };
  await host.tavern.saveTurnData({ ...currentTicket(view), data: explicitDefault });
  assert.equal((await host.call('state')).generationModel, null, 'an explicit default is not replaced by a deprecated model');
});

test('malformed AI decision falls back without losing the action; demos never call the model', async () => {
  const ai = aiFixture({ malformed: true }); const host = makeHost({ variables: partyMvu(), llm: ai.llm });
  let view = await host.call('fill-party');
  view = await host.call('select-options', { ...currentTicket(view), difficulty: 'ai', aiModel: { provider: 'fixture-provider', model: 'fixture-model' } });
  view = await host.call('demo-start');
  let b = view.battle;
  view = await host.call('battle-act', { ...currentTicket(view), battleId: b.id, seq: b.seq, action: { type: 'skill', skillId: b.party[b.activePlayer].skills[0].id } });
  assert.equal(ai.calls.length, 0); assert.match(view.battle.aiNotice, /演练/);
  view = await host.call('manual-start', { ...currentTicket(view), enemyName: '守卫' }); b = view.battle;
  view = await host.call('battle-act', { ...currentTicket(view), battleId: b.id, seq: b.seq, action: { type: 'skill', skillId: b.party[b.activePlayer].skills[0].id } });
  assert.equal(ai.calls.length, 1); assert.equal(view.battle.seq, b.seq + 1); assert(view.battle.aiNotice);
});

test('AI result after timeline regeneration cannot commit or consume a battle action', async () => {
  const ai = aiFixture({ onRequest: () => host.setHead({ textVersion: 'new-story' }) });
  const host = makeHost({ variables: partyMvu(), llm: ai.llm });
  let view = await host.call('fill-party');
  view = await host.call('select-options', { ...currentTicket(view), difficulty: 'ai', aiModel: { provider: 'fixture-provider', model: 'fixture-model' } });
  view = await host.call('manual-start', { ...currentTicket(view), enemyName: '守卫' });
  const b = view.battle, saves = host.calls.saves.length;
  await rejectsCode(host.call('battle-act', { ...currentTicket(view), battleId: b.id, seq: b.seq, action: { type: 'skill', skillId: b.party[b.activePlayer].skills[0].id } }), 'STALE_TURN');
  assert.equal(host.calls.saves.length, saves);
});

const soloParty = () => [{ name: '未莱', hp: 100, maxHp: 100, attack: 12, defense: 5, speed: 10, skills: [] }];

test('a direct order to fight opens the turn even when the body never writes one', async () => {
  const body = '泉在坊西三里外的一处山谷里。谷口已经排了二十来个人。人都站着，没人说话。';
  const host = makeHost({ text: body, input: '遇到插队的人，准备进入战斗，准备开战' });
  let view = await host.call('state');
  await host.call('save-party', { ...currentTicket(view), party: soloParty() });
  assert.equal(host.saved().battle, null, 'no battle until the turn settles');
  await host.settle();
  const saved = host.saved();
  assert.ok(saved.battle, 'the order alone must open a battle');
  assert.equal(saved.battle.enemies[0].name, '剧情对手');
  assert.match(saved.notice, /明确要求当场开战/);
});

test('an ordinary instruction never opens a battle on its own', async () => {
  const host = makeHost({ text: '他走进洞府，把门掩死。', input: '打探三页书下落，弄清谜团' });
  const view = await host.call('state');
  await host.call('save-party', { ...currentTicket(view), party: soloParty() });
  await host.settle();
  const saved = host.saved();
  assert.equal(saved.battle, null);
  assert.doesNotMatch(saved.notice || '', /当场开战/);
});

test('a settled body carrying a raw enemies object starts the fight without the tag', async () => {
  const bare = '他合眼。\n\n[攻方|赭袍、灰衣]\n\n{"enemies":[{"name":"赭袍","level":7,"skills":[{"name":"铜环引地"}]},{"name":"灰衣","level":8,"skills":[{"name":"掌心灵力线"}]}]}';
  const host = makeHost({ text: bare });
  const view = await host.call('state');
  await host.call('save-party', { ...currentTicket(view), party: soloParty() });
  await host.settle();
  const saved = host.saved();
  assert.ok(saved.battle, 'a tagless enemies object still opens the battle');
  assert.deepEqual(saved.battle.enemies.map(actor => actor.name), ['赭袍', '灰衣']);
});

test('removing a game clears its cached turn data and leaves the plugin usable', async () => {
  const host = makeHost();
  await host.remove('g1');
  const view = await host.call('state');
  assert.equal(view.packId, 'human');
  assert.equal(view.revision, 0);
});

test('editing the body of the same turn never spawns a second fight', async () => {
  const bare = '他合眼。\n\n{"enemies":[{"name":"赭袍","level":7}]}';
  const host = makeHost({ text: bare });
  const view = await host.call('state');
  await host.call('save-party', { ...currentTicket(view), party: soloParty() });
  await host.settle();
  const first = host.saved().battle;
  assert.ok(first, 'the tagless object opened the fight');
  host.setHead({ textVersion: 'v-edited' });
  await host.settle({ textVersion: 'v-edited', text: bare, rawText: bare });
  assert.equal(host.saved().battle.id, first.id, 'the running fight survives an edited body');
});
