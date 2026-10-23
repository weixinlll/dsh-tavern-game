// Shared, declarative battle types. Missing legacy types remain neutral.
export const ELEMENTS = Object.freeze([
  ['neutral', '无属性'], ['physical', '武技'], ['fire', '火'], ['water', '水'],
  ['nature', '木 / 自然'], ['electric', '雷'], ['ice', '冰'], ['earth', '土 / 岩'],
  ['wind', '风'], ['light', '光'], ['shadow', '暗'], ['spirit', '灵'],
].map(([id, name]) => Object.freeze({ id, name })));
export const ELEMENT_IDS = Object.freeze(ELEMENTS.map(entry => entry.id));
const labels = Object.fromEntries(ELEMENTS.map(entry => [entry.id, entry.name]));
export const validElement = value => typeof value === 'string' && ELEMENT_IDS.includes(value);
export const validTypes = value => Array.isArray(value) && value.length >= 1 && value.length <= 2
  && new Set(value).size === value.length && value.every(validElement);
export const normalizeTypes = value => validTypes(value) ? [...value] : ['neutral'];
export const elementName = value => labels[value] || labels.neutral;
// No hard immunity: every move remains usable, even against dual resistance.
export const TYPE_CHART = Object.freeze({
  physical: { earth: 0.5, spirit: 0.5, ice: 2 },
  fire: { nature: 2, ice: 2, water: 0.5, fire: 0.5, earth: 0.5 },
  water: { fire: 2, earth: 2, nature: 0.5, water: 0.5, electric: 0.5 },
  nature: { water: 2, earth: 2, fire: 0.5, nature: 0.5, ice: 0.5 },
  electric: { water: 2, wind: 2, earth: 0.5, electric: 0.5, nature: 0.5 },
  ice: { nature: 2, wind: 2, fire: 0.5, water: 0.5, ice: 0.5 },
  earth: { electric: 2, fire: 2, wind: 0.5, nature: 0.5 },
  wind: { earth: 2, nature: 2, electric: 0.5, ice: 0.5 },
  light: { shadow: 2, spirit: 2, light: 0.5 },
  shadow: { light: 2, spirit: 2, shadow: 0.5 },
  spirit: { physical: 2, earth: 2, light: 0.5, shadow: 0.5, spirit: 0.5 },
});
export function elementEffectiveness(element, types) {
  return Math.max(0.25, Math.min(4, normalizeTypes(types).reduce((value, type) => value * (TYPE_CHART[element]?.[type] ?? 1), 1)));
}
export function sameTypeBonus(element, types) {
  return element !== 'neutral' && normalizeTypes(types).includes(element) ? 1.2 : 1;
}
export function elementsPrompt() {
  return `【属性与技能威力】角色types为1—2个不同的属性ID，未知用["neutral"]；技能element为单个属性ID。目录：${JSON.stringify(ELEMENTS)}。每个攻击技能power必须填写20—140的整数（普通威力约55—85，强攻约90—120，范围、控制附伤约25—65）；辅助/治疗技能power必须为0，不凭空附加直接伤害。属性、威力与来源及角色定位吻合，由同一次AI生成；不要四招都给140。角色使用自身属性技能伤害×1.2；克制×2、抵抗×0.5，双属性相乘限制0.25—4；无属性相互中立，无绝对免疫。克制表（攻击属性:目标属性倍率）：${JSON.stringify(TYPE_CHART)}。`;
}
