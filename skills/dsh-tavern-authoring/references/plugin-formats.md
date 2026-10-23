# DSH Tavern import formats

These limits match the plugin's public import validators. Recheck the installed plugin version when its format changes.

## Battle pack JSON

The file is UTF-8 JSON with `schemaVersion: 1` and `kind: "dsh-battle-pack"`.

```json
{
  "schemaVersion": 1,
  "kind": "dsh-battle-pack",
  "id": "my-cultivation-duel",
  "name": "青岚门演武",
  "basePack": "fantasy",
  "description": "山门同伴与守关灵兽的短回合对决。",
  "items": [
    { "id": "healing-potion", "count": 2 },
    { "id": "resource-potion", "count": 1 },
    { "id": "cleanse", "count": 1 }
  ],
  "party": [
    { "name": "青岚剑客", "hp": 80, "maxHp": 100, "attack": 18, "defense": 7, "speed": 55, "skills": ["破阵剑", "护身灵符"] }
  ],
  "opponents": [
    { "name": "山道妖兽", "kind": "animal", "species": "雪狼", "hp": 90, "maxHp": 90, "attack": 15, "defense": 5, "speed": 47, "skills": ["妖爪", "寒息"] }
  ],
  "skillAliases": [
    { "name": "破阵剑", "description": "以剑气破开目标防御。", "baseId": "fantasy-0-2", "mechanics": ["first"] },
    { "name": "护身灵符", "description": "以符光凝成短暂护盾。", "baseId": "fantasy-0-13", "mechanics": ["shieldSelf"] },
    { "name": "妖爪", "description": "近身挥爪攻击。", "baseId": "fantasy-0-1", "mechanics": [] },
    { "name": "寒息", "description": "寒气造成伤害并减缓目标。", "baseId": "fantasy-0-20", "mechanics": [] }
  ]
}
```

Limits:

- `id`: lowercase English letter first, then lowercase letters, digits, or hyphens; 1–48 characters. `human` and `fantasy` are reserved.
- `name`: required, up to 48 characters. `description`: up to 200 characters.
- `basePack`: exactly `human` or `fantasy`.
- Input file: at most 256 KB. The plugin's normalized pack must fit within 12 KB.
- `party` and `opponents`: optional arrays, each at most 6 actors. Names must be unique within each array. The live field has at most 3 actors per side; additional actors are reserves.
- Each actor has at most 4 skills. Numeric fields are finite values from 0 to 1,000,000,000; when both are supplied, `hp` cannot exceed `maxHp`, and `maxHp` must be at least 1.
- `items`: at most 3 supported entries: healing potion up to 2, resource potion up to 1, cleanse up to 1. Counts are integers and cannot be negative.
- `skillAliases`: at most 64 named mappings. Use a supported `baseId` from the chosen base pack (`human-0-1` through `human-0-80`, or `fantasy-0-1` through `fantasy-0-80`) and only the mechanics listed below. Descriptions provide flavor; the local base ID and mechanics determine gameplay.
- Do not add scripts, code, HTML, CSS, modules, or plugins. Imported packs are data and cannot execute code.

## Supported mechanics

Only use these exact IDs in `mechanics`:

`first`, `critical`, `sureHit`, `multiHit`, `shieldPierce`, `armorPierce`, `execute`, `recoil`, `highCrit`, `drain`, `resourceDrain`, `cleanseSelf`, `dispelTarget`, `healSelf`, `counter`, `shieldSelf`.

The plugin resolves status and skill behavior locally. Its current status IDs are:

| ID | Status | ID | Status | ID | Status |
|---|---|---|---|---|---|
| `poison` | 中毒 | `burn` | 灼烧 | `bleed` | 流血 |
| `blind` | 致盲 | `charm` | 魅惑 | `paralysis` | 麻痹 |
| `fear` | 恐惧 | `silence` | 沉默 | `ward` | 护盾 |
| `guard` | 防御 | `haste` | 迅捷 | `slow` | 迟缓 |
| `weaken` | 虚弱 | `expose` | 破绽 | `focus` | 凝神 |
| `reflect` | 反击 | `regen` | 恢复 | `controlImmune` | 定神 |
| `taunt` | 嘲讽 | `disarm` | 缴械 | `confusion` | 混乱 |
| `sleep` | 睡眠 | `freeze` | 冰冻 | `stun` | 眩晕 |
| `petrify` | 石化 | `root` | 束缚 | `curse` | 诅咒 |
| `antiHeal` | 禁疗 | `empower` | 鼓舞 | `fortify` | 壁垒 |
| `evasion` | 闪避 | `vulnerable` | 易伤 | `poisonImmune` | 避毒 |
| `burnImmune` | 耐火 | `bleedImmune` | 止血 | `lifesteal` | 嗜血 |
| `berserk` | 狂暴 | `healBoost` | 疗效提升 | `resourceRegen` | 回气 |
| `resourceLeak` | 漏气 | `exhaustion` | 耗竭 | `charge` | 蓄力 |
| `mark` | 锁定 | `armorPierce` | 穿甲 | `healBlock` | 断疗 |
| `delayedBlast` | 延时爆破 | `protect` | 招架 | `sturdy` | 不屈 |
| `frostbite` | 冻伤 | `electrified` | 感电 | `initiative` | 抢攻 |
| `critReady` | 会心 | `sureHit` | 必中 | `critGuard` | 抗暴 |
| `bramble` | 荆棘 | `resistance` | 抗性 | `amplify` | 增效 |
| `manaShield` | 法力护盾 | `rage` | 怒意 | `sap` | 寄生 |

Use a skill's catalog ID for a dependable result. A prose description alone does not create a new executable effect.

## Character appearance bundle

One JSON file stores one character's PNG sprite atlas and its 4×4 frame map:

```json
{
  "kind": "dsh-battle-appearance",
  "schemaVersion": 1,
  "name": "凌霄剑修",
  "texture": { "mimeType": "image/png", "data": "BASE64_OF_THE_REAL_PNG_FILE" },
  "rig": {
    "schemaVersion": 1,
    "columns": 4,
    "rows": 4,
    "fps": 8,
    "clips": { "idle": [0, 1, 2, 1], "attack": [3, 4, 5, 7], "cast": [8, 9, 7], "guard": [10] }
  }
}
```

- `texture.data` must be Base64 for the actual PNG bytes. Do not leave the example placeholder in a deliverable.
- Atlas width and height must each be a multiple of 4 and no more than 4096 pixels; image files are limited to 12 MB. A transparent background is recommended for clean compositing.
- `rig.columns` and `rig.rows` must both be `4`; `fps` is 1–24.
- Clip names: `idle`, `attack`, `kick`, `cast`, `hit`, `guard`, `dodge`, `down`, `victory`. Each clip has 1–16 integer frame indexes from 0 through 15.
- Complete JSON package is limited to 16 MB; name is required and at most 80 characters.
- Build the bundle from a real atlas with `scripts/build_appearance_package.mjs`. The script verifies the PNG header and 4×4 dimensions; the plugin additionally decodes the image in the browser during import.

Choose **导入资源 → 玩法包** to import a battle pack. Open the intended teammate card and choose **角色外观 → 导入外观包** to apply a character appearance bundle.
