const avatar = (gender, id) => Object.freeze({ gender, category: 'human', src: `human/sprite/defaults/${id}-actions-v1.png` });
const starterAvatar = gender => Object.freeze({ gender, category: 'human', src: `human/sprite/adventurer-${gender}-actions-v1.png` });
const animal = id => Object.freeze({ gender: 'animal', category: 'animal', src: `human/sprite/defaults/${id}-actions-v1.png` });
export const DEFAULT_AVATARS = Object.freeze({
  'starter-male': starterAvatar('male'),
  'starter-female': starterAvatar('female'),
  'jade-swordsman': avatar('male', 'jade-swordsman'),
  'crimson-duelist': avatar('female', 'crimson-duelist'),
  'frost-mage': avatar('female', 'frost-mage'),
  'iron-guardian': avatar('male', 'iron-guardian'),
  'forest-ranger': avatar('female', 'forest-ranger'),
  'amber-monk': avatar('male', 'amber-monk'),
  'moonlit-spear-guard': avatar('female', 'moonlit-spear-guard'),
  'ember-gunslinger': avatar('female', 'ember-gunslinger'),
  'azure-healer': avatar('female', 'azure-healer'),
  'mountain-exorcist': avatar('male', 'mountain-exorcist'),
  'shadow-assassin': avatar('male', 'shadow-assassin'),
  'clockwork-knight': avatar('female', 'clockwork-knight'),
  'storm-lancer': avatar('male', 'storm-lancer'),
  'desert-falconer': avatar('female', 'desert-falconer'),
  'beastkeeper': avatar('male', 'beastkeeper'),
  'star-oracle': avatar('female', 'star-oracle'),
  'thunder-priest': avatar('male', 'thunder-priest'),
  'lingxiao-cultivator': avatar('male', 'lingxiao-cultivator'),
  'dawn-paladin': avatar('male', 'dawn-paladin'),
  'bamboo-alchemist': avatar('male', 'bamboo-alchemist'),
  'dusk-ronin': avatar('male', 'dusk-ronin'),
  'scarlet-sorceress': avatar('female', 'scarlet-sorceress'),
  'frost-archer': avatar('female', 'frost-archer'),
  'lotus-dancer': avatar('female', 'lotus-dancer'),
  'desert-sentinel': avatar('male', 'desert-sentinel'),
  'violet-assassin': avatar('female', 'violet-assassin'),
  'scholar-swordsman': avatar('male', 'scholar-swordsman'),
  'sun-priestess': avatar('female', 'sun-priestess'),
  'obsidian-brawler': avatar('male', 'obsidian-brawler'),
  'jade-lancer': avatar('female', 'jade-lancer'),
  'moon-elf-archer': avatar('female', 'moon-elf-archer'),
  'dwarven-artificer': avatar('male', 'dwarven-artificer'),
  'pirate-captain': avatar('male', 'pirate-captain'),
  'night-ninja': avatar('female', 'night-ninja'),
  'vampire-duelist': avatar('male', 'vampire-duelist'),
  'wandering-bard': avatar('female', 'wandering-bard'),
  'silver-wolf': animal('silver-wolf'),
  'ember-fox': animal('ember-fox'),
  'snow-tiger': animal('snow-tiger'),
  'raven-scout': animal('raven-scout'),
  'azure-eastern-dragon': animal('azure-eastern-dragon'),
  'western-dragon': animal('western-dragon'),
  qilin: animal('qilin'),
  xuanwu: animal('xuanwu'),
  'forest-fae': animal('forest-fae'),
  phoenix: animal('phoenix'),
  pegasus: animal('pegasus'),
  griffin: animal('griffin'),
  unicorn: animal('unicorn'),
  'nine-tail-fox': animal('nine-tail-fox'),
  thunderbird: animal('thunderbird'),
  'sea-serpent': animal('sea-serpent'),
});

export const DEFAULT_AVATAR_IDS = Object.freeze(Object.keys(DEFAULT_AVATARS));

export function avatarSelectionPrompt() {
  const roles = ['徒手冒险者男', '徒手冒险者女', '青衣剑客', '红衣剑士', '冰法师', '重甲守卫', '弓箭游侠', '僧人', '长枪女卫', '火枪手', '医师', '道士', '暗影刺客', '机械骑士', '雷枪战士', '猎鹰师', '御兽师', '占星师', '雷术道士', '修仙剑修', '圣骑士', '炼丹师', '浪人武士', '红衣术士', '冰弓手', '舞者', '沙漠守卫', '女刺客', '书生剑客', '祭司', '黑甲战士', '玉甲枪客', '精灵弓手', '矮人工匠', '海盗', '忍者', '吸血鬼贵族', '吟游诗人', '狼', '狐狸', '白虎', '乌鸦', '东方龙', '西方龙', '麒麟', '玄武', '妖精', '凤凰', '天马', '狮鹫', '独角兽', '九尾狐', '雷鸟', '海蛇'];
  return '外观由你按人物性别、物种、武器与职业选最匹配的avatarId，不按名字随机抽、不生成图片链接；不要把明确的人类选成动物。目录：' + DEFAULT_AVATAR_IDS.map((id, index) => `${id}=${roles[index]}(${DEFAULT_AVATARS[id].gender})`).join('；');
}

export function validDefaultAvatarId(value) {
  return typeof value === 'string' && Object.hasOwn(DEFAULT_AVATARS, value);
}

export function normalizeGender(value) {
  if (value === 'male' || value === 'female') return value;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (['男', '男性', 'm', 'man'].includes(normalized)) return 'male';
  if (['女', '女性', 'f', 'woman'].includes(normalized)) return 'female';
  return undefined;
}

function hash(value) {
  let result = 0x811c9dc5;
  for (const character of value) {
    result ^= character.codePointAt(0);
    result = Math.imul(result, 0x01000193) >>> 0;
  }
  return result >>> 0;
}

const ANIMAL_WORDS = /(?:狼|狐|虎|猫|犬|狗|豹|鸟|鸦|鹰|鹿|蛇|蜥|蜘蛛|蟒|狮|龟|熊猫|黑熊|白熊|熊妖|龙|麒麟|玄武|凤凰|天马|飞马|狮鹫|独角兽|灵狐|神鸟|雷鸟|海蛇|蛟龙|精灵|仙子|花妖|妖精|wolf|fox|tiger|raven|crow|eagle|bear|deer|snake|dragon|qilin|phoenix|pegasus|griffin|unicorn|thunderbird|fairy|fae|beast|animal|creature|pet|monster|灵兽|妖兽|宠物|野兽)/i;
const ANIMAL_KIND = /^(?:animal|beast|creature|pet|monster|灵兽|妖兽|宠物|野兽|动物)$/i;
const HUMAN_KIND = /^(?:human|person|humanoid|人类|人族|凡人|人形)$/i;
const HUMAN_SPECIES = /^(?:human|person|humanoid|人类|人族|凡人|人形)$/i;
const SPECIES_AVATARS = [
  [/(?:东方龙|青龙|东海龙|azure dragon|eastern dragon)/i, 'azure-eastern-dragon'],
  [/(?:西方龙|western dragon|red dragon|黑龙|金龙|赤龙)/i, 'western-dragon'],
  [/(?:麒麟|qilin)/i, 'qilin'], [/(?:玄武|龟蛇|xuanwu|tortoise)/i, 'xuanwu'],
  [/(?:凤凰|凤鸟|phoenix)/i, 'phoenix'], [/(?:天马|飞马|pegasus)/i, 'pegasus'],
  [/(?:狮鹫|griffin)/i, 'griffin'], [/(?:独角兽|unicorn)/i, 'unicorn'],
  [/(?:九尾狐|灵狐|狐妖|nine.?tail.?fox)/i, 'nine-tail-fox'],
  [/(?:雷鸟|雷云神鸟|thunderbird)/i, 'thunderbird'],
  [/(?:海蛇|蛟龙|海龙|sea serpent)/i, 'sea-serpent'],
  [/(?:森林精灵|萤森精灵|仙子|花妖|妖精|forest fae|fairy|fae)/i, 'forest-fae'],
  [/(?:狼|wolf)/i, 'silver-wolf'], [/(?:狐|fox)/i, 'ember-fox'],
  [/(?:虎|tiger)/i, 'snow-tiger'], [/(?:鸦|乌鸦|鸟|raven|crow|eagle)/i, 'raven-scout'],
  [/(?:龙|dragon)/i, 'western-dragon'],
];

export function chooseDefaultAvatar({ id = '', name = '', gender, species = '', kind = '', description = '' } = {}) {
  const normalizedKind = String(kind).trim();
  const normalizedSpecies = String(species).trim();
  const identity = `${name} ${normalizedSpecies}`;
  // Explicit human metadata wins over animal words that may appear in a title or nickname.
  const explicitHuman = HUMAN_KIND.test(normalizedKind) || HUMAN_SPECIES.test(normalizedSpecies);
  const wantsAnimal = !explicitHuman && (ANIMAL_KIND.test(normalizedKind) || ANIMAL_WORDS.test(identity));
  const category = wantsAnimal ? 'animal' : 'human';
  if (wantsAnimal) {
    const specific = SPECIES_AVATARS.slice(0, 12);
    const common = SPECIES_AVATARS.slice(12, 16);
    const generic = SPECIES_AVATARS.slice(16);
    const matchedSpecies = specific.find(([pattern]) => pattern.test(normalizedSpecies))
      || specific.find(([pattern]) => pattern.test(name))
      || common.find(([pattern]) => pattern.test(normalizedSpecies))
      || common.find(([pattern]) => pattern.test(name))
      || generic.find(([pattern]) => pattern.test(normalizedSpecies))
      || generic.find(([pattern]) => pattern.test(name));
    if (matchedSpecies && validDefaultAvatarId(matchedSpecies[1])) return matchedSpecies[1];
  }
  const normalizedGender = normalizeGender(gender);
  const pool = DEFAULT_AVATAR_IDS.filter(avatarId => DEFAULT_AVATARS[avatarId].category === category
    && (category === 'animal' || !normalizedGender || DEFAULT_AVATARS[avatarId].gender === normalizedGender));
  // Enemy positional IDs repeat between encounters; include the name for a fresh
  // character's draw. The chosen avatarId itself is retained on later renames.
  return pool[hash(`${id}\u0000${name || 'actor'}`) % pool.length];
}

// Pick once per actor, not once per render or turn. A bounded human range changes
// outfit palettes while limiting skin-tone drift; creatures can use the full wheel.
export function chooseDefaultHue({ id = '', name = '', avatarId = '' } = {}) {
  const roll = hash(`hue\u0000${id}\u0000${name || 'actor'}\u0000${avatarId}`);
  if (DEFAULT_AVATARS[avatarId]?.category === 'animal') return (roll % 361) - 180;
  return (roll % 73) - 36;
}

export function validDefaultHue(value) {
  return Number.isInteger(value) && value >= -180 && value <= 180;
}

// A palette is rolled once when an actor is created and then stored with that
// actor. Random values are deliberately separate from the combat PRNG so
// appearance generation cannot change hit/critical outcomes.
export function chooseDefaultPaletteSeed() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    const value = new Uint32Array(1);
    cryptoApi.getRandomValues(value);
    return value[0];
  }
  return Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
}

export function validDefaultPaletteSeed(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

// Old snapshots predate saved palette seeds. Give those actors a repeatable
// migration value without consuming fresh randomness every time state is read.
export function legacyDefaultPaletteSeed({ id = '', name = '', avatarId = '', avatarHue = '' } = {}) {
  return hash(`legacy-palette\u0000${id}\u0000${name}\u0000${avatarId}\u0000${avatarHue}`) || 0x9e3779b9;
}
