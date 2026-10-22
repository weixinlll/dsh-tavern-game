import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseDefaultAvatar, chooseDefaultHue, chooseDefaultPaletteSeed, validDefaultHue, validDefaultPaletteSeed } from '../simple/looks.mjs';
import { createBattle, normalizeActor, snapshot } from '../simple/engine.mjs';

test('generated default looks draw a stable, bounded palette per actor', () => {
  const humanHues = Array.from({ length: 64 }, (_, index) => chooseDefaultHue({ id: `human-${index}`, name: `人物${index}`, avatarId: 'jade-swordsman' }));
  const creatureHues = Array.from({ length: 64 }, (_, index) => chooseDefaultHue({ id: `creature-${index}`, name: `灵兽${index}`, avatarId: 'silver-wolf' }));
  assert.ok(new Set(humanHues).size >= 35);
  assert.ok(humanHues.every(hue => hue >= -36 && hue <= 36));
  assert.ok(new Set(creatureHues).size >= 50);
  assert.ok(creatureHues.every(validDefaultHue));
  assert.equal(chooseDefaultHue({ id: 'same', name: '同一人', avatarId: 'jade-swordsman' }),
    chooseDefaultHue({ id: 'same', name: '同一人', avatarId: 'jade-swordsman' }));
});

test('saved actor hue survives rename and battle snapshot round trips', () => {
  const actor = normalizeActor({ id: 'persist-1', name: '青衣', avatarId: 'jade-swordsman' });
  assert.ok(validDefaultHue(actor.avatarHue));
  assert.equal(normalizeActor({ id: actor.id, name: '青衫客', avatarId: actor.avatarId, avatarHue: actor.avatarHue }).avatarHue, actor.avatarHue);
  assert.equal(normalizeActor({ id: actor.id, name: actor.name, avatarId: actor.avatarId, avatarHue: 0 }).avatarHue, 0);
  assert.equal(normalizeActor({ id: actor.id, name: actor.name, avatarId: actor.avatarId, avatarHue: 999 }).avatarHue,
    chooseDefaultHue({ id: actor.id, name: actor.name, avatarId: actor.avatarId }));

  const battle = createBattle({ party: [actor], enemies: [{ id: 'persist-enemy', name: '白狼', species: 'wolf' }] });
  const restored = createBattle(snapshot(battle));
  assert.equal(restored.party[0].avatarHue, battle.party[0].avatarHue);
  assert.equal(restored.enemies[0].avatarHue, battle.enemies[0].avatarHue);
  assert.equal(restored.enemies[0].avatarId, chooseDefaultAvatar({ id: 'persist-enemy', name: '白狼', species: 'wolf' }));
});

test('new actors draw an independent random palette seed and retain it across snapshots', () => {
  const seeds = Array.from({ length: 32 }, () => chooseDefaultPaletteSeed());
  assert.ok(seeds.every(validDefaultPaletteSeed));
  assert.ok(new Set(seeds).size >= 30, 'new actors should not derive the same colors from their names');
  const actor = normalizeActor({ id: 'palette-1', name: '同名角色', avatarId: 'jade-swordsman' });
  assert.ok(validDefaultPaletteSeed(actor.avatarPaletteSeed));
  assert.equal(normalizeActor({ ...actor, name: '改名后', avatarPaletteSeed: actor.avatarPaletteSeed }).avatarPaletteSeed, actor.avatarPaletteSeed);
  const battle = createBattle({ party: [actor], enemies: [{ id: 'palette-foe', name: '同名角色', avatarId: 'western-dragon' }] });
  const restored = createBattle(snapshot(battle));
  assert.equal(restored.party[0].avatarPaletteSeed, battle.party[0].avatarPaletteSeed);
  assert.equal(restored.enemies[0].avatarPaletteSeed, battle.enemies[0].avatarPaletteSeed);
  assert.equal(validDefaultPaletteSeed(0), true);
  assert.equal(validDefaultPaletteSeed(0x1_0000_0000), false);
});
