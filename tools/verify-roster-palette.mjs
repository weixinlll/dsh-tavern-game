import { chromium } from './browser-runtime.mjs';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_AVATARS } from '../simple/looks.mjs';

const root = process.cwd();
const outputDir = path.join(root, 'review', 'palette-0.1.1');
await mkdir(outputDir, { recursive: true });
const LEGACY_STARTER_ASSETS = [
  { id: 'starter-male-portrait', category: 'human', src: '/assets/human/sprite/adventurer-male-v2.png' },
  { id: 'starter-female-portrait', category: 'human', src: '/assets/human/sprite/adventurer-female-v2.png' },
];
const server = spawn(process.execPath, ['tools/browser-dev-server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: '0' },
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let origin = '';
const ready = new Promise((resolve, reject) => {
  const rl = createInterface({ input: server.stdout });
  rl.on('line', line => {
    if (line.startsWith('PREVIEW_URL=')) {
      origin = line.slice('PREVIEW_URL='.length);
      resolve(origin);
    }
  });
  server.once('exit', code => reject(Error(`preview server exited (${code})`)));
  server.stderr.on('data', data => process.stderr.write(data));
});
let browser;

try {
  await ready;
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.addInitScript(() => { window.__DSH_BATTLE_PALETTE_TEST__ = true; });
  await page.goto(origin);
  await page.waitForFunction(() => typeof window.__DSH_BATTLE_PALETTE_TEST_EXPORT__ === 'function');

  // Independent regression colors: pale/yellow highlights, red blush, dark and
  // low-saturation skin were missed by the old narrow skin-tone predicate.
  const skinProbe = await page.evaluate(async () => {
    const colors = [[255,222,165], [245,170,145], [132,98,90], [92,61,49], [244,235,228], [255,255,248], [160,160,160], [38,38,38]];
    const canvas = document.createElement('canvas'); canvas.width = colors.length; canvas.height = 1;
    const context = canvas.getContext('2d'), source = context.createImageData(colors.length, 1);
    colors.forEach((rgb, index) => source.data.set([...rgb,255], index * 4)); context.putImageData(source, 0, 0);
    for (const seed of [1, 12, 1579, 4294967295]) {
      const url = await window.__DSH_BATTLE_PALETTE_TEST_EXPORT__(canvas.toDataURL(), seed, 'human');
      try {
        const image = new Image(); image.src = url; await image.decode(); context.clearRect(0,0,canvas.width,1); context.drawImage(image,0,0);
        const actual = context.getImageData(0,0,canvas.width,1).data;
        if (source.data.some((value,index) => value !== actual[index])) throw Error('human skin or neutral regression patch was recolored');
      } finally { URL.revokeObjectURL(url); }
    }
    return { samples: colors.length, seeds: 4, allPixelsPreserved: true };
  });

  const varietyProbe = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d'); context.fillStyle = 'rgb(35,105,200)'; context.fillRect(0,0,1,1);
    const source = canvas.toDataURL(), hues = new Set(), colors = new Set(), saturations = [];
    for (let index = 0; index < 64; index++) {
      const url = await window.__DSH_BATTLE_PALETTE_TEST_EXPORT__(source, Math.imul(index + 1, 2654435761) >>> 0, 'human');
      try {
        const image = new Image(); image.src = url; await image.decode(); context.clearRect(0,0,1,1); context.drawImage(image,0,0);
        const pixel = context.getImageData(0,0,1,1).data, [r,g,b] = [...pixel].slice(0,3).map(value => value / 255);
        const max = Math.max(r,g,b), min = Math.min(r,g,b), delta = max-min, light = (max+min)/2;
        let hue = max === r ? ((g-b)/delta)%6 : max === g ? (b-r)/delta+2 : (r-g)/delta+4;
        hue = (hue*60+360)%360;
        hues.add(Math.floor(hue/30)); colors.add([...pixel].join(',')); saturations.push(delta/(1-Math.abs(2*light-1)));
      } finally { URL.revokeObjectURL(url); }
    }
    if (hues.size < 10 || colors.size < 60 || Math.max(...saturations) < .8) throw Error('random palettes lack broad color-wheel coverage or vivid variants');
    return { seeds:64, distinctColors:colors.size, hueBinsOf12:hues.size, maximumSaturation:Math.max(...saturations) };
  });

  const hairProbe = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const context = canvas.getContext('2d');
    for (let cell = 0; cell < 16; cell++) {
      const x = cell % 4 * 128, y = Math.floor(cell / 4) * 128;
      context.fillStyle = 'rgb(58,60,65)'; context.fillRect(x + 48, y + 20, 32, 22);
      context.fillStyle = 'rgb(245,170,145)'; context.fillRect(x + 52, y + 42, 24, 18);
      context.fillStyle = 'rgb(35,105,200)'; context.fillRect(x + 40, y + 60, 48, 60);
    }
    const source = canvas.toDataURL(), hair = new Set(), clothes = new Set(), pairs = new Set();
    for (let index = 0; index < 16; index++) {
      const url = await window.__DSH_BATTLE_PALETTE_TEST_EXPORT__(source, Math.imul(index + 1, 2654435761) >>> 0, 'human');
      try {
        const image = new Image(); image.src = url; await image.decode(); context.clearRect(0,0,512,512); context.drawImage(image,0,0);
        const pixel = (x,y) => [...context.getImageData(x,y,1,1).data].join(',');
        if (pixel(448,48) !== '245,170,145,255') throw Error('hair channel recolored face');
        if (pixel(448,24) === '58,60,65,255') throw Error('hair channel failed to vary neutral hair');
        hair.add(pixel(448,24)); clothes.add(pixel(448,70)); pairs.add(`${pixel(448,24)}|${pixel(448,70)}`);
      } finally { URL.revokeObjectURL(url); }
    }
    if (hair.size < 14 || clothes.size < 14 || pairs.size !== 16) throw Error('independent hair/clothing channels lack diversity');
    return { seeds:16, hairColors:hair.size, clothingColors:clothes.size, independentPairs:pairs.size, facePreserved:true };
  });

  const avatars = [
    ...Object.entries(DEFAULT_AVATARS).map(([id, avatar]) => ({ id, category: avatar.category, src: `/assets/${avatar.src}` })),
    ...LEGACY_STARTER_ASSETS,
  ];
  // Reproducible extremes plus unrelated seeds make any failure repeatable.
  const seeds = Array.from({ length: avatars.length }, (_, index) => [0, 0xffff_ffff,
    Math.imul(index + 1, 2654435761) >>> 0, Math.imul(index + 19, 2246822519) >>> 0, 1579, 0x73ab12f0]);

  const rows = await page.evaluate(async ({ avatars, seeds }) => {
    const recolor = window.__DSH_BATTLE_PALETTE_TEST_EXPORT__;
    const loadPixels = async source => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.src = source;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      return { width: canvas.width, height: canvas.height, pixels: context.getImageData(0, 0, canvas.width, canvas.height).data };
    };
    const hsl = (r, g, b) => {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
      let hue = 0, saturation = 0;
      const lightness = (max + min) / 2;
      if (delta) {
        saturation = delta / (1 - Math.abs(2 * lightness - 1));
        if (max === r) hue = ((g - b) / delta) % 6;
        else if (max === g) hue = (b - r) / delta + 2;
        else hue = (r - g) / delta + 4;
        hue = (hue * 60 + 360) % 360;
      }
      return [hue, saturation, lightness];
    };
    const failures = [];
    const results = [];
    for (let index = 0; index < avatars.length; index++) {
      const avatar = avatars[index];
      const [seedA, seedB] = seeds[index];
      const original = await loadPixels(avatar.src);
      const urlA = await recolor(avatar.src, seedA, avatar.category);
      const urlRepeat = await recolor(avatar.src, seedA, avatar.category);
      const urlB = await recolor(avatar.src, seedB, avatar.category);
      try {
        const [paletteA, repeatedA, paletteB] = await Promise.all([loadPixels(urlA), loadPixels(urlRepeat), loadPixels(urlB)]);
        const sameSize = [paletteA, repeatedA, paletteB].every(image => image.width === original.width && image.height === original.height);
        let visible = 0, changedFromSource = 0, changedAcrossSeeds = 0, changedOnRepeat = 0, standingVisible = 0, standingChanged = 0, standingSeedChanged = 0;
        let alphaMismatches = 0, protectedHumanoidPixels = 0, modifiedProtectedPixels = 0, confidentGarmentPixels = 0;
        const protectedIndexes = [];
        const source = original.pixels, a = paletteA.pixels, repeat = repeatedA.pixels, b = paletteB.pixels;
        for (let pixel = 0; pixel < source.length; pixel += 4) {
          if (source[pixel + 3] !== a[pixel + 3] || source[pixel + 3] !== b[pixel + 3]) alphaMismatches++;
          if (source[pixel + 3] < 16) continue;
          visible++;
          if (source[pixel] !== a[pixel] || source[pixel + 1] !== a[pixel + 1] || source[pixel + 2] !== a[pixel + 2]) changedFromSource++;
          if (a[pixel] !== b[pixel] || a[pixel + 1] !== b[pixel + 1] || a[pixel + 2] !== b[pixel + 2]) changedAcrossSeeds++;
          const x = (pixel / 4) % original.width, y = Math.floor(pixel / (4 * original.width));
          if (original.width !== 2048 || (x >= 1536 && y < 512)) {
            standingVisible++;
            if (source[pixel] !== a[pixel] || source[pixel + 1] !== a[pixel + 1] || source[pixel + 2] !== a[pixel + 2]) standingChanged++;
            if (a[pixel] !== b[pixel] || a[pixel + 1] !== b[pixel + 1] || a[pixel + 2] !== b[pixel + 2]) standingSeedChanged++;
          }
          if (a[pixel] !== repeat[pixel] || a[pixel + 1] !== repeat[pixel + 1] || a[pixel + 2] !== repeat[pixel + 2]) changedOnRepeat++;
          if (avatar.category === 'human' && source[pixel + 3] >= 240) {
            const key = ((source[pixel] >> 2) << 12) | ((source[pixel + 1] >> 2) << 6) | (source[pixel + 2] >> 2);
            const red = ((key >> 12) & 63) * 4 + 2, green = ((key >> 6) & 63) * 4 + 2, blue = (key & 63) * 4 + 2;
            const [hue, saturation, lightness] = hsl(red, green, blue);
            if (hue >= 110 && hue <= 280 && saturation >= .35 && lightness >= .2 && lightness <= .85) confidentGarmentPixels++;
            const skin = hue >= 10 && hue <= 55 && red > green && green > blue && saturation >= .16 && saturation <= .70 && lightness >= .22 && lightness <= .91;
            if (skin) {
              protectedHumanoidPixels++;
              protectedIndexes.push(pixel);
              if (source[pixel] !== a[pixel] || source[pixel + 1] !== a[pixel + 1] || source[pixel + 2] !== a[pixel + 2]) modifiedProtectedPixels++;
            }
          }
        }
        const sourceChangeRatio = visible ? changedFromSource / visible : 0;
        const seedDifferenceRatio = visible ? changedAcrossSeeds / visible : 0;
        const extraSeedChecks = [];
        for (const seed of seeds[index].slice(2)) {
          const url = await recolor(avatar.src, seed, avatar.category);
          try {
            const variant = await loadPixels(url), data = variant.pixels;
            let alphaErrors = 0, changed = 0, skinErrors = 0;
            for (let pixel = 0; pixel < source.length; pixel += 4) {
              if (source[pixel + 3] !== data[pixel + 3]) alphaErrors++;
              if (source[pixel + 3] >= 16 && (source[pixel] !== data[pixel] || source[pixel+1] !== data[pixel+1] || source[pixel+2] !== data[pixel+2])) changed++;
            }
            for (const pixel of protectedIndexes) if (source[pixel] !== data[pixel] || source[pixel+1] !== data[pixel+1] || source[pixel+2] !== data[pixel+2]) skinErrors++;
            extraSeedChecks.push({ seed, changedRatio: changed / visible, alphaErrors, skinErrors, passed: alphaErrors === 0 && skinErrors === 0 && changed / visible >= .01 });
          } finally { URL.revokeObjectURL(url); }
        }
        const checks = {
          decoded: original.width > 0 && original.height > 0,
          dimensions: sameSize,
          alphaPreserved: alphaMismatches === 0,
          // Warm robes/leather and grayscale designs are deliberately preserved
          // when no confident garment region exists; do not recolor skin merely
          // to meet an arbitrary percentage quota.
          paletteChangesImage: sourceChangeRatio >= .01,
          randomSeedChangesPalette: seedDifferenceRatio >= .01,
          standingPoseVisiblyChanges: standingVisible > 0 && standingChanged / standingVisible >= .01 && standingSeedChanged / standingVisible >= .01,
          sameSeedIsDeterministic: changedOnRepeat === 0,
          humanSkinPreserved: avatar.category !== 'human' || protectedHumanoidPixels === 0 || modifiedProtectedPixels === 0,
          widerSeedRange: extraSeedChecks.every(check => check.passed),
        };
        const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
        if (failed.length) failures.push({ id: avatar.id, failed, sourceChangeRatio, seedDifferenceRatio, standingChangedRatio: standingChanged / standingVisible, standingSeedChangedRatio: standingSeedChanged / standingVisible, changedOnRepeat, alphaMismatches, protectedHumanoidPixels, modifiedProtectedPixels, dimensions: [original.width, original.height] });
        results.push({ id: avatar.id, category: avatar.category, width: original.width, height: original.height, visiblePixels: visible,
          changedRatio: Number(sourceChangeRatio.toFixed(4)), differentSeedRatio: Number(seedDifferenceRatio.toFixed(4)),
          alphaMismatches, sameSeedDiffPixels: changedOnRepeat, skinPixelsChecked: protectedHumanoidPixels, modifiedSkinPixels: modifiedProtectedPixels, standingChangedRatio: standingChanged / standingVisible, standingSeedChangedRatio: standingSeedChanged / standingVisible, confidentGarmentPixels, extraSeedChecks, checks });
      } finally {
        URL.revokeObjectURL(urlA);
        URL.revokeObjectURL(urlRepeat);
        URL.revokeObjectURL(urlB);
      }
    }
    return { results, failures };
  }, { avatars, seeds });

  if (rows.results.length !== Object.keys(DEFAULT_AVATARS).length + LEGACY_STARTER_ASSETS.length) throw Error(`verified ${rows.results.length}/${Object.keys(DEFAULT_AVATARS).length + LEGACY_STARTER_ASSETS.length} default and legacy images`);
  if (rows.failures.length) throw Error(`palette validation failed: ${JSON.stringify(rows.failures, null, 2)}`);
  if (pageErrors.length) throw Error(`browser page errors: ${pageErrors.join('\n')}`);

  const previewData = await page.evaluate(async avatars => {
    const byId = new Map(avatars.map(avatar => [avatar.id, avatar]));
    const canvas = document.createElement('canvas'); canvas.width = 1536; canvas.height = 2160;
    const context = canvas.getContext('2d'); context.fillStyle = '#171b23'; context.fillRect(0, 0, canvas.width, canvas.height);
    const samples = [['starter-male', 0x273841, 0xa91e6c], ['starter-female', 0x739ad2, 0xe21536], ['crimson-duelist', 0x739ad2, 0xe21536], ['qilin', 0x739ad2, 0xe21536]];
    for (let row = 0; row < samples.length; row++) {
      const [id, seedA, seedB] = samples[row], avatar = byId.get(id);
      const urls = [avatar.src, await window.__DSH_BATTLE_PALETTE_TEST_EXPORT__(avatar.src, seedA, avatar.category), await window.__DSH_BATTLE_PALETTE_TEST_EXPORT__(avatar.src, seedB, avatar.category)];
      try {
        for (let column = 0; column < urls.length; column++) {
          const image = new Image(); image.src = urls[column]; await image.decode();
          const x = column * 512, y = row * 540;
          context.fillStyle = '#252d38'; context.fillRect(x, y, 512, 28);
          context.fillStyle = '#f5f7fa'; context.font = '16px system-ui';
          context.fillText(`${id} · ${column === 0 ? '原图' : `随机调色 ${column}`}`, x + 10, y + 20);
          context.drawImage(image, x, y + 28, 512, 512);
        }
      } finally { for (const url of urls.slice(1)) URL.revokeObjectURL(url); }
    }
    return canvas.toDataURL('image/png').split(',')[1];
  }, avatars);
  await writeFile(path.join(outputDir, 'palette-visual-check.png'), Buffer.from(previewData, 'base64'));
  const variants = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 1440;
    const context = canvas.getContext('2d'); context.fillStyle = '#1b2230'; context.fillRect(0,0,1280,1440);
    for (let index = 0; index < 16; index++) {
      const seed = Math.imul(index+1,2654435761) >>> 0;
      const url = await window.__DSH_BATTLE_PALETTE_TEST_EXPORT__('/assets/human/sprite/adventurer-female-actions-v1.png', seed, 'human');
      try {
        const image = new Image(); image.src = url; await image.decode();
        const x = (index%4)*320, y = Math.floor(index/4)*360;
        context.drawImage(image,1536,0,512,512,x,y,320,320); context.fillStyle = '#eef4fc'; context.font = '16px system-ui'; context.fillText(`seed ${seed}`,x+12,y+344);
      } finally { URL.revokeObjectURL(url); }
    }
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await writeFile(path.join(outputDir, 'palette-variants.png'), Buffer.from(variants,'base64'));

  const summarize = category => {
    const group = rows.results.filter(row => row.category === category);
    const mean = key => Number((group.reduce((sum, row) => sum + row[key], 0) / group.length).toFixed(4));
    return { count: group.length, minimumChangedRatio: Math.min(...group.map(row => row.changedRatio)),
      minimumDifferentSeedRatio: Math.min(...group.map(row => row.differentSeedRatio)), meanChangedRatio: mean('changedRatio'), meanDifferentSeedRatio: mean('differentSeedRatio') };
  };
  const report = { passed: true, total: rows.results.length, seedsPerImage:6, skinProbe, varietyProbe, hairProbe, conservativeWarmOrNeutralLooks: rows.results.filter(row => row.category === 'human' && row.changedRatio < .01).map(row => row.id), human: summarize('human'), animal: summarize('animal'), rows: rows.results };
  await writeFile(path.join(outputDir, 'palette-validation.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, total: report.total, human: report.human, animal: report.animal, reportPath: path.join(outputDir, 'palette-validation.json') }, null, 2));
} finally {
  await browser?.close();
  server.kill();
}
