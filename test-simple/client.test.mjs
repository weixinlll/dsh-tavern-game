import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import vm from 'node:vm'

const source = await fs.readFile(new URL('../client.js', import.meta.url), 'utf8')
const tick = async () => { await new Promise(resolve => setTimeout(resolve, 0)) }
const cleanups = new Set()
afterEach(() => { for (const cleanup of [...cleanups]) cleanup() })
const nodeText = node => node == null || typeof node === 'boolean' ? ''
  : Array.isArray(node) ? node.map(nodeText).join('')
    : typeof node === 'object' ? (node.children || []).map(nodeText).join('') : String(node)

async function mount({ state, routes = {}, watchHead = {}, globals = {} }) {
  const Fragment = Symbol('Fragment')
  const instances = new Map()
  const registrations = {}
  const calls = []
  const watchers = new Set()
  let current
  let submitInputCalls = 0
  const React = {
    Fragment,
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initial) {
      const index = current.cursor++
      const instance = current.instance
      if (!(index in instance.hooks)) instance.hooks[index] = typeof initial === 'function' ? initial() : initial
      return [instance.hooks[index], value => { instance.hooks[index] = typeof value === 'function' ? value(instance.hooks[index]) : value }]
    },
    useRef(initial) {
      const index = current.cursor++
      if (!(index in current.instance.hooks)) current.instance.hooks[index] = { current: initial }
      return current.instance.hooks[index]
    },
    useEffect(effect, deps) {
      const index = current.cursor++
      const old = current.instance.hooks[index]
      if (!old || !deps || !old.deps || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
        old?.cleanup?.()
        current.instance.hooks[index] = { deps, cleanup: effect() }
      }
    },
  }
  const audios = []
  class AudioMock {
    constructor(src) { this.src = src; this.paused = true; audios.push(this) }
    play() { this.paused = false; return Promise.resolve() }
    pause() { this.paused = true }
  }
  const ui = {
    assetUrl: path => `/asset/${path}`,
    registerPanel: config => { registrations.panel = config },
    registerTextMarker: config => { registrations.marker = config },
    watchTurnState(_gameId, listener) { watchers.add(listener); listener({ turn: 12, textVersion: 'text-12', settled: true, ...watchHead }); return () => watchers.delete(listener) },
    callHost: async (route, args) => {
      const name = route.split('/').at(-1)
      calls.push({ name, args })
      return routes[name] ? routes[name](args, calls) : state
    },
    openOverlay(options) { registrations.overlayCount = (registrations.overlayCount || 0) + 1; registrations.overlay = options; return { close() { options.onClose?.() } } },
    setInput: async args => { registrations.input = args },
    submitInput: async () => { submitInputCalls++ },
  }
  const window = { __ModuleLoader__: { load({ factory }) { factory(name => { assert.equal(name, 'react'); return React }).apply({ tavernUi: ui }) } } }
  vm.runInNewContext(source, { window, Audio: AudioMock, setTimeout, clearTimeout, console, ...globals })

  const rootElement = () => registrations.panel.render({ gameId: 'g-1' })
  let elements = []
  const renderNode = (node, path = 'root') => {
    if (node == null || typeof node === 'boolean' || typeof node !== 'object') return
    if (Array.isArray(node)) { node.forEach((child, index) => renderNode(child, `${path}.${index}`)); return }
    if (node.type === Fragment) { node.children.forEach((child, index) => renderNode(child, `${path}.${index}`)); return }
    if (typeof node.type === 'function') {
      const key = `${path}:${node.type.name}`
      const instance = instances.get(key) || { hooks: [] }
      instances.set(key, instance)
      const prior = current
      current = { instance, cursor: 0 }
      const result = node.type({ ...node.props, children: node.children })
      current = prior
      renderNode(result, key)
      return
    }
    elements.push({ ...node, text: nodeText(node.children) })
    node.children.forEach((child, index) => renderNode(child, `${path}.${index}`))
  }
  let extraNode = null
  const render = () => { elements = []; renderNode(rootElement()); if (extraNode) renderNode(extraNode, 'extra') }
  const renderElement = node => { extraNode = node; render() }
  const settle = async () => { for (let cycle = 0; cycle < 3; cycle++) { await tick(); await tick(); render() } }
  const unmount = () => { for (const instance of instances.values()) for (const hook of instance.hooks) hook?.cleanup?.(); cleanups.delete(unmount) }
  cleanups.add(unmount)
  render(); await settle()
  return {
    calls, registrations, audios, get submitInputCalls() { return submitInputCalls }, get elements() { return elements }, render, renderElement, settle,
    unmount,
    emitHead: head => { for (const watcher of [...watchers]) watcher(head) },
    click: async text => {
      const button = elements.find(item => item.type === 'button' && item.text === text)
      assert(button, `button not found: ${text}`)
      await button.props.onClick?.()
      await settle()
    },
    select: async value => {
      const select = elements.find(item => item.type === 'select')
      assert(select, 'pack selector not found')
      await select.props.onChange({ target: { value } })
      await settle()
    },
  }
}

const actor = { id: 'hero', name: '主角', hp: 50, maxHp: 100, attack: 12, defense: 4, speed: 7,
  skills: [{ id: 'strike', name: '斩击', description: '近身攻击', usesLeft: 3, cooldownLeft: 0 }] }
const activeBattle = { id: 'b-1', seq: 4, round: 1, packId: 'human', activePlayers: [1], activeEnemies: [1], inventory: [{ id: 'healing-potion', name: '治疗药水', count: 1 }], party: [
  { ...actor, id: 'front', name: '战士甲', skills: [{ id: 'slash', name: '横斩', usesLeft: 3, cooldownLeft: 0 }] },
  { ...actor, id: 'reserve', name: '战士乙', skills: [{ id: 'strike', name: '猛击', usesLeft: 2, cooldownLeft: 0 }] },
], enemies: [
  { id: 'foe-a', name: '敌人甲', hp: 35, maxHp: 40, skills: [] },
  { id: 'foe-b', name: '敌人乙', hp: 25, maxHp: 30, skills: [] },
], activePlayer: 1, activeEnemy: 1, events: [], log: [] }
const snapshot = { packs: [{ id: 'human', name: '人类对决' }, { id: 'fantasy', name: '玄幻 / 西幻 / 仙侠' }], packId: 'human', revision: 9,
  party: [actor], turnState: { turn: 12, textVersion: 'text-12' }, warnings: [], battle: null }

test('simple panel contains only party setup controls and tickets pack and party changes', async () => {
  const emptyView = await mount({ state: { ...snapshot, party: [] } })
  const emptyText = emptyView.elements.filter(item => item.type !== 'style').map(item => item.text).join('')
  assert.match(emptyText, /AI读取并生成角色和背包/)
  assert.match(emptyText, /队友为空/)
  assert.match(emptyText, /敌人会随剧情自动出现/)
  assert.doesNotMatch(emptyText, /工坊|节点包/)
  assert.equal(emptyView.registrations.panel.title, '战斗')
  assert.equal(emptyView.elements.filter(item => item.props.className?.includes('stg-generation-model')).length, 1, 'all generation tasks share one visible picker')
  assert.match(emptyText, /AI编辑角色、敌人生成与战果概括共用/)
  assert.doesNotMatch(emptyText, /敌人生成模型|角色与背包生成模型/)
  assert.equal(emptyView.registrations.marker.pattern.global, true)
  assert(emptyView.calls.every(call => call.name !== 'callHost'), 'state is requested through the state route, not a fictitious callHost route')
  assert(emptyView.calls.some(call => call.name === 'state'))

  const view = await mount({ state: snapshot })
  const text = view.elements.map(item => item.text).join('')
  assert.match(text, /AI读取并生成角色和背包/)
  assert.match(text, /主角/)
  assert.doesNotMatch(text, /工坊|节点包/)
  assert.equal(view.registrations.panel.title, '战斗')
  assert.equal(view.registrations.marker.pattern.global, true)
  assert(view.calls.every(call => call.name !== 'callHost'))

  await view.select('fantasy')
  const selectTicket = view.calls.find(call => call.name === 'select-pack').args
  assert.deepEqual({ turn: selectTicket.turn, textVersion: selectTicket.textVersion, baseRevision: selectTicket.baseRevision },
    { turn: 12, textVersion: 'text-12', baseRevision: 9 })

  const save = view.elements.find(item => item.type === 'button' && item.text === '保存')
  assert(save, `party card offers a compact save button; buttons: ${view.elements.filter(item => item.type === 'button').map(item => item.text).join(', ')}`)
  await save.props.onClick()
  await view.settle()
  const saveTicket = view.calls.find(call => call.name === 'save-party').args
  assert.deepEqual({ turn: saveTicket.turn, textVersion: saveTicket.textVersion, baseRevision: saveTicket.baseRevision },
    { turn: 12, textVersion: 'text-12', baseRevision: 9 })
  assert.equal(saveTicket.party[0].skills[0].id, 'strike')

  const lockedView = await mount({ state: { ...snapshot, turnState: { turn: 12, textVersion: 'text-12', generating: true } } })
  assert.equal(lockedView.elements.find(item => item.type === 'select').props.disabled, true)
  assert.equal(lockedView.elements.find(item => item.type === 'button' && item.text === 'AI读取并生成角色和背包').props.disabled, true)
  assert.equal(lockedView.elements.find(item => item.type === 'button' && item.text === '保存').props.disabled, true)
})

test('one-click party generation sends selected sources and AI design stays an editable draft', async () => {
  const view = await mount({ state: snapshot, routes: {
    'generate-party': args => ({ ...snapshot, inventory: [{ id: 'healing-potion', name: '治疗药水', count: 2 }], nonCombatInventory: [{ name: '旧徽章', description: '剧情道具', count: 1 }] }),
    'design-actor': args => ({ actor: { ...actor, name: '星火术士', skills: [{ name: '星火', sourceDescription: '造成火焰伤害' }] }, warnings: ['技能效果待检查'] }),
  } })
  const worldbook = view.elements.filter(item => item.type === 'input' && item.props.type === 'checkbox')[2]
  worldbook.props.onChange({ target: { checked: true } })
  const history = view.elements.find(item => item.type === 'input' && item.props.type === 'number' && item.props.min === 0 && item.props.max === 20)
  history.props.onChange({ target: { value: '9' } })
  const ledger = view.elements.find(item => item.type === 'textarea' && item.props.maxLength === 4000)
  ledger.props.onChange({ target: { value: '本世界的公会设定' } })
  await view.settle()
  await view.click('AI读取并生成角色和背包')
  const generated = view.calls.find(call => call.name === 'generate-party')
  assert.deepEqual(structuredClone(generated.args.sourceOptions), { useContext: true, useMvu: true, useWorldbook: true, useLedger: false, historyRounds: 9, ledgerText: '本世界的公会设定' })
  assert.deepEqual({ turn: generated.args.turn, textVersion: generated.args.textVersion, baseRevision: generated.args.baseRevision }, { turn: 12, textVersion: 'text-12', baseRevision: 9 })
  assert(view.elements.some(item => item.type === 'div' && item.text.includes('治疗药水 ×2')))
  assert(!view.elements.some(item => item.type === 'div' && item.text.includes('旧徽章 ×1')))

  const requirements = view.elements.find(item => item.type === 'textarea' && item.props.maxLength === 2000)
  requirements.props.onChange({ target: { value: '使用火焰法术，擅长远程输出' } })
  await view.settle()
  await view.click('AI 设计本角色草稿')
  const design = view.calls.find(call => call.name === 'design-actor')
  assert.equal(design.args.gameId, 'g-1', 'single-character design identifies the current game route')
  assert.equal(design.args.actorId, actor.id)
  assert.equal(design.args.requirements, '使用火焰法术，擅长远程输出')
  assert.deepEqual({ turn: design.args.turn, textVersion: design.args.textVersion, baseRevision: design.args.baseRevision }, { turn: 12, textVersion: 'text-12', baseRevision: 9 })
  assert.equal(view.elements.find(item => item.type === 'input' && item.props.maxLength === 40).props.value, '星火术士', 'design response populates the local draft')
  assert.equal(view.calls.filter(call => call.name === 'save-party').length, 0, 'AI design is not saved until the user presses 保存')
  assert.match(view.elements.map(item => item.text).join(''), /技能效果待检查/)
})

test('a failed character design retries only that actor in compact mode and saves only its card', async () => {
  let attempts = 0
  const view = await mount({ state: snapshot, routes: {
    'design-actor': args => {
      attempts++
      if (attempts === 1) throw Object.assign(new Error('模型连接中断，已保留原数据。'), { code: 'MODEL_INTERRUPTED' })
      return { actor: { ...actor, name: '星火术士', skills: [{ name: '星火', sourceDescription: '造成火焰伤害' }] }, warnings: [] }
    },
    'save-party': args => ({ ...snapshot, party: args.party }),
  } })
  const requirements = view.elements.find(item => item.type === 'textarea' && item.props.maxLength === 2000)
  requirements.props.onChange({ target: { value: '擅长远程火焰法术' } })
  await view.settle()
  await view.click('AI 设计本角色草稿')
  assert(view.elements.some(item => item.type === 'button' && item.text === '重试精简设计本角色'))
  assert(!view.elements.some(item => item.type === 'button' && item.text.includes('重试精简生成队友和背包')))
  assert.equal(view.elements.find(item => item.type === 'input' && item.props.maxLength === 40).props.value, '主角', 'a failed response leaves the current draft intact')
  assert.equal(view.calls.filter(call => call.name === 'generate-party').length, 0, 'character retry never regenerates the team or bag')

  await view.click('重试精简设计本角色')
  const designs = view.calls.filter(call => call.name === 'design-actor')
  assert.equal(designs.length, 2)
  assert.deepEqual(designs.map(call => ({ actorId: call.args.actorId, compact: call.args.compact, requirements: call.args.requirements })), [
    { actorId: 'hero', compact: false, requirements: '擅长远程火焰法术' },
    { actorId: 'hero', compact: true, requirements: '擅长远程火焰法术' },
  ])
  assert.equal(view.elements.find(item => item.type === 'input' && item.props.maxLength === 40).props.value, '星火术士')
  assert.equal(view.calls.filter(call => call.name === 'save-party').length, 0, 'the generated result remains a draft')
  await view.click('保存')
  const saved = view.calls.find(call => call.name === 'save-party')
  assert.equal(saved.args.party.length, 1)
  assert.equal(saved.args.party[0].name, '星火术士')
})

test('manual start and custom pack import carry the current timeline ticket', async () => {
  const imported = { schemaVersion: 1, kind: 'dsh-battle-pack', id: 'my-world', name: '我的世界', basePack: 'fantasy', party: [], opponents: [], skillAliases: [] }
  const view = await mount({ state: snapshot, routes: {
    'import-pack': args => ({ ...snapshot, packs: [...snapshot.packs, { id: imported.id, name: imported.name }], selectedPackId: imported.id, revision: 10 }),
    'manual-start': args => ({ ...snapshot, battle: { ...activeBattle, id: 'manual-1', demo: true }, turnState: snapshot.turnState }),
  } })
  const packInput = view.elements.find(item => item.type === 'input' && item.props.type === 'file' && item.props.accept.includes('application/json'))
  assert(packInput)
  await packInput.props.onChange({ target: { files: [{ size: 120, name: 'my-world.json', text: async () => JSON.stringify(imported) }], value: 'my-world.json' } })
  await view.settle()
  const packCall = view.calls.find(call => call.name === 'import-pack')
  assert.deepEqual({ turn: packCall.args.turn, textVersion: packCall.args.textVersion, baseRevision: packCall.args.baseRevision, pack: structuredClone(packCall.args.pack) },
    { turn: 12, textVersion: 'text-12', baseRevision: 9, pack: imported })
  const battleDescription = view.elements.find(item => item.type === 'textarea' && item.props.placeholder?.includes('山贼*3'))
  battleDescription.props.onChange({ target: { value: '盗匪 | 短刀、格挡' } })
  await view.settle()
  await view.click('开始手动战斗')
  const startCall = view.calls.find(call => call.name === 'manual-start')
  assert.deepEqual({ turn: startCall.args.turn, textVersion: startCall.args.textVersion, baseRevision: startCall.args.baseRevision,
    battleText: startCall.args.battleText, injectStory: startCall.args.injectStory },
  { turn: 12, textVersion: 'text-12', baseRevision: 10, battleText: '盗匪 | 短刀、格挡', injectStory: false })
})

test('decision and encounter difficulty save independently, AI model options stay passive and save with a ticket', async () => {
  const difficulties = [
    { id: 'easy', name: '容易' }, { id: 'normal', name: '中等' }, { id: 'hard', name: '困难' },
    { id: 'expert', name: '极难' }, { id: 'hell', name: '地狱' }, { id: 'ai', name: 'AI决策' },
  ]
  const encounterDifficulties = [{ id: 'low', name: '低' }, { id: 'medium', name: '中' }, { id: 'high', name: '高' }]
  let current = { ...snapshot, difficulty: 'normal', encounterDifficulty: 'medium', difficulties, encounterDifficulties, aiModel: { provider: 'demo', model: 'one', reasoningEffort: 'medium' } }
  const view = await mount({ state: current, routes: {
    'select-options': args => {
      current = { ...current, ...args, revision: current.revision + 1 }
      return current
    },
    'model-options': args => ({
      providers: [{ provider: 'gateway', providerName: '统一接口', models: [{ id: 'm1', name: '模型一' }, { id: 'm2', name: '模型二' }] }],
      selection: { provider: args.provider || 'gateway', model: args.model || 'm1', reasoningEffort: 'medium' },
      efforts: [{ id: 'low', name: '低' }, { id: 'medium', name: '中' }, { id: 'high', name: '高' }], preparationAvailable: true,
    }),
  } })
  assert(!view.calls.some(call => call.name === 'model-options'), 'model options are not requested before AI decision mode')
  const storyUpdateLabel = view.elements.find(item => item.type === 'label' && item.text.includes('数值随正文更新'))
  const storyUpdate = storyUpdateLabel.children.find(item => item?.type === 'input')
  assert.equal(storyUpdate.props.checked, false)
  storyUpdate.props.onChange({ target: { checked: true } })
  await view.settle()
  const updateCall = view.calls.filter(call => call.name === 'select-options').at(-1)
  assert.deepEqual({ autoStoryUpdate: updateCall.args.autoStoryUpdate, turn: updateCall.args.turn, textVersion: updateCall.args.textVersion, baseRevision: updateCall.args.baseRevision },
    { autoStoryUpdate: true, turn: 12, textVersion: 'text-12', baseRevision: 9 })
  const selects = () => view.elements.filter(item => item.type === 'select')
  selects().find(select => select.props.value === 'medium').props.onChange({ target: { value: 'high' } })
  await view.settle()
  const encounterCall = view.calls.filter(call => call.name === 'select-options').at(-1)
  assert.deepEqual({ difficulty: encounterCall.args.difficulty, encounterDifficulty: encounterCall.args.encounterDifficulty, baseRevision: encounterCall.args.baseRevision },
    { difficulty: 'normal', encounterDifficulty: 'high', baseRevision: 10 })
  selects().find(select => select.props.value === 'normal').props.onChange({ target: { value: 'ai' } })
  await view.settle()
  await view.settle()
  assert(view.calls.some(call => call.name === 'model-options'), 'AI mode loads available providers, models, and advertised effort levels')
  const provider = selects().find(select => /统一接口/.test(select.text))
  assert.match(provider.text, /统一接口/)
  provider.props.onChange({ target: { value: 'gateway' } })
  await view.settle()
  await view.settle()
  const model = selects().find(select => /模型二/.test(select.text))
  assert.match(model.text, /模型二/)
  model.props.onChange({ target: { value: 'm2' } })
  await view.settle()
  await view.settle()
  const effort = selects().find(select => select.props.value === 'medium' && /模型默认/.test(select.text))
  assert.match(effort.text, /高/)
  effort.props.onChange({ target: { value: 'high' } })
  await view.settle()
  await view.click('保存 AI 模型')
  const aiSave = view.calls.filter(call => call.name === 'select-options').at(-1)
  assert.deepEqual(structuredClone(aiSave.args.aiModel), { provider: 'gateway', model: 'm2', reasoningEffort: 'high' })
  assert.equal(aiSave.args.difficulty, 'ai')
  assert.equal(aiSave.args.encounterDifficulty, 'high')
  assert.equal(aiSave.args.baseRevision, current.revision - 1)
  await view.unmount()
})

test('battle uses active indexes, switches living bench members, and cues every response event', async () => {
  let currentBattle = activeBattle
  const stateView = () => ({ ...snapshot, turnState: { turn: 12, textVersion: 'text-12' }, battle: currentBattle })
  const view = await mount({ state: { ...snapshot, battle: activeBattle }, routes: {
    'battle-state': () => stateView(),
    'battle-act': args => {
      const action = args.action.commands[0]
      currentBattle = action.type === 'switch'
        ? { ...currentBattle, activePlayer: action.index, activePlayers: [action.index], seq: 5, events: [{ kind: 'use', actorSide: 'player' }, { kind: 'damage', targetSide: 'enemy' }] }
        : { ...currentBattle, activePlayer: 0, activePlayers: [0], seq: 6, events: [{ kind: 'use', actorSide: 'enemy' }, { kind: 'damage', targetSide: 'player' }] }
      return stateView()
    },
  } })
  await view.click('返回战斗')
  const overlay = view.registrations.overlay
  assert(overlay, 'demo start opens the full-screen battle')
  const battleElement = overlay.render({ gameId: 'g-1', close() {} })
  assert.equal(battleElement.type.name, 'BattleGate')
  assert.equal(battleElement.props.initial.battle.id, 'b-1')
  view.renderElement(battleElement)
  await view.settle()
  const sceneText = view.elements.map(item => item.text).join('')
  assert.match(sceneText, /战士乙/)
  assert.match(sceneText, /敌人乙/)
  assert.doesNotMatch(sceneText, /战士甲/)
  assert.match(sceneText, /横斩|猛击/, 'default fight command keeps the skill panel visible')
  assert.equal(view.elements.find(item => item.type === 'button' && item.text === '战斗').props['aria-expanded'], true)
  assert.equal(view.elements.filter(item => item.type === 'img' && /\/human\/sprite\/defaults\/[a-z-]+-actions-v1\.png$/.test(item.props.src)).length, 2,
    'allies and enemies load their selected built-in 4×4 action sheets')
  await view.click('背包')
  assert(view.elements.some(item => item.type === 'button' && item.text === '给 战士乙'), 'items target a living actor')
  await view.click('换人')
  const switchButton = view.elements.find(item => item.type === 'button' && item.text === '换上 战士甲')
  assert(switchButton, 'living reserve can be chosen directly')
  await switchButton.props.onClick()
  await view.settle()
  assert.equal(view.calls.filter(call => call.name === 'battle-act').length, 0, 'selection does not run combat')
  await view.click('确认本回合')
  const switchAction = view.calls.filter(call => call.name === 'battle-act').at(-1).args
  assert.deepEqual({ turn: switchAction.turn, textVersion: switchAction.textVersion, battleId: switchAction.battleId, seq: switchAction.seq, action: structuredClone(switchAction.action) },
    { turn: 12, textVersion: 'text-12', battleId: 'b-1', seq: 4, action: { type: 'round', commands: [{ type: 'switch', actorIndex: 1, index: 0 }] } })
  assert.match(view.elements.map(item => item.text).join(''), /战士甲/, 'HUD follows numeric activePlayer index after switch')
  await view.click('战斗')
  const skill = view.elements.find(item => item.type === 'button' && item.text.includes('横斩'))
  assert(skill, 'skills now belong to the newly active index')
  await skill.props.onClick()
  await view.settle()
  await view.click('确认本回合')
  assert(view.elements.some(item => item.type === 'button' && item.text.includes('横斩')), 'skill panel stays visible after an action')
  assert.equal(view.elements.find(item => item.type === 'button' && item.text === '战斗').props['aria-expanded'], true)
  const skillAction = view.calls.filter(call => call.name === 'battle-act').at(-1).args
  assert.deepEqual({ turn: skillAction.turn, textVersion: skillAction.textVersion, battleId: skillAction.battleId, seq: skillAction.seq },
    { turn: 12, textVersion: 'text-12', battleId: 'b-1', seq: 5 })
  const hitSounds = () => view.audios.filter(audio => audio.src.endsWith('/human/audio/hit.wav'))
  const attackSounds = () => view.audios.filter(audio => audio.src.endsWith('/human/audio/attack.wav'))
  assert.equal(hitSounds().length, 2, 'both the two-event and shorter one-event response play their hit cues')
  assert.equal(attackSounds().length, 2, 'each response independently plays its use cue')
  view.renderElement(overlay.render({ gameId: 'g-1', close() {} }))
  await view.settle()
  assert.equal(hitSounds().length, 2, 'rerendering the same battle sequence does not replay its cue')
  await view.unmount()
  assert(view.audios.every(audio => audio.paused), 'overlay cleanup pauses music and effects')
})

test('same-frame battle action clicks are single-flight and settle after overlay unmount', async () => {
  let resolveAction
  const deferredAction = new Promise(resolve => { resolveAction = resolve })
  const view = await mount({ state: { ...snapshot, battle: activeBattle }, routes: {
    'battle-act': () => deferredAction,
  } })
  await view.click('返回战斗')
  const overlay = view.registrations.overlay
  view.renderElement(overlay.render({ gameId: 'g-1', close() {} }))
  await view.settle()

  const skill = view.elements.find(item => item.type === 'button' && item.text.includes('猛击'))
  assert(skill, 'active actor skill is available')
  skill.props.onClick(); await view.settle()
  const confirm = view.elements.find(item => item.type === 'button' && item.text === '确认本回合')
  const first = confirm.props.onClick()
  const second = confirm.props.onClick()
  assert.equal(view.calls.filter(call => call.name === 'battle-act').length, 1,
    'the action lock prevents a second same-frame host call before busy state rerenders')

  await view.unmount()
  resolveAction({ ...snapshot, battle: activeBattle })
  const settled = await Promise.race([
    Promise.all([first, second]).then(() => true),
    new Promise(resolve => setTimeout(() => resolve(false), 500)),
  ])
  assert.equal(settled, true, 'both event handler promises finish after the pending host response resolves')
})

test('demo stays out of plot and read-only battles disable combat controls', async () => {
  const demo = { ...activeBattle, demo: true, outcome: { winner: 'player', reason: '演示结束' } }
  const demoView = await mount({ state: snapshot, routes: {
    'demo-start': () => ({ ...snapshot, turnState: { turn: 12, textVersion: 'text-12' }, battle: demo }),
  } })
  await demoView.click('本地演示')
  const demoOverlay = demoView.registrations.overlay
  demoView.renderElement(demoOverlay.render({ gameId: 'g-1', close() {} }))
  await demoView.settle()
  const demoText = demoView.elements.filter(item => item.type !== 'style').map(item => item.text).join('')
  assert(!demoView.elements.some(item => item.type === 'button' && /^(生成战况|填入续写)$/.test(item.text)), 'practice has no story result buttons')
  assert(demoView.elements.some(item => item.type === 'button' && item.text === '返回'),
    `demo offers a return button; buttons: ${demoView.elements.filter(item => item.type === 'button').map(item => item.text).join(', ')}`)

  const readOnlyBattle = { ...activeBattle, readOnly: true }
  const lockedView = await mount({ state: { ...snapshot, battle: readOnlyBattle }, routes: {
    'battle-state': () => ({ ...snapshot, turnState: { turn: 12, textVersion: 'text-12', settling: true }, battle: readOnlyBattle }),
  } })
  await lockedView.click('返回战斗')
  const overlay = lockedView.registrations.overlay
  lockedView.renderElement(overlay.render({ gameId: 'g-1', close() {} }))
  await lockedView.settle()
  const battleToggle = lockedView.elements.find(item => item.type === 'button' && item.text === '战斗')
  assert(!battleToggle, 'read-only or settling battle never enables combat actions')
  assert(lockedView.elements.some(item => item.props.role === 'alert' && /正文或战斗已更新/.test(item.text)))
  await demoView.unmount()
  await lockedView.unmount()
})

test('field renders at most three actors per side and item commands use explicit field indexes', async () => {
  const roster = name => Array.from({ length: 6 }, (_, index) => ({ ...actor, id: `${name}-${index}`, name: `${name}${index + 1}` }))
  let battle = { ...activeBattle, activePlayer: 0, activeEnemy: 0, activePlayers: [0, 1, 2], activeEnemies: [0, 1, 2], party: roster('队友'), enemies: roster('敌人'),
    inventory: [{ id: 'healing-potion', name: '治疗药水', count: 1 }] }
  const stateView = () => ({ ...snapshot, battle, turnState: { turn: 2, textVersion: 'v2' } })
  const view = await mount({ state: stateView(), routes: {
    'battle-state': () => stateView(),
    'battle-act': args => { view.lastAction = args.action; return stateView() },
  } })
  await view.click('返回战斗')
  view.renderElement(view.registrations.overlay.render({ gameId: 'g-1', close() {} }))
  await view.settle()
  assert.equal(view.elements.filter(item => item.type === 'div' && item.props.className === 'stg-figure').length, 6)
  const sceneText = view.elements.map(item => item.text).join('')
  assert.match(sceneText, /队友1[\s\S]*队友2[\s\S]*队友3/)
  assert.doesNotMatch(sceneText, /队友4|敌人4/, 'reserves stay off the field')
  assert.doesNotMatch(sceneText, /治疗药水/, 'inventory details remain collapsed')
  await view.click('背包')
  const target = view.elements.find(item => item.type === 'button' && item.text === '给 队友3')
  assert(target)
  await target.props.onClick()
  await view.settle()
  assert.equal(view.calls.filter(call => call.name === 'battle-act').length, 0)
  for (let index = 1; index <= 2; index++) {
    await view.elements.find(item => item.type === 'button' && item.props['aria-pressed'] !== undefined && item.text.startsWith(`队友${index + 1}`)).props.onClick(); await view.settle()
    await view.elements.find(item => item.type === 'button' && item.text.includes('斩击')).props.onClick(); await view.settle()
  }
  await view.click('确认本回合')
  const action = view.calls.filter(call => call.name === 'battle-act').at(-1).args.action
  assert.equal(action.type, 'round')
  assert.deepEqual(structuredClone(action.commands[0]), { type: 'item', actorIndex: 0, itemId: 'healing-potion', targetIndex: 2 })
  assert.equal(action.commands.length, 3)
  await view.unmount()
})

test('invalid party edits are rejected without clamping or calling the host', async () => {
  const view = await mount({ state: snapshot, routes: {
    'save-party': async () => { throw new Error('保存失败') },
  } })
  const hpInput = view.elements.find(item => item.type === 'input' && item.props.type === 'number' && item.props.value === 50)
  assert(hpInput)
  hpInput.props.onChange({ target: { value: '120' } })
  await view.settle()
  const save = view.elements.find(item => item.type === 'button' && item.text === '保存')
  await save.props.onClick()
  await view.settle()
  assert(!view.calls.some(call => call.name === 'save-party'), 'out-of-range values are not silently rewritten and persisted')
  assert.match(view.elements.map(item => item.text).join(''), /HP 需在 0 至最大 HP 之间/)

  const correctedHp = view.elements.find(item => item.type === 'input' && item.props.type === 'number' && item.props.value === '120')
  correctedHp.props.onChange({ target: { value: '55' } })
  await view.settle()
  await view.elements.find(item => item.type === 'button' && item.text === '保存').props.onClick()
  await view.settle()
  const retainedHp = view.elements.find(item => item.type === 'input' && item.props.type === 'number' && item.props.value === '55')
  assert.equal(retainedHp.props.value, '55', 'host rejection preserves the unsaved draft')
  assert.match(view.elements.map(item => item.text).join(''), /保存失败/)
})

test('player AI summary choice fills the composer without sending a turn', async () => {
  const finished = { ...activeBattle, outcome: { winner: 'player', reason: '获胜' } }
  const view = await mount({ state: { ...snapshot, battle: finished }, routes: {
    'battle-state': () => ({ ...snapshot, battle: finished }),
    summary: () => ({ text: '队友击退了山匪。' }),
  } })
  await view.click('返回战斗')
  const overlay = view.registrations.overlay
  view.renderElement(overlay.render({ gameId: 'g-1', close() {} }))
  await view.settle()
  await view.click('生成战况')
  await view.click('填入续写')
  assert.equal(view.registrations.input.gameId, 'g-1')
  assert.equal(view.registrations.input.text, '\n\n队友击退了山匪。')
  assert.equal(view.submitInputCalls, 0, 'summary text is never submitted as a player turn')
  await view.unmount()
})

test('battle starts music on entry, avoids duplicate loops, and honors mute through later gestures', async () => {
  const view = await mount({ state: { ...snapshot, battle: activeBattle } })
  await view.click('返回战斗')
  view.renderElement(view.registrations.overlay.render({ gameId: 'g-1', close() {} })); await view.settle(); await view.settle()
  const loops = () => view.audios.filter(audio => audio.loop)
  assert.equal(loops().length, 1); assert.equal(loops()[0].paused, false)
  assert.equal(view.elements.find(item => item.props['aria-label'] === '战斗音乐').props['aria-pressed'], true)
  view.render(); await view.settle(); assert.equal(loops().length, 1)
  await view.click('音乐开'); assert.equal(loops()[0].paused, true)
  view.elements.find(item => item.props.className === 'stg stg-overlay').props.onPointerDownCapture({})
  await view.settle(); assert.equal(loops().length, 1, 'gestures do not override explicit mute')
  await view.click('音乐关'); assert.equal(loops().length, 2); assert.equal(loops()[1].paused, false)
  await view.unmount(); assert(loops().every(audio => audio.paused))
})

test('blocked autoplay is shown accurately and any battle gesture retries once; explicit music click does not toggle twice', async () => {
  const tracks = []
  class RestrictedAudio {
    constructor(src) { this.src = src; this.paused = true; tracks.push(this) }
    play() {
      if (tracks.length === 1) return Promise.reject(Object.assign(Error('gesture required'), { name: 'NotAllowedError' }))
      this.paused = false; return Promise.resolve()
    }
    pause() { this.paused = true }
  }
  const view = await mount({ state: { ...snapshot, battle: activeBattle }, globals: { Audio: RestrictedAudio } })
  await view.click('返回战斗')
  view.renderElement(view.registrations.overlay.render({ gameId: 'g-1', close() {} })); await view.settle(); await view.settle()
  let button = view.elements.find(item => item.props['aria-label'] === '战斗音乐')
  assert.equal(button.text, '开启音乐'); assert.equal(button.props['aria-pressed'], false)
  const overlay = () => view.elements.find(item => item.props.className === 'stg stg-overlay')
  overlay().props.onPointerDownCapture({ target: { closest: () => true } })
  assert.equal(tracks.length, 1, 'the music button owns its retry, rather than a double toggle')
  await view.click('开启音乐'); assert.equal(tracks.length, 2); assert.equal(tracks[1].paused, false)
  await view.click('音乐开')
  await view.click('音乐关')
  assert.equal(tracks.length, 3)
  // Simulate a policy rejection after an unrelated entry, then recover on a normal control.
  tracks[2].onerror(Object.assign(Error('gesture required'), { name: 'NotAllowedError' })); await view.settle()
  overlay().props.onKeyDownCapture({}); await view.settle()
  assert.equal(tracks.length, 4); assert.equal(tracks[3].paused, false)
  button = view.elements.find(item => item.props['aria-label'] === '战斗音乐'); assert.equal(button.text, '音乐开')
  await view.unmount(); assert(tracks.every(audio => audio.paused))
})


test('battle speed controls stay presentation-only and HP belongs to each rendered actor', async () => {
  const view = await mount({ state: { ...snapshot, battle: activeBattle } });
  await view.click('返回战斗');
  view.renderElement(view.registrations.overlay.render({ gameId: 'g-1', close() {} })); await view.settle();
  const speedTrigger = view.elements.find(item => item.type === 'button' && item.props['aria-label'] === '战斗倍速');
  assert(speedTrigger);
  assert.equal(view.elements.find(item => item.props.role === 'group' && item.props['aria-label'] === '战斗倍速选项'), undefined, 'speed choices start folded');
  speedTrigger.props.onClick(); await view.settle();
  const speed = view.elements.find(item => item.props.role === 'group' && item.props['aria-label'] === '战斗倍速选项');
  assert(speed);
  const speedButtons = view.elements.filter(item => item.type === 'button' && ['1×', '2×', '3×', '10×'].includes(item.text));
  assert.deepEqual(speedButtons.map(button => button.text), ['1×', '2×', '3×', '10×']);
  speedButtons.at(-1).props.onClick(); await view.settle();
  assert.equal(view.elements.find(item => item.props.role === 'group' && item.props['aria-label'] === '战斗倍速选项'), undefined, 'selecting a speed folds the choices');
  assert.match(view.elements.find(item => item.type === 'button' && item.props['aria-label'] === '战斗倍速').text, /10×/);
  assert.equal(view.elements.filter(item => item.props.className === 'stg-hudrow').length, 0);
  const figures = view.elements.filter(item => item.props.className === 'stg-figure');
  assert.equal(figures.length, 2);
  assert(figures.every(figure => figure.children.some(child => child?.type?.name === 'ActorHud')));
  assert(figures.every(figure => figure.props['data-frame'] === 3), 'default ready stance stays consistent instead of cycling idle poses');
  await view.click('战斗');
  await view.elements.find(item => item.type === 'button' && item.text.includes('猛击')).props.onClick();
  await view.settle(); await view.click('确认本回合');
  assert(!Object.hasOwn(view.calls.filter(call => call.name === 'battle-act').at(-1).args.action, 'speed'));
  await view.unmount();
});

test('legacy avatar fallback honors explicit human metadata and animal kind despite gender', async () => {
  const renderAvatar = async member => {
    const view = await mount({ state: { ...snapshot, battle: { ...activeBattle, activePlayers: [0], party: [{ ...actor, avatarId: undefined, ...member }] } } });
    await view.click('返回战斗'); view.renderElement(view.registrations.overlay.render({ gameId: 'g-1', close() {} })); await view.settle();
    const avatarId = view.elements.find(item => item.props.className === 'stg-figure' && item.props['data-avatar'] !== undefined).props['data-avatar'];
    await view.unmount();
    return avatarId;
  };
  const human = await renderAvatar({ id: 'legacy-human-fox', name: '银狐', species: 'human', kind: 'human' });
  assert(!['silver-wolf', 'ember-fox', 'snow-tiger', 'raven-scout'].includes(human), 'explicit human metadata wins over an animal-like nickname');
  const animal = await renderAvatar({ id: 'legacy-male-animal', name: '灵兽', species: 'unknown-beast', kind: 'animal', gender: 'male' });
  assert(['silver-wolf', 'ember-fox', 'snow-tiger', 'raven-scout', 'azure-eastern-dragon', 'western-dragon', 'qilin', 'xuanwu', 'forest-fae', 'phoenix', 'pegasus', 'griffin', 'unicorn', 'nine-tail-fox', 'thunderbird', 'sea-serpent'].includes(animal), 'gender does not empty the expanded animal avatar pool');
  for (const [name, expected] of [['蝎子', 'desert-scorpion'], ['熊', 'wild-bear'], ['lion', 'savanna-lion'], ['lizard', 'giant-lizard']]) {
    assert.equal(await renderAvatar({ id: 'legacy-' + expected, name }), expected, 'legacy names match the new animal roster');
  }
});

test('a settled story offers an entry and opens the scene only after an explicit click', async () => {
  const story = { ...activeBattle, id: 'story-fixture', turn: 12, textVersion: 'text-12' };
  const view = await mount({ state: { ...snapshot, battle: story } });
  const marker = () => view.registrations.marker.render({ gameId: 'g-1', turn: 12, streaming: false, match: '决斗' });
  view.renderElement(marker()); await view.settle();
  assert.equal(view.registrations.overlayCount, undefined, 'settlement never steals the reading screen');
  assert(view.elements.some(item => item.type === 'button' && item.text === '继续战斗'));
  await view.click('继续战斗');
  assert.equal(view.registrations.overlayCount, 1);
  view.renderElement(marker()); await view.settle();
  await view.click('继续战斗');
  assert.equal(view.registrations.overlayCount, 1);
  view.registrations.overlay.onClose();
  await view.click('继续战斗');
  assert.equal(view.registrations.overlayCount, 2, 'closing the scene leaves the story entry reusable');
  await view.unmount();
  const streaming = await mount({ state: { ...snapshot, battle: story } });
  streaming.renderElement(streaming.registrations.marker.render({ gameId: 'g-1', turn: 12, streaming: true })); await streaming.settle();
  assert.equal(streaming.registrations.overlayCount, undefined); await streaming.unmount();
  const old = await mount({ state: { ...snapshot, battle: story } });
  old.renderElement(old.registrations.marker.render({ gameId: 'g-1', turn: 11, streaming: false })); await old.settle();
  assert.equal(old.registrations.overlayCount, undefined); await old.unmount();
});

test('several fight words keep the prose and share one clickable story entry', async () => {
  const story = { ...activeBattle, id: 'story-words', seq: 0, turn: 12, textVersion: 'text-12' };
  const view = await mount({ state: { ...snapshot, battle: story } });
  view.renderElement(['决斗', '战斗', '迎战'].map(match => view.registrations.marker.render({ gameId: 'g-1', turn: 12, streaming: false, match })));
  await view.settle();
  assert.equal(view.elements.filter(item => item.props['aria-label'] === '剧情战斗入口').length, 1);
  assert.equal(view.elements.filter(item => item.type === 'button' && item.text === '进入战斗').length, 1);
  assert.equal(view.registrations.overlayCount, undefined);
  const text = view.elements.filter(item => item.props.className === 'stg-story-marker').map(item => item.text).join('');
  for (const word of ['决斗', '战斗', '迎战']) assert(text.includes(word));
  view.emitHead({ turn: 13, textVersion: 'text-13', settled: true }); await view.settle();
  assert(!view.elements.some(item => item.props['aria-label'] === '剧情战斗入口'), 'old turn entries disappear on timeline advance');
});

test('a stale entry cannot open a different battle after the story advances', async () => {
  const story = { ...activeBattle, id: 'story-old-entry', turn: 12, textVersion: 'text-12' };
  let current = { ...snapshot, battle: story };
  const view = await mount({ state: current, routes: { 'battle-state': () => current } });
  view.renderElement(view.registrations.marker.render({ gameId: 'g-1', turn: 12, streaming: false, match: '决斗' })); await view.settle();
  current = { ...current, turnState: { turn: 13, textVersion: 'text-13', settled: true }, battle: { ...story, id: 'story-another', turn: 13, textVersion: 'text-13' } };
  await view.click('继续战斗');
  assert.equal(view.registrations.overlayCount, undefined);
  assert(view.elements.some(item => item.props.role === 'alert' && /正文已更新/.test(item.text)));
  assert(!view.calls.some(call => call.name === 'battle-act'));
});

test('the loading gate remains cancelable and rejects a battle changed while preparing', async () => {
  let resolveCurrent, defer = false;
  const pending = new Promise(resolve => { resolveCurrent = resolve });
  const view = await mount({ state: { ...snapshot, battle: activeBattle }, routes: { 'battle-state': () => defer ? pending : { ...snapshot, battle: activeBattle } } });
  await view.click('返回战斗');
  defer = true;
  view.renderElement(view.registrations.overlay.render({ gameId: 'g-1', close() {} })); await view.settle();
  assert(view.elements.some(item => item.props['aria-label'] === '准备战斗场景'));
  assert(view.elements.some(item => item.type === 'button' && item.text === '返回正文'));
  assert(!view.elements.some(item => item.props.className === 'stg-figure'));
  resolveCurrent({ ...snapshot, battle: { ...activeBattle, id: 'replacement-battle' } }); await view.settle();
  assert(view.elements.some(item => item.props.role === 'alert' && /正文或战斗已更新/.test(item.text)));
  assert(!view.elements.some(item => item.props.className === 'stg-figure'));
  assert.equal(view.audios.length, 0);
});

const appearanceRig = { schemaVersion: 1, columns: 4, rows: 4, fps: 8, clips: { idle: [3], attack: [3, 4, 5, 7], kick: [3, 4, 6, 7], cast: [8, 9, 7], hit: [11, 7], guard: [10], dodge: [12, 7], down: [13], victory: [14, 15] } }
const pngHeader = Buffer.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,4,0,0,0,4])
const appearancePackage = () => ({ kind: 'dsh-battle-appearance', schemaVersion: 1, name: '测试剑客', texture: { mimeType: 'image/png', data: pngHeader.toString('base64') }, rig: structuredClone(appearanceRig) })
const imageGlobals = { Blob, URL, atob, createImageBitmap: async () => ({ width: 4, height: 4, close() {} }) }
const fileEvent = value => ({ target: { value: 'test.json', files: [{ name: 'test.json', size: JSON.stringify(value).length, text: async () => JSON.stringify(value) }] } })
const appearanceInput = view => view.elements.find(item => item.props['aria-label'] === '导入完整外观包（含动作）')

test('appearance package validates PNG and bounded clips before replacing resources, and reports memory fallback', async () => {
  const view = await mount({ state: { ...snapshot, battle: { ...activeBattle, activePlayers: [0], party: [actor] } }, globals: imageGlobals })
  const badCases = [
    { ...appearancePackage(), texture: { mimeType: 'image/svg+xml', data: 'PHN2Zz4=' } },
    { ...appearancePackage(), texture: { mimeType: 'image/png', data: 'https://example.com/image.png' } },
    { ...appearancePackage(), texture: { mimeType: 'image/png', data: Buffer.from('<script>alert(1)</script>').toString('base64') } },
    { ...appearancePackage(), rig: { ...appearanceRig, clips: { idle: [16] } } },
    { ...appearancePackage(), rig: { ...appearanceRig, clips: { idle: [3], eval: [0] } } },
  ]
  for (const invalid of badCases) {
    await appearanceInput(view).props.onChange(fileEvent(invalid)); await view.settle()
    assert(!view.elements.some(item => item.props.className === 'stg-appearance-preview'))
  }
  const oversized = fileEvent(appearancePackage()); oversized.target.files[0].size = 16 * 1024 * 1024 + 1
  await appearanceInput(view).props.onChange(oversized); await view.settle()
  assert.match(view.elements.filter(item => item.props.role === 'status').map(item => item.text).join(''), /不能超过 16 MB/)
  await appearanceInput(view).props.onChange(fileEvent(appearancePackage())); await view.settle()
  assert.match(view.elements.filter(item => item.props.role === 'status').map(item => item.text).join(''), /已临时导入.*关闭页面后需重新导入/)
  assert(view.elements.some(item => item.props['aria-label'] === '测试剑客动作预览'))
  await view.click('返回战斗')
  view.renderElement(view.registrations.overlay.render({ gameId: 'g-1', close() {} })); await view.settle()
  const figure = view.elements.find(item => item.props.className === 'stg-figure' && item.props['data-avatar'] === 'imported')
  assert(figure, 'imported character texture overrides its default')
  assert.equal(figure.props['data-frame'], 3)
  assert(!view.calls.some(call => /save|import/.test(call.name)), 'appearance imports stay in browser storage')
  await view.unmount()
})

test('appearance PNG and rig save in one transaction; scene and appearance survive a fresh client load', async () => {
  const storage = new Map(), writes = []
  const db = { transaction(_store, mode) {
    const transaction = { objectStore: () => ({
      put(value, key) { storage.set(key, value); transaction.keys.push(key); queueMicrotask(() => transaction.oncomplete?.()) },
      get(key) { const request = {}; queueMicrotask(() => { request.result = storage.get(key); request.onsuccess?.() }); return request },
    }), keys: [] }
    if (mode === 'readwrite') writes.push(transaction.keys)
    return transaction
  } }
  const indexedDB = { open() { const request = {}; queueMicrotask(() => { request.result = db; request.onsuccess?.() }); return request } }
  const state = { ...snapshot, battle: { ...activeBattle, activePlayers: [0], party: [actor] } }
  const view = await mount({ state, globals: { ...imageGlobals, indexedDB } })
  await appearanceInput(view).props.onChange(fileEvent(appearancePackage())); await view.settle()
  assert.deepEqual(writes[0], ['g-1:hero:texture', 'g-1:hero:rig'])
  const sceneInput = view.elements.find(item => item.props['aria-label'] === '导入场景图片')
  await sceneInput.props.onChange({ target: { value: 'scene.png', files: [new Blob([pngHeader], { type: 'image/png' })] } }); await view.settle()
  assert(storage.get('g-1:scene') instanceof Blob)
  await view.unmount()
  const reloaded = await mount({ state, globals: { ...imageGlobals, indexedDB } })
  await reloaded.click('返回战斗')
  reloaded.renderElement(reloaded.registrations.overlay.render({ gameId: 'g-1', close() {} })); await reloaded.settle()
  assert(reloaded.elements.some(item => item.props.className === 'stg-figure' && item.props['data-avatar'] === 'imported'))
  assert.match(reloaded.elements.find(item => item.props.className === 'stg-scene').props.style.backgroundImage, /^url\("blob:/)
  assert(reloaded.elements.some(item => item.props.className === 'stg-sheet' && item.props.src.startsWith('blob:')))
  await reloaded.unmount()
})

test('scene import rejects SVG and a false raster signature without replacing the scene', async () => {
  const view = await mount({ state: snapshot, globals: imageGlobals })
  for (const file of [new Blob(['<svg/>'], { type: 'image/svg+xml' }), new Blob(['<svg/>'], { type: 'image/png' })]) {
    const input = view.elements.find(item => item.props['aria-label'] === '导入场景图片')
    await input.props.onChange({ target: { value: 'unsafe.svg', files: [file] } }); await view.settle()
    assert.match(view.elements.filter(item => item.props.role === 'status').map(item => item.text).join(''), /请选择|内容与文件类型不符/)
  }
  const scrollRoot = view.elements.find(item => item.props['data-testid'] === 'battle-setup-scroll')
  assert.match(scrollRoot.props.className, /stg-setup/)
  assert.match(source, /\.stg\.stg-setup\{[^}]*min-height:0[^}]*overflow-y:auto[^}]*touch-action:pan-y/)
  assert(view.elements.some(item => item.type === 'summary' && item.text === '单独导入图片 / 动作（高级）'))
  await view.unmount()
})

test('default avatar IDs are whitelisted, gender fallback is stable, and one failed atlas leaves others intact', async () => {
  const party = [
    { ...actor, id: 'jade', avatarId: 'jade-swordsman', gender: 'male' },
    { ...actor, id: 'iron', avatarId: 'iron-guardian', gender: 'male' },
    { ...actor, id: 'unknown', avatarId: '../../remote', gender: 'female' },
  ]
  const view = await mount({ state: { ...snapshot, battle: { ...activeBattle, party, activePlayers: [0, 1, 2] } } })
  await view.click('返回战斗'); view.renderElement(view.registrations.overlay.render({ gameId: 'g-1', close() {} })); await view.settle()
  const before = view.elements.filter(item => item.props.className === 'stg-figure').map(item => item.props['data-avatar'])
  assert.deepEqual(before.slice(0, 2), ['jade-swordsman', 'iron-guardian'])
  assert(['crimson-duelist', 'frost-mage', 'forest-ranger', 'moonlit-spear-guard', 'ember-gunslinger', 'azure-healer', 'clockwork-knight', 'desert-falconer', 'star-oracle',
    'scarlet-sorceress', 'frost-archer', 'lotus-dancer', 'violet-assassin', 'sun-priestess', 'jade-lancer'].includes(before[2]), 'legacy female actors select from the expanded human female pool')
  const jade = view.elements.find(item => item.props.className === 'stg-sheet' && item.props.src.includes('jade-swordsman'))
  jade.props.onError(); await view.settle()
  assert(view.elements.some(item => item.props.className === 'stg-sheet' && item.props.src.includes('iron-guardian')))
  assert(view.elements.some(item => item.props.className === 'stg-sheet' && item.props.src.endsWith('/adventurer-male-actions-v1.png')))
  assert.deepEqual(view.elements.filter(item => item.props.className === 'stg-figure').map(item => item.props['data-avatar']), before)
  await view.unmount()
})

test('正文标记也认没有标签的 enemies 对象，并整段替换掉', () => {
  const line = source.split('\n').find(text => text.includes('pattern: /<dsh_battle>'))
  assert.ok(line, 'text marker pattern is present')
  const literal = line.slice(line.indexOf('pattern: ') + 'pattern: '.length).replace(/,\s*$/, '')
  const pattern = new RegExp(literal.slice(1, literal.lastIndexOf('/')), 'g')
  const bare = '他合眼。\n\n{"enemies":[{"name":"无名牌铺主","level":6,"skills":[{"name":"锁牌指"}]},{"name":"牌铺伙计","level":4}]}\n\n下一段。'
  const hits = bare.match(pattern)
  assert.equal(hits.length, 1)
  assert.doesNotThrow(() => JSON.parse(hits[0]), 'the matched slice is the whole object')
  assert.equal(JSON.parse(hits[0]).enemies.length, 2)
  assert.equal('他走进洞府，把门掩死。'.match(pattern), null)
  assert.equal('他说「enemies」这词听着就外行。'.match(pattern), null)
  assert.equal('<dsh_battle>{"enemies":[]}</dsh_battle>'.match(pattern)?.length, 1)
})

test('actor type and skill power edits save through the party route without starting combat', async () => {
  const current = { ...snapshot, elementCatalog: [
    { id: 'neutral', name: '无属性' }, { id: 'fire', name: '火' }, { id: 'water', name: '水' }, { id: 'nature', name: '木 / 自然' },
  ], party: [{ ...actor, types: ['fire'], skills: [{ ...actor.skills[0], element: 'fire', power: 72 }] }] }
  const view = await mount({ state: current })
  const setSelect = async (ariaLabel, value) => {
    const select = view.elements.find(item => item.type === 'select' && item.props['aria-label'] === ariaLabel)
    assert(select, `missing select ${ariaLabel}`)
    await select.props.onChange({ target: { value } }); await view.settle()
  }
  await setSelect('角色主属性', 'water')
  await setSelect('角色副属性', 'nature')
  await setSelect('技能1属性', 'fire')
  const power = view.elements.find(item => item.type === 'input' && item.props['aria-label'] === '技能1威力')
  assert(power); power.props.onChange({ target: { value: '108' } }); await view.settle()
  await view.click('保存')

  const saved = view.calls.find(call => call.name === 'save-party')
  assert(saved, 'saving the edited card reaches the host')
  assert.deepEqual(structuredClone(saved.args.party[0].types), ['water', 'nature'])
  assert.equal(saved.args.party[0].skills[0].element, 'fire')
  assert.equal(saved.args.party[0].skills[0].power, 108)
  assert.deepEqual({ turn: saved.args.turn, textVersion: saved.args.textVersion, baseRevision: saved.args.baseRevision },
    { turn: 12, textVersion: 'text-12', baseRevision: 9 })
  assert.equal(view.calls.some(call => call.name === 'battle-act'), false, 'editing and saving actor data does not start or mutate a battle')
})

test('battle skill matchup follows the selected target and stays a queued local choice until round confirmation', async () => {
  const elements = [{ id: 'neutral', name: '无属性' }, { id: 'fire', name: '火' }, { id: 'nature', name: '木 / 自然' }, { id: 'water', name: '水' }]
  const battle = { ...activeBattle, activePlayers: [0], activeEnemies: [0, 1], activePlayer: 0, activeEnemy: 0,
    party: [{ ...actor, types: ['fire'], skills: [{ id: 'fireball', name: '火球', element: 'fire', power: 90, usesLeft: 2, cooldownLeft: 0 }] }],
    enemies: [
      { id: 'nature-foe', name: '木灵', hp: 40, maxHp: 40, types: ['nature'], skills: [] },
      { id: 'water-foe', name: '水灵', hp: 40, maxHp: 40, types: ['water'], skills: [] },
    ] }
  const view = await mount({ state: { ...snapshot, elementCatalog: elements, elementChart: { fire: { nature: 2, water: 0.5 } }, battle } })
  await view.click('返回战斗')
  view.renderElement(view.registrations.overlay.render({ gameId: 'g-1', close() {} })); await view.settle()
  const skill = () => view.elements.find(item => item.type === 'button' && item.text.includes('火球'))
  assert.match(skill().text, /火 · 威力 90 · 效果拔群 ×2/)
  await skill().props.onClick(); await view.settle()
  assert.equal(skill().props['aria-pressed'], true)
  assert.equal(view.calls.some(call => call.name === 'battle-act'), false, 'choosing a skill only stages a local round command')

  const target = view.elements.find(item => item.type === 'select' && item.text.includes('木灵') && item.text.includes('水灵'))
  assert(target, `battle presents both legal targets in the attack target selector; selects: ${JSON.stringify(view.elements.filter(item => item.type === 'select').map(item => ({ value: item.props.value, label: item.text })))}`)
  await target.props.onChange({ target: { value: '1' } }); await view.settle()
  assert.match(skill().text, /火 · 威力 90 · 效果不佳 ×0\.5/)
  assert.equal(skill().props['aria-pressed'], true, 'changing targets keeps the selected skill staged')
  const dockToggle = label => view.elements.find(item => item.type === 'button' && item.props['aria-label'] === label)
  await dockToggle('收起操作区').props.onClick(); await view.settle()
  assert.equal(view.elements.find(item => item.props.className === 'stg-command-workspace').props.hidden, true)
  await dockToggle('展开操作区').props.onClick(); await view.settle()
  assert.equal(view.elements.find(item => item.props.className === 'stg-command-workspace').props.hidden, false)
  assert.equal(skill().props['aria-pressed'], true, 'collapsing the dock preserves the queued skill')
  assert.equal(view.elements.find(item => item.type === 'select' && item.text.includes('木灵') && item.text.includes('水灵')).props.value, 1, 'expanding the dock preserves the chosen target')
  assert.equal(view.calls.some(call => call.name === 'battle-act'), false, 'neither selection nor target change advances battle state')
  await view.unmount()
})

test('built-in scene choice persists and clears a previously imported scene override', async () => {
  const media = new Map([['g-1:scene', new Blob(['imported scene'], { type: 'image/png' })]])
  const local = new Map()
  const localStorage = { getItem: key => local.get(key) ?? null, setItem: (key, value) => local.set(key, String(value)) }
  const db = { transaction(_store, mode) {
    const transaction = { objectStore: () => ({
      put(value, key) { media.set(key, value); queueMicrotask(() => transaction.oncomplete?.()) },
      get(key) { const request = {}; queueMicrotask(() => { request.result = media.get(key); request.onsuccess?.() }); return request },
    }) }
    return transaction
  } }
  const indexedDB = { open() { const request = {}; queueMicrotask(() => { request.result = db; request.onsuccess?.() }); return request } }
  const globals = { localStorage, indexedDB }
  const view = await mount({ state: snapshot, globals })
  const scene = view.elements.find(item => item.type === 'select' && item.props['aria-label'] === '内置战斗场景')
  assert(scene)
  await scene.props.onChange({ target: { value: 'celestial-terrace' } }); await view.settle()
  assert.equal(local.get('dsh-battle-scene:g-1'), 'celestial-terrace')
  assert.equal(media.get('g-1:scene'), null, 'selecting a built-in scene clears the imported image override in local media')
  await view.unmount()

  const reloaded = await mount({ state: snapshot, globals })
  assert.equal(reloaded.elements.find(item => item.type === 'select' && item.props['aria-label'] === '内置战斗场景').props.value, 'celestial-terrace')
  await reloaded.unmount()
})

test('backup recovery UI passes the selected backup ID to the rollback route', async () => {
  const backupIds = ['20261023120000000-11111111-1111-4111-8111-111111111111', '20261022120000000-22222222-2222-4222-8222-222222222222']
  const view = await mount({ state: snapshot, routes: {
    'list-update-backups': () => ({ backups: backupIds }),
    'rollback-update': args => ({ from: '0.1.1', to: '0.1.0', backup: args.backup }),
  } })
  await view.click('查看完整备份')
  assert.deepEqual(structuredClone(view.calls.find(call => call.name === 'list-update-backups').args), { gameId: 'g-1' })
  const choice = view.elements.find(item => item.type === 'select' && item.props['aria-label'] === '选择恢复备份')
  assert(choice)
  await choice.props.onChange({ target: { value: backupIds[1] } }); await view.settle()
  await view.click('恢复此备份')
  assert.deepEqual(structuredClone(view.calls.find(call => call.name === 'rollback-update').args), { gameId: 'g-1', backup: backupIds[1] })
  assert.match(view.elements.filter(item => item.props.role === 'status').map(item => item.text).join(''), /已恢复 0\.1\.1 → 0\.1\.0/)
})

