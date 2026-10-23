import { BASIC_SKILL_ID, getPack, resolveSkill, STATUSES, NEGATIVE_STATUS_IDS, TEAM_LIMIT, FIELD_LIMIT } from './catalog.mjs';
import { chooseDefaultAvatar, chooseDefaultHue, chooseDefaultPaletteSeed, normalizeGender, validDefaultAvatarId, validDefaultHue, validDefaultPaletteSeed } from './looks.mjs';
import { normalizeTypes, elementEffectiveness, sameTypeBonus } from './elements.mjs';

const MAX_HP = 1_000_000_000;
const MAX_EVENTS = 36;
export const DIFFICULTIES = Object.freeze([
  { id: 'easy', name: '容易', description: '决策难度：较随意地出招，偏好普通攻击；不调整数值。' },
  { id: 'normal', name: '中等', description: '决策难度：常规进攻与偶尔恢复；不调整数值。' },
  { id: 'hard', name: '困难', description: '决策难度：注重治疗、状态与增益；不调整数值。' },
  { id: 'expert', name: '极难', description: '决策难度：分析我方阵容并选择克制目标；不调整数值。' },
  { id: 'hell', name: '地狱', description: '决策难度：结合当前指令预判；不调整数值或行动次数。' },
  { id: 'ai', name: 'AI 对手', description: '决策难度：模型选择已有招式与场上目标，失败回退专家规则；不调整数值。' },
].map(level => Object.freeze(level)));
export const ENCOUNTER_DIFFICULTIES = Object.freeze([
  { id: 'low', name: '低', description: '敌方生命与攻击×0.85。', enemyScale: 0.85 },
  { id: 'medium', name: '中', description: '保留敌方原始生命与攻击。', enemyScale: 1 },
  { id: 'high', name: '高', description: '敌方生命与攻击×1.20。', enemyScale: 1.2 },
].map(level => Object.freeze(level)));
const NEGATIVE = new Set(NEGATIVE_STATUS_IDS);
const CONTROL = new Set(['charm', 'paralysis', 'fear', 'confusion', 'sleep', 'freeze', 'stun', 'petrify']);
const POSITIVE = new Set(['ward', 'guard', 'haste', 'focus', 'reflect', 'regen', 'controlImmune', 'empower', 'fortify', 'evasion', 'poisonImmune', 'burnImmune', 'bleedImmune', 'lifesteal', 'berserk', 'healBoost', 'resourceRegen', 'charge', 'armorPierce', 'protect', 'sturdy', 'initiative', 'critReady', 'sureHit', 'critGuard', 'bramble', 'resistance', 'amplify', 'manaShield', 'rage']);
const IMMUNITY = { poison: 'poisonImmune', burn: 'burnImmune', bleed: 'bleedImmune' };
const OFFENSIVE = new Set(['damage', 'damageStatus', 'lifeDrain', 'resourceDrain', 'areaDamage']);
const clone = value => JSON.parse(JSON.stringify(value));
const numeric = (value, fallback, min, max) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max ? Number(value) : fallback;
const boundedText = (value, fallback, length = 80) => String(value ?? fallback).trim().slice(0, length) || fallback;
const living = actor => actor && actor.hp > 0;
const active = (state, side) => side === 'player' ? state.party[state.activePlayer] : state.enemies[state.activeEnemy];
const team = (state, side) => side === 'player' ? state.party : state.enemies;
const fieldKey = side => side === 'player' ? 'activePlayers' : 'activeEnemies';
const actedKey = side => side === 'player' ? 'actedPlayers' : 'actedEnemies';
const field = (state, side) => state[fieldKey(side)].map(index => team(state, side)[index]).filter(living);
const remaining = (state, side) => state[fieldKey(side)].filter(index => living(team(state, side)[index]) && !state[actedKey(side)].includes(index));
const syncAliases = state => {
  state.activePlayer = state.activePlayers[0] ?? -1; state.activeEnemy = state.activeEnemies[0] ?? -1;
  state.remainingPlayerActions = remaining(state, 'player');
};
const other = side => side === 'player' ? 'enemy' : 'player';
const status = (actor, id) => actor.statuses.find(s => s.id === id);
const removeStatus = (actor, id) => { actor.statuses = actor.statuses.filter(s => s.id !== id); };
const healingFactor = actor => status(actor, 'healBlock') ? 0 : (status(actor, 'antiHeal') ? 0.5 : 1) * (status(actor, 'healBoost') ? 1.3 : 1);
const skillCost = (actor, spec) => Math.ceil(spec.cost * (status(actor, 'exhaustion') ? 1.5 : 1));
const trait = (spec, name) => spec.mechanics?.includes(name);
const equippedSpec = (actor, skill) => resolveSkill(skill, skill.id.startsWith('fantasy-') ? 'fantasy' : 'human');
const emit = (state, kind, fields = {}) => {
  if (state.events.length >= MAX_EVENTS) return;
  if (!fields.side && fields.actorId) {
    if (state.party.some(actor => actor.id === fields.actorId)) fields.side = 'player';
    else if (state.enemies.some(actor => actor.id === fields.actorId)) fields.side = 'enemy';
  }
  const event = { kind, ...fields };
  state.events.push(event);
  state.log.push(event);
  if (state.log.length > 100) state.log.shift();
};
function random(state) {
  state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
  return state.seed / 4294967296;
}

export function normalizeActor(input = {}, { packId = 'human', id, side = 'player' } = {}) {
  if (!getPack(packId)) throw new RangeError(`Unknown fixed pack: ${packId}`);
  const warnings = [];
  const source = input && typeof input === 'object' ? input : {};
  const level = Math.round(numeric(source.level, 1, 1, 999));
  const maxHp = Math.round(numeric(source.maxHp ?? source.max_hp ?? source.hp, 160, 1, MAX_HP));
  const hp = Math.round(numeric(source.hp, maxHp, 0, maxHp));
  const attackDefault = Math.max(12, maxHp * 0.115);
  const defenseDefault = Math.max(5, maxHp * 0.035);
  const attack = numeric(source.attack ?? source.atk, attackDefault, 1, MAX_HP);
  const defense = numeric(source.defense ?? source.def, defenseDefault, 0, MAX_HP);
  const speed = numeric(source.speed, 50, 1, 10000);
  const maxResource = Math.round(numeric(source.maxResource ?? source.max_resource, 100, 1, 100000));
  const resource = Math.round(numeric(source.resource, maxResource, 0, maxResource));
  for (const [key, min, max] of [['maxHp', 1, MAX_HP], ['hp', 0, maxHp], ['attack', 1, MAX_HP], ['defense', 0, MAX_HP], ['speed', 1, 10000], ['resource', 0, maxResource]]) {
    if (source[key] != null && numeric(source[key], NaN, min, max) !== Number(source[key])) warnings.push(`${key} 已使用安全默认值`);
  }
  const rawSkills = Array.isArray(source.skills) ? source.skills.slice(0, 24) : [];
  if (Array.isArray(source.skills) && source.skills.length > 24) warnings.push('技能来源过长，已读取前 24 个');
  const candidates = Array.isArray(source.skills) ? rawSkills : [`${packId}-0-1`, `${packId}-0-12`, `${packId}-0-17`, `${packId}-0-27`];
  const names = [];
  const seen = new Set();
  let duplicateCount = 0, truncatedCount = 0;
  for (const [index, item] of candidates.entries()) {
    const resolvedKey = resolveSkill(item, packId), skillId = resolvedKey.id;
    if (resolvedKey.baseId === BASIC_SKILL_ID[packId] && !resolvedKey.mechanics.length && !resolvedKey.extraStatuses.length) {
      if (!warnings.includes('普通攻击是独立基础行动，不占特殊技能槽')) warnings.push('普通攻击是独立基础行动，不占特殊技能槽');
      continue;
    }
    const signature = JSON.stringify([skillId, resolvedKey.power, resolvedKey.element]);
    if (seen.has(signature)) {
      duplicateCount++;
      continue;
    }
    seen.add(signature);
    if (names.length < 4) names.push(item);
    else truncatedCount++;
  }
  if (duplicateCount) warnings.push(`合并了 ${duplicateCount} 个同效果技能`);
  if (truncatedCount) warnings.push(`只展示前 4 个不同技能，省略 ${truncatedCount} 个`);
  const skills = names.map(item => {
    const resolved = resolveSkill(item, packId);
    warnings.push(...resolved.notes.map(note => `${resolved.displayName}：${note}`));
    return {
      id: resolved.id, name: resolved.displayName, description: resolved.description, kind: resolved.kind,
      baseId: resolved.baseId, sourceDescription: resolved.sourceDescription,
      power: resolved.power, element: resolved.element,
      mechanics: resolved.mechanics, extraStatuses: resolved.extraStatuses, mappingKnown: resolved.recognized,
      cost: resolved.cost, usesLeft: resolved.uses, cooldownLeft: 0,
    };
  });
  const avatar = typeof source.avatar === 'string' && /^(https?:\/\/|data:image\/)/.test(source.avatar) ? source.avatar.slice(0, 2048) : undefined;
  const actorId = boundedText(id ?? source.id, `${side}-1`, 80);
  const gender = normalizeGender(source.gender);
  const avatarId = validDefaultAvatarId(source.avatarId) ? source.avatarId : chooseDefaultAvatar({
    id: actorId, name: source.name, gender, species: source.species, kind: source.kind, description: source.description,
  });
  const avatarHue = validDefaultHue(source.avatarHue) ? source.avatarHue : chooseDefaultHue({ id: actorId, name: source.name, avatarId });
  const avatarPaletteSeed = validDefaultPaletteSeed(source.avatarPaletteSeed) ? source.avatarPaletteSeed : chooseDefaultPaletteSeed();
  return {
    id: actorId, name: boundedText(source.name, side === 'player' ? '我方' : '对手'),
    level, hp, maxHp, attack, defense, speed, resource, maxResource, skills, types: normalizeTypes(source.types),
    statuses: [], controlStreak: 0, warnings, avatarId, avatarHue, avatarPaletteSeed, ...(avatar ? { avatar } : {}), ...(gender ? { gender } : {}),
    ...(typeof source.species === 'string' ? { species: source.species.slice(0, 32) } : {}), ...(typeof source.kind === 'string' ? { kind: source.kind.slice(0, 32) } : {}),
  };
}

export const ITEM_SPECS = Object.freeze({
  'healing-potion': { name: '疗伤药', fantasyName: '回春丹', limit: 2, description: '恢复目标25%最大生命，受本场治疗额度与禁疗限制；消耗一次行动。' },
  'resource-potion': { name: '资源药', fantasyName: '回气丹', limit: 1, description: '恢复目标30点资源，不超过资源上限；消耗一次行动。' },
  cleanse: { name: '净化药', fantasyName: '解毒丹', limit: 1, description: '清除目标负面状态；消耗一次行动。' },
});
function inventory(items) {
  return Object.entries(ITEM_SPECS).map(([id, spec]) => {
    const source = Array.isArray(items) ? items.find(item => item?.id === id) : null;
    return { id, name: boundedText(source?.name, spec.name, 60), description: spec.description,
      count: Math.floor(numeric(source ? source.count : items?.[id], 0, 0, spec.limit)) };
  });
}
function initialField(actors, selected) {
  const indexes = selected === undefined ? actors.map((actor, index) => living(actor) ? index : -1).filter(index => index >= 0).slice(0, FIELD_LIMIT) : selected;
  if (!Array.isArray(indexes) || !indexes.length || indexes.length > FIELD_LIMIT || new Set(indexes).size !== indexes.length || indexes.some(index => !Number.isInteger(index) || !living(actors[index]))) throw new RangeError('Each field requires 1–3 distinct living actors');
  return [...indexes];
}
export function createBattle({ id = 'battle', packId = 'human', difficulty = 'normal', encounterDifficulty = 'medium', party = [], enemies = [], activePlayers: selectedPlayers, activeEnemies: selectedEnemies, items, turn = 0, textVersion = 0, seed = 1 } = {}) {
  if (!getPack(packId)) throw new RangeError(`Unknown fixed pack: ${packId}`);
  if (!DIFFICULTIES.some(level => level.id === difficulty)) throw new RangeError(`Unknown difficulty: ${difficulty}`);
  const level = ENCOUNTER_DIFFICULTIES.find(level => level.id === encounterDifficulty);
  if (!level) throw new RangeError(`Unknown encounter difficulty: ${encounterDifficulty}`);
  if (!Array.isArray(party) || !Array.isArray(enemies) || !party.length || !enemies.length || party.length > TEAM_LIMIT || enemies.length > TEAM_LIMIT) {
    throw new RangeError('Each side requires 1–6 actors');
  }
  const players = party.map((actor, index) => normalizeActor(actor, { packId, id: actor?.id ?? `player-${index + 1}`, side: 'player' }));
  const foes = enemies.map((actor, index) => normalizeActor(actor, { packId, id: actor?.id ?? `enemy-${index + 1}`, side: 'enemy' }));
  for (const actor of foes) if (level.enemyScale !== 1) {
    const maxHp = Math.max(1, Math.min(MAX_HP, Math.round(actor.maxHp * level.enemyScale)));
    actor.hp = actor.hp === 0 ? 0 : Math.max(1, Math.min(maxHp, Math.round(actor.hp * maxHp / actor.maxHp)));
    actor.maxHp = maxHp; actor.attack = Math.max(1, Math.min(MAX_HP, actor.attack * level.enemyScale));
    actor.warnings.push(`敌人出现难度${level.name}：敌方生命与攻击×${level.enemyScale.toFixed(2)}`);
  }
  const activePlayers = initialField(players, selectedPlayers), activeEnemies = initialField(foes, selectedEnemies);
  if (new Set([...players, ...foes].map(actor => actor.id)).size !== players.length + foes.length) throw new RangeError('Actor IDs must be unique');
  return {
    schemaVersion: 32, id: boundedText(id, 'battle'), packId, difficulty, encounterDifficulty, seq: 0, round: 0,
    turn: numeric(turn, 0, 0, 1e9), textVersion: typeof textVersion === 'string' && textVersion.trim() ? textVersion.slice(0, 128) : '0',
    party: players, enemies: foes, activePlayers, activeEnemies, activePlayer: activePlayers[0], activeEnemy: activeEnemies[0],
    fieldCapacity: { player: activePlayers.length, enemy: activeEnemies.length }, actedPlayers: [], actedEnemies: [], remainingPlayerActions: [...activePlayers], roundOpen: false,
    inventory: inventory(items ?? { 'healing-potion': 1, 'resource-potion': 1 }), inventorySource: items === undefined ? '演练补给（固定默认）' : '本场补给',
    outcome: null, log: [], events: [],
    summons: { player: null, enemy: null },
    reviveUsed: false,
    healingBudget: { player: Math.round(players.reduce((sum, actor) => sum + actor.maxHp, 0) * 0.55), enemy: Math.round(foes.reduce((sum, actor) => sum + actor.maxHp, 0) * 0.55) },
    seed: (numeric(seed, 1, 0, 4294967295) >>> 0) || 1,
  };
}

function setStatus(state, target, id, sourceId) {
  if (!Object.hasOwn(STATUSES, id)) return;
  if (IMMUNITY[id] && status(target, IMMUNITY[id])) {
    emit(state, 'resist', { actorId: target.id, targetId: target.id, name: STATUSES[id].name, text: `${target.name}免疫${STATUSES[id].name}` });
    return;
  }
  for (const [negative, immune] of Object.entries(IMMUNITY)) if (id === immune) removeStatus(target, negative);
  if (CONTROL.has(id) && status(target, 'controlImmune')) {
    emit(state, 'resist', { actorId: target.id, targetId: target.id, name: STATUSES[id].name, text: `${target.name}抵御了${STATUSES[id].name}` });
    return;
  }
  const existing = status(target, id);
  const turns = STATUSES[id].duration;
  if (existing) { existing.turns = Math.max(existing.turns, turns); existing.duration = existing.turns; }
  else target.statuses.push({ id, name: STATUSES[id].name, turns, duration: turns, sourceId });
  emit(state, 'status', { actorId: sourceId, targetId: target.id, name: STATUSES[id].name, value: turns, text: `${target.name}获得${STATUSES[id].name}` });
}

function damage(state, source, target, value, skillId, name, side, { reflectable = true, ignoreWard = false, bypassDefense = false } = {}) {
  if (reflectable && status(target, 'protect')) {
    removeStatus(target, 'protect');
    emit(state, 'absorb', { actorId: target.id, targetId: target.id, name: '招架', value: 0, text: `${target.name}招架了这次直接攻击` });
    return 0;
  }
  let amount = Math.max(1, Math.round(value));
  const guard = status(target, 'guard');
  if (!bypassDefense && guard) amount = Math.max(1, Math.round(amount * 0.62));
  if (!bypassDefense && status(target, 'fortify')) amount = Math.max(1, Math.round(amount * 0.78));
  const ward = status(target, 'ward');
  if (!ignoreWard && ward && ward.shield > 0) {
    const absorbed = Math.min(amount, ward.shield);
    ward.shield -= absorbed;
    amount -= absorbed;
    emit(state, 'absorb', { actorId: target.id, targetId: target.id, name: '护盾', value: absorbed, text: `${target.name}的护盾抵消${absorbed}伤害` });
  }
  if (!bypassDefense && status(target, 'manaShield') && target.resource > 0 && amount > 0) {
    const unit = Math.max(0.001, target.maxHp * 0.001);
    const absorbed = Math.min(Math.floor(amount * 0.5), Math.floor(target.resource * unit));
    target.resource -= Math.min(target.resource, Math.ceil(absorbed / unit)); amount -= absorbed;
    if (absorbed) emit(state, 'absorb', { actorId: target.id, targetId: target.id, name: '法力护盾', value: absorbed, text: `${target.name}消耗资源抵消${absorbed}伤害` });
  }
  if (amount > 0) {
    amount = Math.min(amount, target.hp);
    if (amount >= target.hp && target.hp > 1 && status(target, 'sturdy') && !target.sturdyUsed) {
      amount = target.hp - 1; target.sturdyUsed = true; removeStatus(target, 'sturdy');
      emit(state, 'resist', { actorId: target.id, targetId: target.id, name: '不屈', text: `${target.name}以不屈保留1点生命（本场已消耗）` });
    }
    target.hp = Math.max(0, target.hp - amount);
    emit(state, 'damage', { actorId: source?.id ?? null, targetId: target.id, skillId, name, value: amount, side, text: `${target.name}受到${amount}伤害` });
  }
  if (reflectable && source && living(source) && status(target, 'reflect') && amount > 0) {
    damage(state, target, source, Math.min(amount * 0.18, source.maxHp * 0.06), 'reflect', '反击', other(side), { reflectable: false });
  }
  if (reflectable && source && living(source) && status(target, 'bramble') && amount > 0) damage(state, target, source, source.maxHp * 0.03, 'bramble', '荆棘', other(side), { reflectable: false });
  return amount;
}

function heal(state, actor, side, fraction, name, skillId) {
  const budget = state.healingBudget[side];
  const amount = Math.max(0, Math.min(Math.round(actor.maxHp * fraction * healingFactor(actor)), actor.maxHp - actor.hp, budget));
  actor.hp += amount;
  state.healingBudget[side] -= amount;
  emit(state, 'heal', { actorId: actor.id, targetId: actor.id, skillId, name, value: amount, side, text: `${actor.name}恢复${amount}生命` });
}

function effectiveSpeed(actor) { return actor.speed * (status(actor, 'haste') ? 1.3 : 1) * (status(actor, 'slow') ? 0.75 : 1) * (status(actor, 'root') ? 0.7 : 1); }
function available(actor, skill) {
  const spec = equippedSpec(actor, skill);
  if ((status(actor, 'taunt') || status(actor, 'disarm')) && spec.id !== BASIC_SKILL_ID[spec.packId]) return false;
  return skill.usesLeft > 0 && skill.cooldownLeft <= 0 && actor.resource >= skillCost(actor, spec) && !(status(actor, 'silence') && !['damage', 'areaDamage'].includes(spec.kind));
}
function selectEnemySkill(state, actor) {
  const options = actor.skills.filter(skill => available(actor, skill));
  if (!options.length) return null;
  if (!state.reviveUsed && state.enemies.some(member => !living(member))) {
    const revival = options.find(skill => resolveSkill(skill, state.packId).kind === 'revive');
    if (revival) return revival;
  }
  if (actor.hp / actor.maxHp < 0.4) {
    const recovery = options.find(skill => ['heal', 'cleanse'].includes(resolveSkill(skill, state.packId).kind));
    if (recovery && random(state) < 0.55) return recovery;
  }
  const attacks = options.filter(skill => OFFENSIVE.has(resolveSkill(skill, state.packId).kind));
  const pool = attacks.length ? attacks : options;
  return pool[Math.floor(random(state) * pool.length)];
}

function tacticalScore(state, actor, target, skill, expert, incoming) {
  const spec = resolveSkill(skill, state.packId), hp = actor.hp / actor.maxHp;
  const effects = [...(spec.status ? [spec.status] : []), ...(spec.extraStatuses || [])];
  const enemySkills = target.skills.map(entry => resolveSkill(entry, state.packId));
  const hasRecovery = enemySkills.some(entry => ['heal', 'lifeDrain', 'revive'].includes(entry.kind) || trait(entry, 'healSelf'));
  let score = OFFENSIVE.has(spec.kind) ? 30 + (spec.power / 70 || 1) * 12 * elementEffectiveness(spec.element, target.types) * sameTypeBonus(spec.element, actor.types) : -10;
  if (spec.kind === 'heal') score = hp < 0.6 && healingFactor(actor) > 0 && state.healingBudget.enemy > 0 ? 70 + (1 - hp) * 30 : -30;
  if (spec.kind === 'cleanse') score = actor.statuses.filter(effect => NEGATIVE.has(effect.id)).length * 25 - 5;
  if (spec.kind === 'revive') score = !state.reviveUsed && state.enemies.some(member => !living(member)) && state.healingBudget.enemy > 0 ? 95 : -30;
  if (spec.kind === 'summon') score = state.summons.enemy ? -30 : 47;
  if (spec.kind === 'selfStatus') score = status(actor, spec.status) ? -20 : 46 + (hp < 0.65 && ['protect', 'ward', 'guard', 'fortify', 'evasion'].includes(spec.status) ? 15 : 0);
  if (spec.kind === 'dispel') score = 15 + target.statuses.filter(effect => POSITIVE.has(effect.id)).length * 35;
  if (spec.kind === 'areaDamage') score += (field(state, 'player').length - 1) * 12;
  for (const effect of effects) if (NEGATIVE.has(effect) && !status(target, effect) && !(IMMUNITY[effect] && status(target, IMMUNITY[effect]))) {
    if (CONTROL.has(effect)) score += status(target, 'controlImmune') || target.controlStreak >= 1 ? -10 : 23;
    else score += 8;
    if (expert && ['antiHeal', 'healBlock'].includes(effect) && hasRecovery) score += 50;
    if (expert && effect === 'silence' && enemySkills.some(entry => !['damage', 'areaDamage'].includes(entry.kind))) score += 35;
    if (expert && ['blind', 'disarm', 'weaken'].includes(effect) && target.attack / target.maxHp >= 0.12) score += 25;
  }
  if (expert) {
    if (OFFENSIVE.has(spec.kind)) {
      score += (1 - target.hp / target.maxHp) * 18;
      if (target.hp / target.maxHp < 0.16) score += 65;
      if (status(target, 'ward') && trait(spec, 'shieldPierce')) score += 40;
      if (status(target, 'evasion') && trait(spec, 'sureHit')) score += 25;
      if (status(target, 'protect')) score -= 35;
    }
    // Public reserve loadouts inform preparation, while targeting stays on the field.
    if (spec.kind === 'selfStatus' && !status(actor, spec.status)) {
      const prevented = { poisonImmune: 'poison', burnImmune: 'burn', bleedImmune: 'bleed' }[spec.status];
      if (prevented && state.party.some(member => member.skills.some(entry => {
        const move = resolveSkill(entry, state.packId); return move.status === prevented || move.extraStatuses?.includes(prevented);
      }))) score += 30;
    }
  }
  if (incoming) {
    const incomingActor = field(state, 'player').find(member => member.id === incoming.actorId);
    const incomingSkill = incoming.skillId === BASIC_SKILL_ID[state.packId] ? BASIC_SKILL_ID[state.packId] : incomingActor?.skills.find(entry => entry.id === incoming.skillId);
    const move = incomingSkill && resolveSkill(incomingSkill, state.packId);
    if (move && OFFENSIVE.has(move.kind) && (incoming.targetId === actor.id || move.kind === 'areaDamage')) {
      if (spec.kind === 'selfStatus' && !status(actor, spec.status) && ['protect', 'ward', 'guard', 'fortify', 'evasion', 'reflect'].includes(spec.status)) score += spec.status === 'protect' ? 110 : 70;
      if (target.id === incoming.actorId && effects.some(effect => CONTROL.has(effect)) && !status(target, 'controlImmune') && (effectiveSpeed(actor) >= effectiveSpeed(target) || trait(spec, 'first'))) score += 65;
    }
    if (move && ['heal', 'lifeDrain'].includes(move.kind) && target.id === incoming.actorId && effects.some(effect => ['antiHeal', 'healBlock'].includes(effect))) score += 80;
  }
  return score;
}
function enemyDecision(state, actor, { enemyPlans, incoming } = {}) {
  const targets = field(state, 'player');
  if (!targets.length || !living(actor) || !field(state, 'enemy').includes(actor)) return { skill: null, target: targets[0] };
  if (state.difficulty === 'ai') {
    const plan = Array.isArray(enemyPlans) ? enemyPlans.slice(0, FIELD_LIMIT).find(entry => entry?.actorId === actor.id)
      : enemyPlans && typeof enemyPlans === 'object' && Object.hasOwn(enemyPlans, actor.id) ? enemyPlans[actor.id] : null;
    const wantsBasic = plan?.actorId === actor.id && plan.skillId === BASIC_SKILL_ID[state.packId];
    const skill = plan?.actorId === actor.id && typeof plan.skillId === 'string' && !wantsBasic ? actor.skills.find(entry => entry.id === plan.skillId && available(actor, entry)) : null;
    const target = plan && typeof plan.targetId === 'string' ? targets.find(member => member.id === plan.targetId) : null;
    if (wantsBasic && target) return { skill: null, target };
    if (skill && target) return { skill, target };
  }
  if (state.difficulty === 'normal') {
    const skill = selectEnemySkill(state, actor);
    return { skill, target: targets[Math.floor(random(state) * targets.length)] };
  }
  const options = actor.skills.filter(skill => available(actor, skill));
  if (state.difficulty === 'easy') {
    const skill = random(state) < 0.65 ? null : options[Math.floor(random(state) * options.length)];
    return { skill: skill ?? null, target: targets[Math.floor(random(state) * targets.length)] };
  }
  const expert = ['expert', 'hell', 'ai'].includes(state.difficulty);
  const considered = expert ? targets : [targets[Math.floor(random(state) * targets.length)]];
  let chosen = { skill: options[0] ?? null, target: considered[0] }, best = -Infinity;
  for (const target of considered) for (const skill of options) {
    const score = tacticalScore(state, actor, target, skill, expert, state.difficulty === 'hell' ? incoming : null);
    if (score > best) { best = score; chosen = { skill, target }; }
  }
  return chosen;
}

function startAction(state, actor, side) {
  const previous = [...actor.statuses];
  for (const effect of previous) {
    if (['poison', 'burn', 'bleed', 'curse', 'frostbite', 'electrified'].includes(effect.id)) {
      const rate = { poison: 0.038, burn: 0.045, curse: 0.03, bleed: 0.035, frostbite: 0.025, electrified: 0.025 }[effect.id];
      damage(state, null, actor, actor.maxHp * rate, effect.id, effect.name, side, { reflectable: false });
    }
    if (effect.id === 'delayedBlast' && effect.turns <= 1) damage(state, null, actor, actor.maxHp * 0.12, effect.id, effect.name, side, { reflectable: false });
    if (effect.id === 'sap') {
      const drained = damage(state, null, actor, actor.maxHp * 0.04, effect.id, effect.name, side, { reflectable: false });
      const ownerSide = state.party.some(member => member.id === effect.sourceId) ? 'player' : 'enemy';
      const owner = team(state, ownerSide).find(member => member.id === effect.sourceId);
      if (living(owner)) heal(state, owner, ownerSide, drained * 0.5 / owner.maxHp, '寄生吸收', 'sap');
    }
    if (effect.id === 'resourceRegen') actor.resource = Math.min(actor.maxResource, actor.resource + 10);
    if (effect.id === 'resourceLeak' || effect.id === 'electrified') actor.resource = Math.max(0, actor.resource - (effect.id === 'resourceLeak' ? 15 : 6));
    if (effect.id === 'regen' && living(actor)) heal(state, actor, side, 0.04, effect.name, effect.id);
  }
  for (const effect of previous) { effect.turns -= 1; effect.duration = effect.turns; }
  if (!living(actor)) return false;
  const control = previous.find(effect => CONTROL.has(effect.id));
  if (control && !status(actor, 'controlImmune')) {
    if (actor.controlStreak >= 1) {
      actor.controlStreak = 0;
      setStatus(state, actor, 'controlImmune', actor.id);
    } else {
      actor.controlStreak = 1;
      if (control.id === 'charm' || control.id === 'confusion') damage(state, actor, actor, actor.maxHp * 0.055, control.id, `${control.name}反噬`, side, { reflectable: false });
      emit(state, 'skip', { actorId: actor.id, targetId: actor.id, name: control.name, side, text: `${actor.name}因${control.name}失去行动` });
      return false;
    }
  } else actor.controlStreak = 0;
  return true;
}

function attackTarget(state, actor, target, spec, name, side) {
  const hit = (spec.accuracy ?? 0.96) * (status(actor, 'blind') ? 0.62 : 1) * (status(actor, 'focus') ? 1.13 : 1) * (status(target, 'evasion') ? 0.75 : 1) * (status(target, 'mark') ? 1.12 : 1);
  const sure = trait(spec, 'sureHit') || status(actor, 'sureHit');
  if (!sure && random(state) >= Math.min(0.99, hit)) {
    emit(state, 'miss', { actorId: actor.id, targetId: target.id, skillId: spec.id, name, side, text: `${actor.name}的${name}未命中` });
    return { hit: false, dealt: 0 };
  }
  const attack = Math.max(actor.attack, actor.maxHp * 0.075);
  const criticalRoll = trait(spec, 'critical') || status(actor, 'critReady') || (trait(spec, 'highCrit') && random(state) < 0.4);
  const critical = criticalRoll && !status(target, 'critGuard');
  if (critical) emit(state, 'critical', { actorId: actor.id, targetId: target.id, skillId: spec.id, name, side, text: `${actor.name}的${name}触发暴击` });
  if (criticalRoll && !critical) emit(state, 'resist', { actorId: target.id, targetId: target.id, name: '抗暴', text: `${target.name}抵消暴击加成` });
  const raw = target.maxHp * 0.075 + attack * 0.52 - Math.min(target.defense, target.maxHp * 0.2) * 0.23 * (status(actor, 'armorPierce') || trait(spec, 'armorPierce') ? 0.35 : 1);
  const modifier = (status(actor, 'weaken') || status(actor, 'curse') ? 0.78 : 1) * (status(actor, 'empower') ? 1.2 : 1) * (status(actor, 'disarm') ? 0.72 : 1) * (status(actor, 'berserk') ? 1.3 : 1) * (status(actor, 'charge') ? 1.35 : 1) * (status(actor, 'frostbite') ? 0.85 : 1);
  const expose = (status(target, 'expose') ? 1.2 : 1) * (status(target, 'vulnerable') ? 1.2 : 1) * (status(target, 'mark') ? 1.1 : 1) * (status(target, 'berserk') ? 1.15 : 1);
  const cap = spec.kind === 'areaDamage' ? 0.11 : 0.27;
  const floor = spec.kind === 'areaDamage' ? 0.025 : 0.05;
  const rage = status(actor, 'rage') ? 1 + 0.25 * (1 - actor.hp / actor.maxHp) : 1;
  const execute = trait(spec, 'execute') && target.hp / target.maxHp < 0.3 ? 1.25 : 1;
  const effectiveness = elementEffectiveness(spec.element, target.types);
  const affinity = sameTypeBonus(spec.element, actor.types);
  if (effectiveness !== 1) emit(state, 'effectiveness', { actorId: actor.id, targetId: target.id, skillId: spec.id, name, side, value: effectiveness,
    text: effectiveness > 1 ? `效果拔群！${name}对${target.name}属性克制×${effectiveness}` : `效果不佳……${target.name}抵抗${name}，属性倍率×${effectiveness}` });
  // Preserve the existing endurance bounds, then apply type matchups. A strong
  // matchup must remain visible rather than disappear into the old base cap.
  const baseDamage = Math.max(target.maxHp * floor, Math.min(target.maxHp * cap, raw * (spec.power / 70) * modifier * expose * rage * execute * (critical ? 1.5 : 1)));
  const amount = Math.max(1, Math.round(Math.min(target.maxHp * (spec.kind === 'areaDamage' ? 0.4 : 0.7), baseDamage * effectiveness * affinity)));
  const hits = trait(spec, 'multiHit') ? 3 : 1;
  let dealt = 0, remaining = amount;
  for (let index = 0; index < hits && remaining > 0 && living(actor) && living(target); index++) {
    const part = Math.ceil(remaining / (hits - index)); remaining -= part;
    dealt += damage(state, actor, target, part, spec.id, name, side, { ignoreWard: trait(spec, 'shieldPierce') });
  }
  const effects = [...(spec.status ? [[spec.status, spec.chance]] : []), ...(spec.extraStatuses || []).map(id => [id, CONTROL.has(id) ? 0.5 : 0.7])];
  for (const [id, chance] of effects) {
    const adjusted = Math.min(0.95, chance + (status(actor, 'amplify') ? 0.2 : 0)) * (status(target, 'resistance') ? 0.5 : 1);
    if (living(target) && dealt > 0 && random(state) < adjusted) setStatus(state, target, id, actor.id);
  }
  if (dealt > 0 && trait(spec, 'dispelTarget')) {
    let removed = 0;
    target.statuses = target.statuses.filter(effect => !POSITIVE.has(effect.id) || removed++ >= 2);
    emit(state, 'dispel', { actorId: actor.id, targetId: target.id, side, value: Math.min(removed, 2), text: `${actor.name}驱散目标增益` });
  }
  return { hit: true, dealt };
}

function perform(state, side, chosenSkill, actor = active(state, side), chosenTarget) {
  if (!living(actor)) return;
  if (!startAction(state, actor, side)) {
    actor.statuses = actor.statuses.filter(effect => effect.turns > 0);
    return;
  }
  const target = living(chosenTarget) && field(state, other(side)).includes(chosenTarget) ? chosenTarget : field(state, other(side))[0];
  if (!living(target)) {
    actor.statuses = actor.statuses.filter(effect => effect.turns > 0);
    return;
  }
  let spec;
  let skill = chosenSkill;
  if (!skill || !available(actor, skill)) {
    spec = resolveSkill(BASIC_SKILL_ID[state.packId], state.packId);
    skill = null;
  } else spec = resolveSkill(skill, state.packId);
  if (status(actor, 'taunt') || status(actor, 'disarm')) {
    spec = resolveSkill(BASIC_SKILL_ID[state.packId], state.packId);
    skill = null;
  }
  const name = skill?.name ?? spec.name;
  removeStatus(actor, 'initiative');
  if (skill) { skill.usesLeft--; skill.cooldownLeft = spec.cooldown + 1; actor.resource -= skillCost(actor, spec); }
  emit(state, 'use', { actorId: actor.id, targetId: spec.kind === 'selfStatus' || spec.kind === 'heal' || spec.kind === 'cleanse' ? actor.id : target.id, skillId: spec.id, name, side, text: `${actor.name}使用${name}` });
  if (OFFENSIVE.has(spec.kind)) {
    const targets = spec.kind === 'areaDamage' ? field(state, other(side)) : [target];
    let dealt = 0;
    for (const victim of targets) dealt += attackTarget(state, actor, victim, spec, name, side).dealt;
    removeStatus(actor, 'charge'); removeStatus(actor, 'armorPierce'); removeStatus(actor, 'critReady'); removeStatus(actor, 'sureHit');
    if (living(actor) && (spec.kind === 'lifeDrain' || status(actor, 'lifesteal') || trait(spec, 'drain')) && dealt > 0) {
      const budget = state.healingBudget[side];
      const rate = spec.kind === 'lifeDrain' ? 0.35 : 0.18;
      const gain = Math.min(Math.round(dealt * rate * healingFactor(actor)), actor.maxHp - actor.hp, budget);
      actor.hp += gain; state.healingBudget[side] -= gain;
      emit(state, 'heal', { actorId: actor.id, targetId: actor.id, skillId: spec.id, name, value: gain, side, text: `${actor.name}吸收${gain}生命` });
    }
    if ((spec.kind === 'resourceDrain' || trait(spec, 'resourceDrain')) && dealt > 0) {
      const drained = Math.min(15, target.resource);
      target.resource -= drained;
      actor.resource = Math.min(actor.maxResource, actor.resource + Math.min(8, drained));
      emit(state, 'resource', { actorId: actor.id, targetId: target.id, skillId: spec.id, name, value: drained, side, text: `${actor.name}夺取${drained}资源` });
    }
  } else if (spec.kind === 'selfStatus') {
    setStatus(state, actor, spec.status, actor.id);
    if (spec.status === 'ward') status(actor, 'ward').shield = Math.round(actor.maxHp * 0.16);
  } else if (spec.kind === 'heal') heal(state, actor, side, spec.heal, name, spec.id);
  else if (spec.kind === 'cleanse') {
    const before = actor.statuses.length;
    actor.statuses = actor.statuses.filter(effect => !NEGATIVE.has(effect.id));
    emit(state, 'cleanse', { actorId: actor.id, targetId: actor.id, skillId: spec.id, name, value: before - actor.statuses.length, side, text: `${actor.name}清除了${before - actor.statuses.length}个负面状态` });
  } else if (spec.kind === 'summon') {
    if (!state.summons[side]) {
      state.summons[side] = { id: `${actor.id}-summon-${state.seq}`, ownerId: actor.id, name: `${actor.name}的援手`, turns: 3, power: 0.055 };
      emit(state, 'summon', { actorId: actor.id, targetId: target.id, skillId: spec.id, name, side, text: `${actor.name}召出援手` });
    } else emit(state, 'resist', { actorId: actor.id, targetId: actor.id, skillId: spec.id, name, side, text: '已有援手在场' });
  } else if (spec.kind === 'dispel') {
    const before = target.statuses.length;
    target.statuses = target.statuses.filter(effect => !POSITIVE.has(effect.id));
    emit(state, 'dispel', { actorId: actor.id, targetId: target.id, skillId: spec.id, name, value: before - target.statuses.length, side, text: `${actor.name}驱散${before - target.statuses.length}个增益状态` });
  } else if (spec.kind === 'revive') {
    const fallen = team(state, side).find(member => !living(member));
    const amount = fallen && !state.reviveUsed ? Math.min(Math.round(fallen.maxHp * 0.2 * healingFactor(fallen)), state.healingBudget[side]) : 0;
    if (amount > 0) {
      fallen.hp = amount; state.healingBudget[side] -= amount; state.reviveUsed = true;
      emit(state, 'revive', { actorId: actor.id, targetId: fallen.id, skillId: spec.id, name, value: amount, side, text: `${fallen.name}以${amount}生命复苏` });
    } else emit(state, 'miss', { actorId: actor.id, targetId: actor.id, skillId: spec.id, name, side, text: '没有可复苏的队友或复苏次数已用尽' });
  }
  if (living(actor)) {
    if (trait(spec, 'healSelf')) heal(state, actor, side, 0.1, name, spec.id);
    if (trait(spec, 'cleanseSelf')) {
      let removed = 0;
      actor.statuses = actor.statuses.filter(effect => !NEGATIVE.has(effect.id) || removed++ >= 2);
      emit(state, 'cleanse', { actorId: actor.id, side, value: Math.min(removed, 2), text: `${actor.name}净化自身负面状态` });
    }
    if (trait(spec, 'counter')) setStatus(state, actor, 'reflect', actor.id);
    if (trait(spec, 'shieldSelf')) { setStatus(state, actor, 'ward', actor.id); status(actor, 'ward').shield = Math.round(actor.maxHp * 0.16); }
    if (trait(spec, 'recoil')) damage(state, null, actor, actor.maxHp * 0.08, spec.id, '舍身反冲', side, { reflectable: false, ignoreWard: true, bypassDefense: true });
  }
  actor.statuses = actor.statuses.filter(effect => effect.turns > 0 && (effect.id !== 'ward' || effect.shield > 0));
}

function rotate(state, side) {
  const list = team(state, side);
  const key = fieldKey(side), before = state[key];
  const result = before.filter(index => living(list[index]));
  const capacity = state.fieldCapacity[side];
  while (result.length < capacity) {
    const next = list.findIndex((actor, index) => living(actor) && !result.includes(index));
    if (next < 0) break;
    result.push(next);
    // Replacements inherit the defeated slot's spent action for this round.
    if (state.roundOpen && !state[actedKey(side)].includes(next)) state[actedKey(side)].push(next);
    emit(state, 'switch', { actorId: list[next].id, targetId: list[next].id, side, name: list[next].name, text: `${list[next].name}上场` });
  }
  state[key] = result;
  syncAliases(state);
}
function finish(state) {
  rotate(state, 'player'); rotate(state, 'enemy');
  const p = state.party.some(living), e = state.enemies.some(living);
  if (!p || !e) {
    state.outcome = { winner: p ? 'player' : e ? 'enemy' : 'draw', reason: 'all-defeated' };
  } else if (state.round >= 24 && !state.roundOpen) {
    const score = side => team(state, side).reduce((sum, actor) => sum + actor.hp / actor.maxHp, 0) / team(state, side).length;
    const diff = score('player') - score('enemy');
    state.outcome = { winner: Math.abs(diff) < 0.015 ? 'draw' : diff > 0 ? 'player' : 'enemy', reason: 'round-limit' };
  }
  if (state.outcome) emit(state, 'end', { name: state.outcome.winner, text: `战斗结束：${state.outcome.winner}` });
}

// Old saves had one scalar active index. Preserve that formation and round count.
function migrate(state) {
  if (!DIFFICULTIES.some(level => level.id === state.difficulty)) state.difficulty = 'normal';
  if (!ENCOUNTER_DIFFICULTIES.some(level => level.id === state.encounterDifficulty)) state.encounterDifficulty = 'medium';
  for (const side of ['player', 'enemy']) {
    const list = team(state, side), key = fieldKey(side), alias = side === 'player' ? 'activePlayer' : 'activeEnemy';
    const indexes = Array.isArray(state[key]) ? state[key] : [state[alias]];
    state[key] = [...new Set(indexes)].filter(index => Number.isInteger(index) && index >= 0 && index < list.length).slice(0, FIELD_LIMIT);
    if (!state[key].length) state[key] = list.map((actor, index) => living(actor) ? index : -1).filter(index => index >= 0).slice(0, 1);
    state.fieldCapacity ??= {};
    state.fieldCapacity[side] = Math.round(numeric(state.fieldCapacity[side], Math.max(1, state[key].length), 1, FIELD_LIMIT));
    state[actedKey(side)] = Array.isArray(state[actedKey(side)]) ? [...new Set(state[actedKey(side)])].filter(index => Number.isInteger(index) && index >= 0 && index < list.length) : [];
  }
  state.roundOpen = state.roundOpen === true;
  state.inventory = inventory(state.inventory ?? []);
  state.inventorySource ??= '旧存档（无补给）';
  state.schemaVersion = 32;
  syncAliases(state);
  return state;
}
function intentIndex(state, side, intent, prefix, fallback) {
  const list = team(state, side), byId = intent[`${prefix}Id`], byIndex = intent[`${prefix}Index`];
  const index = byId !== undefined ? list.findIndex(actor => actor.id === byId) : byIndex !== undefined ? byIndex : fallback;
  if (!Number.isInteger(index) || !state[fieldKey(side)].includes(index) || !living(list[index]) || (byId !== undefined && byIndex !== undefined && byIndex !== index)) throw new RangeError(`Invalid on-field ${prefix}`);
  return index;
}
function performItem(state, actor, target, item) {
  if (!living(actor) || !startAction(state, actor, 'player')) {
    actor.statuses = actor.statuses.filter(effect => effect.turns > 0); return;
  }
  item.count--;
  emit(state, 'item', { actorId: actor.id, targetId: target.id, itemId: item.id, name: item.name, side: 'player', text: `${actor.name}对${target.name}使用${item.name}` });
  if (item.id === 'healing-potion') heal(state, target, 'player', 0.25, item.name, item.id);
  else if (item.id === 'resource-potion') {
    const value = Math.min(30, target.maxResource - target.resource); target.resource += value;
    emit(state, 'resource', { actorId: actor.id, targetId: target.id, name: item.name, value, side: 'player', text: `${target.name}恢复${value}资源` });
  } else {
    const before = target.statuses.length; target.statuses = target.statuses.filter(effect => !NEGATIVE.has(effect.id));
    emit(state, 'cleanse', { actorId: actor.id, targetId: target.id, name: item.name, value: before - target.statuses.length, side: 'player', text: `${target.name}的负面状态已清除` });
  }
  actor.statuses = actor.statuses.filter(effect => effect.turns > 0);
}
function endRound(state) {
  for (const side of ['player', 'enemy']) {
    const summon = state.summons[side];
    if (!summon) continue;
    const owner = field(state, side).find(actor => actor.id === summon.ownerId), target = field(state, other(side))[0];
    if (owner && target) damage(state, { id: summon.id, name: summon.name, hp: 1, maxHp: 1 }, target, target.maxHp * summon.power, 'summon', summon.name, side, { reflectable: false });
    summon.turns--;
    if (summon.turns <= 0 || !owner) {
      emit(state, 'dismiss', { actorId: summon.id, name: summon.name, side, text: `${summon.name}退场` }); state.summons[side] = null;
    }
  }
  if (state.round > 12) {
    const rate = Math.min(0.10, 0.025 + (state.round - 13) * 0.006);
    for (const side of ['player', 'enemy']) for (const actor of field(state, side)) damage(state, null, actor, actor.maxHp * rate, 'pressure', '战局压力', side, { reflectable: false });
  }
  for (const side of ['player', 'enemy']) for (const actor of field(state, side)) {
    actor.resource = Math.min(actor.maxResource, actor.resource + 8);
    for (const skill of actor.skills) skill.cooldownLeft = Math.max(0, skill.cooldownLeft - 1);
  }
  state.roundOpen = false; state.actedPlayers = []; state.actedEnemies = [];
}
// New clients commit a complete round. Selection is local and cannot mutate combat.
function plannedRound(inputState, commands, { enemyPlans } = {}) {
  const state = migrate(clone(inputState));
  if (state.outcome) throw new Error('Battle already ended');
  rotate(state, 'player'); rotate(state, 'enemy');
  const required = remaining(state, 'player');
  if (!Array.isArray(commands) || commands.length !== required.length || !required.length) throw new RangeError('Choose one command for every on-field actor');
  const seen = new Set(), reserves = new Set(), itemsUsed = new Map();
  const orders = commands.map(intent => {
    if (!intent || !['skill', 'basic', 'switch', 'item'].includes(intent.type)) throw new TypeError('Invalid round command');
    const index = intentIndex(state, 'player', intent, 'actor', required[0]), actor = state.party[index];
    if (!required.includes(index) || seen.has(index)) throw new RangeError('Each actor must act exactly once');
    seen.add(index);
    if (intent.type === 'switch') {
      const reserve = intent.index;
      if (status(actor, 'root') || !Number.isInteger(reserve) || !living(state.party[reserve]) || state.activePlayers.includes(reserve) || state.actedPlayers.includes(reserve) || reserves.has(reserve)) throw new RangeError('Invalid or duplicate switch target');
      reserves.add(reserve);
      return { side: 'player', index, actor, type: 'switch', reserve, priority: 6 };
    }
    if (intent.type === 'item') {
      const item = state.inventory.find(entry => entry.id === intent.itemId), used = (itemsUsed.get(intent.itemId) || 0) + 1;
      if (!item || used > item.count) throw new RangeError('Not enough items for this round');
      itemsUsed.set(item.id, used);
      const targetIndex = intent.targetId !== undefined ? state.party.findIndex(member => member.id === intent.targetId) : intent.targetIndex ?? index;
      if (!Number.isInteger(targetIndex) || !living(state.party[targetIndex])) throw new RangeError('Invalid item target');
      return { side: 'player', index, actor, type: 'item', item, target: state.party[targetIndex], priority: 5 };
    }
    const target = state.enemies[intentIndex(state, 'enemy', intent, 'target', state.activeEnemies[0])];
    if (intent.type === 'basic') return { side: 'player', index, actor, type: 'basic', skill: null, target, priority: status(actor, 'initiative') ? 1 : 0 };
    if (intent.type === 'basic' || intent.skillId === BASIC_SKILL_ID[state.packId]) return { side: 'player', index, actor, type: 'basic', skill: null, target, priority: status(actor, 'initiative') ? 1 : 0 };
    const skill = actor.skills.find(entry => entry.id === intent.skillId || entry.name === intent.skillId);
    if (!skill || !available(actor, skill)) throw new RangeError('Skill is unavailable');
    const spec = resolveSkill(skill, state.packId);
    return { side: 'player', index, actor, type: 'skill', skill, target, priority: trait(spec, 'first') ? 2 : status(actor, 'initiative') ? 1 : 0 };
  });
  // All validation above is pure; even the enemy AI cannot observe pending orders.
  for (const index of remaining(state, 'enemy')) {
    const actor = state.enemies[index], decision = enemyDecision(state, actor, { enemyPlans });
    const spec = resolveSkill(decision.skill || BASIC_SKILL_ID[state.packId], state.packId);
    orders.push({ side: 'enemy', index, actor, type: 'skill', skill: decision.skill, target: decision.target,
      priority: trait(spec, 'first') ? 2 : status(actor, 'initiative') ? 1 : 0 });
  }
  orders.sort((a, b) => b.priority - a.priority || effectiveSpeed(b.actor) - effectiveSpeed(a.actor) || (a.side === b.side ? a.index - b.index : a.side === 'player' ? -1 : 1));
  state.events = []; state.seq++;
  if (!state.roundOpen) { state.round++; state.roundOpen = true; }
  for (const order of orders) {
    const { actor, side, index } = order;
    if (!living(actor) || !state[fieldKey(side)].includes(index) || !field(state, other(side)).length) continue;
    state[actedKey(side)].push(index);
    if (order.type === 'switch') {
      if (startAction(state, actor, side)) {
        state.activePlayers[state.activePlayers.indexOf(index)] = order.reserve;
        state.actedPlayers.push(order.reserve); syncAliases(state);
        emit(state, 'switch', { actorId: actor.id, targetId: state.party[order.reserve].id, name: state.party[order.reserve].name, side, text: `${actor.name}换下，${state.party[order.reserve].name}上场` });
      }
      actor.statuses = actor.statuses.filter(effect => effect.turns > 0);
    } else if (order.type === 'item') {
      if (living(order.target)) performItem(state, actor, order.target, order.item);
    } else {
      const targets = field(state, other(side));
      const target = targets.includes(order.target) ? order.target : targets[0];
      perform(state, side, order.type === 'basic' ? null : order.skill, actor, target);
    }
    rotate(state, 'player'); rotate(state, 'enemy');
  }
  endRound(state); finish(state); syncAliases(state);
  return state;
}

export function act(inputState, intent, { enemyPlans } = {}) {
  if (intent?.type === 'round') return plannedRound(inputState, intent.commands, { enemyPlans });
  const state = migrate(clone(inputState));
  if (state.outcome) throw new Error('Battle already ended');
  if (!intent || !['skill', 'basic', 'switch', 'flee', 'item'].includes(intent.type)) throw new TypeError('Invalid battle intent');
  state.events = [];
  rotate(state, 'player'); rotate(state, 'enemy');
  if (intent.type === 'flee') {
    state.seq++;
    state.outcome = { winner: 'fled', reason: 'player-fled' };
    emit(state, 'end', { actorId: active(state, 'player')?.id, name: '逃离', side: 'player', text: '我方离开战斗' });
    return state;
  }
  const playerIndex = intentIndex(state, 'player', intent, 'actor', remaining(state, 'player')[0]);
  if (state.actedPlayers.includes(playerIndex)) throw new RangeError('Actor already acted this round');
  const player = state.party[playerIndex];
  let skill, target, item, switchIndex;
  if (intent.type === 'switch') {
    switchIndex = intent.index;
    if (status(player, 'root')) throw new RangeError('Rooted actor cannot switch');
    if (!Number.isInteger(switchIndex) || !living(state.party[switchIndex]) || state.activePlayers.includes(switchIndex) || state.actedPlayers.includes(switchIndex)) throw new RangeError('Invalid switch target');
  } else if (intent.type === 'item') {
    item = state.inventory.find(entry => entry.id === intent.itemId);
    if (!item || item.count <= 0) throw new RangeError('Item is unavailable');
    target = state.party[intentIndex(state, 'player', intent, 'target', playerIndex)];
  } else if (intent.type === 'skill') {
    skill = intent.skillId === BASIC_SKILL_ID[state.packId] ? null : player.skills.find(entry => entry.id === intent.skillId || entry.name === intent.skillId);
    if (intent.skillId !== BASIC_SKILL_ID[state.packId] && !skill) throw new RangeError('Skill is not equipped');
    if (skill && !available(player, skill)) throw new RangeError('Skill is unavailable');
    target = state.enemies[intentIndex(state, 'enemy', intent, 'target', state.activeEnemies[0])];
  } else target = state.enemies[intentIndex(state, 'enemy', intent, 'target', state.activeEnemies[0])];
  state.seq++;
  if (!state.roundOpen) { state.round++; state.roundOpen = true; }
  state.actedPlayers.push(playerIndex);
  const enemyIndex = remaining(state, 'enemy')[0], enemy = state.enemies[enemyIndex];
  const incoming = { type: intent.type, actorId: player.id,
    skillId: skill?.id || (intent.type === 'basic' || intent.skillId === BASIC_SKILL_ID[state.packId] ? BASIC_SKILL_ID[state.packId] : undefined), targetId: target?.id };
  const decision = enemy ? enemyDecision(state, enemy, { enemyPlans, incoming }) : { skill: null, target: null };
  const enemySkill = decision.skill, enemyTarget = decision.target;
  const playerAction = () => {
    if (!living(player) || !state.activePlayers.includes(playerIndex)) return;
    if (intent.type === 'switch') {
      if (startAction(state, player, 'player')) {
        state.activePlayers[state.activePlayers.indexOf(playerIndex)] = switchIndex;
        state.actedPlayers.push(switchIndex); syncAliases(state);
        emit(state, 'switch', { actorId: player.id, targetId: state.party[switchIndex].id, name: state.party[switchIndex].name, side: 'player', text: `${player.name}换下，${state.party[switchIndex].name}上场` });
      }
      player.statuses = player.statuses.filter(effect => effect.turns > 0);
    } else if (intent.type === 'item') performItem(state, player, target, item);
    else perform(state, 'player', skill, player, target);
  };
  const enemyAction = () => {
    if (!enemy || !living(enemy) || !field(state, 'player').length) return;
    state.actedEnemies.push(enemyIndex); perform(state, 'enemy', enemySkill, enemy, enemyTarget);
  };
  if (['skill', 'basic'].includes(intent.type) && enemy) {
    const priority = (actor, selected) => {
      const spec = selected ? resolveSkill(selected, state.packId) : resolveSkill(BASIC_SKILL_ID[state.packId], state.packId);
      return trait(spec, 'first') ? 2 : status(actor, 'initiative') ? 1 : 0;
    };
    const first = priority(player, skill) - priority(enemy, enemySkill);
    const actions = first > 0 || (first === 0 && effectiveSpeed(player) >= effectiveSpeed(enemy)) ? [playerAction, enemyAction] : [enemyAction, playerAction];
    for (const action of actions) { action(); rotate(state, 'player'); rotate(state, 'enemy'); }
  } else { playerAction(); rotate(state, 'player'); rotate(state, 'enemy'); enemyAction(); }
  rotate(state, 'player'); rotate(state, 'enemy');
  if (!remaining(state, 'player').length) {
    for (const index of remaining(state, 'enemy')) {
      const actor = state.enemies[index], targets = field(state, 'player');
      if (!targets.length) break;
      state.actedEnemies.push(index);
      const decision = enemyDecision(state, actor, { enemyPlans, incoming });
      perform(state, 'enemy', decision.skill, actor, decision.target);
      rotate(state, 'player'); rotate(state, 'enemy');
    }
    endRound(state);
  }
  finish(state);
  syncAliases(state);
  return state;
}

export function snapshot(state) { return migrate(clone(state)); }
export function summary(state) {
  state = migrate(clone(state));
  const player = state.party[state.activePlayer], enemy = state.enemies[state.activeEnemy];
  return { id: state.id, packId: state.packId, seq: state.seq, round: state.round, outcome: clone(state.outcome),
    player: player ? { id: player.id, name: player.name, hp: player.hp, maxHp: player.maxHp } : null,
    enemy: enemy ? { id: enemy.id, name: enemy.name, hp: enemy.hp, maxHp: enemy.maxHp } : null,
    activePlayers: [...state.activePlayers], activeEnemies: [...state.activeEnemies], remainingPlayerActions: remaining(state, 'player'), recentEvents: clone(state.events),
  };
}
