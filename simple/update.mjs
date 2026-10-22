// 插件自更新：读 GitHub Release，比对版本，下载源码 tarball 覆盖本插件目录。
// 只写本插件自己的文件夹；Tavern 自动生成的入口文件、状态文件与本地备份一律不碰。
import { readFile, writeFile, mkdir, stat, copyFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { get } from 'node:https';
import { gunzipSync } from 'node:zlib';

const OWNER = 'weixinlll';
const REPO = 'dsh-tavern-game';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_BYTES = 400 * 1024 * 1024;
const MAX_FILE = 32 * 1024 * 1024;
const MAX_FILES = 4000;
const TIMEOUT = 180000;
const ALLOWED_HOSTS = new Set(['api.github.com', 'codeload.github.com', 'github.com', 'objects.githubusercontent.com']);
// Tavern 生成的入口与状态、本地备份、依赖与输出目录都不能被上游覆盖。
const PROTECTED = /^\.tavern-[^/\\]*$|^(?:\.update-backup|node_modules|dist|\.git)(?:$|[\\/])|\.bak-|\.orig$/i;

export const REPO_URL = `https://github.com/${OWNER}/${REPO}`;

/** 语义化版本比较：a 比 b 新返回正数，相同返回 0。 */
export function compareVersions(a, b) {
  const parse = value => String(value ?? '').replace(/^v/i, '').split(/[.+-]/).map(part => {
    const n = Number.parseInt(part, 10);
    return Number.isFinite(n) ? n : 0;
  });
  const left = parse(a), right = parse(b);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff) return diff > 0 ? 1 : -1;
  }
  return 0;
}

/** 从 tar 内容里取文件；支持 ustar 前缀与 pax 长路径，目录与其它类型跳过。 */
export function parseTar(buffer) {
  const files = [];
  let offset = 0, nextPath = '';
  const text = (from, length) => {
    let end = from;
    while (end < from + length && buffer[end]) end++;
    return buffer.toString('utf8', from, end);
  };
  const octal = (from, length) => Number.parseInt(text(from, length).trim() || '0', 8);
  while (offset + 512 <= buffer.length) {
    const header = offset;
    if (buffer.subarray(header, header + 512).every(byte => byte === 0)) break;
    const name = text(header, 100);
    const size = octal(header + 124, 12);
    const type = String.fromCharCode(buffer[header + 156] || 48);
    const prefix = text(header + 345, 155);
    const start = header + 512;
    if (!Number.isFinite(size) || size < 0 || start + size > buffer.length) throw new Error('更新包内容不完整。');
    const body = buffer.subarray(start, start + size);
    offset = start + Math.ceil(size / 512) * 512;
    if (type === 'x') {
      const records = body.toString('utf8').split('\n');
      for (const record of records) {
        const match = /^\d+ (?:path|linkpath)=([\s\S]+)$/.exec(record);
        if (match) nextPath = match[1].trim();
      }
      continue;
    }
    if (type === 'g' || type === 'L' || type === 'K') continue;
    if (type === '5') { nextPath = ''; continue; }
    if (type !== '0' && type !== '\u0000') { nextPath = ''; continue; }
    const path = nextPath || (prefix ? `${prefix}/${name}` : name);
    nextPath = '';
    if (!path || path.endsWith('/')) continue;
    if (size > MAX_FILE) throw new Error(`更新包里的文件过大：${path}`);
    files.push({ path, data: body });
    if (files.length > MAX_FILES) throw new Error('更新包文件数量过多。');
  }
  return files;
}

/** 去掉打包工具加的顶层目录，返回相对插件根的安全路径；不安全的返回空串。 */
export function safeRelative(path, stripComponents = 0) {
  const parts = String(path || '').split(/[\\/]+/).filter(Boolean);
  const rest = parts.slice(stripComponents);
  if (!rest.length) return '';
  for (const part of rest) if (part === '.' || part === '..') return '';
  const relative = rest.join('/');
  if (PROTECTED.test(relative)) return '';
  return relative;
}

function request(url, { asJson = false, limit = MAX_BYTES } = {}) {
  return new Promise((resolveRequest, reject) => {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
      reject(new Error('更新地址不在允许范围内。'));
      return;
    }
    const req = get(parsed, { headers: { 'user-agent': 'dsh-tavern-game-updater', accept: asJson ? 'application/vnd.github+json' : '*/*' } }, res => {
      const status = res.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
        res.resume();
        request(new URL(res.headers.location, parsed).href, { asJson, limit }).then(resolveRequest, reject);
        return;
      }
      if (status !== 200) {
        res.resume();
        reject(Object.assign(new Error(status === 404 ? '还没有发布版本。' : `更新请求失败（HTTP ${status}）。`), { status }));
        return;
      }
      const chunks = [];
      let total = 0;
      res.on('data', chunk => {
        total += chunk.length;
        if (total > limit) { req.destroy(new Error('更新包超出大小上限。')); return; }
        chunks.push(chunk);
      });
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (!asJson) { resolveRequest(buffer); return; }
        try { resolveRequest(JSON.parse(buffer.toString('utf8'))); } catch { reject(new Error('更新信息格式不正确。')); }
      });
    });
    req.setTimeout(TIMEOUT, () => req.destroy(new Error('更新请求超时。')));
    req.on('error', reject);
  });
}

export async function localVersion() {
  try {
    const raw = await readFile(join(ROOT, 'package.json'), 'utf8');
    const value = JSON.parse(raw);
    return typeof value.version === 'string' ? value.version : '0.0.0';
  } catch { return '0.0.0'; }
}

export async function checkForUpdate() {
  const current = await localVersion();
  let release = null;
  try { release = await request(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, { asJson: true, limit: 2 * 1024 * 1024 }); }
  catch (error) {
    if (error?.status !== 404) throw error;
  }
  const latest = typeof release?.tag_name === 'string' ? release.tag_name.replace(/^v/i, '') : '';
  if (!latest) return { current, latest: '', updateAvailable: false, repo: REPO_URL, notice: '上游还没有发布版本。' };
  const newer = compareVersions(latest, current) > 0;
  return {
    current, latest, updateAvailable: newer, repo: REPO_URL,
    publishedAt: typeof release.published_at === 'string' ? release.published_at : '',
    notes: typeof release.body === 'string' ? release.body.slice(0, 2000) : '',
    tarball: newer ? (release.tarball_url || `https://codeload.github.com/${OWNER}/${REPO}/tar.gz/${release.tag_name}`) : '',
  };
}

/** 下载并覆盖本插件目录。返回写入统计；失败时抛出，已写入的文件会留在备份目录。 */
export async function installUpdate({ expected = '' } = {}) {
  const info = await checkForUpdate();
  if (!info.updateAvailable) return { updated: false, current: info.current, latest: info.latest || info.current, notice: '已经是最新版本。' };
  if (expected && info.latest !== expected) throw new Error('版本在准备过程中变化了，请重新检查更新。');
  const archive = await request(info.tarball);
  let tar;
  try { tar = gunzipSync(archive); } catch { throw new Error('更新包解压失败。'); }
  const entries = parseTar(tar);
  if (!entries.length) throw new Error('更新包里没有文件。');
  // GitHub 的 tarball 外面套一层 <owner>-<repo>-<sha>/，本地打的包可能没有。
  const firstSegment = entries[0].path.split(/[\\/]+/)[0];
  const strip = entries.every(entry => entry.path.split(/[\\/]+/)[0] === firstSegment) && entries.some(entry => /[\\/]/.test(entry.path)) ? 1 : 0;
  const manifest = entries.find(entry => safeRelative(entry.path, strip) === 'package.json');
  let remote = null;
  try { remote = manifest ? JSON.parse(manifest.data.toString('utf8')) : null; } catch { remote = null; }
  if (!remote || remote.name !== REPO) throw new Error('更新包不是这个插件的源码。');

  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const backup = join(ROOT, '.update-backup', stamp);
  let written = 0, skipped = 0, backedUp = 0;
  const touched = [];
  for (const entry of entries) {
    const relative = safeRelative(entry.path, strip);
    if (!relative) { skipped++; continue; }
    const target = resolve(ROOT, relative);
    if (target !== ROOT && !target.startsWith(ROOT + sep)) { skipped++; continue; }
    const existing = await stat(target).catch(() => null);
    const code = /\.(?:js|mjs|cjs|json|md|ps1|txt|ya?ml)$/i.test(relative);
    if (existing?.isFile() && code) {
      const copy = join(backup, relative);
      await mkdir(dirname(copy), { recursive: true });
      await copyFile(target, copy).then(() => { backedUp++; }).catch(() => {});
    }
    if (existing?.isFile() && !code && existing.size === entry.data.length) { skipped++; continue; }
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, entry.data);
    written++;
    touched.push(relative);
  }
  await writeFile(join(ROOT, '.update-backup', 'last.json'), JSON.stringify({
    at: new Date().toISOString(), from: info.current, to: info.latest, written, backedUp, files: touched.slice(0, 200),
  }, null, 2), 'utf8').catch(() => {});
  return { updated: true, from: info.current, to: info.latest, written, skipped, backedUp, backup: '.update-backup/' + stamp, restart: true };
}

/** 本地备份目录列表，供面板显示与回滚。 */
export async function listBackups() {
  const directory = join(ROOT, '.update-backup');
  const names = await readdir(directory).catch(() => []);
  return names.filter(name => /^\d{14}$/.test(name)).sort().reverse().slice(0, 5);
}
