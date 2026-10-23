// Real browser interactions against a local, deterministic model fixture only.
import { chromium } from './browser-runtime.mjs';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd(), output = path.join(root, 'review/battle-0.1.1');
await mkdir(output, { recursive: true });
const server = spawn(process.execPath, ['tools/browser-dev-server.mjs'], { cwd: root, env: { ...process.env, PORT: '0' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let browser;
try {
  const origin = await new Promise((resolve, reject) => {
    createInterface({ input: server.stdout }).on('line', line => { if (line.startsWith('PREVIEW_URL=')) resolve(line.slice(12)); });
    server.once('exit', code => reject(Error('fixture stopped: ' + code)));
  });
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const trackAudio = ({ blockFirstLoop = false } = {}) => {
    const OriginalAudio = window.Audio; window.__battleTracks = []; let blocked = false;
    window.Audio = function (...args) {
      const audio = new OriginalAudio(...args), play = audio.play.bind(audio); window.__battleTracks.push(audio);
      audio.play = () => {
        if (audio.loop && blockFirstLoop && !blocked) { blocked = true; return Promise.reject(new DOMException('Fixture: first autoplay blocked', 'NotAllowedError')); }
        return play();
      };
      return audio;
    };
    window.Audio.prototype = OriginalAudio.prototype;
  };
  await page.addInitScript(trackAudio);
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  await page.goto(origin);
  const state = () => page.evaluate(async () => (await fetch('/rpc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ route: 'dsh-tavern-game/state', args: { gameId: 'simple-preview' } }) })).json());
  const generation = page.locator('.stg-generation-model').first();
  if (await page.locator('.stg-generation-model').count() !== 1) throw Error('generation model picker is duplicated');
  await generation.locator(':scope>summary').click();
  await generation.getByRole('button', { name: '保存生成模型', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.stg-generation-model>summary').textContent.includes('structured-reply'));
  await page.getByRole('button', { name: 'AI读取并生成角色和背包', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.stg-party>.stg-card').length === 2);
  const generated = await state();
  if (generated.nonCombatInventory.length || generated.inventory.some(item => !['healing-potion','resource-potion','cleanse'].includes(item.id))) throw Error('story props reached the combat bag');
  const manual = page.locator('.stg-manual');
  await manual.locator(':scope>summary').click();
  await manual.locator('textarea').fill('遇到三个动物');
  await manual.getByRole('checkbox', { name: '将战果用于正文' }).check();
  await page.getByRole('button', { name: '开始手动战斗', exact: true }).click();
  await page.locator('.stg-figure').first().waitFor();
  const initial = await state();
  if (initial.battle.enemies.length !== 3 || !initial.battle.enemies.every(actor => initial.avatarCatalog[actor.avatarId]?.category === 'animal')) throw Error('three animals did not become three animal enemies');
  await page.getByRole('button', { name: '战斗音乐', exact: true }).filter({ hasText: '音乐开' }).waitFor();
  const musicAutoplays = await page.evaluate(() => document.querySelector('[aria-label="战斗音乐"]').getAttribute('aria-pressed') === 'true');
  if (!musicAutoplays) throw Error('music did not start when entering battle');
  await page.waitForFunction(() => window.__battleTracks.some(audio => audio.loop && !audio.paused && audio.currentTime > 0.05));
  await page.locator('.stg-skills button').first().click();
  if (!(await page.getByRole('button', { name: '确认本回合', exact: true }).isDisabled())) throw Error('partial round can be committed');
  await page.waitForTimeout(400);
  const pending = await state();
  if (pending.battle.seq !== initial.battle.seq || await page.locator('.stg-figure[data-travel="approach"]').count()) throw Error('selection mutated combat or triggered travel');
  await page.getByRole('button', { name: '背包', exact: true }).click();
  const item = page.locator('.stg-inventory').first();
  if (!/25%.*行动/.test(await item.innerText())) throw Error('item description or action cost missing');
  await page.screenshot({ path: path.join(output, 'bag-description.png') });
  await item.getByRole('button', { name: '给 演练主角', exact: true }).click();
  const confirm = page.getByRole('button', { name: '确认本回合', exact: true });
  if (await confirm.isDisabled()) throw Error('complete round cannot be committed');
  await page.screenshot({ path: path.join(output, 'two-orders-ready.png') });
  const started = Date.now();
  await confirm.click();
  await page.waitForFunction(() => !document.querySelector('.stg-commandrow>button')?.disabled);
  const normalRoundMs = Date.now() - started, completed = await state();
  if (completed.battle.seq !== initial.battle.seq + 1 || completed.battle.round !== 1) throw Error('one confirmation did not commit exactly one full round');
  if (normalRoundMs < 3000) throw Error('one-times playback is too fast for the multi-actor round');
  if (completed.battle.inventory.find(item => item.id === 'healing-potion').count !== 0) throw Error('queued item was not consumed');
  await page.getByRole('button', { name: '逃离', exact: true }).click();
  await page.getByRole('button', { name: '确认逃离', exact: true }).click();
  await page.getByRole('button', { name: '生成战况', exact: true }).click();
  await page.getByRole('button', { name: '填入续写', exact: true }).click();
  const composer = await page.locator('#input').inputValue();
  if (!composer.includes('【AI战况】') || !composer.includes('我方撤离')) throw Error('AI recap did not reach the composer with actual outcome');
  const modelCalls = await page.evaluate(async () => (await (await fetch('/status')).json()).modelCalls);
  const enemyCall = modelCalls.find(call => call.prompt.startsWith('玩家明确要求'));
  if (!enemyCall?.prompt.includes('演练主角和演练同伴结伴探索。')) throw Error('enemy request did not receive current context');
  if (!modelCalls.every(call => call.model === completed.generationModel.model)) throw Error('generation tasks did not share the selected model');
  if (modelCalls.filter(call => call.prompt.startsWith('你要概括')).length !== 1) throw Error('recap did not use exactly one model call');
  const audioPage = await browser.newPage({ viewport: { width: 1100, height: 850 } });
  audioPage.on('pageerror', error => errors.push(String(error)));
  await audioPage.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  await audioPage.addInitScript(trackAudio, { blockFirstLoop: true });
  await audioPage.goto(origin);
  await audioPage.locator('input[type="file"][accept="audio/*"]').nth(2).setInputFiles(path.join(root, 'assets/human/audio/battle-loop.wav'));
  await audioPage.getByRole('button', { name: '本地演示', exact: true }).click();
  const music = audioPage.getByRole('button', { name: '战斗音乐', exact: true });
  await music.filter({ hasText: '开启音乐' }).waitFor();
  if (await music.getAttribute('aria-pressed') !== 'false') throw Error('blocked audio was incorrectly labeled on');
  await audioPage.getByRole('button', { name: '战斗', exact: true }).click();
  await music.filter({ hasText: '音乐开' }).waitFor();
  await audioPage.waitForFunction(() => window.__battleTracks.filter(audio => audio.loop && !audio.paused && audio.src.startsWith('blob:') && audio.currentTime > 0.05).length === 1);
  await music.click();
  await audioPage.getByRole('button', { name: '背包', exact: true }).click();
  if (await audioPage.evaluate(() => window.__battleTracks.some(audio => audio.loop && !audio.paused))) throw Error('battle gestures overrode mute');
  await music.click();
  await music.filter({ hasText: '音乐开' }).waitFor();
  if (await audioPage.evaluate(() => window.__battleTracks.filter(audio => audio.loop && !audio.paused).length) !== 1) throw Error('music duplicated after unmuting');
  await audioPage.getByRole('button', { name: '关闭战斗', exact: true }).click();
  if (await audioPage.evaluate(() => window.__battleTracks.some(audio => !audio.paused))) throw Error('closing battle leaked audio');
  await audioPage.close();
  if (errors.length) throw Error(errors.join('\n'));
  const report = { fixtureOnly: true, generationModel: completed.generationModel, singleGenerationPicker: true, enemyReadsCurrentContext: true,
    threeAnimalEnemies: initial.battle.enemies.map(actor => ({ name: actor.name, avatarId: actor.avatarId })), musicAutoplays, audioClockAdvanced: true,
    autoplayBlockedStateAccurate: true, normalGestureUnlocksImportedMusic: true, muteRespected: true, noDuplicateLoops: true, audioStopsOnClose: true, aiRecapInComposer: true,
    onlyCombatItems: true, itemDescriptionVisible: true, selectionDoesNotAct: true, partialRoundBlocked: true,
    oneConfirmationOneRound: true, modelMatchedEnemyAvatar: initial.battle.enemies[0].avatarId, normalRoundMs, pageErrors: errors };
  await writeFile(path.join(output, 'round-flow-result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser?.close(); server.kill(); }
