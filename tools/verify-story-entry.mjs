// Actual React/Chrome against the isolated public-API fixture; no player data or real model.
import { chromium } from './browser-runtime.mjs';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd(), output = path.join(root, 'review/fullscreen-0.1.3');
await mkdir(output, { recursive: true });
const server = spawn(process.execPath, ['tools/browser-dev-server.mjs'], { cwd: root, windowsHide: true,
  env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
let browser;
try {
  const origin = await new Promise((resolve, reject) => {
    createInterface({ input: server.stdout }).on('line', line => { if (line.startsWith('PREVIEW_URL=')) resolve(line.slice(12)); });
    server.once('exit', code => reject(Error('Preview exited ' + code)));
    server.stderr.on('data', data => process.stderr.write(data));
  });
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [], pendingSprites = [];
  let holdSprites = false;
  page.on('pageerror', error => errors.push(String(error)));
  await page.addInitScript(() => {
    const Original = window.Audio;
    window.__storyAudio = [];
    window.Audio = function (...args) { const audio = new Original(...args); window.__storyAudio.push(audio); return audio; };
    window.Audio.prototype = Original.prototype;
  });
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (!url.startsWith(origin + '/') && !url.startsWith('blob:') && !url.startsWith('data:')) return route.abort();
    if (holdSprites && url.includes('/sprite/')) await new Promise(resolve => pendingSprites.push(resolve));
    return route.continue();
  });
  const releaseSprites = () => { holdSprites = false; pendingSprites.splice(0).forEach(resolve => resolve()); };
  const state = () => page.evaluate(async () => (await fetch('/rpc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ route: 'dsh-tavern-game/state', args: { gameId: 'simple-preview' } }) })).json());
  const entry = () => page.getByRole('group', { name: '剧情战斗入口' });
  await page.goto(origin);
  await page.getByRole('button', { name: 'AI读取并生成角色和背包', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.stg-party>.stg-card').length === 2);
  await page.getByRole('button', { name: '模拟下一轮剧情遭遇', exact: true }).click();
  await entry().getByRole('button', { name: '进入战斗', exact: true }).waitFor();
  await page.waitForTimeout(500);
  assert.equal(await entry().count(), 1, 'multiple fight words share one entry');
  assert.equal(await page.locator('.stg-overlay').count(), 0, 'story settlement does not open the scene');
  assert.equal(await page.evaluate(() => window.__storyAudio.length), 0, 'the story does not start battle audio');
  const prose = await page.locator('#encounter').innerText();
  for (const word of ['决斗', '迎战', '战斗']) assert(prose.includes(word));
  await page.locator('#encounter').screenshot({ path: path.join(output, 'story-clickable-entry.png') });
  await page.setViewportSize({ width: 390, height: 780 });
  await entry().scrollIntoViewIfNeeded();
  const mobileEntry = await entry().evaluate(el => ({ width: el.getBoundingClientRect().width, buttonHeight: el.querySelector('button').getBoundingClientRect().height, viewport: innerWidth }));
  assert(mobileEntry.width <= mobileEntry.viewport && mobileEntry.buttonHeight >= 44);
  await page.locator('#encounter').screenshot({ path: path.join(output, 'story-entry-mobile.png') });
  await page.setViewportSize({ width: 1440, height: 900 });
  holdSprites = true;
  await entry().getByRole('button', { name: '进入战斗', exact: true }).click();
  await page.getByLabel('准备战斗场景', { exact: true }).waitFor();
  assert.equal(await page.locator('.stg-figure').count(), 0);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(output, 'scene-preparing.png') });
  await page.getByRole('button', { name: '返回正文', exact: true }).click();
  await page.locator('.stg-overlay').waitFor({ state: 'detached' });
  releaseSprites();
  await page.waitForTimeout(1300);
  assert.equal(await page.locator('.stg-overlay').count(), 0, 'canceling preparation never opens a late scene');
  assert.equal(await page.evaluate(() => window.__storyAudio.length), 0);
  await entry().getByRole('button', { name: '进入战斗', exact: true }).click();
  await page.locator('.stg-battle .stg-figure').first().waitFor();
  await page.waitForTimeout(750);
  const first = await state();
  const palettesReady = await page.locator('.stg-figure').evaluateAll(actors => actors.every(actor => actor.dataset.paletteReady === 'true'));
  assert(palettesReady);
  await page.screenshot({ path: path.join(output, 'story-scene-ready.png') });
  const compactLayouts = [];
  for (const viewport of [{ width: 2560, height: 1440 }, { width: 1440, height: 900 }, { width: 390, height: 780 }, { width: 320, height: 780 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(100);
    const layout = await page.evaluate(() => {
      const box = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right }; };
      const dock = document.querySelector('.stg-control-dock');
      return { viewport: { width: innerWidth, height: innerHeight }, overlay: box(document.querySelector('.stg-overlay')),
        scene: box(document.querySelector('.stg-scene')), actorStage: box(document.querySelector('.stg-actor-stage')), dock: box(dock), dockScrollWidth: dock.scrollWidth,
        uncoveredGutters: [3, innerWidth - 3].map(x => document.elementsFromPoint(x, innerHeight - 20).some(el => el.classList.contains('stg-scene'))),
        confirm: box(document.querySelector('.stg-confirm-round')), basic: box(document.querySelector('.stg-skill-basic')),
        commandHeights: [...document.querySelectorAll('.stg-commandrow>button')].map(el => el.getBoundingClientRect().height) };
    });
    assert.equal(layout.overlay.width, viewport.width, 'battle stays full screen');
    assert.equal(layout.overlay.height, viewport.height);
    assert(layout.dockScrollWidth <= layout.dock.width + 1, 'dock has no horizontal overflow');
    assert(layout.commandHeights.every(height => height >= 44), 'compact commands remain easy to tap');
    await page.screenshot({ path: path.join(output, `compact-battle-${viewport.width}.png`) });
    assert(layout.confirm.bottom <= layout.dock.bottom + 1, 'whole-round confirmation is visible without scrolling: ' + JSON.stringify(layout));
    assert.equal(layout.scene.height, viewport.height, 'background covers the entire screen height, including beside the dock');
    assert(layout.uncoveredGutters.every(Boolean), 'both bottom gutters expose the scene instead of a flat container');
    assert(layout.actorStage.bottom <= layout.dock.y - 10, 'the actor stage ends above the floating controls');
    assert(layout.actorStage.height >= viewport.height * (viewport.width > 600 ? 0.7 : 0.4), 'characters keep enough space above the controls');
    if (viewport.width > 600) assert(layout.basic.width <= 211, 'a basic attack does not stretch across a wide screen');
    compactLayouts.push(layout);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const count = await page.locator('.stg-round-plan>button').count();
  for (let index = 0; index < count; index++) await page.locator('.stg-skill-basic').click();
  assert.equal((await state()).battle.seq, first.battle.seq, 'selection does not perform combat');
  assert.match(await page.locator('.stg-round-plan').innerText(), /→/);
  assert.match(await page.locator('.stg-round-confirm').innerText(), /指令已齐/);
  const queuedOrders = await page.locator('.stg-round-plan').innerText();
  await page.getByRole('button', { name: '收起操作区', exact: true }).click();
  assert.equal(await page.locator('.stg-command-workspace').isVisible(), false);
  const collapsedHeight = await page.locator('.stg-control-dock').evaluate(el => el.getBoundingClientRect().height);
  assert(collapsedHeight <= 64, 'collapsed controls leave a small reachable toolbar');
  await page.screenshot({ path: path.join(output, 'battle-controls-collapsed.png') });
  await page.getByRole('button', { name: '展开操作区', exact: true }).click();
  assert.equal(await page.locator('.stg-round-plan').innerText(), queuedOrders, 'expand preserves all orders');
  assert.equal((await state()).battle.seq, first.battle.seq, 'collapse and expand never perform combat');
  await page.getByRole('button', { name: '战斗倍速', exact: true }).click();
  await page.getByRole('group', { name: '战斗倍速选项' }).getByRole('button', { name: '10×', exact: true }).click();
  await page.getByRole('button', { name: '确认本回合', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.stg-commandrow>button')?.disabled);
  assert.equal((await state()).battle.seq, first.battle.seq + 1);
  await page.getByRole('button', { name: '关闭战斗', exact: true }).click();
  await entry().getByRole('button', { name: '继续战斗', exact: true }).waitFor();
  await entry().getByRole('button', { name: '继续战斗', exact: true }).click();
  await page.locator('.stg-battle .stg-figure').first().waitFor();
  assert.equal(await page.locator('.stg-entry').count(), 0, 'resuming does not replay the battle-start banner');
  assert.equal((await state()).battle.seq, first.battle.seq + 1);
  await page.getByRole('button', { name: '逃离', exact: true }).click();
  await page.getByRole('button', { name: '确认逃离', exact: true }).click();
  await page.getByRole('button', { name: '生成战况', exact: true }).waitFor();
  await page.getByRole('button', { name: '生成战况', exact: true }).click();
  await page.getByRole('button', { name: '填入续写', exact: true }).click();
  await page.locator('.stg-overlay').waitFor({ state: 'detached' });
  assert.match(await page.locator('#input').inputValue(), /【AI战况】/);
  await entry().getByRole('button', { name: '查看战果', exact: true }).waitFor();
  await page.evaluate(() => window.__previewStory({ text: '他们没有开战，决定和平离开。' }));
  await page.waitForTimeout(1700);
  assert.equal(await entry().count(), 0, 'noncombat prose has no battle entry');
  assert.equal(await page.locator('.stg-overlay').count(), 0);
  assert.deepEqual(errors, []);
  const report = { fixtureOnly: true, explicitEntryOnly: true, repeatedWordsDeduplicated: true, prosePreserved: true,
    noAudioBeforeEntry: true, mobileEntry, cancellablePreparation: true, noLateOpeningAfterCancel: true,
    palettesReadyOnSceneDisplay: palettesReady, selectionDoesNotAct: true, plannedTargetsVisible: true,
    resumesSameRound: true, resumeDoesNotReplayIntro: true, recapReturnsToComposer: true, finishedEntryShowsResult: true,
    noncombatDoesNotOfferEntry: true, compactLayouts, collapsedHeight, collapsePreservesOrders: true, pageErrors: errors };
  await writeFile(path.join(output, 'story-entry-result.json'), JSON.stringify(report, null, 2));
  console.log('STORY_ENTRY_PASS ' + JSON.stringify(report));
} finally { await browser?.close(); server.kill(); }
