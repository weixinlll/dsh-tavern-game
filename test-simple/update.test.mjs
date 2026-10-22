import test from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, parseTar, safeRelative } from '../simple/update.mjs';

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
  const paxBody = Buffer.from(`${String(6 + paxPath.length).padStart(3, '0')} path=${paxPath}\n`, 'utf8');
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
