import test from 'node:test';
import assert from 'node:assert/strict';
import { requestGeneration, generationPrompt, parseGenerationResult } from '../simple/generation.mjs';
import { BASIC_SKILL_ID, SKILLS, STATUSES, generationEffectCatalog, GENERATION_EXTRA_STATUS_IDS, GENERATION_STATUS_COMBINATIONS, getPack, resolveSkill } from '../simple/catalog.mjs';

const payload = JSON.stringify({ party: [{ name: '剑客', avatarId: 'lingxiao-cultivator', skills: [
  { name: '破阵剑', baseId: 'human-0-1' }, { name: '裂甲', baseId: 'human-0-2' },
  { name: '影步', baseId: 'human-0-15' }, { name: '回春', baseId: 'human-0-17' },
] }], items: [] });
const host = (text = payload, finish = 'stop', interrupt = false) => {
  const calls = [];
  return { calls, T: { backgroundModel: async () => ({ provider: 'default', model: 'default' }) },
    llm: { prepareCall: async config => ({ config, stream: async function* (options) {
      calls.push(options); yield { type: 'text-delta', text };
      if (interrupt) throw Error('connection reset');
      yield { type: 'finish', reason: { kind: finish } };
    } }) } };
};
test('generation uses the explicit provider/model/effort with one bounded call', async () => {
  const fixture = host(), selection = { provider: 'chosen', model: 'roles', reasoningEffort: 'low' };
  const raw = await requestGeneration(fixture.T, fixture.llm, 'g', 'data', new AbortController().signal, selection);
  assert.equal(raw, payload); assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.calls[0].provider, 'chosen'); assert.equal(fixture.calls[0].model, 'roles'); assert.equal(fixture.calls[0].reasoningEffort, 'low');
  assert.equal(fixture.calls[0].maxTokens, 12000); assert.equal(fixture.calls[0].tools, undefined);
  assert.equal(fixture.calls[0].sessionId, 'g', 'OpenCode routing uses the stable DSH conversation id');
  assert.match(fixture.calls[0].messages[0].id, /^[0-9a-f-]{36}$/i);
  assert.deepEqual(fixture.calls[0].messages[0].source, { kind: 'plugin:dsh-tavern' });
  assert.equal(parseGenerationResult(raw).party[0].avatarId, 'lingxiao-cultivator');
});
test('token limit accepts fully closed JSON and rejects a cut response explicitly without retry loops', async () => {
  const complete = host(payload, 'max-tokens');
  assert.equal(await requestGeneration(complete.T, complete.llm, 'g', '', new AbortController().signal), payload);
  const cut = host(payload.slice(0, -8), 'max-tokens');
  await assert.rejects(requestGeneration(cut.T, cut.llm, 'g', '', new AbortController().signal), error => error.code === 'MODEL_LIMIT' && /截断/.test(error.message));
  assert.equal(cut.calls.length, 1);
});
test('generation prompts demand matched built-in appearance, a combat-only bag and compact descriptions', () => {
  const prompt = generationPrompt({ text: '主角是持剑男修士。' }, getPack('fantasy'), { compact: true });
  assert.match(prompt, /按人物性别、物种、武器与职业/); assert.match(prompt, /lingxiao-cultivator=修仙剑修/);
  assert.match(prompt, /背包只返回战斗中可用/); assert.match(prompt, /忽略钥匙/); assert.match(prompt, /精简重试/);
  assert.match(prompt, /恰好生成4个互不重复的特殊技能/); assert.match(prompt, /普通攻击是独立的基础行动/);
  assert.match(prompt, /固定技能效果目录/); assert.match(prompt, /baseId必须逐字选自固定效果目录/);
  assert(prompt.includes('fantasy-0-80')); assert(prompt.includes('465种单项/双项组合'));
});

test('AI-generated skill effects must be exact package IDs and are rewritten from the local effect data', () => {
  const output = JSON.stringify({ party: [{ name: '灵修', skills: [
    { name: '灵剑诀', baseId: 'fantasy-0-1' },
    { name: '破阵咒', baseId: 'fantasy-0-2', extraStatuses: ['poison', 'blind'], mechanics: ['sureHit'] },
    { name: '护体罡气', baseId: 'fantasy-0-13' },
    { name: '迷心咒', baseId: 'fantasy-0-5' },
  ] }], items: [] });
  const generated = parseGenerationResult(output, { packId: 'fantasy' });
  assert.deepEqual(generated.party[0].skills.map(skill => skill.name), ['灵剑诀', '破阵咒', '护体罡气', '迷心咒']);
  assert(generated.party[0].skills.every(skill => {
    const move = resolveSkill(skill, 'fantasy');
    return move.id !== BASIC_SKILL_ID.fantasy && move.recognized && !move.notes.some(note => /未识别/.test(note))
      && move.description === skill.sourceDescription;
  }));
  assert(generated.party[0].skills[1].description.includes('中毒'));
  assert.throws(() => parseGenerationResult(JSON.stringify({ party: [{ name: '灵修', skills: [
    { name: '普通攻击' }, { name: '技能2', baseId: 'fantasy-0-2' }, { name: '技能3', baseId: 'fantasy-0-3' }, { name: '技能4', baseId: 'fantasy-0-4' },
  ] }], items: [] }), { packId: 'fantasy' }), error => error.code === 'MODEL_FORMAT' && /效果ID/.test(error.message));
  assert.throws(() => parseGenerationResult(JSON.stringify({ party: [{ name: '灵修', skills: [
    { name: '技能1', baseId: 'fantasy-0-1' }, { name: '技能2', baseId: 'fantasy-0-2', extraStatuses: ['unknown'] },
    { name: '技能3', baseId: 'fantasy-0-3' }, { name: '技能4', baseId: 'fantasy-0-4' },
  ] }], items: [] }), { packId: 'fantasy' }), error => error.code === 'MODEL_FORMAT' && /状态ID/.test(error.message));
});

test('the fixed generation library covers all statuses and hundreds of bounded debuff combinations', () => {
  assert.equal(generationEffectCatalog('human').length, 80);
  assert.equal(generationEffectCatalog('fantasy').length, 80);
  assert.equal(GENERATION_EXTRA_STATUS_IDS.length, 30);
  assert.equal(GENERATION_STATUS_COMBINATIONS.length, 465);
  const represented = new Set(SKILLS.filter(skill => skill.packId === 'fantasy' && skill.id.startsWith('fantasy-0-') && skill.status).map(skill => skill.status));
  assert.deepEqual([...Object.keys(STATUSES)].filter(id => !represented.has(id)), []);
});

test('compact single-character design asks only for actor JSON and excludes inventory instructions', () => {
  const prompt = generationPrompt({ text: '主角是持剑男修士。' }, getPack('fantasy'), { actor: { name: '剑客', skills: [] }, requirements: '设计剑术', compact: true });
  assert.match(prompt, /单角色精简重试，只返回actor对象/);
  assert.doesNotMatch(prompt, /必须完整返回全部人物和items|背包只返回战斗中可用/);
});

test('a disconnected stream reports an actionable interruption and never retries by itself', async () => {
  const fixture = host(payload.slice(0, 20), 'stop', true);
  await assert.rejects(requestGeneration(fixture.T, fixture.llm, 'g', '', new AbortController().signal), error => error.code === 'MODEL_INTERRUPTED' && /重试精简生成/.test(error.message));
  assert.equal(fixture.calls.length, 1);
});

test('provider interruption exposes a short sanitized cause without leaking credentials', async () => {
  const fixture = host();
  fixture.llm.prepareCall = async config => ({ config, stream: async function* () { throw Error('HTTP 429 authorization: Bearer top-secret-token'); } });
  await assert.rejects(requestGeneration(fixture.T, fixture.llm, 'g', '', new AbortController().signal), error => {
    assert.equal(error.code, 'MODEL_INTERRUPTED');
    assert.match(error.message, /HTTP 429/);
    assert.doesNotMatch(error.message, /top-secret-token/);
    return true;
  });
});

test('terminal DSH stream failures preserve status, provider code, and sanitized failure message', async () => {
  const fixture = host();
  fixture.llm.prepareCall = async config => ({ config, stream: async function* () {
    yield { type: 'finish', reason: { kind: 'error', failure: {
      status: 502, code: 'UPSTREAM_FAILURE', message: 'provider returned HTTP 502; api_key=secret-value',
    } } };
  } });
  await assert.rejects(requestGeneration(fixture.T, fixture.llm, 'g', '', new AbortController().signal), error => {
    assert.equal(error.code, 'MODEL_INTERRUPTED');
    assert.match(error.message, /HTTP 502/);
    assert.match(error.message, /UPSTREAM_FAILURE/);
    assert.match(error.message, /provider returned HTTP 502/);
    assert.doesNotMatch(error.message, /secret-value/);
    return true;
  });
});

test('model preparation failures retain their actionable cause and sanitize secrets', async () => {
  const fixture = host();
  fixture.llm.prepareCall = async () => { throw Error('HTTP 401 api_key=secret-value'); };
  await assert.rejects(requestGeneration(fixture.T, fixture.llm, 'g', '', new AbortController().signal), error => {
    assert.equal(error.code, 'MODEL_PREPARE');
    assert.match(error.message, /HTTP 401/);
    assert.doesNotMatch(error.message, /secret-value/);
    return true;
  });
});

test('a host-normalized lower output ceiling is honored rather than overwritten', async () => {
  let options;
  const fixture = host();
  fixture.llm.prepareCall = async config => ({ config: { ...config, maxTokens: 4096 }, stream: async function* (value) {
    options = value; yield { type: 'text-delta', text: payload }; yield { type: 'finish', reason: { kind: 'stop' } };
  } });
  await requestGeneration(fixture.T, fixture.llm, 'g', '', new AbortController().signal);
  assert.equal(options.maxTokens, 4096);
});
