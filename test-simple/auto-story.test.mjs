import test from 'node:test';
import assert from 'node:assert/strict';
import { apply } from '../simple/plugin.mjs';

const copy = value => structuredClone(value);
const ticket = view => ({ turn: view.turnState.turn, textVersion: view.turnState.textVersion, baseRevision: view.revision });
const variables = () => ({ 主角: { name: '林青', hp: 50, maxHp: 100, attack: 17, defense: 6, speed: 50, resource: 50, skills: [{ name: '快拳连击', description: '近身攻击时连续打击' }], 背包: { 疗伤药: 2 } } });
const pack = () => ({ schemaVersion: 1, kind: 'dsh-battle-pack', id: 'auto-test', name: '同步夹具', basePack: 'human', party: [{ name: '林青', hp: 50, maxHp: 100, attack: 17, defense: 6, speed: 50, resource: 50, skills: [{ name: '快拳连击', description: '近身攻击时连续打击' }] }], items: [{ id: 'healing-potion', count: 2 }] });
function host() {
  const routes = new Map(), sections = {}; let stored, settled;
  let head = { turn: 10, textVersion: 'v10', settled: true };
  const calls = { tasks: 0, saves: 0 }, T = {
    apiVersion: 2, handle: (name, fn) => routes.set(name, fn), getTurnState: async () => copy(head),
    getTurn: async () => ({ ...head, text: '林青抵达客栈。', variables: variables() }), getHistory: async () => [],
    readTurnData: async () => stored ? { data: copy(stored) } : null,
    saveTurnData: async args => { calls.saves++; stored = copy(args.data); },
    backgroundModel: async () => null, runTask: async () => { calls.tasks++; throw new Error('Auto synchronization must never invoke a model'); },
    promptSection: section => { sections.prompt = section; }, turnSection: section => { sections.turn = section; }, settlementSection: section => { sections.settlement = section; },
    onTurnSettled: handler => { settled = handler; }, onTimelineChanged: () => {},
  };
  apply({ tavern: T, get: () => null });
  const call = (name, args = {}) => routes.get('dsh-tavern-game/' + name)({ gameId: 'sync-fixture', ...args });
  return { calls, sections, call, saved: () => copy(stored), patch: fn => { stored = fn(copy(stored)); },
    advance: () => { head = { ...head, turn: head.turn + 1, textVersion: 'v' + (head.turn + 1) }; },
    settle: vars => settled({ gameId: 'sync-fixture', ...head, text: '林青经历本轮正文。', variables: vars }),
    setup: async () => call('import-pack', { ...ticket(await call('state')), pack: pack() }),
  };
}

test('automatic story updates default off, validate a strict flag and survive pack selection/import/legacy fill', async () => {
  const fixture = host(); let view = await fixture.setup();
  assert.equal(view.autoStoryUpdate, false);
  await assert.rejects(fixture.call('select-options', { ...ticket(view), autoStoryUpdate: 'true' }), error => error.code === 'INVALID_OPTIONS');
  view = await fixture.call('select-options', { ...ticket(view), autoStoryUpdate: true });
  assert.equal(view.autoStoryUpdate, true);
  view = await fixture.call('select-pack', { ...ticket(view), packId: 'human' }); assert.equal(view.autoStoryUpdate, true);
  view = await fixture.call('import-pack', { ...ticket(view), pack: pack() }); assert.equal(view.autoStoryUpdate, true);
  view = await fixture.call('fill-party'); assert.equal(view.autoStoryUpdate, true);
  assert.equal(fixture.calls.tasks, 0);
});

test('enabled settlement injects a short structured snapshot into the unique MVU writer without an extra AI request', async () => {
  const fixture = host(); let view = await fixture.setup();
  assert.equal(await fixture.sections.settlement.text({ gameId: 'sync-fixture', turn: 11 }), '');
  view = await fixture.call('select-options', { ...ticket(view), autoStoryUpdate: true });
  fixture.patch(data => ({ ...data, nonCombatInventory: [{ name: '旧钥匙', description: '开启旧门', count: 1 }] }));
  const text = await fixture.sections.settlement.text({ gameId: 'sync-fixture', turn: 11 });
  assert.match(text, /酒馆唯一MVU结算方/); assert.match(text, /已有MVU原路径/); assert.match(text, /不自动回满HP=0/); assert.match(text, /不把战果重复扣除/);
  const snapshot = JSON.parse(text.split('\n').at(-1));
  assert.equal(snapshot.party[0].name, '林青'); assert.equal(snapshot.party[0].hp, 50); assert.equal(snapshot.party[0].attack, 17);
  assert(snapshot.party[0].skills.some(skill => skill.sourceDescription.includes('近身攻击')));
  assert.equal(snapshot.inventory[0].count, 2); assert.deepEqual(snapshot.nonCombatInventory, []);
  assert(Buffer.byteLength(text, 'utf8') < 10000);
  assert.equal(fixture.calls.tasks, 0);
});

test('disabled synchronization retains game values, skills and bag after a settled story', async () => {
  const fixture = host(), before = await fixture.setup(); fixture.advance();
  const changed = variables(); changed.主角.hp = 0; changed.主角.attack = 99;
  changed.主角.skills = [{ name: '毒镖', description: '施加中毒' }]; changed.主角.背包 = { 疗伤药: 0, 旧钥匙: { 数量: 2, 描述: '旧门钥匙' } };
  await fixture.settle(changed); const after = await fixture.call('state');
  assert.deepEqual(after.party, before.party); assert.deepEqual(after.inventory, before.inventory); assert.deepEqual(after.nonCombatInventory, []);
  assert.equal(fixture.calls.tasks, 0);
});

test('enabled post-settlement merge updates actual HP, zero stats, skill effects and combat/noncombat quantities', async () => {
  const fixture = host(); let view = await fixture.setup();
  view = await fixture.call('select-options', { ...ticket(view), autoStoryUpdate: true }); fixture.advance();
  const changed = variables(); changed.主角.hp = 0; changed.主角.attack = 25; changed.主角.defense = 0; changed.主角.resource = 0;
  changed.主角.skills = [{ name: '毒镖', description: '必定先攻，施加中毒' }];
  changed.主角.背包 = { 疗伤药: [0, '数量'], 回气丹: { 数量: 1 }, 旧钥匙: { 数量: 2, 描述: '开启旧门' } };
  await fixture.settle(changed); const after = await fixture.call('state');
  assert.equal(after.party[0].id, view.party[0].id); assert.equal(after.party[0].hp, 0); assert.equal(after.party[0].attack, 25); assert.equal(after.party[0].defense, 0); assert.equal(after.party[0].resource, 0);
  assert(after.party[0].skills.some(skill => skill.name === '毒镖' && skill.mechanics.includes('first') && skill.extraStatuses.includes('poison')));
  assert.equal(after.inventory.find(item => item.id === 'healing-potion').count, 0);
  assert.equal(after.inventory.find(item => item.id === 'resource-potion').count, 1);
  assert.deepEqual(after.nonCombatInventory, []);
  assert.equal(fixture.calls.tasks, 0);
});

test('explicit empty skills and bag clear their game counterparts; absent bag data keeps prior inventory', async () => {
  const fixture = host(); let view = await fixture.setup();
  view = await fixture.call('select-options', { ...ticket(view), autoStoryUpdate: true }); fixture.advance();
  const changed = variables(); changed.主角.skills = []; delete changed.主角.背包;
  await fixture.settle(changed); let after = await fixture.call('state');
  assert.equal(after.party[0].skills.length, 0, 'the base attack is independent from the special skill list');
  assert.deepEqual(after.inventory, view.inventory);
  fixture.advance(); changed.主角.背包 = {}; await fixture.settle(changed); after = await fixture.call('state');
  assert.deepEqual(after.inventory, []); assert.deepEqual(after.nonCombatInventory, []);
});

test('a current active battle remains frozen while next-version settled updates apply to the next battle', async () => {
  const fixture = host(); let view = await fixture.setup();
  view = await fixture.call('select-options', { ...ticket(view), autoStoryUpdate: true });
  view = await fixture.call('manual-start', { ...ticket(view), enemyName: '守卫' }); const original = fixture.saved(), saves = fixture.calls.saves;
  const changed = variables(); changed.主角.hp = 5; changed.主角.背包 = { 疗伤药: 0 };
  await fixture.settle(changed);
  assert.deepEqual(fixture.saved(), original); assert.equal(fixture.calls.saves, saves);
  fixture.advance(); await fixture.settle(changed); const next = await fixture.call('state');
  assert.equal(next.battle, null); assert.equal(next.party[0].hp, 5);
  assert.equal(next.inventory[0].count, 0); assert.equal(fixture.calls.tasks, 0);
});

test('only the future auto-update switch can change during a live battle, preserving its snapshot', async () => {
  const fixture = host(); let view = await fixture.setup();
  view = await fixture.call('manual-start', { ...ticket(view), enemyName: '守卫' });
  const snapshot = copy(view.battle);
  view = await fixture.call('select-options', { ...ticket(view), autoStoryUpdate: true });
  assert.equal(view.autoStoryUpdate, true); assert.deepEqual(view.battle, snapshot);
  await assert.rejects(fixture.call('select-options', { ...ticket(view), autoStoryUpdate: false, difficulty: 'hell' }), error => error.code === 'ACTIVE_BATTLE');
});
