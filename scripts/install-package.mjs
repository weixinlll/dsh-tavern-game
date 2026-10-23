import { createUpdater } from '../simple/update.mjs';
const [source, target, expected, replace] = process.argv.slice(2);
if (!source || !target || !expected) throw new Error('Expected source, target and version.');
const result = await createUpdater({ root: target }).installDirectory(source, { expected, replace: replace === 'replace' });
console.log(`Installed ${result.to}: ${result.written} files verified.`);
if (result.backup) console.log(`Previous complete runtime: ${result.backup}`);
