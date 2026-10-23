// Generate this tracked manifest immediately before packaging/publishing a release.
import { readdir, readFile, writeFile, lstat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { validateRelease } from '../simple/update.mjs';

export async function generateIntegrity(root) {
  const paths = ['package.json', 'index.mjs', 'client.js', 'README.md', 'LICENSE'];
  for (const entry of await readdir(join(root, 'simple'), { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.mjs')) paths.push('simple/' + entry.name);
  }
  async function assets(directory, prefix) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = prefix + '/' + entry.name;
      if (entry.isDirectory()) await assets(join(directory, entry.name), path);
      else if (entry.isFile()) paths.push(path);
      else throw new Error('Cannot package linked/special assets: ' + path);
    }
  }
  await assets(join(root, 'assets'), 'assets');
  const entries = [];
  for (const path of paths.sort()) {
    if ((await lstat(join(root, path))).isSymbolicLink()) throw new Error('Cannot package linked runtime: ' + path);
    entries.push({ path, data: await readFile(join(root, path)) });
  }
  const pkg = JSON.parse(entries.find(entry => entry.path === 'package.json').data.toString('utf8'));
  const integrity = { schemaVersion: 1, name: pkg.name, version: pkg.version,
    files: entries.map(({ path, data }) => ({ path, size: data.length, sha256: createHash('sha256').update(data).digest('hex') })) };
  const data = Buffer.from(JSON.stringify(integrity, null, 2) + '\n');
  validateRelease([...entries, { path: 'update-integrity.json', data }], pkg.version);
  await writeFile(join(root, 'update-integrity.json'), data);
  return integrity;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const manifest = await generateIntegrity(root);
  console.log(`Integrity verified: ${manifest.files.length} runtime files, version ${manifest.version}.`);
}
