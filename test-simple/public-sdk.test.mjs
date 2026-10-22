// Actual installed public SDK, backed exclusively by an in-memory fixture store.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { apply } from '../index.mjs';

const sdk = process.env.DSH_TEST_SDK || path.join(process.env.USERPROFILE || '', '.dsh/apps/dsh-tavern/tavern-plugin/lib');
const present = existsSync(path.join(sdk, 'plugin-api.js'));
test('installed public SDK mounts, persists, resumes, settles once, and invalidates regenerated branches', { skip: !present && 'Set DSH_TEST_SDK to the installed SDK lib directory' }, async () => {
  const { createTavernPluginApi } = await import(pathToFileURL(path.join(sdk, 'plugin-api.js')).href);
  const { createPluginData } = await import(pathToFileURL(path.join(sdk, 'domain/plugin-data.js')).href);
  const json = new Map(), materials = new Map(), errors = [];
  const copy = value => structuredClone(value);
  const store = {
    async readJson(key) { return copy(json.get(key) ?? null); },
    async updateJson(key, update) { const next = update(copy(json.get(key) ?? null)); json.set(key, copy(next)); return copy(next); },
  };
  const data = createPluginData({ store });
  const gameId = 'isolated-simple-sdk';
  let at = 1;
  const variables = { stat_data: { 主角: { 姓名: '测试行者', 当前生命: 120, 最大生命: 120, 攻击: 18, 防御: 6, 速度: 50, 技能: ['直拳', { name: '瞬毒击', description: '必定先攻、必中、必定暴击，附加中毒和麻痹' }] } } };
  const material = (turn, key, source) => ({ sessionId: gameId, chatId: 'memory-sdk-chat', turn, key,
    greeting: turn === 1, text: source, source, card: { path: 'fixture-card', name: '隔离夹具' } });
  materials.set(1, material(1, 'opaque-greeting', '测试行者抵达练武场。'));
  const deps = {
    ctx: { fiber: { name: 'dsh-tavern-game' }, effect: register => register() }, data,
    logger: { warn: (...args) => errors.push(args.join(' ')), error: (...args) => errors.push(args.join(' ')) },
    resolveGame: async id => id === gameId ? { sessionId: gameId, chatId: 'memory-sdk-chat' } : null,
    readTurn: async (_id, turn) => copy(materials.get(turn) ?? null),
    readPendingTurn: async () => copy(materials.get(at)), readLatestSettledTurn: async () => copy(materials.get(at)),
    readActivity: async () => ({ generating: false, settling: false }),
    currentKey: async (_id, turn) => materials.get(turn)?.key ?? null,
    readVariables: async () => copy(variables),
    readHistory: async (_id, from, to) => [...materials.values()].filter(row => row.turn >= from && row.turn <= to).map(copy),
    media: { issue: async () => {} }, publish() {}, backgroundModel: async () => null,
  };
  const build = () => {
    const api = createTavernPluginApi(deps);
    apply({ tavern: api.service, get: () => null });
    return { api, call: (route, args = {}) => api.callHandler('dsh-tavern-game/' + route, { gameId, ...args }) };
  };
  let host = build();
  assert.equal((await host.call('state')).party.length, 0);
  assert.match((await host.api.promptSections({ gameId, turn: 2 }))[0].text, /dsh_battle/);
  let view = await host.call('fill-party');
  assert.equal(view.party[0].hp, 120);
  host = build(); // Data survives recreating the plugin and public service.
  assert.equal((await host.call('state')).party[0].name, '测试行者');
  at = 2;
  materials.set(2, material(2, 'opaque-story-v1', '<dsh_battle>{"enemies":[{"name":"测试守卫","skills":["横斩","麻痹"]}]}</dsh_battle>'));
  await host.api.turnSettled(gameId);
  // The real SDK dispatches event handlers asynchronously.
  for (let i = 0; i < 30; i++) {
    view = await host.call('state');
    if (view.battle) break;
    await new Promise(resolve => setImmediate(resolve));
  }
  assert(view.battle, errors.join('\n'));
  const battleId = view.battle.id;
  host = build();
  view = await host.call('battle-state');
  assert.equal(view.battle.id, battleId);
  assert(view.battle.party[0].skills.some(skill => skill.mechanics.includes('first') && skill.mechanics.includes('critical')), 'compound mechanics survive real SDK storage and remount');
  for (let i = 0; i < 24 && !view.battle.outcome; i++) {
    const actor = view.battle.party[view.battle.activePlayer];
    const skill = actor.skills.find(entry => entry.usesLeft > 0 && entry.cooldownLeft === 0 && actor.resource >= entry.cost);
    view = await host.call('battle-act', { turn: 2, textVersion: 'opaque-story-v1', battleId, seq: view.battle.seq,
      action: skill ? { type: 'skill', skillId: skill.id } : { type: 'basic' } });
  }
  assert(view.battle.outcome);
  const result = await host.call('summary', { turn: 2, textVersion: 'opaque-story-v1', battleId, seq: view.battle.seq });
  assert(result.text.length <= 900);
  assert.match((await host.api.turnContext({ gameId, turn: 3, input: '继续' }))[0].text, /回合制战果/);
  at = 3;
  materials.set(3, material(3, 'opaque-followup', '测试行者整理装备。'));
  assert.match((await host.api.settlement.sections({ gameId, turn: 3 }))[0].text, /唯一结算方/);
  await host.api.turnSettled(gameId);
  for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal((await host.call('state')).battle, null);
  assert.equal((await host.api.settlement.sections({ gameId, turn: 3 })).length, 0, 'completed result is not injected twice after the next turn settles');
  at = 2;
  materials.set(2, material(2, 'opaque-regenerated', '重新生成后没有战斗。'));
  view = await host.call('state');
  assert.equal(view.battle, null, 'the SDK excludes the old version and newer turn records');
  assert.equal(view.party.length, 1, 'the valid greeting record is retained');
  assert.deepEqual(errors, []);
});
