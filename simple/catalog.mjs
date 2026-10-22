// Fixed local combat vocabulary. Story text may select and rename a preset; it cannot set numbers.
export const PACKS = Object.freeze([
  { id: 'human', name: '人类对决', description: '写实的人物、兵器、格斗与计策。' },
  { id: 'fantasy', name: '玄幻 / 西幻 / 仙侠', description: '法术、灵力、仙术与异界生物。' },
]);
export const BASIC_SKILL_ID = Object.freeze({ human: 'human-0-0', fantasy: 'fantasy-0-0' });
export const TEAM_LIMIT = 6;
export const FIELD_LIMIT = 3;

export const STATUSES = Object.freeze({
  poison: { name: '中毒', kind: 'damage', duration: 3 },
  burn: { name: '灼烧', kind: 'damage', duration: 3 },
  bleed: { name: '流血', kind: 'damage', duration: 3 },
  blind: { name: '致盲', kind: 'accuracy', duration: 2 },
  charm: { name: '魅惑', kind: 'control', duration: 1 },
  paralysis: { name: '麻痹', kind: 'control', duration: 1 },
  fear: { name: '恐惧', kind: 'control', duration: 1 },
  silence: { name: '沉默', kind: 'restriction', duration: 2 },
  ward: { name: '护盾', kind: 'absorb', duration: 2 },
  guard: { name: '防御', kind: 'mitigation', duration: 1 },
  haste: { name: '迅捷', kind: 'speed', duration: 2 },
  slow: { name: '迟缓', kind: 'speed', duration: 2 },
  weaken: { name: '虚弱', kind: 'attack', duration: 2 },
  expose: { name: '破绽', kind: 'defense', duration: 2 },
  focus: { name: '凝神', kind: 'accuracy', duration: 2 },
  reflect: { name: '反击', kind: 'counter', duration: 2 },
  regen: { name: '恢复', kind: 'heal', duration: 2 },
  controlImmune: { name: '定神', kind: 'immunity', duration: 2 },
  taunt: { name: '嘲讽', kind: 'restriction', duration: 1 },
  disarm: { name: '缴械', kind: 'restriction', duration: 1 },
  confusion: { name: '混乱', kind: 'control', duration: 1 },
  sleep: { name: '睡眠', kind: 'control', duration: 1 },
  freeze: { name: '冰冻', kind: 'control', duration: 1 },
  stun: { name: '眩晕', kind: 'control', duration: 1 },
  petrify: { name: '石化', kind: 'control', duration: 1 },
  root: { name: '束缚', kind: 'restriction', duration: 2 },
  curse: { name: '诅咒', kind: 'damage', duration: 3 },
  antiHeal: { name: '禁疗', kind: 'healing', duration: 2 },
  empower: { name: '鼓舞', kind: 'attack', duration: 2 },
  fortify: { name: '壁垒', kind: 'mitigation', duration: 2 },
  evasion: { name: '闪避', kind: 'evasion', duration: 2 },
  vulnerable: { name: '易伤', kind: 'mitigation', duration: 2 },
  poisonImmune: { name: '避毒', kind: 'immunity', duration: 3 },
  burnImmune: { name: '耐火', kind: 'immunity', duration: 3 },
  bleedImmune: { name: '止血', kind: 'immunity', duration: 3 },
  lifesteal: { name: '嗜血', kind: 'heal', duration: 2 },
  berserk: { name: '狂暴', kind: 'attack', duration: 2 },
  healBoost: { name: '疗效提升', kind: 'healing', duration: 2 },
  resourceRegen: { name: '回气', kind: 'resource', duration: 3 },
  resourceLeak: { name: '漏气', kind: 'resource', duration: 3 },
  exhaustion: { name: '耗竭', kind: 'resource', duration: 2 },
  charge: { name: '蓄力', kind: 'attack', duration: 2 },
  mark: { name: '锁定', kind: 'accuracy', duration: 2 },
  armorPierce: { name: '穿甲', kind: 'attack', duration: 2 },
  healBlock: { name: '断疗', kind: 'healing', duration: 2 },
  delayedBlast: { name: '延时爆破', kind: 'damage', duration: 2 },
  protect: { name: '招架', kind: 'absorb', duration: 2 },
  sturdy: { name: '不屈', kind: 'survival', duration: 2 },
  frostbite: { name: '冻伤', kind: 'damage', duration: 3 },
  electrified: { name: '感电', kind: 'damage', duration: 3 },
  initiative: { name: '抢攻', kind: 'priority', duration: 2 },
  critReady: { name: '会心', kind: 'critical', duration: 2 },
  sureHit: { name: '必中', kind: 'accuracy', duration: 2 },
  critGuard: { name: '抗暴', kind: 'critical', duration: 2 },
  bramble: { name: '荆棘', kind: 'counter', duration: 2 },
  resistance: { name: '抗性', kind: 'immunity', duration: 2 },
  amplify: { name: '增效', kind: 'chance', duration: 2 },
  manaShield: { name: '法力护盾', kind: 'absorb', duration: 2 },
  rage: { name: '怒意', kind: 'attack', duration: 2 },
  sap: { name: '寄生', kind: 'damage', duration: 3 },
});

export const STATUS_HELP = Object.freeze({
  poison: '行动时损失3.8%最大生命', burn: '行动时损失4.5%最大生命', bleed: '行动时损失3.5%最大生命',
  blind: '命中率乘以62%', charm: '失去一次行动并受到5.5%生命反噬', paralysis: '失去一次行动', fear: '失去一次行动',
  silence: '只能使用直接攻击或群攻', ward: '吸收16%最大生命的伤害', guard: '所受伤害减少38%',
  haste: '速度提高30%', slow: '速度降低25%', weaken: '攻击伤害降低22%', expose: '受到的攻击伤害提高20%',
  focus: '命中率提高13%', reflect: '反击直接伤害的18%，最多6%攻击者生命；不递归', regen: '行动时恢复4%最大生命，消耗治疗预算',
  controlImmune: '抵抗行动控制', taunt: '只能使用基础攻击', disarm: '只能基础攻击且伤害降低28%',
  confusion: '失去一次行动并受到5.5%生命反噬', sleep: '失去一次行动', freeze: '失去一次行动', stun: '失去一次行动', petrify: '失去一次行动',
  root: '无法换人且速度降低30%', curse: '行动时损失3%生命且攻击伤害降低22%', antiHeal: '治疗效果减半', empower: '攻击伤害提高20%', fortify: '所受伤害减少22%',
  evasion: '敌方命中率乘以75%', vulnerable: '所受攻击伤害提高20%', poisonImmune: '清除并免疫中毒', burnImmune: '清除并免疫灼烧', bleedImmune: '清除并免疫流血',
  lifesteal: '攻击恢复实际伤害的18%，消耗治疗预算', berserk: '攻击伤害提高30%，但受到的攻击伤害提高15%', healBoost: '治疗效果提高30%，仍受治疗预算限制',
  resourceRegen: '行动时额外恢复10资源', resourceLeak: '行动时流失15资源', exhaustion: '技能资源消耗增加50%', charge: '下次攻击伤害提高35%后消失',
  mark: '更容易被命中，所受攻击伤害提高10%', armorPierce: '下次攻击忽略65%防御后消失', healBlock: '无法获得治疗或复苏',
  delayedBlast: '第二次行动前爆破，损失12%最大生命；可净化', protect: '抵消下一次直接攻击后消失，不抵消持续伤害',
  sturdy: '每名角色每场最多一次保留1点生命', frostbite: '行动时损失2.5%生命且攻击伤害降低15%', electrified: '行动时损失2.5%生命和6资源',
  initiative: '下次行动增加先手优先级，之后消失', critReady: '下次攻击若命中则必定暴击，出招后消失；抗暴可抵消',
  sureHit: '下次攻击跳过命中检定，之后消失；仍会被招架或护盾阻挡', critGuard: '受到的攻击不能获得暴击加成',
  bramble: '受直接攻击时返还3%攻击者最大生命，不递归触发', resistance: '负面状态的附加率减半，不能清除已有状态',
  amplify: '附加状态概率提高20个百分点，最多95%', manaShield: '用资源吸收部分伤害，最多抵消单次一半伤害',
  rage: '按自身已损生命比例提高伤害，最多提高25%', sap: '行动时损失4%生命，施术者吸收其中一半，消耗治疗预算',
});

// Keep cleansing, UI classification, and AI-generated target debuffs on one
// bounded list. Every entry below already has a local turn-resolution handler.
export const NEGATIVE_STATUS_IDS = Object.freeze([
  'poison', 'burn', 'bleed', 'blind', 'charm', 'paralysis', 'fear', 'silence', 'slow', 'weaken',
  'expose', 'taunt', 'disarm', 'confusion', 'sleep', 'freeze', 'stun', 'petrify', 'root', 'curse',
  'antiHeal', 'vulnerable', 'resourceLeak', 'exhaustion', 'mark', 'healBlock', 'delayedBlast',
  'frostbite', 'electrified', 'sap',
]);
export const GENERATION_EXTRA_STATUS_IDS = NEGATIVE_STATUS_IDS;
export const GENERATION_STATUS_COMBINATIONS = Object.freeze([
  ...GENERATION_EXTRA_STATUS_IDS.map(id => Object.freeze([id])),
  ...GENERATION_EXTRA_STATUS_IDS.flatMap((left, index) => GENERATION_EXTRA_STATUS_IDS.slice(index + 1).map(right => Object.freeze([left, right]))),
]);

const forms = {
  human: [
    ['拳', '直拳'], ['掌', '掌击'], ['腿', '踢击'], ['刀', '刀斩'], ['剑', '剑击'],
    ['枪', '枪刺'], ['弓', '箭射'], ['斧', '斧劈'], ['锤', '锤击'], ['棍', '棍扫'],
    ['匕首', '匕首刺击'], ['盾', '盾击'], ['投石', '投石'], ['摔跤', '擒摔'], ['机关', '机关触发'],
    ['战术', '战术动作'],
  ],
  fantasy: [
    ['火', '火焰术'], ['冰', '寒冰术'], ['雷', '雷霆术'], ['风', '风刃术'],
    ['水', '水流术'], ['土', '岩石术'], ['光', '圣光术'], ['影', '暗影术'],
    ['灵', '灵力术'], ['剑气', '剑气'], ['符箓', '符咒'], ['龙息', '龙息'],
    ['星', '星辰术'], ['毒藤', '藤蔓术'], ['幻', '幻术'], ['召灵', '御灵术'],
  ],
};

// Append new actual mechanical patterns only; never reorder IDs already in saved data.
const patterns = [
  ['迅击', 'damage', { power: 0.78, cost: 0, cooldown: 0, uses: 99 }],
  ['强袭', 'damage', { power: 1.24, cost: 12, cooldown: 1, uses: 6 }],
  ['破防', 'damageStatus', { power: 0.68, status: 'expose', chance: 0.8, cost: 9, cooldown: 1, uses: 5 }],
  ['追击', 'damage', { power: 0.97, accuracy: 0.87, cost: 6, cooldown: 0, uses: 8 }],
  ['致盲', 'damageStatus', { power: 0.50, status: 'blind', chance: 0.82, cost: 12, cooldown: 2, uses: 4 }],
  ['迷心', 'damageStatus', { power: 0.40, status: 'charm', chance: 0.58, cost: 18, cooldown: 3, uses: 2 }],
  ['麻痹', 'damageStatus', { power: 0.42, status: 'paralysis', chance: 0.55, cost: 18, cooldown: 3, uses: 2 }],
  ['威吓', 'damageStatus', { power: 0.43, status: 'fear', chance: 0.62, cost: 15, cooldown: 3, uses: 3 }],
  ['封招', 'damageStatus', { power: 0.45, status: 'silence', chance: 0.78, cost: 14, cooldown: 2, uses: 3 }],
  ['施毒', 'damageStatus', { power: 0.52, status: 'poison', chance: 0.85, cost: 11, cooldown: 2, uses: 4 }],
  ['灼伤', 'damageStatus', { power: 0.54, status: 'burn', chance: 0.85, cost: 11, cooldown: 2, uses: 4 }],
  ['割裂', 'damageStatus', { power: 0.55, status: 'bleed', chance: 0.85, cost: 11, cooldown: 2, uses: 4 }],
  ['守势', 'selfStatus', { status: 'guard', cost: 5, cooldown: 1, uses: 8 }],
  ['护体', 'selfStatus', { status: 'ward', cost: 12, cooldown: 2, uses: 5 }],
  ['聚神', 'selfStatus', { status: 'focus', cost: 7, cooldown: 1, uses: 7 }],
  ['迅身', 'selfStatus', { status: 'haste', cost: 7, cooldown: 1, uses: 7 }],
  ['反制', 'selfStatus', { status: 'reflect', cost: 10, cooldown: 2, uses: 4 }],
  ['回生', 'heal', { heal: 0.19, cost: 17, cooldown: 3, uses: 3 }],
  ['净化', 'cleanse', { cost: 14, cooldown: 2, uses: 4 }],
  ['召援', 'summon', { cost: 18, cooldown: 4, uses: 2 }],
  ['迟滞', 'damageStatus', { power: 0.49, status: 'slow', chance: 0.82, cost: 9, cooldown: 2, uses: 4 }],
  ['削弱', 'damageStatus', { power: 0.49, status: 'weaken', chance: 0.82, cost: 9, cooldown: 2, uses: 4 }],
  ['续生', 'selfStatus', { status: 'regen', cost: 14, cooldown: 3, uses: 3 }],
  ['汲命', 'lifeDrain', { power: 0.59, cost: 13, cooldown: 2, uses: 4 }],
  ['夺能', 'resourceDrain', { power: 0.40, cost: 11, cooldown: 2, uses: 4 }],
  ['横扫', 'areaDamage', { power: 0.49, cost: 20, cooldown: 3, uses: 3 }],
  ['复苏', 'revive', { cost: 30, cooldown: 5, uses: 1 }],
  ['驱益', 'dispel', { cost: 13, cooldown: 2, uses: 4 }],
  ['挑衅', 'damageStatus', { power: 0.36, status: 'taunt', chance: 0.9, cost: 12, cooldown: 2, uses: 4 }],
  ['缴械', 'damageStatus', { power: 0.42, status: 'disarm', chance: 0.8, cost: 13, cooldown: 2, uses: 4 }],
  ['惑乱', 'damageStatus', { power: 0.36, status: 'confusion', chance: 0.62, cost: 17, cooldown: 3, uses: 2 }],
  ['催眠', 'damageStatus', { power: 0.34, status: 'sleep', chance: 0.55, cost: 18, cooldown: 3, uses: 2 }],
  ['冰封', 'damageStatus', { power: 0.34, status: 'freeze', chance: 0.55, cost: 18, cooldown: 3, uses: 2 }],
  ['震晕', 'damageStatus', { power: 0.34, status: 'stun', chance: 0.55, cost: 18, cooldown: 3, uses: 2 }],
  ['石化', 'damageStatus', { power: 0.31, status: 'petrify', chance: 0.48, cost: 20, cooldown: 4, uses: 2 }],
  ['束缚', 'damageStatus', { power: 0.46, status: 'root', chance: 0.82, cost: 12, cooldown: 2, uses: 4 }],
  ['诅咒', 'damageStatus', { power: 0.39, status: 'curse', chance: 0.78, cost: 15, cooldown: 2, uses: 3 }],
  ['禁疗', 'damageStatus', { power: 0.41, status: 'antiHeal', chance: 0.78, cost: 15, cooldown: 2, uses: 3 }],
  ['鼓舞', 'selfStatus', { status: 'empower', cost: 9, cooldown: 2, uses: 5 }],
  ['壁垒', 'selfStatus', { status: 'fortify', cost: 11, cooldown: 2, uses: 5 }],
  ['闪身', 'selfStatus', { status: 'evasion', cost: 12, cooldown: 2, uses: 4 }],
  ['易伤', 'damageStatus', { status: 'vulnerable', power: 0.42, chance: 0.8, cost: 12, cooldown: 2, uses: 4 }],
  ['避毒', 'selfStatus', { status: 'poisonImmune', cost: 9, cooldown: 3, uses: 3 }],
  ['耐火', 'selfStatus', { status: 'burnImmune', cost: 9, cooldown: 3, uses: 3 }],
  ['止血', 'selfStatus', { status: 'bleedImmune', cost: 9, cooldown: 3, uses: 3 }],
  ['嗜血', 'selfStatus', { status: 'lifesteal', cost: 14, cooldown: 3, uses: 3 }],
  ['狂暴', 'selfStatus', { status: 'berserk', cost: 12, cooldown: 3, uses: 3 }],
  ['疗效', 'selfStatus', { status: 'healBoost', cost: 10, cooldown: 3, uses: 3 }],
  ['回气', 'selfStatus', { status: 'resourceRegen', cost: 6, cooldown: 4, uses: 2 }],
  ['漏气', 'damageStatus', { status: 'resourceLeak', power: 0.36, chance: 0.8, cost: 12, cooldown: 2, uses: 4 }],
  ['耗竭', 'damageStatus', { status: 'exhaustion', power: 0.38, chance: 0.8, cost: 13, cooldown: 2, uses: 4 }],
  ['蓄力', 'selfStatus', { status: 'charge', cost: 8, cooldown: 2, uses: 4 }],
  ['锁定', 'damageStatus', { status: 'mark', power: 0.38, chance: 0.9, cost: 9, cooldown: 2, uses: 4 }],
  ['穿甲', 'selfStatus', { status: 'armorPierce', cost: 11, cooldown: 2, uses: 4 }],
  ['断疗', 'damageStatus', { status: 'healBlock', power: 0.35, chance: 0.72, cost: 16, cooldown: 3, uses: 3 }],
  ['爆破', 'damageStatus', { status: 'delayedBlast', power: 0.28, chance: 0.9, cost: 15, cooldown: 3, uses: 3 }],
  ['招架', 'selfStatus', { status: 'protect', cost: 15, cooldown: 3, uses: 3 }],
  ['不屈', 'selfStatus', { status: 'sturdy', cost: 18, cooldown: 4, uses: 2 }],
  ['冻伤', 'damageStatus', { status: 'frostbite', power: 0.4, chance: 0.8, cost: 12, cooldown: 2, uses: 4 }],
  ['感电', 'damageStatus', { status: 'electrified', power: 0.4, chance: 0.8, cost: 12, cooldown: 2, uses: 4 }],
  ['先制', 'damage', { power: 0.66, mechanics: ['first'], cost: 10, cooldown: 1, uses: 6 }],
  ['必暴', 'damage', { power: 0.7, mechanics: ['critical'], cost: 15, cooldown: 2, uses: 4 }],
  ['必中', 'damage', { power: 0.73, mechanics: ['sureHit'], cost: 10, cooldown: 1, uses: 6 }],
  ['连击', 'damage', { power: 0.94, mechanics: ['multiHit'], cost: 15, cooldown: 2, uses: 4 }],
  ['破盾', 'damage', { power: 0.73, mechanics: ['shieldPierce'], cost: 13, cooldown: 2, uses: 4 }],
  ['斩杀', 'damage', { power: 0.85, mechanics: ['execute'], cost: 15, cooldown: 2, uses: 4 }],
  ['舍身', 'damage', { power: 1.3, mechanics: ['recoil'], cost: 10, cooldown: 2, uses: 4 }],
  ['锐击', 'damage', { power: 0.88, mechanics: ['highCrit'], cost: 10, cooldown: 1, uses: 6 }],
  ['抢攻', 'selfStatus', { status: 'initiative', cost: 7, cooldown: 2, uses: 4 }],
  ['会心', 'selfStatus', { status: 'critReady', cost: 12, cooldown: 2, uses: 4 }],
  ['定准', 'selfStatus', { status: 'sureHit', cost: 8, cooldown: 2, uses: 4 }],
  ['抗暴', 'selfStatus', { status: 'critGuard', cost: 11, cooldown: 2, uses: 4 }],
  ['荆棘', 'selfStatus', { status: 'bramble', cost: 12, cooldown: 3, uses: 3 }],
  ['抗性', 'selfStatus', { status: 'resistance', cost: 12, cooldown: 3, uses: 3 }],
  ['增效', 'selfStatus', { status: 'amplify', cost: 12, cooldown: 2, uses: 4 }],
  ['法盾', 'selfStatus', { status: 'manaShield', cost: 8, cooldown: 2, uses: 4 }],
  ['怒意', 'selfStatus', { status: 'rage', cost: 10, cooldown: 3, uses: 3 }],
  ['寄生', 'damageStatus', { power: 0.35, status: 'sap', chance: 0.8, cost: 16, cooldown: 3, uses: 3 }],
  ['回疗击', 'damage', { power: 0.6, mechanics: ['healSelf'], cost: 18, cooldown: 3, uses: 3 }],
  ['反击势', 'damage', { power: 0.55, mechanics: ['counter'], cost: 15, cooldown: 2, uses: 4 }],
  ['定神', 'selfStatus', { status: 'controlImmune', cost: 14, cooldown: 3, uses: 3 }],
];

const descriptions = {
  damage: '造成一次直接伤害', damageStatus: '造成伤害并有概率附加状态',
  selfStatus: '为自身施加状态', heal: '恢复自身生命', cleanse: '移除自身负面状态',
  summon: '召出短暂援手进行协战',
  lifeDrain: '造成伤害并吸收部分生命', resourceDrain: '造成伤害并夺取资源',
  areaDamage: '攻击敌方全队（包括后备）', revive: '复活一名倒下的队友',
  dispel: '驱散敌方增益状态',
};

// Composable, finite mechanics. Neither stories nor models may supply formulas.
export const MECHANICS = Object.freeze({
  first: '先手等级2，优先于普通招式；同级比较速度',
  critical: '命中时必定暴击，伤害×1.5；抗暴可抵消',
  sureHit: '跳过命中检定；不绕过控制、招架和护盾',
  multiHit: '分为3段伤害，共享一次伤害总预算；不获得3倍总伤害',
  shieldPierce: '穿过普通护盾；不等于穿过招架或无敌',
  armorPierce: '本次忽略65%防御', execute: '目标低于30%生命时伤害提高25%，仍受单招上限限制',
  recoil: '出招后自身损失8%最大生命', highCrit: '命中时有40%概率暴击，伤害×1.5',
  drain: '恢复实际伤害的18%，受治疗预算限制', resourceDrain: '命中后最多夺取15资源，自身最多获得8',
  cleanseSelf: '出招后清除自身最多2个负面状态', dispelTarget: '命中后驱散目标最多2个增益',
  healSelf: '出招后恢复10%最大生命，受治疗预算限制', counter: '出招后获得2次行动的反击姿态',
  shieldSelf: '出招后获得16%最大生命的护盾',
});
const mechanicRules = [
  ['first', /必定先(?:手|攻|攻击)|必先|先制|先攻|先发制人|priority attack|quick attack/i],
  ['critical', /必定暴击|必暴|必然暴击|guaranteed crit|always crit/i],
  ['sureHit', /必中|必定命中|never miss|sure hit/i],
  ['multiHit', /连击|多段|连续.{0,8}(?:攻击|打击)|multi.?hit|double strike|triple/i],
  ['shieldPierce', /破盾|穿盾|穿透护盾|无视护盾|shield pierc/i],
  ['armorPierce', /穿甲|贯穿|无视防御|armor pierc/i], ['execute', /斩杀|处决|低血.{0,5}增伤|execute/i],
  ['recoil', /舍身|反冲|自损|recoil/i], ['highCrit', /高暴击|暴击率提高|会心率|high crit/i],
  ['drain', /吸血|汲命|生命吸取|噬血|life drain/i], ['resourceDrain', /吸蓝|吸魔|夺能|抽取灵力|mana drain/i],
  ['cleanseSelf', /净化自身|解除自身.{0,6}(?:负面|异常)|self cleanse/i],
  ['dispelTarget', /驱散(?:敌方|目标|敌人).{0,6}增益|dispel target/i],
  ['healSelf', /恢复自身生命|攻击.{0,6}回血|self heal/i], ['counter', /反击|反制|反弹|counter|reflect/i],
  ['shieldSelf', /攻击.{0,8}(?:护盾|护体)|出招.{0,8}护盾|self shield/i],
];

const skills = [];
for (const packId of ['human', 'fantasy']) {
  forms[packId].forEach(([theme, base], themeIndex) => {
    patterns.forEach(([suffix, kind, config], patternIndex) => {
      const name = `${base}·${suffix}`;
      const statusName = config.status ? `（${STATUSES[config.status].name}）` : '';
      skills.push(Object.freeze({
        id: `${packId}-${themeIndex}-${patternIndex}`, packId, name,
        description: `${descriptions[kind]}${statusName}。${config.status ? `${STATUS_HELP[config.status]}；持续${STATUSES[config.status].duration}次行动${config.chance ? `，附加率${Math.round(config.chance * 100)}%` : ''}。` : ''}${(config.mechanics || []).map(id => MECHANICS[id]).join('；')}`,
        theme, kind, ...config,
      }));
    });
  });
}
export const SKILLS = Object.freeze(skills);
const byId = new Map(SKILLS.map(skill => [skill.id, skill]));

// The model sees one canonical ID per executable profile. Theme-specific names
// remain available in SKILLS, while the generated name supplies character flavor.
export function generationEffectCatalog(packId = 'human') {
  if (!getPack(packId)) throw new RangeError(`Unknown fixed pack: ${packId}`);
  return Object.freeze(SKILLS.filter(skill => skill.packId === packId && skill.id.startsWith(`${packId}-0-`)
    && skill.id !== BASIC_SKILL_ID[packId]).map(skill => Object.freeze({
    baseId: skill.id, name: skill.name, kind: skill.kind, description: skill.description,
    ...(skill.status ? { status: skill.status } : {}), ...(skill.mechanics?.length ? { mechanics: skill.mechanics } : {}),
  })));
}

export function getPack(id = 'human') {
  return PACKS.find(pack => pack.id === id) ?? null;
}

const semanticRules = [
  [/控制免疫|免控|免受控制|control immunity/i, 80],
  [/抢攻姿态|先手姿态|抢攻|initiative stance/i, 68], [/会心姿态|暴击准备|下次.*必[定然]?暴击|critical stance/i, 69],
  [/定准|必中姿态|下次.*必中|sure.?hit stance/i, 70], [/抗暴|防暴击|暴击免疫|crit.*immun/i, 71],
  [/荆棘|thorn|bramble/i, 72], [/状态抗性|异常抗性|抗性提升|status resistance/i, 73],
  [/增效|效果命中提高|附加率提高|effect amplify/i, 74], [/法力护盾|法盾|灵力护盾|mana shield/i, 75],
  [/怒意|怒火|越战越勇|rage/i, 76], [/寄生|蛊蚀|leech seed|parasite/i, 77],
  [/必定先(?:手|攻|攻击)|必先|先制|先攻|先发制人|必定先攻击|priority attack|quick attack/i, 60],
  [/必定暴击|必暴|必然暴击|guaranteed crit|always crit/i, 61], [/必中|必定命中|never miss|sure hit/i, 62],
  [/连击|多段|连续.*击|multi.?hit|double strike|triple/i, 63], [/破盾|穿盾|穿透护盾|shield pierc/i, 64],
  [/斩杀|处决|低血.*增伤|execute/i, 65], [/舍身|反冲|自损|recoil/i, 66], [/暴击率提高|高暴击|会心率|high crit/i, 67],
  [/避毒|毒免|免疫中毒|poison immunity/i, 42], [/耐火|火免|免疫灼烧|burn immunity/i, 43],
  [/止血|流血免疫|免疫流血|bleed immunity/i, 44], [/闪避|闪身|残影|隐身|潜行|evasion|stealth/i, 40],
  [/易伤|脆弱|vulnerab/i, 41], [/嗜血|吸血姿态|lifesteal stance/i, 45],
  [/狂暴|暴走|berserk/i, 46], [/疗效提升|治疗强化|heal boost/i, 47],
  [/回气|回蓝|灵力恢复|法力恢复|mana regen/i, 48], [/漏气|漏蓝|灵力流失|mana leak/i, 49],
  [/耗竭|法力消耗增加|exhaustion/i, 50], [/蓄力|蓄势|charge up/i, 51],
  [/锁定|标记|追踪印|mark target/i, 52], [/穿甲|贯穿|无视防御|armor pierc/i, 53],
  [/断疗|治疗无效|禁止恢复|heal block/i, 54], [/延时|爆破|炸弹|定时|delayed blast/i, 55],
  [/招架|抵挡下次|格挡下次|protect next/i, 56], [/不屈|免死|毅力|sturdy/i, 57],
  [/冻伤|frostbite/i, 58], [/感电|electrified/i, 59],
  [/时间停止|时停|暂停时间|永恒禁锢|time stop/i, 33], [/一击必杀|即死|秒杀|瞬杀|抹杀|instant kill/i, 1],
  [/无敌|绝对免疫|全免疫|不死|永生/, 39],
  [/吸血|汲命|生命吸取|噬血|life drain/i, 23], [/吸蓝|吸魔|夺能|抽取灵力|资源掠夺|mana drain/i, 24],
  [/群攻|范围|横扫|全体攻击|波及所有/, 25], [/复活|复苏|起死回生/, 26],
  [/驱散增益|驱益|破除强化|解除护盾/, 27], [/挑衅|嘲讽/, 28], [/缴械|卸兵/, 29],
  [/混乱|惑乱|神志不清|confus/i, 30], [/睡眠|催眠|昏睡|sleep/i, 31],
  [/冰冻|冰封|冻结/, 32], [/眩晕|震晕|昏厥/, 33],
  [/石化|化石/, 34], [/束缚|禁足|缠绕|定根/, 35],
  [/诅咒|咒蚀/, 36], [/禁疗|疗效阻断|无法治疗/, 37],
  [/鼓舞|强化攻击|激励/, 38], [/壁垒|强化防御|坚壁/, 39],
  [/持续恢复|再生|续生|缓慢治疗/, 22], [/削弱|虚弱|疲惫/, 21], [/迟滞|减速|迟缓/, 20],
  [/召|唤|傀儡|使魔|援手|召援|summon/i, 19], [/净|解毒|驱散|祛|清除|cleanse/i, 18],
  [/治疗|疗伤|治愈|恢复|回生|回春|回复/, 17], [/反弹|反击|反制/, 16],
  [/加速|迅捷|疾行|迅身/, 15], [/凝神|专注|聚神|瞄准/, 14],
  [/护盾|护体|结界|屏障/, 13], [/防御|守势|格挡/, 12],
  [/流血|割裂|出血|重伤|bleed/i, 11], [/灼伤|燃烧|火焰|烈焰|burn/i, 10],
  [/毒|腐蚀|poison/i, 9], [/沉默|封招|禁言|封印|silence/i, 8],
  [/恐惧|威吓|震慑|fear/i, 7], [/麻痹|电击|定身|paraly/i, 6],
  [/魅惑|迷心|迷惑|催眠|charm/i, 5], [/致盲|失明|烟幕|blind/i, 4],
  [/破防|破甲|削甲/, 2], [/重击|强袭|猛击|必杀/, 1],
];

export function resolveSkill(input, packId = 'human') {
  if (!getPack(packId)) throw new RangeError(`Unknown fixed pack: ${packId}`);
  const requested = typeof input === 'string' ? { id: input, name: input } : input ?? {};
  const text = String(requested.name ?? requested.id ?? '').trim().slice(0, 80);
  const id = String(requested.baseId ?? requested.id ?? '').trim().split('~')[0];
  const exact = byId.get(id) ?? SKILLS.find(s => s.packId === packId && (s.name === text || s.name === id));
  const sourceDescription = String(requested.sourceDescription ?? requested.description ?? '').slice(0, 400);
  const story = `${text} ${sourceDescription}`;
  const themeIndex = Math.max(0, forms[packId].findIndex(([theme, base]) => story.includes(theme) || story.includes(base)));
  const matched = semanticRules.find(([rule]) => rule.test(story));
  const basicName = /^(?:普通|基础|快速)?(?:拳击|直拳|掌击|踢击|挥剑|剑斩|刀斩|快剑|剑击|刀砍|斧劈|锤击|枪刺|箭射|斩击|刺击|攻击|strike|attack|punch|slash)$/i.test(text);
  const basicAction = id === BASIC_SKILL_ID[packId] || basicName;
  const fallbackPattern = basicAction ? 0 : 1;
  const preset = exact?.packId === packId ? exact : byId.get(`${packId}-${themeIndex}-${matched?.[1] ?? fallbackPattern}`);
  const offensive = ['damage', 'damageStatus', 'areaDamage', 'lifeDrain', 'resourceDrain'].includes(preset.kind);
  const compiled = !!exact && Array.isArray(requested.mechanics);
  const provided = Array.isArray(requested.mechanics) ? requested.mechanics.slice(0, 20) : [];
  const mechanics = [...new Set([...(preset.mechanics || []), ...provided, ...(compiled ? [] : mechanicRules.filter(([, rule]) => rule.test(story)).map(([key]) => key))])].filter(key => Object.hasOwn(MECHANICS, key) && (offensive || ['first', 'cleanseSelf', 'healSelf', 'counter', 'shieldSelf'].includes(key))).sort();
  const effectText = story.replace(/(?:免疫|抵抗|不受|清除)(?:中毒|灼烧|流血|魅惑|麻痹|眩晕|冰冻|石化)/g, '');
  const inferred = offensive && !compiled ? semanticRules.filter(([rule, index]) => patterns[index][1] === 'damageStatus' && rule.test(effectText)).map(([, index]) => patterns[index][2].status) : [];
  const requestedStatuses = Array.isArray(requested.extraStatuses) ? requested.extraStatuses.slice(0, 8) : [];
  const allStatuses = [...new Set([...inferred, ...requestedStatuses])].filter(key => key !== preset.status && STATUSES[key] && ['damage', 'accuracy', 'control', 'restriction', 'attack', 'defense', 'speed', 'healing', 'resource', 'mitigation'].includes(STATUSES[key].kind));
  const extraStatuses = offensive ? allStatuses.slice(0, 2) : [];
  const notes = [];
  if (allStatuses.length > 2) notes.push('额外异常最多2种，其余效果已省略');
  if (provided.some(key => !Object.hasOwn(MECHANICS, key))) notes.push('未支持的机制标签已忽略');
  const recognized = compiled && requested.mappingKnown === false ? false : !!exact || !!matched || basicName;
  if (!recognized && !mechanics.length && !extraStatuses.length) notes.push('效果未识别，暂用限次特殊攻击效果；可补充技能说明后保存');
  const added = mechanics.filter(key => !(preset.mechanics || []).includes(key));
  const signature = JSON.stringify([mechanics, extraStatuses, !recognized && !basicAction ? text : '']);
  let hash = 2166136261;
  for (const ch of signature) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
  const variant = added.length || extraStatuses.length || (!recognized && !basicAction);
  const labels = added.map(key => MECHANICS[key]);
  labels.push(...extraStatuses.map(key => `额外附加${STATUSES[key].name}：${STATUS_HELP[key]}（附加率${STATUSES[key].kind === 'control' ? 50 : 70}%）`));
  return { ...preset, baseId: preset.id, id: variant ? `${preset.id}~${hash.toString(36)}` : preset.id,
    displayName: text && text !== requested.id && text !== preset.id ? text : preset.name,
    mechanics, extraStatuses, sourceDescription: sourceDescription.slice(0, 160), recognized: recognized || mechanics.length > 0 || extraStatuses.length > 0, notes,
    description: [preset.description, ...labels, ...notes].join('；').slice(0, 1300),
    cost: variant ? Math.min(30, Math.max(8, preset.cost + added.length * 3 + extraStatuses.length * 3)) : preset.cost,
    cooldown: variant ? Math.max(preset.cooldown, added.length + extraStatuses.length >= 3 ? 2 : 1) : preset.cooldown,
    uses: variant ? Math.min(preset.uses, 6) : preset.uses };
}
