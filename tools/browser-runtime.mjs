// Optional development dependency; the installed plugin needs no Playwright.
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const paths = [process.cwd(), process.env.DSH_TEST_NODE_MODULES,
  join(homedir(), '.dsh/apps/dsh-tavern'),
  join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node')].filter(Boolean);
let entry;
try { entry = require.resolve('playwright', { paths }); }
catch { throw new Error('Browser verification requires Playwright. Install it locally or set DSH_TEST_NODE_MODULES to its node_modules directory.'); }
const runtime = await import(pathToFileURL(entry).href);
export const chromium = runtime.chromium || runtime.default?.chromium;
if (!chromium) throw new Error('The resolved Playwright package does not provide Chromium.');
