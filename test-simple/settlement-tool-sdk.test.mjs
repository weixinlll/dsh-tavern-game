// Exercise the actual installed Tavern settlement dispatcher, with only an in-memory store.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { apply } from '../simple/plugin.mjs';

const sdk = process.env.DSH_TEST_SDK || path.join(process.env.USERPROFILE || '', '.dsh/apps/dsh-tavern/tavern-plugin/lib');
const present = existsSync(path.join(sdk, 'plugin-api.js'));
const ticket = view => ({ turn: view.turnState.turn, textVersion: view.turnState.textVersion, baseRevision: view.revision });
const tick = () => new Promise(resolve => setImmediate(resolve));
async function fixture() {
  const { createTavernPluginApi } = await import(pathToFileURL(path.join(sdk, 'plugin-api.js')).href);
  const { createPluginData } = await import(pathToFileURL(path.join(sdk, 'domain/plugin-data.js')).href);
  const json = new Map(), materials = new Map(), variables = new Map(), gameId = 'native-staged-battle-update', chatId = 'isolated-staged-chat';
  let pending = 1, settled = 1, settling = false, requests = 0, version = 0;
  const data = createPluginData({ store: { readJson: async key => structuredClone(json.get(key) ?? null), updateJson: async (key, update) => { const next = update(structuredClone(json.get(key) ?? null)); json.set(key, structuredClone(next)); return structuredClone(next); } } });
  const material = (turn, key, text) => ({ sessionId: gameId, chatId, turn, key, greeting: turn === 1, text, source: text, card: { path: 'fixture-card', name: '隔离夹具' } });
  materials.set(1, material(1, 'greeting-v1', '行者抵达客栈。')); variables.set(1, {});
  const deps = { ctx: { fiber: { name: 'dsh-tavern-game' }, effect: callback => callback() }, data,
    logger: { warn() {}, error() {} }, resolveGame: async id => id === gameId ? { sessionId: gameId, chatId } : null,
    readTurn: async (_id, turn) => turn <= settled ? structuredClone(materials.get(turn) ?? null) : null,
    readPendingTurn: async () => structuredClone(materials.get(pending)), readLatestSettledTurn: async () => structuredClone(materials.get(settled)),
    readActivity: async () => ({ generating: false, settling }), currentKey: async (_id, turn) => materials.get(turn)?.key ?? null,
    readVariables: async row => structuredClone(variables.get(row.turn) ?? {}), readHistory: async (_id, from, to) => [...materials.values()].filter(row => row.turn >= from && row.turn <= to && row.turn <= settled).map(row => structuredClone(row)),
    media: { issue: async () => {} }, publish() {}, backgroundModel: async () => ({ provider: 'fixture', model: 'fixture' }),
  };
  const api = createTavernPluginApi(deps);
  const llm = { prepareCall: async config => ({ config, stream: async function* () {
    requests++;
    yield { type: 'text-delta', text: JSON.stringify({ party: [{ name: '行者', hp: 80, maxHp: 100, attack: 17, defense: 6, speed: 50,
      skills: [{ name: '疾风连击', baseId: 'human-0-63' }, { name: '闪身反制', baseId: 'human-0-16' }, { name: '破甲毒镖', baseId: 'human-0-9', extraStatuses: ['blind'] }, { name: '护体灵光', baseId: 'human-0-13' }] }], items: [{ name: '疗伤药', count: 1, description: 'AI补全' }, { name: '旧钥匙', count: 1, description: '客栈门钥匙' }] }) };
    yield { type: 'finish', reason: { kind: 'stop' } };
  } }) };
  apply({ tavern: api.service, get: name => name === 'llm' ? llm : null });
  const call = (route, args = {}) => api.callHandler('dsh-tavern-game/' + route, { gameId, ...args });
  let view = await call('generate-party', ticket(await call('state')));
  view = await call('select-options', { ...ticket(view), autoStoryUpdate: true });
  return { api, call, gameId, requests: () => requests,
    records: () => data.turnsUpTo({ chatId, owner: 'dsh-tavern-game', turn: pending }),
    begin: (text = '行者经历本轮正文。', vars = {}) => { pending++; version++; materials.set(pending, material(pending, `story-${pending}-v${version}`, text)); variables.set(pending, structuredClone(vars)); settling = true; },
    sections: () => api.settlement.sections({ gameId, turn: pending }),
    dispatcher: () => api.settlement.calls({ gameId, turn: pending }),
    settle: async () => { settled = pending; settling = false; await api.turnSettled(gameId); for (let index = 0; index < 25; index++) await tick(); return call('state'); },
    regenerate: async () => { version++; materials.set(pending, material(pending, `story-${pending}-v${version}`, '重新生成后无变化。')); api.timelineChanged(gameId, { kind: 'regenerate', turn: pending }); for (let index = 0; index < 5; index++) await tick(); },
  };
}
function issuedTicket(sections) {
  const text = sections.map(section => section.text).join('\n');
  const token = text.match(/ticket必须精确为「([^」]+)」/)?.[1];
  assert(token, text); return token;
}

test('native SDK stages generated-only actor/skill/bag updates until settlement completes, then rejects replay', { skip: !present && 'Installed Tavern SDK unavailable' }, async () => {
  const host = await fixture(); const before = await host.call('state'), id = before.party[0].id;
  assert(host.api.settlement.tools().some(tool => tool.name === 'dsh_battle_update_party'));
  assert.equal(host.requests(), 1);
  host.begin('行者受伤，学会毒镖，用掉药物并获得绳索。');
  const token = issuedTicket(await host.sections()), records = await host.records();
  const invoke = host.dispatcher(), args = { ticket: token, actors: [{ actorId: id, hp: 35, attack: 22, skills: [{ name: '毒镖', description: '施加中毒' }] }], items: [{ name: '疗伤药', id: 'healing-potion', count: 0 }, { name: '绳索', count: 1, description: '新获得的绳索' }] };
  const staged = JSON.parse(await invoke('dsh_battle_update_party', args));
  assert.equal(staged.ok, true); assert.equal(staged.staged, true);
  assert.deepEqual(await host.records(), records, 'tool writes nothing while the native turn is unsettled');
  const pending = await host.call('state'); assert.equal(pending.party[0].hp, 80); assert.equal(pending.inventory[0].count, 1);
  const after = await host.settle();
  assert.equal(after.party[0].hp, 35); assert.equal(after.party[0].attack, 22); assert.equal(after.party[0].id, id);
  assert(after.party[0].skills.some(skill => skill.name === '毒镖' && /中毒/.test(skill.description)));
  assert.equal(after.inventory.find(item => item.id === 'healing-potion').count, 0);
  assert.deepEqual(after.nonCombatInventory, []);
  assert.equal(host.requests(), 1, 'automatic synchronization makes no extra model request');
  assert.equal(JSON.parse(await invoke('dsh_battle_update_party', args)).ok, false);
});

test('native SDK drops staged patches after regeneration and rejects the tool while synchronization is disabled', { skip: !present && 'Installed Tavern SDK unavailable' }, async () => {
  const host = await fixture(); const before = await host.call('state');
  host.begin(); const token = issuedTicket(await host.sections()), invoke = host.dispatcher();
  assert.equal(JSON.parse(await invoke('dsh_battle_update_party', { ticket: token, actors: [{ actorId: before.party[0].id, hp: 1 }] })).ok, true);
  await host.regenerate(); const newToken = issuedTicket(await host.sections()); assert.notEqual(newToken, token);
  assert.equal(JSON.parse(await invoke('dsh_battle_update_party', { ticket: token, actors: [{ actorId: before.party[0].id, hp: 1 }] })).ok, false);
  let after = await host.settle(); assert.equal(after.party[0].hp, before.party[0].hp);
  after = await host.call('select-options', { ...ticket(after), autoStoryUpdate: false });
  host.begin(); assert.equal((await host.sections()).length, 0);
  assert.equal(JSON.parse(await host.dispatcher()('dsh_battle_update_party', { ticket: newToken, actors: [{ actorId: before.party[0].id, hp: 2 }] })).ok, false);
  const disabled = await host.settle(); assert.equal(disabled.party[0].hp, before.party[0].hp);
  assert.equal(host.requests(), 1);
});

test('native SDK validates approved IDs, finite fields and caps, then gives explicit MVU values final priority', { skip: !present && 'Installed Tavern SDK unavailable' }, async () => {
  const host = await fixture(), initial = await host.call('state'), id = initial.party[0].id;
  host.begin('行者失去战斗能力。', { 主角: { name: '行者', hp: 0, maxHp: 100, attack: 17, skills: [], 背包: { 疗伤药: 0 } } });
  const token = issuedTicket(await host.sections()), invoke = host.dispatcher();
  for (const actors of [[{ actorId: 'unknown', hp: 10 }], [{ actorId: id, hp: Infinity }], [{ actorId: id, hp: 200 }], [{ actorId: id, skills: Array.from({ length: 5 }, () => ({ name: '一招' })) }]]) {
    assert.equal(JSON.parse(await invoke('dsh_battle_update_party', { ticket: token, actors })).ok, false);
  }
  assert.equal(JSON.parse(await invoke('dsh_battle_update_party', { ticket: token, items: Array.from({ length: 21 }, () => ({ name: '绳索', count: 1 })) })).ok, false);
  assert.equal(JSON.parse(await invoke('dsh_battle_update_party', { ticket: token, actors: [{ actorId: id, hp: 90, attack: 90, skills: [{ name: '火球', description: '施加灼烧' }] }], items: [{ name: '疗伤药', id: 'healing-potion', count: 2 }, { name: '绳索', count: 1 }] })).ok, true);
  const after = await host.settle();
  assert.equal(after.party[0].hp, 0); assert.equal(after.party[0].attack, 17); assert.equal(after.party[0].skills.length, 0);
  assert.equal(after.inventory.find(item => item.id === 'healing-potion').count, 0);
  assert.deepEqual(after.nonCombatInventory, []);
  host.begin('行者恢复后弃用所有招式。', { 主角: { name: '行者', skills: [] } });
  const nextToken = issuedTicket(await host.sections());
  assert.equal(JSON.parse(await host.dispatcher()('dsh_battle_update_party', { ticket: nextToken, actors: [{ actorId: id, hp: 40, skills: [{ name: '火球', description: '施加灼烧' }] }] })).ok, true);
  const skillsOnly = await host.settle();
  assert.equal(skillsOnly.party[0].hp, 40, 'missing MVU numeric fields keep the staged game update');
  assert.equal(skillsOnly.party[0].skills.length, 0, 'explicit MVU empty skills override the staged skill list');
});
