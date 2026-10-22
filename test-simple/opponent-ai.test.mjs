import test from 'node:test';
import assert from 'node:assert/strict';
import { BASIC_SKILL_ID } from '../simple/catalog.mjs';
import { act, createBattle } from '../simple/engine.mjs';
import { battleObservation, chooseEnemyPlans } from '../simple/opponent-ai.mjs';

test('AI enemy can choose the independent basic action without adding it to four special skills', async () => {
  const battle = createBattle({ difficulty: 'ai', packId: 'human', party: [{ id: 'player-1', name: '队友', skills: ['human-0-1'] }],
    enemies: [{ id: 'enemy-1', name: '对手', skills: ['human-0-1', 'human-0-2', 'human-0-3', 'human-0-4'] }] });
  const observed = battleObservation(battle).opponents[0];
  assert.equal(observed.skills.length, 5);
  assert.equal(observed.skills[0].id, BASIC_SKILL_ID.human);
  assert.equal(battle.enemies[0].skills.length, 4);

  let streamedOptions;
  const llm = { prepareCall: async config => ({ config, stream: async function* (options) {
    streamedOptions = options;
    yield { type: 'text-delta', text: JSON.stringify({ choices: [{ actorId: 'enemy-1', skillId: BASIC_SKILL_ID.human, targetId: 'player-1' }] }) };
    yield { type: 'finish', reason: { kind: 'stop' } };
  } }) };
  const plans = await chooseEnemyPlans({}, llm, 'stable-game-id', battle, new AbortController().signal, { provider: 'fixture', model: 'fixture' });
  assert.equal(streamedOptions.sessionId, 'stable-game-id');
  const next = act(battle, { type: 'round', commands: [{ type: 'basic', actorId: 'player-1', targetId: 'enemy-1' }] }, { enemyPlans: plans });
  assert.ok(next.events.some(event => event.actorId === 'enemy-1' && event.skillId === BASIC_SKILL_ID.human));
  assert.equal(next.enemies[0].skills.length, 4);
});

test('explicit basic attacks are removed from an actor skill list during normalization', () => {
  const battle = createBattle({ packId: 'fantasy', party: [{ name: '队友', skills: [
    'fantasy-0-0', 'fantasy-0-1', 'fantasy-0-2', 'fantasy-0-3', 'fantasy-0-4',
  ] }], enemies: [{ name: '对手', skills: ['fantasy-0-1'] }] });
  assert.deepEqual(battle.party[0].skills.map(skill => skill.id), ['fantasy-0-1', 'fantasy-0-2', 'fantasy-0-3', 'fantasy-0-4']);
  assert.ok(battle.party[0].warnings.includes('普通攻击是独立基础行动，不占特殊技能槽'));
});
