import test from 'node:test'
import assert from 'node:assert/strict'
import { compactVariables, encounterFromText, extractMvuParty, extractMvuEnemies, extractMvuItems, parsePartyResult, readSources } from '../simple/context.mjs'

const skillActor = (name, extra = {}) => ({ name, hp: 30, maxHp: 50, attack: 8, skills: ['火球术', '冰锥'], ...extra })
const partyNames = party => party.map(actor => actor.name)

test('MVU extraction handles nested stats, described tuples, zero HP and preserves skill-name lists', () => {
  const variables = {
    stat_data: {
      主角: {
        姓名: '林青',
        基础属性: { 等级: [7, '角色等级'], 生命值: [80, '当前生命'], 最大生命: [100, '生命上限'], 攻击力: [19, '攻击'] },
        技能: ['风刃', '冰锥'],
      },
      队伍: [
        { name: '同伴甲', stats: { hp: [0, '倒下'], maxHp: [64, '上限'], defense: [9, '护甲'] } },
        { name: '同伴乙', stats: { hp: '24/40' } },
        { name: '同伴丙', stats: { hp: ['24/40', '生命'] } },
      ],
      敌人: { name: '敌方首领', hp: 999, maxHp: 999 },
    },
  }
  const party = extractMvuParty(variables)
  assert.deepEqual(partyNames(party), ['林青', '同伴甲', '同伴乙', '同伴丙'])
  assert.equal(party[0].level, 7)
  assert.equal(party[0].hp, 80)
  assert.equal(party[0].maxHp, 100)
  assert.deepEqual(party[0].skills.map(skill => skill.name), ['风刃', '冰锥'], 'two string skills are not interpreted as an MVU value/description tuple')
  assert.equal(party[1].hp, 0, 'zero HP remains zero')
  assert.equal(party[1].maxHp, 64)
  assert.equal(party[2].hp, 24)
  assert.equal(party[2].maxHp, 40)
  const paired = extractMvuParty({ 主角: { name: '甲', hp: ['24/40', '生命'] } })[0]
  assert.equal(paired.hp, 24)
  assert.equal(paired.maxHp, 40, 'described HP fractions are unwrapped as a value tuple')
  const nestedSkills = extractMvuParty({ 主角: { name: '行者', hp: 50, 战技: { 春回: { 效果: '恢复生命' }, 碧毒: { 描述: '中毒' } } } })
  assert.deepEqual(nestedSkills[0].skills, [{ name: '春回', description: '恢复生命' }, { name: '碧毒', description: '中毒' }])
})

test('MVU extraction accepts companion dictionaries and named list forms but excludes enemy blocks', () => {
  const variables = {
    companions: {
      阿青: { stats: { hp: [18, '生命'], maxHp: [30, '上限'], speed: [6, '身法'] }, skills: ['刺击'] },
      小白: { stats: { hp: [20, '生命'], maxHp: [25, '上限'] } },
    },
    party: [skillActor('队伍成员甲'), skillActor('队伍成员乙')],
    enemies: { 首领: { name: '敌方首领', hp: 900, maxHp: 900 } },
    enemy: [skillActor('另一敌人')],
    对手: { 敌人甲: { name: '不应出现', hp: 10, maxHp: 10 } },
  }
  const party = extractMvuParty(variables)
  assert.deepEqual(partyNames(party), ['阿青', '小白', '队伍成员甲', '队伍成员乙'])
  assert(!party.some(actor => /敌人|首领|不应出现/.test(actor.name)))
})

test('MVU extraction caps parties at six and does not execute getters or recurse through cycles', () => {
  const variables = { party: Array.from({ length: 8 }, (_, index) => skillActor(`同伴${index + 1}`)) }
  const cycle = { name: '循环同伴', hp: 5, maxHp: 5 }
  cycle.self = cycle
  variables.队友 = { 循环同伴: cycle }
  let getterCalls = 0
  Object.defineProperty(variables, '恶意属性', { enumerable: true, get() { getterCalls++; throw new Error('getter executed') } })
  const party = extractMvuParty(variables)
  assert.equal(party.length, 6)
  assert.equal(getterCalls, 0)
  assert(!party.some(actor => actor.name === '循环同伴'), 'party cap stops traversal after the first six actors')
})

test('MVU extraction and compact source serialization enforce depth, node, and text bounds', () => {
  const branch = depth => depth === 0 ? {} : Object.fromEntries(Array.from({ length: 4 }, (_, i) => [`n${i}`, branch(depth - 1)]))
  const wide = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`tree${i}`, branch(5)]))
  wide.队伍 = [skillActor('藏在节点上限之后')]
  assert.deepEqual(partyNames(extractMvuParty(wide)), ['藏在节点上限之后'], 'known party keys are visited before unrelated large trees')

  const actorBehindBudget = { misc: { a: branch(5), z: { 队伍: [skillActor('预算之后的同伴')] } } }
  assert.deepEqual(extractMvuParty(actorBehindBudget), [], 'the node budget stops a deep, irrelevant subtree before its late party key')

  const deep = { name: '太深的同伴', hp: 5, maxHp: 5 }
  let nested = deep
  for (let i = 0; i < 10; i++) nested = { next: nested }
  assert.deepEqual(extractMvuParty({ 队伍: nested }), [], 'objects beyond the path-depth bound are ignored')
  const compact = compactVariables({ text: '字'.repeat(5000), items: Array.from({ length: 1000 }, (_, i) => `entry-${i}`) }, 256)
  assert(compact.length <= 256)
})

test('model party JSON parser rejects malformed, oversized, empty, and over-six results', () => {
  for (const text of ['{"party":[', ' '.repeat(18001), '{"party":[]}', JSON.stringify({ party: Array.from({ length: 7 }, (_, i) => ({ name: `同伴${i}` })) })]) {
    assert.throws(() => parsePartyResult(text))
  }
  assert.deepEqual(parsePartyResult('{"party":[{"name":"林青","hp":0}]}'), [{ name: '林青', hp: 0 }])
})

test('encounter marker permits only 1–6 named enemies and reduces their skills to names and descriptions', () => {
  const result = encounterFromText('<dsh_battle>{"enemies":[{"name":"山匪","level":2,"hp":99999,"formula":"1d999","skills":["断水刀",{"name":"迷踪步","description":"短暂隐匿","power":9999,"formula":"free win"}]}]}</dsh_battle>')
  assert.equal(result.enemies.length, 1)
  assert.deepEqual(Object.keys(result.enemies[0]).sort(), ['description', 'level', 'name', 'skills', 'types'])
  assert.deepEqual(result.enemies[0].skills, [{ name: '断水刀' }, { name: '迷踪步', description: '短暂隐匿' }])
  assert.equal('hp' in result.enemies[0], false)
  assert.equal('formula' in result.enemies[0], false)
  assert.equal('power' in result.enemies[0].skills[1], false)

  const three = encounterFromText(`<dsh_battle>${JSON.stringify({ enemies: Array.from({ length: 3 }, (_, i) => ({ name: `敌人${i + 1}`, skills: ['招式'] })) })}</dsh_battle>`)
  assert.equal(three.enemies.length, 3)
  assert.match(encounterFromText('<dsh_battle>{truncated</dsh_battle>').error, /JSON/)
  assert.match(encounterFromText('<dsh_battle>{"enemies":[]}</dsh_battle>').error, /1—6/)
  assert.match(encounterFromText(`<dsh_battle>${JSON.stringify({ enemies: Array.from({ length: 7 }, (_, i) => ({ name: `敌人${i + 1}` })) })}</dsh_battle>`).error, /1—6/)
  assert.equal(encounterFromText('<dsh_battle>{"enemies":[{"hp":999}]}</dsh_battle>').enemies, undefined, 'invalid names never create an encounter')
  assert.deepEqual(encounterFromText('battle###旧版山匪|旧字段###'), { enemies: [{ name: '旧版山匪', skills: [] }] })
})

test('active narrative combat identifies actual opponents without a marker or model call', () => {
  const party = [{ name: '林青' }, { name: '阿白' }]
  for (const verb of ['决斗', '对战', '交战', '战斗', '切磋', '比武', '开战']) {
    assert.deepEqual(encounterFromText(`你与张三展开${verb}。`, { party }).enemies.map(actor => actor.name), ['张三'])
  }
  assert.deepEqual(encounterFromText('林青和阿白正在与守卫切磋。', { party }).enemies.map(actor => actor.name), ['守卫'])
  assert.deepEqual(encounterFromText('张三向你发起决斗。', { party }).enemies.map(actor => actor.name), ['张三'])
  assert.deepEqual(encounterFromText('你正在迎战张三。', { party }).enemies.map(actor => actor.name), ['张三'])
  assert.deepEqual(encounterFromText('你与张三、李四交战。', { party }).enemies.map(actor => actor.name), ['张三', '李四'])
  const generic = encounterFromText('双方开始战斗。')
  assert.deepEqual(generic.enemies, [{ name: '剧情对手', skills: [] }])
  assert.match(generic.notice, /没有明确对手资料.*1名.*固定包默认值/)
  assert.deepEqual(encounterFromText('遇到插队的人，准备进入战斗，准备开战。').enemies, [{ name: '剧情对手', skills: [] }])
})

test('negated, past, completed, future and hypothetical combat remains passive', () => {
  for (const text of ['不想决斗。', '我不愿和张三切磋。', '昨天决斗已结束。', '如果对战就会受伤。', '假如与张三交战。', '你和张三尚未开始比武。', '明天与张三战斗。', '曾经与张三切磋。', '你和张三的决斗已经结束。', '你和张三战斗，双方已经分出胜负。', '双方停止战斗。', '什么是决斗规则？', '我们在讨论切磋技巧。', '他无法参加比武。', '张三邀请你明天比武。', '<think>现在开始决斗。</think>众人喝茶。']) {
    assert.equal(encounterFromText(text), null, text)
  }
  assert.deepEqual(encounterFromText('昨天的决斗已经结束。现在你与张三展开决斗。').enemies.map(actor => actor.name), ['张三'])
  assert.deepEqual(encounterFromText('昨天的决斗已经结束，今天你与张三开始决斗。').enemies.map(actor => actor.name), ['张三'])
  assert.equal(encounterFromText('如果张三过来，你就与他决斗。'), null)
  for (const text of ['你与张三的决斗开始。数招后，决斗已经结束。', '双方开始战斗。战斗落幕，众人回到酒馆。', '张三与你开战。交战结束。', '明日迎战张三。', '你准备迎战张三。']) assert.equal(encounterFromText(text), null, text)
  for (const text of ['准备明天开战。', '如果准备开战，就会受伤。', '我不准备开战。']) assert.equal(encounterFromText(text), null, text)
  assert.deepEqual(encounterFromText('你与张三决斗。决斗已经结束。随后你与李四开始比武。').enemies.map(actor => actor.name), ['李四'])
  assert.deepEqual(encounterFromText('你与张三决斗。决斗尚未结束。').enemies.map(actor => actor.name), ['张三'])
})

test('settled MVU enemy containers provide bounded current names and skills, excluding allies and archives', () => {
  const variables = { stat_data: {
    主角: { name: '林青', hp: 0, maxHp: 100 },
    历史战斗: { 当前敌人: [{ name: '昨日山贼', hp: 1 }] },
    当前对手: [{ name: '林青', hp: 100 }, { name: '守卫', hp: 0, skills: ['挥剑', '格挡'] }, { name: '副卫', hp: 20, skills: ['重拳'] }],
  } }
  Object.defineProperty(variables.stat_data, 'enemy', { enumerable: true, get() { throw new Error('never execute getters') } })
  const enemies = extractMvuEnemies(variables)
  assert.deepEqual(enemies.map(actor => actor.name), ['守卫', '副卫'])
  assert.equal(enemies[0].hp, 0)
  assert.deepEqual(enemies[0].skills.map(skill => skill.name), ['挥剑', '格挡'])
  const named = encounterFromText('林青正在与副卫交战。', { variables })
  assert.deepEqual(named.enemies.map(actor => actor.name), ['副卫'], 'active named opponent excludes unrelated enemy records')
  assert.deepEqual(encounterFromText('双方开始战斗。', { variables }).enemies.map(actor => actor.name), ['守卫', '副卫'])
  assert.equal(extractMvuEnemies({ enemies: Array.from({ length: 20 }, (_, index) => ({ name: `敌人${index}`, skills: Array(12).fill('挥剑') })) }).length, 6)
  const explicit = '<dsh_battle>{"enemies":[{"name":"明确对手"}]}</dsh_battle>'
  assert.deepEqual(encounterFromText('你与张三交战。', { rawText: explicit, variables }).enemies.map(actor => actor.name), ['明确对手'])
  assert.match(encounterFromText('双方开始战斗。', { rawText: '<dsh_battle>{broken</dsh_battle>' }).error, /JSON/)
  assert.equal(encounterFromText('大家喝茶。', { rawText: '<think>现在交战。</think>', variables }), null, 'raw hidden prose cannot override visible story')
})

test('source reader requests current turn plus only six prior contexts', async () => {
  const calls = []
  const T = {
    async getTurn(args) { calls.push(['turn', args]); return { turn: 12, variables: { 主角: skillActor('林青') }, text: '当前正文', rawText: '当前原文' } },
    async getHistory(args) { calls.push(['history', args]); return Array.from({ length: 6 }, (_, i) => ({ turn: i + 6, text: `历史${i + 6}` })) },
  }
  const source = await readSources(T, 'game-1', { turn: 12 })
  assert.deepEqual(calls[0], ['turn', { gameId: 'game-1', turn: 12 }])
  assert.deepEqual(calls[1], ['history', { gameId: 'game-1', from: 6, to: 11 }])
  for (const text of ['历史6', '历史11', '当前正文']) assert(source.text.includes(text), `source includes ${text}`)
  assert.equal(source.text.split('第').length - 1, 7, 'three settled contexts plus the current source are passed')
  assert.equal(source.directParty[0].name, '林青')
})

test('source reader fails clearly when the current turn source is missing', async () => {
  await assert.rejects(readSources({ getTurn: async () => null }, 'game-1', { turn: 12 }), /本轮正文尚未读到/)
})


test('MVU bag reads explicit consumable quantities, preserves zero and excludes enemy inventories', () => {
  const bag = extractMvuItems({ stat_data: { 主角: { 背包: { 生命药水: { 数量: 8 }, 解毒丹: [0, '数量'], 金钱: 99999 } },
    同伴: { inventory: [{ name: '回气丹', count: 3 }] }, 敌人: { bag: { 解毒丹: 1 } } } });
  assert.deepEqual(bag, [{ id: 'healing-potion', count: 2 }, { id: 'cleanse', count: 0 }, { id: 'resource-potion', count: 1 }]);
  assert.deepEqual(extractMvuItems({ 主角: { 生命: 20, 无关: { 生命药水: 99 } } }), []);
});

test('a tagless enemies object in the body still becomes an encounter', () => {
  const body = '他合眼。\n\n[攻方|赭袍、灰衣]\n\n{"enemies":[{"name":"赭袍","level":7,"skills":[{"name":"铜环引地"}]},{"name":"灰衣","level":8,"skills":[{"name":"掌心灵力线"}]}]}';
  const encounter = encounterFromText(body);
  assert.ok(encounter, 'the raw object is recognised without <dsh_battle>');
  assert.deepEqual(encounter.enemies.map(actor => actor.name), ['赭袍', '灰衣']);
  assert.equal(encounter.enemies[0].level, 7);
});

test('a fenced enemies object is accepted while other JSON and broken JSON are ignored', () => {
  const fenced = '他拔刀。\n\n```json\n{"enemies":[{"name":"银月狼","kind":"animal","species":"狼"}]}\n```';
  assert.equal(encounterFromText(fenced).enemies[0].name, '银月狼');
  assert.equal(encounterFromText('{"hp":10,"level":3}'), null, 'JSON without enemies is not a battle');
  assert.equal(encounterFromText('{"enemies":[{"name":"半截'), null, 'an unterminated object never opens a fight');
});

test('the tagged marker keeps priority over a stray bare object', () => {
  const body = '<dsh_battle>{"enemies":[{"name":"甲"}]}</dsh_battle> 之后又写 {"enemies":[{"name":"乙"}]}';
  assert.equal(encounterFromText(body).enemies[0].name, '甲');
});

test('交锋 and 交手 count as an active encounter in the body', () => {
  const encounter = encounterFromText('双方交锋，刀光在廊下炸开。');
  assert.ok(encounter);
  assert.equal(encounter.source, 'narrative');
  assert.equal(encounterFromText('上次交手，他输了。'), null, 'a past fight is not an active one');
});
