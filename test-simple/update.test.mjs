import test from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, parseTar, safeRelative, validateRelease, createUpdater } from '../simple/update.mjs';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const pad = (buffer, size) => {
  const missing = (512 - (buffer.length % 512)) % 512;
  return missing ? Buffer.concat([buffer, Buffer.alloc(missing)]) : buffer;
};

function tarEntry(name, body, { type = '0', prefix = '' } = {}) {
  const header = Buffer.alloc(512);
  header.write(name, 0, 100, 'utf8');
  header.write(body.length.toString(8).padStart(11, '0') + '\0', 124, 12, 'ascii');
  header.write(type, 156, 1, 'ascii');
  header.write('ustar\0', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');
  if (prefix) header.write(prefix, 345, 155, 'utf8');
  header.fill(32, 148, 156);
  const checksum = header.reduce((sum, value) => sum + value, 0);
  header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
  return Buffer.concat([header, pad(body)]);
}

function tarOf(entries) {
  return Buffer.concat([...entries, Buffer.alloc(1024)]);
}

test('compareVersions 按段比较，v 前缀不影响', () => {
  assert.equal(compareVersions('0.1.1', '0.1.0'), 1);
  assert.equal(compareVersions('v0.2.0', '0.1.9'), 1);
  assert.equal(compareVersions('0.1.0', '0.1.0'), 0);
  assert.equal(compareVersions('0.0.9', '0.1.0'), -1);
  assert.equal(compareVersions('1.0', '1.0.0'), 0);
});

test('safeRelative 剥掉打包顶层目录并挡掉越界与保护文件', () => {
  assert.equal(safeRelative('repo-abc123/client.js', 1), 'client.js');
  assert.equal(safeRelative('repo-abc123/simple/plugin.mjs', 1), 'simple/plugin.mjs');
  assert.equal(safeRelative('client.js'), 'client.js');
  assert.equal(safeRelative('repo/../evil.txt', 1), '');
  assert.equal(safeRelative('repo/.tavern-entry.mjs', 1), '');
  assert.equal(safeRelative('repo/.tavern-status.json', 1), '');
  assert.equal(safeRelative('repo/.update-backup/20260101/x.js', 1), '');
  assert.equal(safeRelative('repo/node_modules/x/index.js', 1), '');
  assert.equal(safeRelative('repo/client.js.bak-20260101', 1), '');
  assert.equal(safeRelative('repo/.gitignore', 1), '.gitignore');
  assert.equal(safeRelative('repo/../client.js', 1), '');
});

test('parseTar 读出普通文件、目录前缀与 pax 长路径', () => {
  const paxPath = 'repo-' + 'a'.repeat(90) + '/assets/human/sprite/defaults/azure-eastern-dragon-actions-v1.png';
  const record = ` path=${paxPath}\n`;
  let length = Buffer.byteLength(record) + 1;
  while (String(length).length + Buffer.byteLength(record) !== length) length = String(length).length + Buffer.byteLength(record);
  const paxBody = Buffer.from(`${length}${record}`, 'utf8');
  const body = tarOf([
    tarEntry('repo-abc123/', Buffer.alloc(0), { type: '5' }),
    tarEntry('client.js', Buffer.from('console.log(1)\n', 'utf8')),
    tarEntry('simple/plugin.mjs', Buffer.from('export {}\n', 'utf8'), { prefix: 'repo-abc123' }),
    tarEntry('PaxHeader', paxBody, { type: 'x' }),
    tarEntry('sprite.png', Buffer.from([1, 2, 3, 4])),
  ]);
  const files = parseTar(body);
  assert.deepEqual(files.map(file => file.path), [
    'client.js',
    'repo-abc123/simple/plugin.mjs',
    paxPath,
  ]);
  assert.equal(files[0].data.toString('utf8'), 'console.log(1)\n');
  assert.equal(safeRelative(paxPath, 1).startsWith('assets/'), true, 'pax 长路径能被安全还原');
  assert.equal(files[2].data.length, 4);
});

test('parseTar 拒绝被截断的包', () => {
  const full = tarOf([tarEntry('client.js', Buffer.alloc(64, 7))]);
  assert.throws(() => parseTar(full.subarray(0, 550)), /不完整|超出/);
});

const hash = data => createHash('sha256').update(data).digest('hex');
function release(version = '0.1.1', sprite = Buffer.from([4, 5, 6])) {
  const pkg = { name: 'dsh-tavern-game', version, main: 'index.mjs', exports: { '.': './index.mjs', './client': './client.js' } };
  const files = new Map([
    ['package.json', Buffer.from(JSON.stringify(pkg))], ['index.mjs', Buffer.from("export * from './simple/plugin.mjs';")],
    ['client.js', Buffer.from(`console.log('${version}');`)], ['simple/plugin.mjs', Buffer.from('export const apply = () => {};')],
    ['assets/manifest.json', Buffer.from(JSON.stringify({ schemaVersion: 1, files: ['sprite.png'] }))], ['assets/sprite.png', sprite],
  ]);
  return seal(files, version);
}
function seal(files, version = '0.1.1') {
  const integrity = { schemaVersion: 1, name: 'dsh-tavern-game', version,
    files: [...files].filter(([path]) => path !== 'update-integrity.json').map(([path, data]) => ({ path, size: data.length, sha256: hash(data) })) };
  files.set('update-integrity.json', Buffer.from(JSON.stringify(integrity)));
  return files;
}
const archive = files => gzipSync(tarOf([...files].map(([path, data]) => tarEntry('repo-sha/' + path, data))));
const entries = files => [...files].map(([path, data]) => ({ path, data }));
async function fixture(t, options = {}) {
  const parent = await fs.mkdtemp(join(tmpdir(), 'dsh-update-test-')), root = join(parent, 'dsh-tavern-game');
  t.after(() => fs.rm(parent, { recursive: true, force: true }));
  await writeFiles(root, release('0.1.0', Buffer.from([1, 2, 3])));
  await writeFiles(root, new Map([['.tavern-entry.mjs', Buffer.from('native-guard')], ['local/state.json', Buffer.from('{"party":6}')]]));
  let calls = 0;
  const fetch = async (url, args) => {
    calls++;
    if (args?.asJson) return { tag_name: 'v0.1.1', tarball_url: 'https://codeload.github.com/release' };
    return archive(options.files || release());
  };
  return { parent, root, updater: createUpdater({ root, fetch: options.fetch || fetch, io: options.io || fs }), calls: () => calls };
}
async function writeFiles(root, files) {
  for (const [path, data] of files) { await fs.mkdir(dirname(join(root, path)), { recursive: true }); await fs.writeFile(join(root, path), data); }
}

test('safeRelative 拒绝绝对、磁盘流、Windows 设备名和尾点别名', () => {
  for (const path of ['/repo/client.js', '\\repo\\client.js', 'C:/client.js', 'repo/a:stream', 'repo/NUL.txt', 'repo/simple./x.mjs', 'repo//client.js']) {
    assert.equal(safeRelative(path, 1), '', path);
  }
});

test('tar 文件头 checksum、完整 EOF、链接和畸形 PAX 都必须检查', () => {
  const complete = tarOf([tarEntry('client.js', Buffer.from('abc'))]);
  const corrupt = Buffer.from(complete); corrupt[0] ^= 1;
  assert.throws(() => parseTar(corrupt), /校验/);
  assert.throws(() => parseTar(complete.subarray(0, -1024)), /不完整/);
  assert.throws(() => parseTar(complete.subarray(0, -512)), /结束标记/);
  assert.throws(() => parseTar(tarOf([tarEntry('link', Buffer.alloc(0), { type: '2' })])), /链接/);
  assert.throws(() => parseTar(tarOf([tarEntry('pax', Buffer.from('10 path=abc\n'), { type: 'x' })])), /记录/);
});

test('发布清单检查版本、同长度资源内容以及模块/资源闭包', () => {
  const good = release();
  assert.equal(validateRelease(entries(good), '0.1.1').size, good.size);
  assert.throws(() => validateRelease(entries(good), '0.1.2'), /版本/);
  const changed = new Map(good); changed.set('assets/sprite.png', Buffer.from([7, 8, 9]));
  assert.throws(() => validateRelease(entries(changed), '0.1.1'), /校验/);
  for (const path of ['simple/plugin.mjs', 'assets/sprite.png']) {
    const missing = new Map(good); missing.delete(path); seal(missing);
    assert.throws(() => validateRelease(entries(missing), '0.1.1'), /缺少模块|缺少资源/);
  }
  const truncated = new Map(good); truncated.delete('client.js');
  assert.throws(() => validateRelease(entries(truncated), '0.1.1'), /校验/);
  const duplicate = [...entries(good), { path: 'CLIENT.JS', data: Buffer.from('bad') }];
  assert.throws(() => validateRelease(duplicate, '0.1.1'), /重复/);
});

test('更新同长度二进制并完整回滚，保留 guard 和本地数据、不嵌套备份', async t => {
  const { root, updater } = await fixture(t);
  const result = await updater.installUpdate({ expected: '0.1.1' });
  assert.equal(result.updated, true);
  assert.deepEqual(await fs.readFile(join(root, 'assets/sprite.png')), Buffer.from([4, 5, 6]));
  assert.equal(await fs.readFile(join(root, '.tavern-entry.mjs'), 'utf8'), 'native-guard');
  await fs.writeFile(join(root, 'local/state.json'), '{"party":3}');
  const [id] = await updater.listBackups();
  assert.ok(id);
  const restored = await updater.rollbackUpdate({ backup: id });
  assert.equal(restored.rolledBack, true);
  assert.equal(await updater.localVersion(), '0.1.0');
  assert.deepEqual(await fs.readFile(join(root, 'assets/sprite.png')), Buffer.from([1, 2, 3]));
  assert.equal(await fs.readFile(join(root, 'local/state.json'), 'utf8'), '{"party":3}');
  assert.equal((await updater.listBackups()).length, 2);
  for (const backup of await updater.listBackups()) await assert.rejects(fs.stat(join(root, '.update-backup', backup, '.update-backup')), { code: 'ENOENT' });
});

test('缺失或损坏更新包在发布前拒绝，原始字节不变', async t => {
  const broken = release(); broken.delete('assets/sprite.png');
  const { root, updater } = await fixture(t, { files: broken });
  await assert.rejects(updater.installUpdate(), /校验/);
  assert.equal(await updater.localVersion(), '0.1.0');
  assert.deepEqual(await fs.readFile(join(root, 'assets/sprite.png')), Buffer.from([1, 2, 3]));
  assert.equal((await updater.listBackups()).length, 0);
});

test('备份或阶段写入失败都中止，绝不改动运行目录', async t => {
  for (const failure of ['snapshot', 'stage']) {
    const io = { ...fs, writeFile: async (path, ...args) => {
      if ((failure === 'snapshot' && String(path).endsWith('snapshot.json'))
        || (failure === 'stage' && String(path).endsWith('client.js') && !String(path).includes('.update-backup'))) throw new Error('disk full');
      return fs.writeFile(path, ...args);
    } };
    const { root, updater } = await fixture(t, { io });
    await assert.rejects(updater.installUpdate(), /disk full/);
    assert.equal(await updater.localVersion(), '0.1.0');
    assert.equal(await fs.readFile(join(root, '.tavern-entry.mjs'), 'utf8'), 'native-guard');
  }
});

test('发布重命名失败自动恢复完整旧版本', async t => {
  let calls = 0;
  const io = { ...fs, rename: async (...args) => { if (++calls === 2) throw new Error('publication locked'); return fs.rename(...args); } };
  const { root, updater, parent } = await fixture(t, { io });
  await assert.rejects(updater.installUpdate(), /原版本已自动恢复/);
  assert.equal(await updater.localVersion(), '0.1.0');
  assert.equal(await fs.readFile(join(root, '.tavern-entry.mjs'), 'utf8'), 'native-guard');
  assert.deepEqual(await fs.readdir(parent), ['dsh-tavern-game']);
});

test('发布和恢复同时失败，完整原目录保留供恢复', async t => {
  let calls = 0;
  const io = { ...fs, rename: async (...args) => { if (++calls >= 2) throw new Error('rename locked'); return fs.rename(...args); } };
  const { updater, parent } = await fixture(t, { io });
  await assert.rejects(updater.installUpdate(), /完整原目录保留/);
  const recovery = (await fs.readdir(parent)).find(name => name.startsWith('.dsh-tavern-game-previous-'));
  assert.ok(recovery);
  const original = join(parent, recovery);
  assert.equal(JSON.parse(await fs.readFile(join(original, 'package.json'), 'utf8')).version, '0.1.0');
  assert.deepEqual(await fs.readFile(join(original, 'assets/sprite.png')), Buffer.from([1, 2, 3]));
  assert.equal(await fs.readFile(join(original, 'local/state.json'), 'utf8'), '{"party":6}');
});

test('损坏回滚备份不触碰当前版本', async t => {
  const { root, updater } = await fixture(t);
  await updater.installUpdate();
  const [id] = await updater.listBackups();
  await fs.writeFile(join(root, '.update-backup', id, 'assets/sprite.png'), Buffer.from([9, 9, 9]));
  await assert.rejects(updater.rollbackUpdate({ backup: id }), /备份文件校验失败/);
  assert.equal(await updater.localVersion(), '0.1.1');
});

test('回滚可以修复当前已缺失模块或资源的插件，不把损坏版本提供为可用备份', async t => {
  const { root, updater } = await fixture(t);
  await updater.installUpdate();
  await fs.unlink(join(root, 'simple/plugin.mjs'));
  await fs.unlink(join(root, 'assets/sprite.png'));
  await updater.rollbackUpdate();
  assert.equal(await updater.localVersion(), '0.1.0');
  assert.ok(await fs.readFile(join(root, 'simple/plugin.mjs')));
  assert.deepEqual(await fs.readFile(join(root, 'assets/sprite.png')), Buffer.from([1, 2, 3]));
  assert.equal((await updater.listBackups()).length, 1);
});

test('回滚发布失败时恢复当前完整版本', async t => {
  const { root, updater } = await fixture(t);
  await updater.installUpdate();
  let calls = 0;
  const io = { ...fs, rename: async (...args) => { if (++calls === 2) throw new Error('publication locked'); return fs.rename(...args); } };
  const restore = createUpdater({ root, io });
  await assert.rejects(restore.rollbackUpdate(), /原版本已自动恢复/);
  assert.equal(await updater.localVersion(), '0.1.1');
  assert.deepEqual(await fs.readFile(join(root, 'assets/sprite.png')), Buffer.from([4, 5, 6]));
  assert.equal((await updater.listBackups()).length, 1);
});

test('两个 updater 实例不能并发发布或回滚', async t => {
  let releaseFetch, enteredFetch;
  const blocked = new Promise(resolve => { releaseFetch = resolve; });
  const entered = new Promise(resolve => { enteredFetch = resolve; });
  const fetch = async (url, args) => {
    if (args?.asJson) return { tag_name: 'v0.1.1', tarball_url: 'https://codeload.github.com/release' };
    enteredFetch(); await blocked; return archive(release());
  };
  const { root, updater } = await fixture(t, { fetch });
  const pending = updater.installUpdate(); await entered;
  const other = createUpdater({ root, fetch });
  await assert.rejects(other.installUpdate(), /另一个更新或回滚/);
  await assert.rejects(other.rollbackUpdate(), /另一个更新或回滚/);
  releaseFetch(); await pending;
  assert.equal(await updater.localVersion(), '0.1.1');
});

test('共享安装器支持首次安装及明确替换，不覆盖陌生目录', async t => {
  const { parent } = await fixture(t), source = join(parent, 'package'), target = join(parent, 'fresh');
  await writeFiles(source, release());
  const updater = createUpdater({ root: target });
  await updater.installDirectory(source, { expected: '0.1.1' });
  assert.equal(await updater.localVersion(), '0.1.1');
  await assert.rejects(updater.installDirectory(source, { expected: '0.1.1' }), /明确允许/);
  await updater.installDirectory(source, { expected: '0.1.1', replace: true });
  assert.equal((await updater.listBackups()).length, 1);
  const stranger = join(parent, 'stranger'); await fs.mkdir(stranger); await fs.writeFile(join(stranger, 'package.json'), '{"name":"other"}');
  await assert.rejects(createUpdater({ root: stranger }).installDirectory(source, { expected: '0.1.1', replace: true }), /不是此插件/);
});

test('不完整恢复快照不占用五份完整备份的保留名额', async t => {
  const { root, updater } = await fixture(t);
  const complete = [], incomplete = [];
  for (let index = 0; index < 7; index++) {
    const id = `2025010100000000${index}-00000000-0000-4000-8000-000000000000`;
    const directory = join(root, '.update-backup', id);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(join(directory, 'snapshot.json'), JSON.stringify({ schemaVersion: 1, complete: index < 5 }));
    (index < 5 ? complete : incomplete).push(id);
  }
  await updater.installUpdate();
  const retained = await fs.readdir(join(root, '.update-backup'));
  assert.equal((await updater.listBackups()).length, 5);
  assert(!retained.includes(complete[0]), 'only the oldest complete backup is pruned');
  for (const id of [...complete.slice(1), ...incomplete]) assert(retained.includes(id), id);
});
