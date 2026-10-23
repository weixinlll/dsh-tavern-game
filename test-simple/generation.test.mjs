import test from 'node:test';
import assert from 'node:assert/strict';
import { apply } from '../simple/plugin.mjs';
import { generationSourceOptions, readGenerationSources } from '../simple/context.mjs';

const copy = value => structuredClone(value);
const ticket = view => ({ turn: view.turnState.turn, textVersion: view.turnState.textVersion, baseRevision: view.revision });
const member = (name, extra = {}) => ({ name, hp: 80, maxHp: 100, attack: 18, defense: 6, speed: 50,
  skills: [{ name: '破防拳', baseId: 'human-0-2' }, { name: '烟幕迷心', baseId: 'human-0-4' },
    { name: '疾步追击', baseId: 'human-0-15' }, { name: '护体反制', baseId: 'human-0-16' }], ...extra });
const response = () => ({ party: [member('林青', { hp: 100, attack: 999 }), member('阿白')], items: [{ name: '疗伤药', description: '用于伤势恢复', count: 8 }, { name: '提神药', description: 'AI补全，恢复资源', count: 1 }, { name: '旧钥匙', description: '开启客栈旧门', count: 1 }] });

function host({ variables = { 主角: { name: '林青', hp: 0, maxHp: 100, attack: 17 }, 同伴: [{ name: '阿白', hp: 75, maxHp: 100 }] }, text = '林青和阿白来到客栈。', result = response(), prepared = false, ledgerService, onRequest, missingModel = false } = {}) {
  const routes = new Map(), sections = {}, calls = { sources: [], tasks: [], prepared: [], streams: [], saves: [] };
  let head = { turn: 30, textVersion: 'story-v1', settled: true }, story = { turn: 30, textVersion: 'story-v1', text, rawText: text, variables }, stored;
  let timeline, settled;
  const answer = async options => { await onRequest?.(options); return typeof result === 'function' ? result(options) : { text: typeof result === 'string' ? result : JSON.stringify(result) }; };
  const T = {
    apiVersion: 2, handle: (name, handler) => routes.set(name, handler),
    getTurnState: async () => copy(head), getTurn: async args => { calls.sources.push(['current', args]); return copy(story); },
    getHistory: async args => { calls.sources.push(['history', args]); return Array.from({ length: args.to - args.from + 1 }, (_, index) => ({ turn: args.from + index, text: `历史${args.from + index}，林青与阿白同行。` })); },
    getCard: async args => { calls.sources.push(['card', args]); return { name: '客栈', description: '公开人物卡', avatar: 'data:image/png;base64,NEVER_SEND_IMAGE', character_book: { entries: [{ name: '公开设定', content: '阿白携带地图。' }, { name: '禁用秘密', content: 'NEVER_SEND_DISABLED_ENTRY', enabled: false }] } }; },
    getCardContext: async args => { calls.sources.push(['worldbook', args]); return { description: '当前人物卡', lore: [{ title: '当前条目', content: '林青是玩家主角。' }] }; },
    readTurnData: async () => stored ? { data: copy(stored) } : null,
    saveTurnData: async args => { assert.equal(args.turn, head.turn); assert.equal(args.textVersion, head.textVersion); calls.saves.push(copy(args.data)); stored = copy(args.data); },
    backgroundModel: async () => missingModel ? null : { provider: 'test-provider', model: 'test-model' },
    runTask: async options => { calls.tasks.push(options); return answer(options); },
    promptSection: section => { sections.prompt = section; }, turnSection: section => { sections.turn = section; }, settlementSection: section => { sections.settlement = section; },
    onTimelineChanged: handler => { timeline = handler; }, onTurnSettled: handler => { settled = handler; },
  };
  const llm = prepared ? { prepareCall: async config => {
    calls.prepared.push(config);
    return { config: { ...config, tools: ['never'], history: 'never' }, stream: async function* (options) {
      calls.streams.push(options); const value = await answer(options);
      yield { type: 'text-delta', text: value.text }; yield { type: 'finish', reason: { kind: 'stop' } };
    } };
  } } : null;
  apply({ tavern: T, get: name => name === 'llm' ? llm : name === 'dshBattleLedger' ? ledgerService : null });
  return { T, calls, sections,
    call: (route, args = {}) => routes.get(`dsh-tavern-game/${route}`)({ gameId: 'generation-fixture', ...args }),
    saved: () => copy(stored), mutateStored: fn => { stored = fn(copy(stored)); },
    setHead: patch => { head = { ...head, ...patch }; }, setStory: patch => { story = { ...story, ...patch }; },
    cancel: () => timeline({ gameId: 'generation-fixture' }), settle: payload => settled({ gameId: 'generation-fixture', ...copy(story), ...payload }),
  };
}

test('main generation always calls AI once for roles, skill descriptions and real bounded bag even with direct MVU', async () => {
  const fixture = host({ prepared: true }); const initial = await fixture.call('state');
  const view = await fixture.call('generate-party', ticket(initial));
  assert.equal(fixture.calls.prepared.length, 1); assert.equal(fixture.calls.streams.length, 1); assert.equal(fixture.calls.tasks.length, 0);
  const request = fixture.calls.streams[0];
  assert.equal(request.maxTokens, 12000); assert.equal(request.tools, undefined); assert.equal(request.history, undefined);
  assert.equal(view.party[0].hp, 0); assert.equal(view.party[0].attack, 17); assert.equal(view.party[1].hp, 75);
  assert(view.party.every(actor => actor.skills.length <= 4 && actor.skills.every(skill => skill.description)));
  assert.equal(view.inventory.find(item => item.id === 'healing-potion').count, 2);
  assert.equal(view.inventory.find(item => item.id === 'resource-potion').count, 1);
  assert.match(view.inventory[0].description, /25%/);
  assert.deepEqual(view.nonCombatInventory, []);
  assert.equal(fixture.calls.saves.length, 1); assert.equal(view.revision, initial.revision + 1);
  assert.match(view.notice, /AI已生成/); assert(view.warnings.some(note => /忽略非战斗物品/.test(note)));
  assert.equal(view.sourceReport.context.historyRead, 6); assert(view.sourceReport.bytes <= 8192);
});

test('AI actor types and individual skill power/element survive save, reload and manual editing', async () => {
  const fixture = host({ variables: {}, text: '林青是一位擅长火与雷的法师。', result: { party: [member('林青', {
    types: ['fire', 'electric'], skills: [
      { name: '火矛', baseId: 'human-0-1', power: 110, element: 'fire' },
      { name: '雷矛', baseId: 'human-0-1', power: 80, element: 'electric' },
      { name: '护盾', baseId: 'human-0-13', power: 0, element: 'spirit' },
      { name: '疗愈', baseId: 'human-0-17', power: 0, element: 'light' },
    ],
  })], items: [] } });
  const view = await fixture.call('generate-party', ticket(await fixture.call('state')));
  assert.deepEqual(view.party[0].types, ['fire', 'electric']);
  assert.deepEqual(view.party[0].skills.map(skill => skill.power), [110, 80, 0, 0]);
  assert.deepEqual(view.party[0].skills.map(skill => skill.element), ['fire', 'electric', 'spirit', 'light']);
  const loaded = await fixture.call('state');
  assert.deepEqual(loaded.party, view.party);
  loaded.party[0].types = ['water']; loaded.party[0].skills[0].power = 90; loaded.party[0].skills[0].element = 'water';
  const edited = await fixture.call('save-party', { ...ticket(loaded), party: loaded.party });
  assert.deepEqual(edited.party[0].types, ['water']); assert.equal(edited.party[0].skills[0].power, 90);
  assert.equal(edited.party[0].skills[0].element, 'water'); assert.match(edited.party[0].skills[0].description, /威力90/);
  assert.equal(fixture.calls.tasks.length, 1);
});

test('generation keeps AI metadata with MVU stats and gives explicit MVU skill/type metadata priority', async () => {
  const result = { party: [member('林青', { types: ['fire'], skills: member('林青').skills.map((skill, index) => ({ ...skill, power: index < 2 ? 70 : 0, element: 'fire' })) })], items: [] };
  const fixture = host({ result, variables: { 主角: { name: '林青', hp: 0, maxHp: 100, attack: 17,
    types: ['water'], skills: [{ name: '破防拳', power: 112, element: 'electric' }] } } });
  const view = await fixture.call('generate-party', ticket(await fixture.call('state')));
  assert.equal(view.party[0].hp, 0); assert.equal(view.party[0].attack, 17);
  assert.deepEqual(view.party[0].types, ['water']);
  assert.equal(view.party[0].skills[0].power, 112); assert.equal(view.party[0].skills[0].element, 'electric');
  assert.equal(view.party[0].skills[1].power, 70); assert.equal(view.party[0].skills[1].element, 'fire');
  assert.match(view.party[0].skills[0].description, /威力112/);
  assert.equal(fixture.calls.tasks.length, 1);
});

test('manual save rejects malformed power/type atomically instead of silently resetting it', async () => {
  const fixture = host(); const view = await fixture.call('generate-party', ticket(await fixture.call('state'))), before = fixture.saved();
  for (const patch of [{ power: 141 }, { power: 0 }, { element: 'void' }]) {
    const party = copy(view.party); Object.assign(party[0].skills[0], patch);
    await assert.rejects(fixture.call('save-party', { ...ticket(view), party }), error => error.code === 'INVALID_PARTY');
    assert.deepEqual(fixture.saved(), before);
  }
  const party = copy(view.party); party[0].skills[2].power = 70;
  await assert.rejects(fixture.call('save-party', { ...ticket(view), party }), error => error.code === 'INVALID_PARTY');
  assert.deepEqual(fixture.saved(), before);
});

test('source toggles omit disabled context/MVU and history ranges follow 0–20 without retrieval loops', async () => {
  const fixture = host({ text: 'CONTEXT_SECRET 林青和阿白。' });
  const start = await fixture.call('state');
  const view = await fixture.call('generate-party', { ...ticket(start), sourceOptions: { useContext: false, useMvu: true, historyRounds: 20 } });
  assert.equal(fixture.calls.sources.filter(([name]) => name === 'history').length, 0);
  assert(!fixture.calls.tasks[0].prompt.includes('CONTEXT_SECRET')); assert.equal(view.party[0].hp, 0);
  const noMvu = host({ variables: { 主角: { name: '林青', hp: 0, maxHp: 100, 密文: 'MVU_SECRET' } }, result: { party: [member('林青', { hp: 60 })], items: [] } });
  let current = await noMvu.call('state');
  current = await noMvu.call('generate-party', { ...ticket(current), sourceOptions: { useContext: true, useMvu: false, historyRounds: 0 } });
  assert.equal(current.party[0].hp, 60); assert(!noMvu.calls.tasks[0].prompt.includes('MVU_SECRET'));
  assert.equal(noMvu.calls.sources.filter(([name]) => name === 'history').length, 0);
  const twenty = host(); await twenty.call('generate-party', { ...ticket(await twenty.call('state')), sourceOptions: { historyRounds: 20 } });
  assert.deepEqual(twenty.calls.sources.find(([name]) => name === 'history')[1], { gameId: 'generation-fixture', from: 10, to: 29 });
  assert.equal(twenty.calls.tasks.length, 1);
  for (const options of [{ historyRounds: 21 }, { historyRounds: -1 }, { historyRounds: '6' }, { useMvu: 1 }, { ledgerText: 'x'.repeat(4001) }]) assert.throws(() => generationSourceOptions(options));
});

test('worldbook uses only bounded public text and documented versioned ledger snapshots, with honest fallback', async () => {
  let ledgerCalls = 0;
  const fixture = host({ ledgerService: { getSnapshot: async args => { ledgerCalls++; return { data: { 台账: 'LEDGER_ENTRY' }, producedAt: { turn: args.turn, textVersion: args.textVersion } }; } } });
  const view = await fixture.call('generate-party', { ...ticket(await fixture.call('state')), sourceOptions: { useWorldbook: true, useLedger: true } });
  assert.equal(ledgerCalls, 1); const prompt = fixture.calls.tasks[0].prompt;
  assert(prompt.includes('公开设定')); assert(prompt.includes('LEDGER_ENTRY'));
  assert(!prompt.includes('NEVER_SEND_IMAGE')); assert(!prompt.includes('NEVER_SEND_DISABLED_ENTRY'));
  assert(prompt.includes('"kind":"human或animal"') && prompt.includes('"species":"来源明确的物种"'));
  assert.match(prompt, /名字、称号和绰号里的动物词不能单独证明物种/);
  assert.equal(view.sourceReport.ledger.kind, 'service'); assert.equal(fixture.calls.sources.filter(([name]) => ['card', 'worldbook'].includes(name)).length, 2);
  const manual = await fixture.call('generate-party', { ...ticket(view), sourceOptions: { useLedger: true, ledgerText: '玩家粘贴台账' } });
  assert.equal(ledgerCalls, 1); assert.equal(manual.sourceReport.ledger.kind, 'manual');
  const absent = host(); const missing = await absent.call('generate-party', { ...ticket(await absent.call('state')), sourceOptions: { useLedger: true } });
  assert(missing.warnings.some(note => /未连接外部台账/.test(note)));
  const stale = host({ ledgerService: { getSnapshot: async () => ({ data: { secret: 'STALE_LEDGER' }, producedAt: { turn: 1, textVersion: 'old' } }) } });
  const rejected = await stale.call('generate-party', { ...ticket(await stale.call('state')), sourceOptions: { useLedger: true } });
  assert(rejected.warnings.some(note => /没有匹配/.test(note))); assert(!stale.calls.tasks[0].prompt.includes('STALE_LEDGER'));
});

test('all source chunks together stay within 8KB UTF-8 even for large Chinese context, variables and ledger', async () => {
  const T = {
    getTurn: async () => ({ turn: 30, textVersion: 'v', text: '正文'.repeat(10000), variables: { 队伍: Array.from({ length: 6 }, (_, index) => ({ name: `人物${index}`, hp: 100, description: '人物资料'.repeat(1000) })) } }),
    getHistory: async () => Array.from({ length: 20 }, (_, index) => ({ turn: index + 10, text: '历史'.repeat(2000) })),
    getCard: async () => ({ description: '世界'.repeat(10000), character_book: { entries: Array.from({ length: 40 }, () => ({ content: '书目'.repeat(2000) })) } }),
    getCardContext: async () => ({ lore: Array.from({ length: 16 }, () => ({ content: '召回条目'.repeat(2000) })) }),
  };
  const source = await readGenerationSources(T, 'g', { turn: 30, textVersion: 'v' }, { options: { historyRounds: 20, useWorldbook: true, useLedger: true, ledgerText: '台账'.repeat(2000) } });
  assert(Buffer.byteLength(source.text, 'utf8') <= 8192); assert.equal(source.report.bytes, Buffer.byteLength(source.text, 'utf8'));
  assert(source.warnings.some(note => /8KB/.test(note)));
});

test('malformed, fabricated, missing-model and stale-generation results preserve saved party, settings and items', async () => {
  for (const result of ['{bad', { party: [member('林青')] }, { party: [member('不存在的新路人')], items: [] }, { party: [member('林青'), member('阿白')], items: [{ name: '药', count: -1 }] }]) {
    const fixture = host({ result }); const view = await fixture.call('fill-party'), before = fixture.saved();
    await assert.rejects(fixture.call('generate-party', ticket(view)), error => error.code === 'MODEL_FORMAT'); assert.deepEqual(fixture.saved(), before);
  }
  const missing = host({ missingModel: true });
  await assert.rejects(missing.call('generate-party', ticket(await missing.call('state'))), error => error.code === 'MODEL_MISSING');
  assert.equal(missing.calls.tasks.length, 0); assert.equal(missing.calls.saves.length, 0);
  let fixture; fixture = host({ onRequest: () => fixture.setHead({ textVersion: 'new-story' }) });
  const view = await fixture.call('fill-party'), before = fixture.saved();
  await assert.rejects(fixture.call('generate-party', ticket(view)), error => error.code === 'STALE_TURN');
  assert.deepEqual(fixture.saved(), before);
  await assert.rejects(fixture.call('generate-party', { turn: 30, textVersion: 'new-story', baseRevision: -1 }), error => error.code === 'REVISION_CONFLICT');
});

test('120-second timeout and timeline cancellation prevent even late model completion from committing', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let release; const fixture = host({ result: () => new Promise(resolve => { release = resolve; }) });
  const view = await fixture.call('fill-party'), before = fixture.saved();
  const pending = fixture.call('generate-party', ticket(view));
  const rejection = assert.rejects(pending, error => error.code === 'GENERATION_TIMEOUT');
  while (!release) await new Promise(resolve => setImmediate(resolve));
  t.mock.timers.tick(120000); await rejection;
  release({ text: JSON.stringify(response()) }); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(fixture.saved(), before);
  let finish; const cancel = host({ result: () => new Promise(resolve => { finish = resolve; }) });
  const current = await cancel.call('fill-party'), saved = cancel.saved();
  const job = cancel.call('generate-party', ticket(current)); const stopped = assert.rejects(job, error => error.code === 'TIMELINE_CHANGED');
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  cancel.cancel(); finish({ text: JSON.stringify(response()) }); await stopped;
  assert.deepEqual(cancel.saved(), saved);
});

test('per-character design reads once, preserves explicit MVU numbers and approved asset ID, and returns only a draft', async () => {
  const fixture = host({ result: { actor: member('林青', { hp: 100, attack: 999 }) } });
  const view = await fixture.call('fill-party'), before = fixture.saved();
  const draft = await fixture.call('design-actor', { ...ticket(view), actorId: view.party[0].id, requirements: '补全一招有限的治疗技能。' });
  assert.equal(draft.actor.id, view.party[0].id); assert.equal(draft.actor.hp, 0); assert.equal(draft.actor.attack, 17);
  assert.equal(draft.baseRevision, view.revision); assert.equal(draft.textVersion, view.turnState.textVersion);
  assert.equal(fixture.calls.tasks.length, 1); assert.deepEqual(fixture.saved(), before);
  assert.match(fixture.calls.tasks[0].prompt, /只设计一个角色草稿/);
  await assert.rejects(fixture.call('design-actor', { ...ticket(view), actorId: 'unknown', requirements: '设计' }), error => error.code === 'INVALID_ACTOR');
  assert.equal(fixture.calls.tasks.length, 1);
  const renamed = { ...view.party[0], name: '更名后的林青' };
  const saved = await fixture.call('save-party', { ...ticket(view), party: [renamed, view.party[1]] });
  assert.equal(saved.party[0].id, view.party[0].id, 'manual rename preserves imported asset key');
  await assert.rejects(fixture.call('save-party', { ...ticket(saved), party: [saved.party[0], { ...saved.party[1], id: saved.party[0].id }] }), error => error.code === 'INVALID_PARTY');
});

test('generation reuses existing IDs, preserves settings and attaches current story enemies atomically', async () => {
  const fixture = host({ text: '林青和阿白遇到守卫。<dsh_battle>{"enemies":[{"name":"守卫"}]}</dsh_battle>' });
  let view = await fixture.call('fill-party');
  view = await fixture.call('battle-act', { ...ticket(view), battleId: view.battle.id, seq: view.battle.seq, action: { type: 'flee' } });
  const ids = view.party.map(actor => actor.id);
  view = await fixture.call('select-options', { ...ticket(view), difficulty: 'expert', encounterDifficulty: 'high', autoStoryUpdate: true });
  const saves = fixture.calls.saves.length;
  view = await fixture.call('generate-party', ticket(view));
  assert.deepEqual(view.party.map(actor => actor.id), ids); assert.equal(view.difficulty, 'expert'); assert.equal(view.encounterDifficulty, 'high');
  assert.equal(view.autoStoryUpdate, true);
  assert.equal(fixture.calls.saves.length, saves + 1); assert.equal(fixture.calls.tasks.length, 1);
  // The already-consumed current marker is never respawned by character generation.
  assert.equal(view.battle, null);
  const pending = host({ text: '林青和阿白遇到守卫。<dsh_battle>{"enemies":[{"name":"守卫"}]}</dsh_battle>' });
  const battle = await pending.call('generate-party', ticket(await pending.call('state')));
  assert.equal(battle.battle.enemies[0].name, '守卫'); assert.equal(pending.calls.saves.length, 1);
  await assert.rejects(pending.call('design-actor', { ...ticket(battle), actorId: battle.party[0].id, requirements: '设计' }), error => error.code === 'ACTIVE_BATTLE');
});

test('generation fits imported skill aliases and rejects an externally changed revision after its one model call', async () => {
  const result = response(); result.party[0].skills = [
    { name: '灵火指', baseId: 'fantasy-0-1' }, { name: '冰刃', baseId: 'fantasy-0-4' },
    { name: '回春', baseId: 'fantasy-0-17' }, { name: '护体', baseId: 'fantasy-0-13' },
  ];
  result.party[1].skills = [
    { name: '破防', baseId: 'fantasy-0-2' }, { name: '致盲', baseId: 'fantasy-0-4' },
    { name: '迅身', baseId: 'fantasy-0-15' }, { name: '反制', baseId: 'fantasy-0-16' },
  ];
  const fixture = host({ result }); let view = await fixture.call('fill-party');
  view = await fixture.call('import-pack', { ...ticket(view), pack: { schemaVersion: 1, kind: 'dsh-battle-pack', id: 'school', name: '灵火门', basePack: 'fantasy', skillAliases: [{ name: '灵火指', baseId: 'fantasy-0-10', description: '必中，施加灼烧', mechanics: ['sureHit'] }] } });
  view = await fixture.call('generate-party', ticket(view));
  assert.equal(view.selectedPackId, 'school'); assert.equal(view.packId, 'fantasy');
  assert(view.party[0].skills.some(skill => skill.name === '灵火指' && skill.mechanics.includes('sureHit')));
  assert(fixture.calls.tasks[0].prompt.includes('可用自定义技能词汇：[{"name":"灵火指"'));
  let conflict; conflict = host({ onRequest: () => conflict.mutateStored(data => ({ ...data, revision: data.revision + 1 })) });
  const initial = await conflict.call('fill-party'), saves = conflict.calls.saves.length;
  await assert.rejects(conflict.call('generate-party', ticket(initial)), error => error.code === 'REVISION_CONFLICT');
  assert.equal(conflict.calls.saves.length, saves);
});

test('real combat consumption preserves generated combat bag names and descriptions, excluding story props', async () => {
  const fixture = host(); let view = await fixture.call('generate-party', ticket(await fixture.call('state')));
  const item = view.inventory.find(item => item.id === 'healing-potion');
  view = await fixture.call('manual-start', { ...ticket(view), enemyName: '山贼' });
  const battle = view.battle;
  view = await fixture.call('battle-act', { ...ticket(view), battleId: battle.id, seq: battle.seq,
    action: { type: 'item', actorIndex: battle.activePlayer, itemId: item.id } });
  const after = view.inventory.find(entry => entry.id === item.id);
  assert.equal(after.count, item.count - 1); assert.equal(after.name, item.name); assert.equal(after.description, item.description);
  assert.deepEqual(view.nonCombatInventory, []);
});
