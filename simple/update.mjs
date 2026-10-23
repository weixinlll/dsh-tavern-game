// Validate the complete release before publishing a staged plugin directory.
// Local Tavern guards/data are copied unchanged; backups contain runtime files only.
import * as fs from 'node:fs/promises';
import { dirname, join, resolve, sep, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { get, Agent } from 'node:https';
import { createHash, randomUUID } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

const OWNER = 'weixinlll', REPO = 'dsh-tavern-game';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_BYTES = 400 * 1024 * 1024, MAX_FILE = 32 * 1024 * 1024, MAX_FILES = 4000;
const TIMEOUT = 600000;
const INTEGRITY = 'update-integrity.json';
const ALLOWED_HOSTS = new Set(['api.github.com', 'codeload.github.com', 'github.com', 'objects.githubusercontent.com']);
const PROTECTED = /^(?:\.tavern-[^/]*|\.update-backup|node_modules|dist|\.git)(?:$|\/)|\.bak-|\.orig$/i;
const sha256 = data => createHash('sha256').update(data).digest('hex');
const runtimePath = path => /^(?:package\.json|index\.mjs|client\.js|README\.md|LICENSE|update-integrity\.json)$/.test(path)
  || /^simple\/[^/]+\.mjs$/.test(path) || path.startsWith('assets/');
export const REPO_URL = `https://github.com/${OWNER}/${REPO}`;

export function compareVersions(a, b) {
  const parse = value => String(value ?? '').replace(/^v/i, '').split(/[.+-]/).map(part => Number.parseInt(part, 10) || 0);
  const left = parse(a), right = parse(b);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff) return diff > 0 ? 1 : -1;
  }
  return 0;
}

/** Reject absolute paths, traversal, Windows aliases/streams and protected host data. */
export function safeRelative(path, stripComponents = 0) {
  const raw = String(path || '');
  if (!raw || /^[\\/]/.test(raw) || /[\x00-\x1f:]/.test(raw)) return '';
  const parts = raw.split(/[\\/]/);
  if (parts.some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part)
    || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) return '';
  const rest = parts.slice(stripComponents), relative = rest.join('/');
  return relative && !PROTECTED.test(relative) ? relative : '';
}

/** Checksums, complete padded bodies and the two EOF blocks are mandatory. */
export function parseTar(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length > MAX_BYTES || buffer.length % 512) throw new Error('更新包内容不完整或过大。');
  const files = []; let offset = 0, nextPath = '', ended = false;
  const text = (from, length) => buffer.subarray(from, from + length).toString('utf8').split('\0')[0];
  const octal = (from, length) => {
    const raw = text(from, length).trim();
    if (!/^[0-7]+$/.test(raw || '0')) throw new Error('更新包文件头格式不正确。');
    return Number.parseInt(raw || '0', 8);
  };
  while (offset + 512 <= buffer.length) {
    const header = offset;
    if (buffer.subarray(header, header + 512).every(byte => byte === 0)) {
      if (offset + 1024 > buffer.length || !buffer.subarray(offset).every(byte => byte === 0)) throw new Error('更新包结束标记不完整。');
      ended = true; break;
    }
    let checksum = 0;
    for (let i = 0; i < 512; i++) checksum += i >= 148 && i < 156 ? 32 : buffer[header + i];
    if (checksum !== octal(header + 148, 8)) throw new Error('更新包文件头校验失败。');
    const size = octal(header + 124, 12), type = String.fromCharCode(buffer[header + 156] || 48);
    const start = header + 512, end = start + Math.ceil(size / 512) * 512;
    if (!Number.isSafeInteger(size) || size > MAX_FILE || end > buffer.length) throw new Error('更新包文件不完整或过大。');
    const body = buffer.subarray(start, start + size);
    offset = end;
    if (type === 'x' || type === 'g') {
      let cursor = 0;
      while (cursor < body.length) {
        const space = body.indexOf(32, cursor), rawLength = body.toString('ascii', cursor, space);
        const length = /^\d+$/.test(rawLength) ? Number(rawLength) : 0;
        if (space < cursor || length <= space - cursor + 1 || cursor + length > body.length || body[cursor + length - 1] !== 10) throw new Error('更新包长路径记录不完整。');
        const record = body.toString('utf8', space + 1, cursor + length - 1);
        if (type === 'x' && record.startsWith('path=')) nextPath = record.slice(5);
        cursor += length;
      }
      continue;
    }
    if (type === 'L') { nextPath = body.toString('utf8').replace(/\0.*$/s, '').replace(/\n$/, ''); continue; }
    if (type === '5') { nextPath = ''; continue; }
    if (type !== '0') throw new Error('更新包含不支持的链接或特殊文件。');
    const prefix = text(header + 345, 155), name = text(header, 100);
    const path = nextPath || (prefix ? `${prefix}/${name}` : name);
    nextPath = '';
    if (!path) throw new Error('更新包文件路径为空。');
    files.push({ path, data: body });
    if (files.length > MAX_FILES) throw new Error('更新包文件数量过多。');
  }
  if (!ended || nextPath) throw new Error('更新包内容不完整。');
  return files;
}

function request(url, { asJson = false, limit = MAX_BYTES, redirects = 0 } = {}) {
  return new Promise((resolveRequest, reject) => {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname) || parsed.username || parsed.password || (parsed.port && parsed.port !== '443') || redirects > 5) {
      reject(new Error('更新地址不在允许范围内或重定向过多。')); return;
    }
    // Inherit configured HTTP(S)/NO_PROXY only for this updater. Never replace
    // the host's global agent or change certificate verification.
    let agent;
    try { agent = new Agent({ proxyEnv: process.env }); }
    catch { reject(new Error('更新代理配置无法使用，请检查宿主的HTTP(S)代理设置。')); return; }
    const req = get(parsed, { agent, headers: { 'user-agent': 'dsh-tavern-game-updater', accept: asJson ? 'application/vnd.github+json' : '*/*' } }, res => {
      const status = res.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
        res.resume(); request(new URL(res.headers.location, parsed).href, { asJson, limit, redirects: redirects + 1 }).then(resolveRequest, reject); return;
      }
      if (status !== 200) {
        res.resume(); reject(Object.assign(new Error(status === 404 ? '还没有发布版本。' : `更新请求失败（HTTP ${status}）。`), { status })); return;
      }
      const chunks = []; let total = 0;
      res.on('data', chunk => {
        total += chunk.length;
        if (total > limit) { req.destroy(new Error('更新包超出大小上限。')); return; }
        chunks.push(chunk);
      });
      res.on('aborted', () => reject(new Error('更新下载中断。')));
      res.on('error', reject);
      res.on('end', () => {
        if (!res.complete || (res.headers['content-length'] && Number(res.headers['content-length']) !== total)) { reject(new Error('更新下载不完整。')); return; }
        const buffer = Buffer.concat(chunks);
        if (!asJson) { resolveRequest(buffer); return; }
        try { resolveRequest(JSON.parse(buffer.toString('utf8'))); } catch { reject(new Error('更新信息格式不正确。')); }
      });
    });
    const timer = setTimeout(() => req.destroy(new Error('更新请求超时。')), TIMEOUT);
    req.on('close', () => { clearTimeout(timer); agent.destroy(); });
    req.setTimeout(TIMEOUT, () => req.destroy(new Error('更新请求超时。')));
    req.on('error', reject);
  });
}

function checkRuntime(files, expected) {
  let manifest;
  try { manifest = JSON.parse(files.get('package.json')?.toString('utf8')); } catch { throw new Error('更新包缺少有效的 package.json。'); }
  if (manifest.name !== REPO || manifest.version !== expected || manifest.main !== 'index.mjs'
    || manifest.exports?.['.'] !== './index.mjs' || manifest.exports?.['./client'] !== './client.js') throw new Error('更新包身份、版本或入口不匹配。');
  for (const path of ['index.mjs', 'client.js', 'assets/manifest.json']) if (!files.has(path)) throw new Error(`更新包缺少文件：${path}`);
  for (const [path, data] of files) {
    if (!/\.(?:mjs|js)$/.test(path)) continue;
    const source = data.toString('utf8');
    for (const match of source.matchAll(/(?:from\s+|import\s*\(?\s*)['"](\.[^'"]+)['"]/g)) {
      const target = posix.normalize(posix.join(posix.dirname(path), match[1]));
      if (!safeRelative(target) || !files.has(target)) throw new Error(`更新包缺少模块：${target}`);
    }
  }
  let assets;
  try { assets = JSON.parse(files.get('assets/manifest.json').toString('utf8')); } catch { throw new Error('更新包资源目录格式不正确。'); }
  if (!Array.isArray(assets.files) || !assets.files.length) throw new Error('更新包资源目录为空。');
  for (const path of assets.files) if (typeof path !== 'string' || safeRelative(path) !== path || !files.has('assets/' + path)) throw new Error(`更新包缺少资源：${String(path)}`);
  return manifest;
}

/** A source tarball may contain docs/tests, but only declared runtime files are installed. */
export function validateRelease(entries, expected) {
  if (!entries.length || entries.length > MAX_FILES) throw new Error('更新包文件数量不正确。');
  const first = entries[0].path.split('/')[0];
  const strip = entries.every(entry => entry.path.startsWith(first + '/')) ? 1 : 0;
  const all = new Map(), names = new Set();
  let total = 0;
  for (const entry of entries) {
    if (!Buffer.isBuffer(entry.data) || entry.data.length > MAX_FILE || (total += entry.data.length) > MAX_BYTES) throw new Error('更新包文件超出大小上限。');
    const path = safeRelative(entry.path, strip);
    if (!path) throw new Error(`更新包包含不安全路径：${entry.path}`);
    if (names.has(path.toLowerCase())) throw new Error(`更新包包含重复路径：${path}`);
    names.add(path.toLowerCase()); all.set(path, entry.data);
  }
  let integrity;
  try { integrity = JSON.parse(all.get(INTEGRITY)?.toString('utf8')); } catch { throw new Error('更新包缺少完整性清单，请使用新版发布流程重新打包。'); }
  if (integrity.schemaVersion !== 1 || integrity.name !== REPO || integrity.version !== expected || !Array.isArray(integrity.files)
    || integrity.files.length > MAX_FILES) throw new Error('更新包完整性清单身份或版本不匹配。');
  const files = new Map();
  for (const entry of integrity.files) {
    const path = entry.path, data = all.get(path);
    if (typeof path !== 'string' || safeRelative(path) !== path || !runtimePath(path) || path === INTEGRITY || files.has(path)
      || !Number.isSafeInteger(entry.size) || !/^[a-f0-9]{64}$/.test(entry.sha256 || '')) throw new Error('更新包完整性清单格式不正确。');
    if (!data || data.length !== entry.size || sha256(data) !== entry.sha256) throw new Error(`更新包文件校验失败：${path}`);
    files.set(path, data);
  }
  for (const path of all.keys()) if (runtimePath(path) && path !== INTEGRITY && !files.has(path)) throw new Error(`更新包文件未列入校验：${path}`);
  files.set(INTEGRITY, all.get(INTEGRITY)); checkRuntime(files, expected);
  return files;
}

/** Injectable filesystem/root/request support real failure tests without touching an installation. */
export function createUpdater({ root = ROOT, io = fs, fetch = request } = {}) {
  root = resolve(root);
  const parent = dirname(root), base = root.slice(parent.length + 1), lockPath = join(parent, `.${base}-update.lock`);
  const inside = path => { const target = resolve(root, path); if (!target.startsWith(root + sep)) throw new Error('不安全的更新路径。'); return target; };
  const exists = async path => { try { return await io.lstat(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } };
  async function localVersion() { try { return JSON.parse(await io.readFile(inside('package.json'), 'utf8')).version || '0.0.0'; } catch { return '0.0.0'; } }
  async function checkForUpdate() {
    const current = await localVersion(); let release;
    try { release = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, { asJson: true, limit: 2 * 1024 * 1024 }); }
    catch (error) { if (error?.status !== 404) throw error; }
    const latest = typeof release?.tag_name === 'string' ? release.tag_name.replace(/^v/i, '') : '';
    if (!latest) return { current, latest: '', updateAvailable: false, repo: REPO_URL, notice: '上游还没有发布版本。' };
    if (!/^\d+\.\d+\.\d+$/.test(latest)) throw new Error('上游版本号格式不正确。');
    const newer = compareVersions(latest, current) > 0;
    return { current, latest, updateAvailable: newer, repo: REPO_URL,
      publishedAt: typeof release.published_at === 'string' ? release.published_at : '',
      notes: typeof release.body === 'string' ? release.body.slice(0, 2000) : '',
      // The API's legacy archive redirect can stall on large art packages.
      // Use the canonical, fixed-owner archive endpoint for the validated tag.
      tarball: newer ? `https://codeload.github.com/${OWNER}/${REPO}/tar.gz/refs/tags/${encodeURIComponent(release.tag_name)}` : '' };
  }
  async function locked(operation) {
    await io.mkdir(parent, { recursive: true });
    let handle;
    try { handle = await io.open(lockPath, 'wx'); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      // A crashed process must not permanently disable updates. Never steal a live lock.
      let pid; try { pid = JSON.parse(await io.readFile(lockPath, 'utf8')).pid; } catch { /* keep uncertain locks */ }
      let alive = true;
      if (Number.isSafeInteger(pid) && pid > 0) { try { process.kill(pid, 0); } catch (e) { if (e.code === 'ESRCH') alive = false; } }
      if (alive) throw new Error('另一个更新或回滚正在进行，请稍后重试。');
      await io.unlink(lockPath); handle = await io.open(lockPath, 'wx');
    }
    try { await handle.writeFile(JSON.stringify({ pid: process.pid })); return await operation(); }
    finally { await handle.close(); await io.unlink(lockPath); }
  }
  async function walk(directory, prefix = '') {
    const found = [];
    for (const item of await io.readdir(directory, { withFileTypes: true })) {
      const path = prefix ? prefix + '/' + item.name : item.name, absolute = join(directory, item.name);
      if (item.isSymbolicLink()) throw new Error(`插件目录含链接，无法安全更新：${path}`);
      if (item.isDirectory()) found.push(...await walk(absolute, path));
      else if (item.isFile()) found.push(path);
      else throw new Error(`插件目录含特殊文件：${path}`);
    }
    return found;
  }
  async function writeTree(directory, files) {
    for (const [path, data] of files) { const target = join(directory, path); await io.mkdir(dirname(target), { recursive: true }); await io.writeFile(target, data); }
    for (const [path, data] of files) if (sha256(await io.readFile(join(directory, path))) !== sha256(data)) throw new Error(`写入校验失败：${path}`);
  }
  async function listBackups() {
    const directory = inside('.update-backup'), names = await io.readdir(directory).catch(() => []), valid = [];
    for (const name of names.filter(name => /^\d{17}-[a-f0-9-]{36}$/.test(name)).sort().reverse()) {
      try {
        const metadata = JSON.parse(await io.readFile(join(directory, name, 'snapshot.json'), 'utf8'));
        if (metadata.schemaVersion === 1 && metadata.complete === true) valid.push(name);
      } catch { /* Legacy partial or interrupted backups remain on disk for manual recovery. */ }
    }
    return valid.slice(0, 5);
  }
  async function publish(files, from, to, { rollback = '' } = {}) {
    const existing = await exists(root);
    if (existing?.isSymbolicLink()) throw new Error('插件根目录不能是链接。');
    const id = new Date().toISOString().replace(/\D/g, '').slice(0, 17) + '-' + randomUUID();
    const stage = join(parent, `.${base}-update-${id}`), previous = join(parent, `.${base}-previous-${id}`);
    let published = false;
    await io.mkdir(stage);
    try {
      const current = existing ? await walk(root) : [], snapshot = new Map();
      for (const path of current) {
        const data = await io.readFile(inside(path));
        if (runtimePath(path)) snapshot.set(path, data);
        else { const target = join(stage, path); await io.mkdir(dirname(target), { recursive: true }); await io.writeFile(target, data); }
      }
      // Snapshot every runtime byte, including binary assets. A failed backup aborts before rename.
      if (existing) {
        // A damaged installed runtime must still be repairable by update/rollback.
        // Keep its exact bytes for recovery, but never offer an incomplete snapshot.
        let complete = true;
        try {
          if (snapshot.has(INTEGRITY)) validateRelease([...snapshot].map(([path, data]) => ({ path, data })), from);
          else checkRuntime(snapshot, from);
        } catch { complete = false; }
        const backup = join(stage, '.update-backup', id);
        await writeTree(backup, snapshot);
        await io.writeFile(join(backup, 'snapshot.json'), JSON.stringify({ schemaVersion: 1, complete, version: from,
          files: [...snapshot].map(([path, data]) => ({ path, size: data.length, sha256: sha256(data) })) }));
      }
      await writeTree(stage, files);
      await io.mkdir(join(stage, '.update-backup'), { recursive: true });
      await io.writeFile(join(stage, '.update-backup', 'last.json'), JSON.stringify({ at: new Date().toISOString(), from, to, backup: existing ? id : '', rollback }));
      // Keep five complete runtime snapshots without recursively nesting old backups.
      const backups = (await io.readdir(join(stage, '.update-backup'))).filter(name => /^\d{17}-[a-f0-9-]{36}$/.test(name)).sort().reverse();
      let completeBackups = 0;
      for (const old of backups) {
        let metadata;
        try { metadata = JSON.parse(await io.readFile(join(stage, '.update-backup', old, 'snapshot.json'), 'utf8')); }
        catch { continue; }
        if (metadata.schemaVersion === 1 && metadata.complete === true && ++completeBackups > 5) {
          await io.rm(join(stage, '.update-backup', old), { recursive: true });
        }
      }
      if (existing) await io.rename(root, previous);
      try { await io.rename(stage, root); published = true; }
      catch (error) {
        if (!existing) throw error;
        try { await io.rename(previous, root); }
        catch (recovery) { throw new Error(`更新发布失败且自动恢复受阻。完整原目录保留在 ${previous}；请关闭 DSH 后将它恢复为 ${root}。原因：${recovery.message}`, { cause: error }); }
        throw new Error('更新发布失败，原版本已自动恢复。', { cause: error });
      }
      // Publication has succeeded. Cleanup errors must never remove the running plugin or its backup.
      if (existing) await io.rm(previous, { recursive: true }).catch(() => {});
      return { updated: true, from, to, written: files.size, skipped: 0, backedUp: snapshot.size,
        backup: existing ? '.update-backup/' + id : '', restart: true, ...(rollback ? { rolledBack: true } : {}) };
    } finally {
      if (!published) await io.rm(stage, { recursive: true, force: true }).catch(() => {});
      // A failed recovery leaves `previous` as the original copy. Always retain it.
    }
  }
  async function installUpdate({ expected = '' } = {}) {
    return locked(async () => {
      const info = await checkForUpdate();
      if (!info.updateAvailable) return { updated: false, current: info.current, latest: info.latest || info.current, notice: '已经是最新版本。' };
      if (expected && info.latest !== expected) throw new Error('版本在准备过程中变化了，请重新检查更新。');
      const archive = await fetch(info.tarball);
      let tar; try { tar = gunzipSync(archive, { maxOutputLength: MAX_BYTES }); } catch { throw new Error('更新包解压失败或超出大小上限。'); }
      return publish(validateRelease(parseTar(tar), info.latest), info.current, info.latest);
    });
  }
  // 完整包 160MB 以上，放图集时下载会卡死；快速通道只取代码文件，走 contents 接口。
  async function fetchContents(path, ref) {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`;
    const value = await fetch(url, { asJson: true, limit: 8 * 1024 * 1024 });
    if (!value || value.encoding !== 'base64' || typeof value.content !== 'string') throw new Error(`无法读取 ${path}。`);
    return Buffer.from(value.content.replace(/\s+/g, ''), 'base64');
  }
  async function installUpdateQuick({ expected = '' } = {}) {
    return locked(async () => {
      const info = await checkForUpdate();
      if (!info.updateAvailable) return { updated: false, current: info.current, latest: info.latest || info.current, notice: '已经是最新版本。', quick: true };
      if (expected && info.latest !== expected) throw new Error('版本在准备过程中变化了，请重新检查更新。');
      const ref = `v${info.latest}`;
      let manifest;
      try { manifest = JSON.parse((await fetchContents(INTEGRITY, ref)).toString('utf8')); }
      catch { throw new Error('上游缺少完整性清单，只能使用完整更新。'); }
      if (manifest?.schemaVersion !== 1 || manifest.version !== info.latest || !Array.isArray(manifest.files)) throw new Error('上游完整性清单无效。');
      const targets = manifest.files.filter(entry => entry && typeof entry.path === 'string'
        && /^[a-f0-9]{64}$/.test(entry.sha256 || '') && runtimePath(entry.path)
        && entry.path !== INTEGRITY && !entry.path.startsWith('assets/'));
      if (!targets.length) throw new Error('完整性清单里没有可更新的代码文件。');
      const files = new Map();
      for (const entry of targets) {
        const data = await fetchContents(entry.path, ref);
        if (data.length !== entry.size || sha256(data) !== entry.sha256) throw new Error(`更新文件校验失败：${entry.path}`);
        files.set(entry.path, data);
      }
      const integrity = await fetchContents(INTEGRITY, ref);
      files.set(INTEGRITY, integrity);
      // 代码先全部取回并校验，再落盘；旧文件逐个备份，方便手动恢复。
      const id = new Date().toISOString().replace(/\D/g, '').slice(0, 17) + '-' + randomUUID();
      const backup = inside('.update-backup/quick-' + id);
      let backedUp = 0;
      for (const [path, data] of files) {
        const target = inside(path), previous = await io.readFile(target).catch(() => null);
        if (previous) { await io.mkdir(dirname(join(backup, path)), { recursive: true }); await io.writeFile(join(backup, path), previous); backedUp++; }
        await io.mkdir(dirname(target), { recursive: true });
        await io.writeFile(target, data);
      }
      for (const [path, data] of files) if (sha256(await io.readFile(inside(path))) !== sha256(data)) throw new Error(`写入校验失败：${path}`);
      return { updated: true, from: info.current, to: info.latest, written: files.size, backedUp, quick: true, restart: true, backup: '.update-backup/quick-' + id };
    });
  }
  async function rollbackUpdate({ backup = '' } = {}) {
    return locked(async () => {
      const backups = await listBackups(), id = backup || backups[0];
      if (!id || !backups.includes(id)) throw new Error('没有可用的本地备份。');
      const directory = inside('.update-backup/' + id);
      if ((await io.lstat(directory)).isSymbolicLink()) throw new Error('备份目录不能是链接。');
      const snapshot = JSON.parse(await io.readFile(join(directory, 'snapshot.json'), 'utf8'));
      if (snapshot.schemaVersion !== 1 || snapshot.complete !== true || !Array.isArray(snapshot.files) || snapshot.files.length > MAX_FILES) throw new Error('备份清单无效。');
      const files = new Map();
      for (const entry of snapshot.files) {
        if (safeRelative(entry.path) !== entry.path || !runtimePath(entry.path) || files.has(entry.path)) throw new Error('备份路径无效。');
        const data = await io.readFile(join(directory, entry.path));
        if (data.length !== entry.size || sha256(data) !== entry.sha256) throw new Error(`备份文件校验失败：${entry.path}`);
        files.set(entry.path, data);
      }
      checkRuntime(files, snapshot.version);
      if (files.has(INTEGRITY)) validateRelease([...files].map(([path, data]) => ({ path, data })), snapshot.version);
      return publish(files, await localVersion(), snapshot.version, { rollback: id });
    });
  }
  async function installDirectory(source, { expected, replace = false } = {}) {
    return locked(async () => {
      if (await exists(root)) {
        if (!replace) throw new Error('插件已经存在，请明确允许替换。');
        let old; try { old = JSON.parse(await io.readFile(inside('package.json'), 'utf8')); } catch { /* reject unidentified directories */ }
        if (old?.name !== REPO) throw new Error('现有目录不是此插件，拒绝替换。');
      }
      const entries = [];
      for (const path of await walk(source)) entries.push({ path, data: await io.readFile(join(source, path)) });
      return publish(validateRelease(entries, expected), await localVersion(), expected);
    });
  }
  return { localVersion, checkForUpdate, installUpdate, installUpdateQuick, listBackups, rollbackUpdate, installDirectory };
}

const updater = createUpdater();
export const { localVersion, checkForUpdate, installUpdate, installUpdateQuick, listBackups, rollbackUpdate } = updater;
