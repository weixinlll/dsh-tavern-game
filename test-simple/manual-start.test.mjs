import test from 'node:test';
import assert from 'node:assert/strict';
import { apply } from '../simple/plugin.mjs';
import { manualEncounterLines, manualEncounterIntent, readEnemyContext } from '../simple/context.mjs';
import { DEFAULT_AVATARS } from '../simple/looks.mjs';

const copy = value => structuredClone(value);
const ticket = view => ({ turn: view.turnState.turn, textVersion: view.turnState.textVersion, baseRevision: view.revision });
const pack = () => ({ schemaVersion: 1, kind: 'dsh-battle-pack', id: 'manual-test', name: '手动测试', basePack: 'human', party: [{ name: '林青', hp: 50, maxHp: 100, attack: 17, defense: 6, speed: 50, skills: ['直拳'] }], opponents: [{ name: '守关人', hp: 120, maxHp: 120, attack: 19, defense: 8, speed: 60, skills: [{ name: '毒刃', description: '施加中毒' }] }], items: [{ id: 'healing-potion', count: 2 }] });
function host({ result, onRequest, missingModel = true, storyText = '当下在山林小径，三只动物从树后出现。', contextError = false, contextVersion, history = [] } = {}) {
  const routes = new Map(), sections = {}; let stored, timeline;
  let head = { turn: 10, textVersion: 'v10', settled: true };
  const calls = { tasks: [], saves: 0, sources: 0, history: [] };
  const T = {
    apiVersion: 2, handle: (name, handler) => routes.set(name, handler), getTurnState: async () => copy(head),
    getTurn: async () => { calls.sources++; if (contextError) throw Error('unavailable'); return { ...head, ...(contextVersion ? { textVersion: contextVersion } : {}), text: storyText, variables: { private: 'MVU_NOT_REQUESTED' } }; },
    getHistory: async args => { calls.history.push(args); return copy(history); },
    readTurnData: async () => stored ? { data: copy(stored) } : null,
    saveTurnData: async args => { calls.saves++; stored = copy(args.data); },
    backgroundModel: async () => missingModel ? null : { provider: 'test-provider', model: 'test-model' },
    runTask: async options => { calls.tasks.push(options); await onRequest?.(); return typeof result === 'function' ? result(options) : { text: typeof result === 'string' ? result : JSON.stringify(result) }; },
    promptSection: section => { sections.prompt = section; }, turnSection: section => { sections.turn = section; }, settlementSection: section => { sections.settlement = section; },
    onTimelineChanged: handler => { timeline = handler; }, onTurnSettled: () => {},
  };
  apply({ tavern: T, get: () => null });
  const call = (name, args = {}) => routes.get('dsh-tavern-game/' + name)({ gameId: 'manual-fixture', ...args });
  return { calls, sections, call, saved: () => copy(stored), setHead: patch => { head = { ...head, ...patch }; }, cancel: () => timeline({ gameId: 'manual-fixture' }),
    setup: async () => call('import-pack', { ...ticket(await call('state')), pack: pack() }),
  };
}

test('manual line format expands bounded teams and skill lists without a model', () => {
  const enemies = manualEncounterLines('山贼*3 | 挥剑、格挡\n守卫 × 2｜护盾，治疗');
  assert.equal(enemies.length, 5); assert.equal(enemies[0].name, '山贼'); assert.deepEqual(enemies[0].skills, ['挥剑', '格挡']);
  assert.deepEqual(enemies[4].skills, ['护盾', '治疗']);
  for (const text of ['', '山贼*0', '山贼*7', '山贼*-1', '山贼*1.5', '山贼*4\n守卫*3', '山贼 | 一、二、三、四、五', '山贼 | 技能 | 注释', '名'.repeat(2001)]) assert.throws(() => manualEncounterLines(text));
});

test('non-injected manual practice never persists HP, item consumption or battle results', async () => {
  const fixture = host(); let view = await fixture.setup(); const before = fixture.saved(), saves = fixture.calls.saves;
  view = await fixture.call('manual-start', { ...ticket(view), battleText: '山贼*2 | 挥剑、格挡', injectStory: false });
  assert.equal(view.battle.demo, true); assert.equal(view.battle.enemies.length, 2); assert.equal(fixture.calls.saves, saves);
  let battle = view.battle;
  view = await fixture.call('battle-act', { ...ticket(view), battleId: battle.id, seq: battle.seq, action: { type: 'item', actorIndex: 0, targetIndex: 0, itemId: 'healing-potion' } });
  assert.equal(view.battle.inventory.find(item => item.id === 'healing-potion').count, 1);
  assert.deepEqual(fixture.saved(), before);
  battle = view.battle;
  view = await fixture.call('battle-act', { ...ticket(view), battleId: battle.id, seq: battle.seq, action: { type: 'flee' } });
  await assert.rejects(fixture.call('summary', { ...ticket(view), battleId: view.battle.id, seq: view.battle.seq }), error => error.code === 'NO_RESULT');
  assert(!/回合制战果/.test(await fixture.sections.turn.text({ gameId: 'manual-fixture' })));
  assert.equal(fixture.calls.saves, saves); assert.equal(fixture.calls.tasks.length, 0);
});

test('injected manual text persists one battle, looks up authored opponents and allows explicit result injection', async () => {
  const fixture = host(); let view = await fixture.setup(); const saves = fixture.calls.saves;
  view = await fixture.call('manual-start', { ...ticket(view), battleText: '守关人', injectStory: true });
  assert.equal(view.battle.demo, false); assert.equal(view.battle.enemies[0].maxHp, 120); assert.equal(view.battle.enemies[0].attack, 19);
  assert(view.battle.enemies[0].skills.some(skill => skill.name === '毒刃'));
  assert.equal(fixture.calls.saves, saves + 1);
  const battle = view.battle;
  view = await fixture.call('battle-act', { ...ticket(view), battleId: battle.id, seq: battle.seq, action: { type: 'flee' } });
  const result = await fixture.call('summary', { ...ticket(view), battleId: view.battle.id, seq: view.battle.seq });
  assert.match(result.text, /我方撤离/); assert.equal(fixture.calls.tasks.length, 0);
});

test('legacy manual arguments stay injected; invalid counts, flags and active fights fail atomically', async () => {
  const fixture = host(); let view = await fixture.setup(); const before = fixture.saved();
  for (const args of [{ battleText: '山贼*7' }, { battleText: '山贼', injectStory: 'false' }, { battleText: '山贼', baseRevision: -1 }]) {
    await assert.rejects(fixture.call('manual-start', { ...ticket(view), ...args })); assert.deepEqual(fixture.saved(), before);
  }
  view = await fixture.call('manual-start', { ...ticket(view), enemyName: '山贼', teamCount: 3 });
  assert.equal(view.battle.demo, false); assert.equal(view.battle.enemies.length, 3);
  await assert.rejects(fixture.call('manual-start', { ...ticket(view), battleText: '守卫', injectStory: false }), error => error.code === 'ACTIVE_BATTLE');
});

test('natural-language manual battle uses exactly one bounded model response and catalog-bound enemy skills', async () => {
  const fixture = host({ missingModel: false, result: { enemies: [
    { name: '山贼头目', types: ['nature', 'physical'], skills: [{ name: '毒刃', baseId: 'human-0-9', power: 75, element: 'nature' }] },
    { name: '山贼', skills: [{ name: '挥剑', baseId: 'human-0-1' }] },
    { name: '山贼', skills: [{ name: '格挡', baseId: 'human-0-12' }] },
  ] } });
  let view = await fixture.setup(); const saves = fixture.calls.saves;
  view = await fixture.call('manual-start', { ...ticket(view), battleText: '和三名山贼战斗，头目会毒刃', injectStory: false });
  assert.equal(view.battle.enemies.length, 3); assert.equal(view.battle.enemies[0].name, '山贼头目');
  assert(view.battle.enemies[0].skills.some(skill => skill.name === '毒刃'));
  assert.deepEqual(view.battle.enemies[0].types, ['nature', 'physical']);
  assert.equal(view.battle.enemies[0].skills[0].power, 75);
  assert.equal(view.battle.enemies[0].skills[0].element, 'nature');
  assert.deepEqual(fixture.calls.tasks[0].tools, []); assert.equal(fixture.calls.tasks.length, 1); assert.equal(fixture.calls.sources, 1);
  assert.match(fixture.calls.tasks[0].prompt, /当下在山林小径/); assert(!fixture.calls.tasks[0].prompt.includes('MVU_NOT_REQUESTED')); assert.match(fixture.calls.tasks[0].prompt, /固定技能效果目录/); assert.equal(fixture.calls.saves, saves);
  assert.deepEqual(fixture.calls.history, [{ gameId: 'manual-fixture', from: 8, to: 9 }]);
  assert.equal(view.battle.enemies[1].name, '山贼 1'); assert.equal(view.battle.enemies[2].name, '山贼 2');
});

test('AI enemy skills outside the fixed package are rejected without opening or saving a battle', async () => {
  const fixture = host({ missingModel: false, result: { enemies: [{ name: '山贼术士', skills: [{ name: '无尽湮灭' }] }] } });
  const view = await fixture.setup(), before = fixture.saved();
  await assert.rejects(fixture.call('manual-start', { ...ticket(view), battleText: '挑战山贼术士', injectStory: true }),
    error => error.code === 'MODEL_FORMAT' && /效果ID/.test(error.message));
  assert.deepEqual(fixture.saved(), before);
  assert.equal((await fixture.call('state')).battle, null);
});

test('natural request classification covers animal counts without confusing direct or embedded counts', () => {
  for (const text of ['遇到三个动物', '碰到3只野兽', '三名山贼', '与两位守卫交战', '出现六头灵兽']) assert.equal(manualEncounterIntent(text).useAi, true, text);
  assert.deepEqual(manualEncounterIntent('遇到三个动物'), { useAi: true, requestedCount: 3, animalOnly: true });
  assert.equal(manualEncounterIntent('两只灵兽').requestedCount, 2);
  for (const text of ['山贼*3 | 挥剑', '山贼\n守卫', '守关人']) assert.equal(manualEncounterIntent(text).useAi, false, text);
  assert.equal(manualEncounterIntent('挑战者', ['挑战者']).useAi, false);
  for (const text of ['召唤三只狼的法师', '遇到三名守卫，另外两只狼', '一名法师带着一只狼']) assert.equal(manualEncounterIntent(text).requestedCount, undefined, text);
  for (const text of ['遇到七个动物', '出现0只野兽', '遇到十二名山贼']) assert.throws(() => manualEncounterIntent(text), error => error.code === 'INVALID_ENCOUNTER');
});

test('three animals expands into three actual animals and repairs a human avatar without another model call', async () => {
  const fixture = host({ missingModel: false, result: { enemies: [{ name: '灰狼', species: '狼', kind: 'animal', avatarId: 'iron-guardian' }, { name: '赤狐', species: '狐狸', kind: 'animal', avatarId: 'ember-fox' }, { name: '乌鸦', species: '乌鸦', kind: 'animal', avatarId: 'raven-scout' }] } });
  let view = await fixture.setup(); view = await fixture.call('manual-start', { ...ticket(view), battleText: '遇到三个动物', injectStory: false });
  assert.equal(view.battle.enemies.length, 3); assert.equal(fixture.calls.tasks.length, 1);
  assert(view.battle.enemies.every(actor => DEFAULT_AVATARS[actor.avatarId].category === 'animal'));
  assert.equal(view.battle.enemies[0].avatarId, 'silver-wolf'); assert(view.battle.enemies.every(actor => actor.name !== '遇到三个动物'));
});

test('wrong AI count, species or literal request never starts a battle or overwrites data', async () => {
  for (const enemies of [[{ name: '灰狼', species: '狼' }], Array.from({ length: 3 }, () => ({ name: '山贼', kind: 'human' })), [{ name: '遇到三个动物', species: '狼' }, { name: '狐', species: '狐' }, { name: '虎', species: '虎' }]]) {
    const fixture = host({ missingModel: false, result: { enemies } }); const view = await fixture.setup(), before = fixture.saved();
    await assert.rejects(fixture.call('manual-start', { ...ticket(view), battleText: '遇到三个动物' }), error => error.code === 'MODEL_FORMAT');
    assert.deepEqual(fixture.saved(), before); assert.equal((await fixture.call('state')).battle, null); assert.equal(fixture.calls.tasks.length, 1);
  }
});

test('enemy context is byte-bounded, recent, tolerant of missing sources and rejects stale snapshots', async () => {
  const headTicket = { turn: 10, textVersion: 'v10' }, calls = [];
  const source = await readEnemyContext({ getTurn: async () => ({ ...headTicket, text: '中'.repeat(10000) + '当前尾部' }),
    getHistory: async args => { calls.push(args); return [{ turn: 2, text: '过时资料' }, { turn: 11, text: '未来资料' }, { turn: 9, text: '最近九' }, { turn: 8, text: '最近八' }]; } }, 'g', headTicket);
  assert(Buffer.byteLength(source.text, 'utf8') <= 4096); assert.match(source.text, /当前尾部/); assert.match(source.text, /最近八.*\n.*最近九/);
  assert(!/过时资料|未来资料|\uFFFD/.test(source.text)); assert.equal(calls.length, 1);
  const missing = host({ missingModel: false, contextError: true, result: { enemies: [{ name: '山贼' }] } });
  let view = await missing.setup(); view = await missing.call('manual-start', { ...ticket(view), battleText: '挑战山贼', injectStory: false });
  assert.match(view.battle.aiNotice, /未读到当前正文/);
  const stale = host({ missingModel: false, contextVersion: 'old', result: { enemies: [{ name: '山贼' }] } });
  view = await stale.setup(); await assert.rejects(stale.call('manual-start', { ...ticket(view), battleText: '挑战山贼' }), error => error.code === 'STALE_TURN');
  assert.equal(stale.calls.tasks.length, 0);
});

test('missing model suggests direct format; malformed and stale AI interpretations never create a battle', async () => {
  const missing = host(); let view = await missing.setup(), before = missing.saved();
  await assert.rejects(missing.call('manual-start', { ...ticket(view), battleText: '挑战一名山贼', injectStory: false }), error => error.code === 'MODEL_MISSING' && /山贼\*3/.test(error.message));
  assert.deepEqual(missing.saved(), before); assert.equal(missing.calls.tasks.length, 0);
  for (const result of ['{bad', { enemies: [] }, { enemies: Array.from({ length: 7 }, () => ({ name: '山贼' })) }]) {
    const fixture = host({ missingModel: false, result }); view = await fixture.setup(); before = fixture.saved();
    await assert.rejects(fixture.call('manual-start', { ...ticket(view), battleText: '挑战山贼', injectStory: true }), error => error.code === 'MODEL_FORMAT');
    assert.deepEqual(fixture.saved(), before);
  }
  let stale; stale = host({ missingModel: false, result: { enemies: [{ name: '山贼' }] }, onRequest: () => stale.setHead({ textVersion: 'regenerated' }) });
  view = await stale.setup(); before = stale.saved();
  await assert.rejects(stale.call('manual-start', { ...ticket(view), battleText: '挑战山贼', injectStory: false }), error => error.code === 'STALE_TURN');
  assert.deepEqual(stale.saved(), before);
});

test('manual AI interpretation timeout and timeline cancellation keep original party and storage', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let release; const fixture = host({ missingModel: false, result: () => new Promise(resolve => { release = resolve; }) });
  const view = await fixture.setup(), before = fixture.saved();
  const pending = fixture.call('manual-start', { ...ticket(view), battleText: '挑战山贼', injectStory: false });
  const failed = assert.rejects(pending, error => error.code === 'MANUAL_TIMEOUT');
  while (!release) await new Promise(resolve => setImmediate(resolve));
  t.mock.timers.tick(120000); await failed; release({ text: '{"enemies":[{"name":"山贼"}]}' });
  await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(fixture.saved(), before);
  let finish; const cancel = host({ missingModel: false, result: () => new Promise(resolve => { finish = resolve; }) });
  const initial = await cancel.setup(), saved = cancel.saved();
  const job = cancel.call('manual-start', { ...ticket(initial), battleText: '挑战山贼', injectStory: true });
  const stopped = assert.rejects(job, error => error.code === 'TIMELINE_CHANGED');
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  cancel.cancel(); finish({ text: '{"enemies":[{"name":"山贼"}]}' }); await stopped;
  assert.deepEqual(cancel.saved(), saved);
});

async function endedBattle(fixture) {
  let view = await fixture.setup();
  view = await fixture.call('manual-start', { ...ticket(view), battleText: '守关人', injectStory: true });
  return fixture.call('battle-act', { ...ticket(view), battleId: view.battle.id, seq: view.battle.seq, action: { type: 'flee' } });
}

test('AI recaps the real battle once, checks result, retains authoritative facts and never writes or sends', async () => {
  const fixture = host({ missingModel: false, result: { winner: 'fled', rounds: 0, summary: '林青在交手前撤离，守关人仍然保持战斗能力。' } });
  const view = await endedBattle(fixture), before = fixture.saved(), args = { ...ticket(view), battleId: view.battle.id, seq: view.battle.seq };
  const recap = await fixture.call('summary', args);
  assert.equal(recap.aiGenerated, true); assert.match(recap.text, /林青在交手前撤离/); assert.match(recap.text, /我方撤离/);
  assert.equal(fixture.calls.tasks.length, 1); assert.deepEqual(fixture.calls.tasks[0].tools, []);
  assert.match(fixture.calls.tasks[0].prompt, /实战记录/); assert.match(fixture.calls.tasks[0].prompt, /HP为0只是失去战斗能力/);
  assert.deepEqual(await fixture.call('summary', args), recap); assert.equal(fixture.calls.tasks.length, 1, 'a successful unchanged recap is reused');
  assert.deepEqual(fixture.saved(), before);
});

test('invalid or unavailable AI recap falls back transparently and stays retryable', async () => {
  for (const result of ['{broken', { winner: 'player', rounds: 0, summary: '全灭敌方' }, { winner: 'fled', rounds: 10, summary: '错误回合数' }]) {
    const fixture = host({ missingModel: false, result }); const view = await endedBattle(fixture), args = { ...ticket(view), battleId: view.battle.id, seq: view.battle.seq };
    const recap = await fixture.call('summary', args);
    assert.equal(recap.aiGenerated, false); assert.match(recap.notice, /可再次点击重试/); assert.match(recap.text, /我方撤离/); assert(!recap.text.includes('全灭敌方'));
    await fixture.call('summary', args); assert.equal(fixture.calls.tasks.length, 2);
  }
  const missing = host(); const view = await endedBattle(missing);
  const recap = await missing.call('summary', { ...ticket(view), battleId: view.battle.id, seq: view.battle.seq });
  assert.equal(recap.aiGenerated, false); assert.match(recap.notice, /未配置生成模型/); assert.equal(missing.calls.tasks.length, 0);
});

test('recap rejects a changed story ticket instead of attaching stale AI text', async () => {
  let fixture; fixture = host({ missingModel: false, onRequest: () => fixture.setHead({ textVersion: 'new' }), result: { winner: 'fled', rounds: 0, summary: '已撤离' } });
  const view = await endedBattle(fixture), before = fixture.saved();
  await assert.rejects(fixture.call('summary', { ...ticket(view), battleId: view.battle.id, seq: view.battle.seq }), error => error.code === 'STALE_TURN');
  assert.deepEqual(fixture.saved(), before);
});

test('recap deadline and timeline cancellation release the job and preserve storage', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let release; const fixture = host({ missingModel: false, result: () => new Promise(resolve => { release = resolve; }) });
  const view = await endedBattle(fixture), before = fixture.saved();
  const pending = fixture.call('summary', { ...ticket(view), battleId: view.battle.id, seq: view.battle.seq });
  while (!release) await new Promise(resolve => setImmediate(resolve));
  t.mock.timers.tick(60000); const recap = await pending; assert.equal(recap.aiGenerated, false); assert.match(recap.notice, /超时/);
  release({ text: '{"winner":"fled","rounds":0,"summary":"迟到"}' }); await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(fixture.saved(), before);
  let finish; const cancelled = host({ missingModel: false, result: () => new Promise(resolve => { finish = resolve; }) });
  const ended = await endedBattle(cancelled), saved = cancelled.saved();
  const job = cancelled.call('summary', { ...ticket(ended), battleId: ended.battle.id, seq: ended.battle.seq });
  const rejected = assert.rejects(job, error => error.code === 'TIMELINE_CHANGED');
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  cancelled.cancel(); await rejected; finish({ text: '{}' }); assert.deepEqual(cancelled.saved(), saved);
});
