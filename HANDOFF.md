# 0.8.15 代码交接 · 2026-10-22（固定效果目录与可分享制作Skill）

角色生成/提取、MVU技能效果补全、手动AI敌人生成统一使用固定目录。每个内置包有80个可选基础效果ID；引擎实现60种状态、16种有限机制及465种单项/双项负面状态组合。AI必须给出当前包有效baseId，并且附加状态和机制只能取白名单；技能说明由本地ID解析生成。缺失/无效ID、重复效果、改名或增删原有技能都会拒绝草稿，保留原队伍和技能，防止新生成招式落入“效果未识别”的无限普通伤害回退。测试覆盖生成角色、context提取、MVU补全、AI敌人及错ID保留。

固定效果分类参考GitHub中的Pokémon Showdown条件与战斗规则，以及MacacaGames EffectSystem的数据驱动触发/持续效果模式：<https://github.com/smogon/pokemon-showdown/blob/master/data/conditions.ts>、<https://github.com/MacacaGames/EffectSystem>。只借鉴类别和实现思路，未复制源代码。

新增`skills/dsh-tavern-authoring/`：可在Codex里调用`$dsh-tavern-authoring`制作玩法包和完整角色外观包。参考文档含约束、16项机制ID和60种状态ID；模板及`validate_pack.mjs`通过插件实际导入解析器；`build_appearance_package.mjs`将真实PNG与4×4动作映射生成导入JSON并校验尺寸、动作和包大小。已将Skill安装到本机`C:\Users\30625\.codex\skills\dsh-tavern-authoring`，并打包供分享：`dist/dsh-tavern-authoring-skill-1.0.0.zip`。

165项测试、`npm run check`、`npm run package`和`git diff --check`全部通过。0.8.15已安装；76个发布文件与包逐项SHA256一致，Tavern入口文件保留且哈希不变。安装/备份/校验收据：`review/effect-catalog-0.8.15/installation.json`。没有真实模型调用或自动重启DSH；完全重启DSH并刷新Tavern后加载插件。

# 0.8.13 代码交接 · 2026-10-22（OpenCode 会话与四个特殊技能）

修复直接 `prepareCall().stream()` 调用遗漏稳定会话 ID 的问题：整队/单人生成、手动敌人解析、战果概括、旧队伍填入和敌方战术请求均把本局 `gameId` 作为 `sessionId` 传入流选项，OpenCode 因缺少 `x-opencode-session` 而拒绝的路径已覆盖。模型请求仍为单次调用；未向真实供应商发请求。

角色最多四个技能位全部留给特殊技能，普通攻击单独作为基础行动，不占位、不消耗技能次数。生成输出中的普通攻击会从技能表移除；缺少预设映射的招式不再落成无限次普攻，而使用受次数/冷却限制的特殊攻击效果。旧客户端发来的普通攻击技能 ID 仍映射到独立基础行动。AI敌方观察和选招也明确包含此基础行动。

162 项测试、`npm run check`、`npm run package` 和 `git diff --check` 通过。0.8.13 已安装；76 个发布文件与 ZIP SHA256 全部一致，Tavern 入口文件保留且哈希不变。安装、备份和校验收据：`review/ai-generation-0.8.13/installation.json`。未自动重启 DSH；需要完全重启 DSH 并刷新 Tavern 才会加载宿主代码。

# 0.8.9 代码交接 · 2026-10-22（统一生成模型、动物开战、自动音乐与AI战果）

当前用户要求已替代0.8.8的模型分流设计：只有一个 `generationModel`，同时用于角色/背包生成、AI编辑单人、手动敌人生成和战果概括；战术 `aiModel` 保持独立。前端只有一个生成模型折叠区。读取旧存档时仅在 generationModel 字段不存在才接收旧 enemyModel；显式null保持宿主默认。旧 enemyModel 路由输入兼容为同一设置别名，后续保存删除旧字段。切换/导入玩法包及legacy fill保留统一选择。

手动自然描述分类补上遇到/碰到/出现、个/只/头/条/匹/位和中文数量，修复“遇到三个动物”绕过模型变成单个人名。明确快写格式和导入对手原名继续本地开战。AI只读当前正文末段与最近两轮，按UTF-8最多4KB，不扫MVU/世界书/台账；精确校验当前turn/textVersion，读取失败可按描述生成并提示。单个直接总数为1—6时要求输出数量一致；复合描述中的召唤/携带数量不当总数。泛动物要求必须返回具体species；已有动物外观保留，错误的人形外观按物种本地纠正，无第二次AI请求。错误数量、缺物种或整句作姓名不创建战斗、不覆盖原数据。自然正文触发仍本地提取，不新增AI调用。

音乐旧实现只在点击场景/按钮时调用play，界面默认开却未启动。本版等导入资源读完即自动play，区分starting/playing/blocked/error/off，成功才显示“音乐开”。NotAllowedError后战斗区下一次pointer/keyboard操作自动重试；音乐按钮自己处理，避免捕获阶段与click双切换。保存静音意愿，不因其它按钮重开，旧循环停止后才换资源，退出停止全部音轨。浏览器自动播放权限仍由宿主/浏览器决定，不能承诺无任何用户手势的环境必然出声。

“生成战况”用统一生成模型概括已经结束且注入正文的真实战斗，单请求、60秒、1200输出tokens，数据是最终胜负、回合、双方HP/资源与最多40条保留事件。提示不编造奖励/死亡/后续剧情，不推断未保留过程。JSON必须匹配winner/rounds并有有界summary；输出与权威本地战果一起给用户编辑，再由“填入续写”放进输入框，绝不自动发送。成功摘要有限缓存防重复付费；缺模型/超时/格式错时明示事实回退、可手动重试。生成后再次检查正文版本、修订和battleId/seq；时间线取消不能提交旧结果。无战斗状态写入，演练不提供剧情摘要。

验收：153项单测与 npm run check 通过（最终日志见 review/sprite-battle-0.8.9）。完整浏览器回归 browser-result.json 覆盖整轮战斗/3v3/320px/外观场景导入/正文自动进场；专项 round-flow-result.json 验证一个模型入口、当前正文确实进入敌人提示、三只动物、整轮确认、背包说明、AI战况进续写。音乐实测检查HTMLAudioElement播放时钟推进；模拟首播NotAllowedError，普通战斗按钮可解锁导入Blob音乐，静音保持、无重复循环、关闭全部停止；pageErrors为空。2友3敌一倍速一轮约9.6秒，仅作本机夹具记录。真实供应商返回质量与真实玩家会话未调用/验证；54套立绘调色实现未改，沿用0.8.8逐图验收证据。

安装收据、旧包备份和76个运行文件/资源SHA256核对：review/sprite-battle-0.8.9/installation.json（安装完成后写入）。保留Tavern生成入口，不重启DSH；用户需要完整退出重启DSH加载新宿主代码。

## 0.8.8 代码交接 · 2026-10-22（整轮选招、生成模型、战斗背包与全量随机色）

本版按用户反馈改为宝可梦式整轮下令。每个可行动上场队友先选择技能/物品/换人，前端只存本地指令，可返回修改；全部选完后「确认本回合」才发送一次 `{type:'round',commands:[...]}`。后端先原子验证整组指令，阻止漏选、同一角色重复行动、重复分配同一份药、同一后备被换入两次，再按换人/道具/技能先制及全场速度统一结算双方。被击倒角色跳过，自动补位者本轮不能额外行动，失去目标时转向仍存活的场上敌人。保留旧单次 `act` API；旧存档半轮可提交剩余角色指令。逃离需单独确认。3人上场/6人阵容/4技能/24回合上限保持。

一倍速动画基础等待乘1.35；每个出手、伤害、状态与物品事件增加有限字幕停留，不再无等待覆盖状态字幕，也不再由总字幕计时器中途清空逐事件字幕。2/3/10倍速仅控制演出。隔离浏览器多次验证1v1一轮约4.6—6.1秒，2队友+1敌人含使用药品约5.6—5.8秒，10倍速1v1约0.6—1.0秒。实际时长随事件数和机器负载变化。

随机色覆盖全部54套内置图集和2张旧男女兜底立绘。去掉六段色相硬映射与量化平涂，改为完整360°色相、连续色相变形、鲜艳/宝石/浅色/深色方案；保存RGB增量，保持源画渐变和Alpha。冷色衣料、红/橙/金色衣料与灰色铠甲分别使用连续权重，保护肤色核心、眼白、高光与近黑色轮廓。仍在进场前准备色图，个人导入外观不自动换色。每个角色独立32位随机种子持久化，回合/重开不重新抽色。肤色保护是有界颜色分类，不是逐像素语义分割；不得宣称可对任意外部图片完美识别皮肤。

颜色验收不再只检查全图：56张每张均需全图和待机第3帧至少1%可见像素换色、换种子有差异、同种子一致、尺寸/Alpha一致、肤色核心测试像素不变。全图最低换色比例为人物3.34%、动物29.03%；另用8个独立肤色/中性样本×4种子验证保护，用64种子测试得到64种不同颜色、覆盖12/12色相区间、最高饱和度约0.926。报告及16色对照：`review/palette-0.8.8/palette-validation.json`、`palette-variants.png`，原图/双色比较 `palette-visual-check.png`。不存在未换色的内置图集；暖色立绘也通过待机姿势检查。

`generationModel`（队友/背包/单人设计）、`enemyModel`（手动自然描述解析敌人）、原 `aiModel`（战术决策）独立保存；提供方、模型和推理强度均由宿主目录校验，换包/导入/填入保留选择，null表示酒馆后台默认。主按钮下和手动开战内提供折叠模型选择；自然正文敌人仍按公开正文/MVU本地提取，不额外调用生成模型。角色/手动敌人的同一次AI输出可选54项白名单avatarId，提示按性别/武器/职业/物种匹配；不是额外生图，不接受自拟URL；已有角色ID和个人导入资源继续保留。

生成限时从45秒改为120秒，输出请求上限12000 tokens（宿主prepareCall若归一到更低预算则尊重）；限制技能短说明和mechanics数量。供应商标记max-tokens但已输出完整JSON时允许继续严格校验；真截断或连接中断保留全部原数据，明确显示原因，用户可点击「重试精简生成」。仍为每次点击一次请求，无自动重试/检索循环，也不拼接不完整JSON。主角、同伴、明确MVU数值及轮次/正文版本/修订守卫仍生效。

背包只生成三类本地战斗补给，剧情钥匙/牌/材料不进入游戏背包；旧非战斗字段兼容为空。战斗快照现在保留生成的物品名称和本地权威效果说明，界面直接显示恢复量、数量、禁疗/治疗预算约束和一次行动消耗。整轮药品允许指定存活后备；UI对满血/满资源等明显无效目标禁用。

验收：142项单测、`npm run check`通过。整轮原子校验/速度排序/补位/物品计数、模型分流与宿主预算、截断/连接中断、不覆盖旧数据均有新增回归。完整隔离浏览器报告 `review/sprite-battle-0.8.8/browser-result.json`；模型保存、AI手动敌人、两人整轮选招、只生成战斗包、背包说明和实测节奏报告 `round-flow-result.json`。安装/备份/逐文件SHA256核对见同目录 `installation.json`，安装完成后生成。未读取真实玩家会话或调用真实玩家模型，未自动重启DSH。

0.8.8已安装到当前Tavern插件目录，76个运行文件/资源SHA256与工作区一致，目标另有1个原样保留的Tavern入口文件。旧版0.8.7备份为 `dist/installed-backup-20261022-172923-433f3117e462455f9391a1676e6191bc.zip`，备份与安装包哈希均已写入安装收据。需要完整退出并重启DSH，以便宿主也加载整轮指令实现；仅刷新客户端可能仍连接旧宿主。未代用户重启。

## 0.8.7 代码交接 · 2026-10-22（原始示范人物换色与首帧修复）

原始男女动作图集此前只会在其它图集加载失败时作为回退，不在默认角色池中，因此既没有稳定抽到，也没有进入正常换色路径。本版把它们作为 `starter-male` / `starter-female` 加入54套默认图集，演示战斗固定使用这两位；每位角色仍按持久化的32位 `avatarPaletteSeed` 独立换色。人物池现有38人，动物/奇幻生物16种。单张男女旧立绘也纳入着色器，作为动作图集损坏时的着色回退。

颜色进场晚的原因是：战斗overlay先渲染原始图，再由挂载后的React effect解码2048图集并逐像素调色，换色发生在首次绘制之后。本版改为先调色当前上阵角色，再打开全屏层，将准备好的图像URL作为首帧数据；最多缓存8个调色Blob，重复使用相同角色不再重复做像素转换。浏览器回归证明1v1和3v3的全部角色首帧已着色；演示首屏使用原版男女角色图集，但首帧已经应用各自色板。隔离浏览器实测入场准备时间约2.0秒（1v1）和3.7秒（3v3）；等待发生在overlay显示之前，不会看到原色之后再跳变。

像素校验覆盖54套默认图集和两张旧版男女单张立绘，共56张：同一种子逐像素确定、换种子可见颜色变化、Alpha与尺寸保留、人类保护肤色未变。报告 `review/default-roster-palette/palette-validation.json` 与调色对照 `review/default-roster-palette/palette-visual-check.png`。完整战斗、背包、换人、资源导入和窄屏流程证据在 `review/sprite-battle-0.8.7`；六角色同时上场测试确认颜色准备完毕后才显示；浏览器pageErrors为0。测试是隔离夹具，不是玩家的真实DSH会话。

验收：`npm test` 130/130通过；`npm run check`通过（10个运行源码文件、62项资源）；`node tools/verify-browser.mjs`通过；`npm run verify:palette`验证56张图片全部通过。0.8.7已安装到 `C:/Users/30625/.dsh/profile-data/tavern/data/plugins/dsh-tavern-game`；76个运行文件/资源SHA256与工作区一致，Tavern入口保护文件保留。旧版备份、包/备份SHA256和核对收据见 `review/sprite-battle-0.8.7/installation.json`。未自动重启DSH；刷新Tavern页面，若已运行的宿主未加载新客户端，再完整退出并重启DSH。隔离浏览器测试通过，但未在真实DSH玩家会话中点测，也未读取真实卡/会话或调用玩家模型。

## 0.8.6 代码交接 · 2026-10-22（默认立绘换色全量验收）

0.8.6时默认池是52套：36个人物、16种动物/奇幻生物；着色和默认随机色板详见其历史记录与下节。正式安装记录保留为 `review/sprite-battle-0.8.6/installation.json`。

## 0.8.6 已确认的代码与界面

- 近战角色按真实目标位置靠近并回位；镜头按windup、strike、impact切换。高倍速时镜头晃动缩减。逐事件显示HP变化和伤害飘字。
- 行动同步增加单飞锁，阻止同帧重复点击导致的重复行动。前端剧情对手回退逻辑与后端一致。
- 自然正文仅在当前turn/textVersion已结算后识别“决斗、对战、交战、战斗、切磋、比武、开战、迎战”；过滤否定、历史、假设和已结束语境。对手从可见正文与公开MVU敌人容器提取；提取不到时回退剧情对手，不额外调用AI。共享短轮询覆盖正文先结算、保存稍后的竞态；关键词去重防止重复开场。
- 后端剧情写入使用幂等ticket并拒绝旧轮次。物种识别中明确的人类字段优先于动物绰号。
- 技能默认常驻在底部dock，桌面控制区四条指令一行、四个技能一行，移动端两列。header工具栏合并；倍速为单按钮，弹出约190px宽的2×2档位浮层，选档后收起。原有camera/travel/HP/persistent行为不变。
- 320px布局曾发现10×档被音乐控件遮挡、敌方角色裁切6px，均已修复。隔离浏览器临时22资源模式复测通过；1v1及双方各3人时，角色和HUD均在viewport内，与dock无交叉；10×可实际点击，无横向溢出。此为隔离浏览器证据，不代表真实DSH验证。

# 0.8.5 交接 · 2026-10-22

## 0.8.5 内置立绘扩充

内置默认池扩为18名人物、4种动物；五套原默认外观和独立凌霄剑修素材全部进入默认池。所有内置角色都是2048×2048透明PNG、4×4共16帧动作图集，文件在 `assets/human/sprite/defaults/` 并登记到 `assets/manifest.json`，随正式插件包一起分发。

新增人物：黄岳、沈月璃、绯烬、蓝翎医师、玄岳道长、夜渡、伊芙、霆锋、阿莎、森语、星轨、雷音。动物：银月狼、赤尾灵狐、雪纹白虎、夜鸦。名字、物种或描述明确为动物时进入动物池；一般角色仍只从人物池按性别选取。`avatarId`仍按角色保存，已绑定外观不会因回合或改名变化。玩家单角色自定义外观仍优先。

动物识别使用常见中英文物种词与显式species/kind字段；不把“兽师”等职业词当作动物。资料中的 `species` 受长度限制；动物不能被误判为普通性别池。若未识别的幻想物种没有常见物种词，默认仍走人物外观，之后可在该角色导入专属外观。

原图和生成设计见 `review/default-roster-sources.json`、`docs/DEFAULT-ROSTER-PROMPTS.json`；全部默认外观总览见 `review/default-roster-preview.jpg`；逐帧裁切报告含来源与输出哈希，见 `review/default-roster-validation.json`。裁切脚本只做透明像素分割、统一画布与脚底位置，没有重绘角色。凌霄剑修导入文件和离线动作预览仍在桌面「DSH外观导入测试」目录，同时该立绘现已是默认池成员。

版本号升至0.8.5。正式包构建后安装到当前Tavern插件目录并留备份；未自动重启DSH。重开插件后看版本号0.8.5。当前默认池资产解码与角色/动物自动选择尚未在本轮真实DSH会话里点测。

## 0.8.4 收尾：统一外观包、场景、滚动


## 0.8.4 收尾：五套默认立绘、统一外观包、场景、滚动

本次在0.8.3基础上增加：

1. 五套默认16姿态透明动作图集：jade-swordsman男、crimson-duelist女、frost-mage女、iron-guardian男、forest-ranger女。路径 assets/human/sprite/defaults/{id}-actions-v1.png。各2048×2048、4×4、脚底454。旧男女图仅作为兼容回退，不再作为主默认池。
2. simple/looks.mjs纯外观模块。FNV按id+name稳定抽选，已知性别缩小池；avatarId写入角色。normalizeActor、队友保存/改名、生成、随文更新、导入及敌人平衡都保留。不得消耗战斗随机种子。敌人enemy-1位置ID会复用，所以不能只按位置ID抽选；重命名后靠已保存avatarId保持原外观。未知或路径型ID拒绝/回退。
3. 前端SetupPanel根节点 stg-setup / data-testid=battle-setup-scroll 有独立overflow滚动、min-height:0、flex和触摸滚动。真实浏览器验证固定480px/overflow:hidden宿主，只有max-height:360px宿主，及390px窄屏。不要把scroll修复改回依赖宿主外层滚动。
4. 全局「导入资源」只展示小折叠分类：玩法包、场景背景、声音、共享外观（高级）。人物「角色外观」有一个完整外观包入口，分开的纹理/骨架入口藏在高级折叠，不再铺一整屏大表单。保留所有旧导入能力。
5. 完整外观JSON：kind=dsh-battle-appearance,schemaVersion=1,name,texture:{mimeType:image/png,data:纯Base64},rig:4×4动作配置。≤16MB、PNG≤12MB、真实PNG签名与IHDR、宽高为4的倍数且≤4096、浏览器实际解码成功；拒绝远程URL和无效帧。只接受有界数据。使用同一个IDB事务保存个人texture+rig；失败仅页面内存回退，明确提示。预览有站立/攻击/强击/施法/防御按钮。
6. 场景资源键scene，接受真实PNG/JPEG/WebP/GIF且≤12MB，浏览器解码验证。个人场景优先于内置场景；按game隔离IDB，刷新保留。不写MVU/64KB存档。个人立绘优先于共享槽，再默认池；每个URL独立处理加载失败，不能一张出错使全部同性别角色回退。

单独修仙男子素材：output/lingxiao-import-test/，已复制到桌面DSH外观导入测试。lingxiao-cultivator.battle-avatar.json是唯一需要选的导入文件（约4MB）。PNG/actions.json是高级手动备份，动作预览.html完全离线。dist/lingxiao-cultivator-import-0.8.4.zip方便分享。此角色不自动加入默认池。动作图集不是Spine/Live2D骨骼，保留原layered-rig高级能力，不能把16静态姿态说成16套完整骨骼动画。

图像由内置image_gen六个独立并发请求生成，完整提示 docs/DEFAULT-ROSTER-PROMPTS.json；原图映射 review/default-roster-sources.json；裁切/透明alpha/十六格/源输出SHA256检查 review/default-roster-validation.json。review/prepare-default-roster.py只裁切和缩放源像素，统一画布与落脚，不生成新图案；少数相邻武器尖端粘连按网格附近最窄缝分开，检查记录touchingTipSeparations。预览 review/default-roster-preview.jpg。

核验：117项测试通过。review/sprite-battle-0.8.4/browser-result.json检查完整测试外观文件导入、实际攻击帧变化、场景渲染、两者刷新留存、五张默认图浏览器解码、真实分层骨骼、桌面/窄屏滚动、既有战斗流程。没有调用真实玩家模型或重启DSH。安装证据同目录installation.json。安装后需要用户完整退出重开DSH确认0.8.4。以下0.8.3合同继续生效，旧标签「立绘与动作」现在叫「角色外观」，旧全局导入标签现在叫「导入资源」。

## 当前方向

简洁主界面，不恢复旧通用适配工坊/资料检索循环。内置 human / fantasy，允许声明式JSON包。双方阵容各最多6，最多3人同时上场，每人最多4招（含免费基础攻击）。旧树已归档，不需要恢复。

主按钮「AI读取并生成角色和背包」一次生成现有队友、技能和物品。高级来源/人物/背包折叠，单人AI设计先草稿后保存。加入每角色立绘/动作/骨架导入、正文后更新开关、手动描述开战、演练/剧情选择、头顶血条、平滑待机、四档速度和正文自动入场。

决策 easy/normal/hard/expert/hell/ai 只影响选招；enemy strength low/medium/high 独立调整敌方生命/攻击×0.85/1/1.2。AI供应商/模型/思考强度来自宿主llm目录，空reasoningEffort为模型默认。不能把难度变成额外玩家数值，也不能把演练回退当作真实供应商已测。

## 代码地图

- client.js：唯一前端，折叠设置/人物、导入、图集/分层SVG骨架、资源IDB、HUD/菜单/倍速/自动入场。
- simple/plugin.mjs：公开Tavern路由、按game串行写、版本保护、原生结算工具、手动/随文战斗。
- simple/generation.mjs：一次生成提示与JSON验证、MVU数值优先、战斗/非战斗物品归类。
- simple/context.mjs：有界公开来源快照、MVU提取、战斗标记与手动行格式解析。
- simple/engine.mjs：6人/3在场、每人每回合一次、换人和道具耗行动、24回合终局。
- simple/catalog.mjs：60状态、80模式、16组合机制、2560题材预设；题材变体不能宣传成独立机制。
- simple/imports.mjs：JSON包解析，拒绝脚本，规范化定义最多12KB，保护64KB存档。
- simple/opponent-ai.mjs：模型目录、有限战斗观察、一次450输出token请求/8秒回退，不带剧情上下文或玩家待选指令。

入口index.mjs，schemaVersion仍32。正式包仅运行源码、资产、README/LICENSE/package。旧代码可从 dist/before-v32-simplification-20261021.zip 和 dist/retired-v31-source-20261021/恢复，不进入运行包。保留工作区既有脏改动，不提交历史大删除。

## 一次AI生成合同

```js
// 前端主按钮
callHost('dsh-tavern-game/generate-party', {
  sourceOptions: {
    useContext: true, useMvu: true,
    useWorldbook: false, useLedger: false,
    historyRounds: 6, // 整数0..20
    ledgerText: ''   // 可选<=4000字，不存入配置
  },
  turn, textVersion, baseRevision
});
```

以实际注册路由前缀为准。调用一次getTurn；getHistory按选定范围一次读取，不逐源翻页。公开世界书用getCardContext/getCard，提取描述与条目并省略图片；卡内可见条目不等于本轮激活条目。关闭来源不得悄悄塞回模型提示。

外部台账服务：ctx.get('dshBattleLedger').getSnapshot({gameId,turn,textVersion})，返回 {producedAt:{turn,textVersion},data}；版本必须匹配。没有服务时明确提示，可用粘贴台账替代。不读其他插件私有数据文件。

来源总预算8KB UTF-8，各来源分预算，正文优先保留尾部。截取/缺失写warnings/sourceReport，不能宣称读完整本世界书。一个45秒受限模型请求，无资料读取工具；优先backgroundModel+llm.prepareCall，兼容runTask返回。无模型、坏JSON、超时、正文版本或修订变化均不提交原数据。

MVU明确数值包括HP0最终优先；缺失数值可以按固定包补全。人物/技能被本地限制，不允许任意公式/即死。design-actor用同一来源体系，按已有actorId或明确新角色名返回草稿；保存才落库。改名保留ID，重复ID拒绝。

药品归一到healing-potion最多2、resource-potion最多1、cleanse最多1；原名/来源说明保留，本地规则说明优先。钥匙等物品保留为非战斗物品，最多20种生成物品。真实战斗消耗后仍保留元数据。主按钮整体更新队友和背包，局部修改用人物的AI设计/保存。

## 数值随正文更新

autoStoryUpdate默认false，select-options只接受布尔值。切换/导入包保留它。当前战斗中只允许修改未来同步开关，其他难度/模型配置冻结。

使用酒馆原有结算模型，无额外同步模型请求，也不直接写MVU：

```text
settlementSection: 角色/技能/背包快照 + 本轮正文
  -> 签发nonce，绑定turn/textVersion/revision/approved actor IDs
  -> 宿主模型调用 dsh_battle_update_party
  -> 内存暂存，未结算不写TurnData
  -> onTurnSettled严格匹配后提交插件数据
  -> 本轮MVU明确字段最后覆盖
```

工具参数：{ticket, actors:[{actorId,hp?,maxHp?,attack?,defense?,speed?,resource?,maxResource?,level?,skills?}], items?}。只能更新已有角色，不能改名/新增；数字必须有限且范围受限，skills<=4，items<=20且若给出就是完整背包。count0表示用尽，保留未变化物品。

原生工具execute没有textVersion！必须保留section签发nonce和当前head校验。时间线变化、正文重新生成、关闭插件时清暂存；关闭同步/过期ticket拒绝；未结算不得保存；当前battle不能改写。MVU只有技能字段、空skills数组、HP0和物品count0也要覆盖；缺失字段保留。

宿主缺少settlementTool时只能读取MVU结算更新；无法给没有MVU路径的生成角色更新插件独有字段，view.autoStoryToolAvailable反映能力。模型是否调用工具仍需真实宿主/供应商验证。

## 手动/随文战斗

新UI manual-start({battleText,injectStory:false,turn,textVersion,baseRevision})，输入<=2000字。

- 山贼*3 | 挥剑、格挡：本地逐行解析，1..6人，不调用模型。
- 与三名山贼战斗，头目会刀斩：一次后台模型解析，只用输入描述，无正文/世界书检索，45秒期限，再本地平衡。
- injectStory:false：demos内存里的独立演练，不修改队友/背包/剧情存档，不提供续写。
- injectStory:true：真实battle写TurnData；战后生成战况/填入续写只填输入框，不自动发送。
- 兼容旧enemyName/teamCount；旧调用省略injectStory仍为true，新UI必须显式false。

正文明确开战时写<dsh_battle>{enemies:[...]}</dsh_battle>（内容必须合法JSON）。结算后创建battle；前端只对当前turn/textVersion、已结算、未结束、story-前缀battle自动入场。模块Set去重，旧历史/流式半截/手动战斗不自动跳，仍保留点击打开入口。

所有写入按game串行；设置/编辑检查baseRevision，行动检查battleId/seq。AI等待后再次检查正文ticket和修订。每人每回合一次；换入角色不能额外行动；群攻只打场上；24回合强制结束。资源不能塞入64KB轮次数据。

## 动作/资源

男女各2048×2048透明PNG，4×4共16姿态，每格512。生成提示docs/SPRITE-IMAGE-PROMPTS.json；统一落脚线与裁切检查review/sprite-atlas-validation.json。待机稳定frame3配连续CSS呼吸/重心变化，避免0/1/2差异大造成闪切。HUD挂figure，不随visual摇摆。

依次播放攻击/受击/敌方攻击/受击，双方音效，演出期间锁定出招；演出完成再切最终视图，保留倒下帧/胜利姿态。1/2/3/10倍速只改变JS等待、CSS动画、骨架动作插值，不改引擎/伤害/随机/行动数；闲置呼吸保持稳定，尊重减少动画设置。

每角色资源键`${actor.id}:texture`/`${actor.id}:rig`，按gameId隔离；个人优先，再共享男女槽/内置默认。单图无rig整图展示；grid为图集；layered-rig真正SVG父子变换。IDB只有transaction完成才报告持久化，失败保留页面内存回退；改名保留ID所以不丢资源。

图片<=12MB、配置<=256KB。图集4×4/0..15/fps1..24。分层rig 1..24骨骼、1..32部件、最多8动作/每动作16关键帧，检查父子循环、裁切、角度、图片URI，界面下载模板。普通单图不能补被遮挡关节，不声称兼容任意Spine/Live2D。浏览器资源不会随Tavern存档自动导出。音乐默认开但受首次交互限制。

## 核验/安装

npm test **110/110通过**，包含已安装Tavern原生SDK结算工具契约，不只是mock路由。npm run check检查运行文件与10项资产。tools/verify-browser.mjs在自己的临时Chrome上下文验证平滑待机、头顶HUD、四档速度、6人阵容/3在场、角色+物品生成、个人骨架动画与刷新持久化、正文自动入场；pageErrors为空。

证据review/sprite-battle-0.8.3/：tests.txt、browser-result.json、battle-menu.png、attack-frame.png、six-roster-three-field.png、per-character-rig.png、story-to-battle.png、installation.json。隔离演示AI为本地固定回复，没有调用真实玩家模型、读取真实卡内容或重启DSH。

安装到C:/Users/30625/.dsh/profile-data/tavern/data/plugins/dsh-tavern-game。脚本备份旧插件，保留.tavern-entry.mjs，发布完整目录，不改DSH配置。installation.json记录生产ZIP/source/installed逐文件SHA256及入口保留检查。需要用户完整退出并重开DSH确认0.8.3。

接手优先真实环境验收：一键生成/来源选择；同步开关开启后正文消耗物品和生命变化；手动同一描述分别试演练/剧情；个人资源刷新留存；AI决策供应商和声音。漏MVU字段则加脱敏fixture扩别名，不恢复旧工坊。单图动作仍不满意时优先制作分层关节素材与关键帧，不能靠提高差异姿态切换频率改善。
# 0.8.12 代码交接 · 完整构造 DSH 后台模型消息

0.8.11 安装后截图仍显示`模型连接中断（error）`。检查当前 DSH 的模型调用实现发现：独立 helper 消息在送入 `prepareCall().stream()` 前必须具备唯一 `id` 和 DSH 插件 `source`。本插件此前只传`role/content`，导致后台聊天可用而插件自己的模型流仍可能被拒。现通过 `helperTextMessage()` 补齐元数据，覆盖整队/单角色生成、自然语言敌人解析、AI战果、旧版队伍填入与敌方 AI 决策；流式失败码/消息解析也保留在 0.8.11。

回归测试断言生成请求和战术请求都带UUID与插件来源。`npm test`158项通过，静态检查、打包通过。0.8.12已安装；发布包和安装目录76项运行文件/资源逐个SHA256一致，Tavern入口保留，哈希=`fac756e943ee697d9dd15aac29c14bd0ffce7ead0b4c82c34fc8f3b58b694102`。包SHA256=`83fb773f916b165255c39dc2e0890ba677fb17a729dee88444b4d43e15cc103b`，安装备份`dist/installed-backup-20261022-200229-838a9465613d40fc8754e7e2779d6542.zip`。完整退出并重开 DSH，再刷新 Tavern 后实测；未调用真实模型。安装收据见`review/ai-generation-0.8.12/installation.json`。

# 0.8.11 代码交接 · 修复 AI 生成请求路由与错误诊断

截图中的“缺少本局标识”来自单角色 AI 设计按钮的直接路由调用漏传 `gameId`；已补齐。另一处 `(error)` 是 DSH 流以 `finish.reason.failure` 返回结构化错误，但客户端只读取了 `kind`；现在展示脱敏后的 HTTP 状态、供应商错误码和消息。根据 DSH 流协议，模型错误可作为带内 `finish {kind:'error', failure}` 返回，详见[官方流式文档](https://github.com/tsdaer/dsh-desktop/blob/feat/tauri-shell/docs/subsystems/llm-streaming.zh.md)。

回归测试覆盖设计路由携带当前 `gameId`、模型带内失败读取 `failure` 字段及隐藏凭据。`npm test`158项通过，静态检查、打包通过。0.8.11已安装；运行文件和资源76项SHA256逐个匹配，Tavern入口哈希仍为`fac756e943ee697d9dd15aac29c14bd0ffce7ead0b4c82c34fc8f3b58b694102`。备份为`dist/installed-backup-20261022-195354-54bfc453945c420cbda3b5dae1e0aca2.zip`，包SHA256=`53b8175767c16bf4ddc182cde6019bc72bbc0dbe79fc31da4be78636377c3278`，完整收据见`review/ai-generation-0.8.11/installation.json`。未请求真实模型；刷新酒馆，如宿主插件未热更新则重启DSH。若仍失败，新界面应显示具体诊断码与脱敏原因，可据此区分授权/限流、空响应、上下文限制或传输故障。

# 0.8.10 代码交接 · AI生成错误诊断与单角色重试

AI设计单个队友仍是未保存草稿；失败时卡片提供“重试精简设计本角色”，复用同一actorId与要求并发送`compact:true`，不触发整队/背包生成。角色精简提示只要求`actor` JSON，去除背包指令，避免返回结构冲突。主队伍生成的精简重试仍只在该请求失败时显示。流异常给出短的脱敏错误摘要（例如HTTP状态/连接原因），凭据字段会屏蔽；原数据保留。

验证：`npm test`通过157项，`npm run check`及`npm run package`通过。安装目标`C:\Users\30625\.dsh\profile-data\tavern\data\plugins\dsh-tavern-game`；运行文件和资源75项SHA256一致，Tavern入口保留，SHA256=`fac756e943ee697d9dd15aac29c14bd0ffce7ead0b4c82c34fc8f3b58b694102`。旧版备份：`dist/installed-backup-20261022-193846-dd62e7c1f8e84a3baf1ff9574da11781.zip`；收据：`review/ai-generation-0.8.10/installation.json`。本地固定模型夹具未调用真实供应商；远端账号/模型状态需刷新酒馆、重启DSH后重试并查看新显示的诊断摘要。
