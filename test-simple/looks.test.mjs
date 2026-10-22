import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseDefaultAvatar, chooseDefaultHue, DEFAULT_AVATARS, DEFAULT_AVATAR_IDS, normalizeGender, validDefaultAvatarId, validDefaultHue } from '../simple/looks.mjs';
import { createBattle, normalizeActor, snapshot } from '../simple/engine.mjs';
import { extractMvuParty, encounterFromText } from '../simple/context.mjs';
import { parseImportedPack } from '../simple/imports.mjs';

test('default avatar selection is deterministic, gender-aware, and whitelisted', () => {
  assert.equal(DEFAULT_AVATAR_IDS.length, 54);
  assert.deepEqual(Object.keys(DEFAULT_AVATARS), ['starter-male', 'starter-female', 'jade-swordsman', 'crimson-duelist', 'frost-mage', 'iron-guardian', 'forest-ranger', 'amber-monk', 'moonlit-spear-guard', 'ember-gunslinger', 'azure-healer', 'mountain-exorcist', 'shadow-assassin', 'clockwork-knight', 'storm-lancer', 'desert-falconer', 'beastkeeper', 'star-oracle', 'thunder-priest', 'lingxiao-cultivator', 'dawn-paladin', 'bamboo-alchemist', 'dusk-ronin', 'scarlet-sorceress', 'frost-archer', 'lotus-dancer', 'desert-sentinel', 'violet-assassin', 'scholar-swordsman', 'sun-priestess', 'obsidian-brawler', 'jade-lancer', 'moon-elf-archer', 'dwarven-artificer', 'pirate-captain', 'night-ninja', 'vampire-duelist', 'wandering-bard', 'silver-wolf', 'ember-fox', 'snow-tiger', 'raven-scout', 'azure-eastern-dragon', 'western-dragon', 'qilin', 'xuanwu', 'forest-fae', 'phoenix', 'pegasus', 'griffin', 'unicorn', 'nine-tail-fox', 'thunderbird', 'sea-serpent']);
  assert.equal(DEFAULT_AVATARS['starter-male'].src, 'human/sprite/adventurer-male-actions-v1.png');
  assert.equal(DEFAULT_AVATARS['starter-female'].src, 'human/sprite/adventurer-female-actions-v1.png');
  assert.equal(chooseDefaultAvatar({ id: 'p-1', name: '青' }), chooseDefaultAvatar({ id: 'p-1', name: '青' }));
  assert.ok(new Set(Array.from({ length: 30 }, (_, index) => chooseDefaultAvatar({ id: 'enemy-1', name: '对手' + index }))).size > 5, 'reused positional enemy IDs still draw different looks for different people');
  assert.equal(DEFAULT_AVATARS[chooseDefaultAvatar({ id: 'm', gender: 'male' })].gender, 'male');
  assert.equal(DEFAULT_AVATARS[chooseDefaultAvatar({ id: 'f', gender: 'female' })].gender, 'female');
  assert.equal(DEFAULT_AVATARS[chooseDefaultAvatar({ id: 'human-dragon', name: '龙王', kind: 'human' })].category, 'human', 'explicit human kind wins over an animal-like title');
  assert.equal(DEFAULT_AVATARS[chooseDefaultAvatar({ id: 'human-wolf', name: '白狼将军', species: '人类' })].category, 'human', 'explicit human species wins over an animal-like name');
  assert.equal(chooseDefaultAvatar({ id: 'named-wolf', name: '龙王', species: '狐狸' }), 'ember-fox', 'explicit supported species selects its matching atlas before nickname words');
  assert.equal(chooseDefaultAvatar({ id: 'species-wolf', name: '阿白', species: 'wolf' }), 'silver-wolf');
  assert.equal(chooseDefaultAvatar({ id: 'east-dragon', name: '龙君', species: '东方龙', kind: 'animal' }), 'azure-eastern-dragon');
  assert.equal(chooseDefaultAvatar({ id: 'west-dragon', name: '赤金', species: 'western dragon', kind: 'animal' }), 'western-dragon');
  assert.equal(chooseDefaultAvatar({ id: 'qilin', name: '灵兽', species: '麒麟', kind: 'animal' }), 'qilin');
  assert.equal(chooseDefaultAvatar({ id: 'tortoise', name: '守护者', species: '玄武', kind: 'animal' }), 'xuanwu');
  assert.equal(chooseDefaultAvatar({ id: 'firebird', name: '神鸟', species: 'phoenix', kind: 'animal' }), 'phoenix');
  assert.equal(chooseDefaultAvatar({ id: 'pegasus', name: '坐骑', species: 'pegasus', kind: 'animal' }), 'pegasus');
  assert.equal(chooseDefaultAvatar({ id: 'fairy', name: '精灵', species: 'fairy' }), 'forest-fae');
  assert.equal(chooseDefaultAvatar({ id: 'specific-dragon', name: '东方龙君', species: 'dragon', kind: 'animal' }), 'azure-eastern-dragon');
  assert.equal(DEFAULT_AVATARS[chooseDefaultAvatar({ id: 'elf-human', name: '月林精灵弓手', kind: 'human' })].category, 'human',
    'explicit humanoid elf remains eligible for human portraits');
  assert.equal(normalizeGender('女'), 'female');
  assert.equal(normalizeGender('unknown'), undefined);
  assert.equal(validDefaultAvatarId('../custom.png'), false);
  assert.equal(normalizeActor({ name: '角色', avatarId: '../custom.png' }).avatarId, chooseDefaultAvatar({ id: 'player-1', name: '角色' }));
  assert.equal(normalizeActor({ name: '角色', avatarId: 'frost-mage', gender: 'male' }).avatarId, 'frost-mage');
  assert.equal(chooseDefaultHue({ id: 'a', name: '阿青', avatarId: 'frost-mage' }), chooseDefaultHue({ id: 'a', name: '阿青', avatarId: 'frost-mage' }));
  assert.ok(Math.abs(chooseDefaultHue({ id: 'a', name: '阿青', avatarId: 'frost-mage' })) <= 36);
  assert.ok(new Set(Array.from({ length: 30 }, (_, index) => chooseDefaultHue({ id: `enemy-${index}`, name: `怪物${index}`, avatarId: 'silver-wolf' }))).size > 20,
    'creature palettes vary widely without changing each turn');
  assert.ok(new Set(Array.from({ length: 30 }, (_, index) => chooseDefaultHue({ id: `human-${index}`, name: `俠客${index}`, avatarId: 'jade-swordsman' }))).size > 5,
    'human palette shifts vary while staying within a face-friendly range');
  assert.equal(validDefaultHue(-180), true);
  assert.equal(validDefaultHue(181), false);
  assert.equal(normalizeActor({ id: 'hue-zero', name: '青', avatarId: 'jade-swordsman', avatarHue: 0 }).avatarHue, 0,
    'zero degrees is a valid saved palette choice');
  assert.equal(normalizeActor({ id: 'bad-hue', name: '青', avatarHue: 999 }).avatarHue,
    chooseDefaultHue({ id: 'bad-hue', name: '青', avatarId: chooseDefaultAvatar({ id: 'bad-hue', name: '青' }) }), 'invalid hues are replaced with a stable default');
});

test('renames and battle snapshots retain approved looks for both sides', () => {
  const original = createBattle({
    party: [{ id: 'ally-1', name: '青', gender: 'female', avatarId: 'forest-ranger' }],
    enemies: [{ id: 'enemy-1', name: '守卫', gender: 'male', avatarId: 'iron-guardian' }],
  });
  const renamedPlayer = normalizeActor({ id: 'ally-1', name: '青衣', avatarId: original.party[0].avatarId, avatarHue: original.party[0].avatarHue });
  const renamedEnemy = normalizeActor({ id: 'enemy-1', name: '新守卫', avatarId: original.enemies[0].avatarId, avatarHue: original.enemies[0].avatarHue });
  assert.equal(renamedPlayer.avatarId, 'forest-ranger');
  assert.equal(renamedEnemy.avatarId, 'iron-guardian');
  assert.equal(renamedPlayer.avatarHue, original.party[0].avatarHue);
  assert.equal(renamedEnemy.avatarHue, original.enemies[0].avatarHue);

  const saved = JSON.parse(JSON.stringify(snapshot(original)));
  const redrawn = createBattle({ party: saved.party, enemies: saved.enemies });
  assert.equal(redrawn.party[0].avatarId, 'forest-ranger');
  assert.equal(redrawn.enemies[0].avatarId, 'iron-guardian');
  assert.equal(redrawn.party[0].avatarHue, original.party[0].avatarHue);
  assert.equal(redrawn.enemies[0].avatarHue, original.enemies[0].avatarHue);
});

test('MVU and imported data preserve only safe gender and avatar IDs', () => {
  const party = extractMvuParty({ 主角: { name: '林青', hp: 20, 性别: ['女', '描述'] }, 同伴: { name: '性别字段不能单独成队友', 性别: '男' } });
  assert.equal(party.length, 1);
  assert.equal(party[0].gender, 'female');
  const encounter = encounterFromText(`<dsh_battle>${JSON.stringify({ enemies: [{ name: '敌人', gender: 'male', avatarId: 'jade-swordsman' }, { name: '坏ID', avatarId: 'https://example.test/a.png', gender: 'other' }] })}</dsh_battle>`);
  assert.deepEqual(encounter.enemies.map(({ gender, avatarId }) => ({ gender, avatarId })), [
    { gender: 'male', avatarId: 'jade-swordsman' }, { gender: undefined, avatarId: undefined },
  ]);
  const imported = parseImportedPack({ schemaVersion: 1, kind: 'dsh-battle-pack', id: 'looks', name: 'Looks', basePack: 'human', party: [
    { name: '安全', avatarId: 'frost-mage' }, { name: '不安全', avatarId: 'https://bad' },
  ] });
  assert.deepEqual(imported.party.map(actor => actor.avatarId), ['frost-mage', undefined]);
});
