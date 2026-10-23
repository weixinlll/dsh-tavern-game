// Isolated real-React preview; all Tavern data below is an explicitly labeled in-memory fixture.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apply } from '../index.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageInfo = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const modulesRoot = process.env.DSH_TEST_NODE_MODULES || path.join(process.env.USERPROFILE || '', '.dsh/apps/dsh-tavern/node_modules');
const routes = new Map(), callbacks = {}, turns = new Map(), records = new Map(), modelCalls = [];
let revision = 0;
let head = { gameId: 'simple-preview', turn: 7, textVersion: 'preview-v1', settled: true, busy: false, generating: false, settling: false };
const variables = { stat_data: { 主角: { 姓名: '演练主角', 生命: 138, 生命上限: 160, 攻击: 20, 防御: 8, 速度: 50, 技能: ['直拳', '致盲烟幕', '护体'] },
  队友: [{ 姓名: '演练同伴', 生命: 112, 生命上限: 130, 攻击: 17, 防御: 6, 速度: 55, 技能: ['剑斩', '治疗', '麻痹'] }],
  敌人: [{ 姓名: '敌人不进入队友列表', 生命: 999 }] } };
turns.set(head.turn, { ...head, text: '演练主角和演练同伴结伴探索。', rawText: '', variables });
const copy = value => structuredClone(value);
const T = {
  apiVersion: 3,
  handle: (name, handler) => routes.set(name, handler),
  getTurnState: async () => copy(head),
  getTurn: async ({ turn }) => copy(turns.get(turn) || null),
  getHistory: async ({ from = 1, to = head.turn }) => [...turns.values()].filter(t => t.turn >= from && t.turn <= to).map(copy),
  readTurnData: async ({ turn }) => [...records.values()].filter(r => r.turn <= turn && turns.get(r.turn)?.textVersion === r.textVersion).sort((a, b) => b.turn - a.turn).map(copy)[0] || null,
  saveTurnData: async ({ turn, textVersion, data }) => {
    if (head.turn !== turn || head.textVersion !== textVersion) throw Error('预览版本已变化');
    records.set(`${turn}:${textVersion}`, { turn, textVersion, data: copy(data) }); revision++;
    return { turn, textVersion };
  },
  promptSection: config => { callbacks.prompt = config; }, turnSection: config => { callbacks.turn = config; },
  settlementSection: config => { callbacks.settlement = config; },
  onTurnSettled: fn => { callbacks.settled = fn; }, onTimelineChanged: fn => { callbacks.timeline = fn; },
  backgroundModel: async () => ({ provider: 'local-fixture', model: 'structured-reply' }), runTask: async () => { throw Error('隔离预览禁止调用真实模型'); },
};
const fixtureSkill = (name, baseId, power, element = 'physical') => ({ name, baseId, power, element, extraStatuses: [], mechanics: [] });
const fixtureActor = (name, gender, avatarId, types, skills, hp, maxHp, attack, defense, speed) => ({
  name, gender, avatarId, kind: 'human', types, hp, maxHp, attack, defense, speed,
  skills,
});
// This is a deterministic local fixture, never a provider request or a claim of live AI generation.
const fixtureLlm = {
  listProviders: () => [{ id: 'local-fixture', name: '固定回复（仅隔离演练）' }],
  listModels: async () => [{ id: 'structured-reply', name: '本地夹具，无网络请求' }],
  resolveModelInfo: async () => ({ reasoning: null }),
  prepareCall: async config => ({ config, stream: async function* (options) {
    const prompt = options.messages[0].content[0].text;
    modelCalls.push({ provider: options.provider, model: options.model, maxTokens: options.maxTokens, prompt });
    let output;
    if (prompt.startsWith('你要概括一场已经结束')) {
      const facts = JSON.parse(prompt.match(/<实战记录>\s*([\s\S]*?)\s*<\/实战记录>/)[1]);
      output = { winner: facts.outcome.winner, rounds: facts.rounds, summary: '演练队伍与对手完成交锋，随后撤离战场。双方状态以实战记录为准。' };
    } else if (prompt.startsWith('玩家明确要求按以下输入手动开战')) {
      const animal = prompt.includes('遇到三个动物');
      const opponents = animal ? [
        { name: '灰狼', species: '狼', avatarId: 'silver-wolf', types: ['nature'], baseId: 'human-0-1' },
        { name: '赤狐', species: '狐狸', avatarId: 'ember-fox', types: ['fire'], baseId: 'human-0-3' },
        { name: '乌鸦', species: '乌鸦', avatarId: 'raven-scout', types: ['wind'], baseId: 'human-0-2' },
      ] : [{ name: '演练山贼', avatarId: 'iron-guardian', types: ['physical'], baseId: 'human-0-1' }];
      output = { enemies: opponents.map((opponent, index) => ({ ...opponent, kind: animal ? 'animal' : 'human', ...(animal ? {} : { gender: 'male' }),
        skills: [fixtureSkill(['扑咬', '爪击', '啄击', '挥剑'][index] || '攻击', opponent.baseId, 68 + index * 3)] })) };
    } else if (prompt.includes('只设计一个角色草稿')) {
      output = { actor: fixtureActor('演练主角', 'male', 'jade-swordsman', ['physical', 'fire'], [
        fixtureSkill('快拳', 'human-0-1', 76), fixtureSkill('致盲拳', 'human-0-4', 55),
        fixtureSkill('格挡', 'human-0-12', 0, 'neutral'), fixtureSkill('疗伤', 'human-0-17', 0, 'neutral'),
      ], 138, 160, 20, 8, 50) };
    } else {
      output = { party: [
        fixtureActor('演练主角', 'male', 'jade-swordsman', ['physical', 'fire'], [
          fixtureSkill('直拳', 'human-0-1', 76), fixtureSkill('致盲烟幕', 'human-0-4', 54),
          fixtureSkill('护体', 'human-0-13', 0, 'neutral'), fixtureSkill('凝神', 'human-0-14', 0, 'neutral'),
        ], 138, 160, 20, 8, 50),
        fixtureActor('演练同伴', 'female', 'jade-lancer', ['physical', 'water'], [
          fixtureSkill('快剑', 'human-0-3', 82), fixtureSkill('剑斩', 'human-0-2', 58),
          fixtureSkill('疗伤', 'human-0-17', 0, 'neutral'), fixtureSkill('净化', 'human-0-18', 0, 'neutral'),
        ], 112, 130, 17, 6, 55),
      ], items: [
        { id: 'healing-potion', name: '疗伤药', description: 'AI补全的演练药品（本地固定回复）', count: 1 },
        { name: '旧钥匙', description: '演练非战斗物品', count: 1 },
      ] };
    }
    yield { type: 'text-delta', text: JSON.stringify(output) }; yield { type: 'finish', reason: { kind: 'stop' } };
  } }),
};
apply({ tavern: T, get: key => key === 'llm' ? fixtureLlm : null, effect: () => {} });

async function reactBundle() {
  const modules = { react: 'react/cjs/react.development.js', 'react-dom': 'react-dom/cjs/react-dom.development.js',
    'react-dom/client': 'react-dom/cjs/react-dom-client.development.js', scheduler: 'scheduler/cjs/scheduler.development.js' };
  const code = await Promise.all(Object.entries(modules).map(async ([id, file]) => `${JSON.stringify(id)}:function(module,exports,require){${await readFile(path.join(modulesRoot, file), 'utf8')}\n}`));
  return `(function(){const process={env:{NODE_ENV:'development'}},modules={${code.join(',')}},cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](m,m.exports,require);return m.exports}window.React=require('react');window.ReactDOMClient=require('react-dom/client')})()`;
}
const bootstrap = `
const gameId='simple-preview', registrations={},listeners=new Set();let lastRevision=-1;
async function rpc(route,args){const r=await fetch('/rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({route,args})});const v=await r.json();if(!r.ok)throw Object.assign(Error(v.message),{code:v.code});return v}
async function sync(){const v=await(await fetch('/status')).json();if(lastRevision!==v.revision){lastRevision=v.revision;listeners.forEach(fn=>fn(v.head))}}
const ui={apiVersion:3,assetUrl:p=>'/assets/'+p,callHost:rpc,registerPanel:c=>registrations.panel=c,registerTextMarker:c=>registrations.marker=c,
watchTurnState:(id,fn)=>{listeners.add(fn);fetch('/status').then(r=>r.json()).then(v=>fn(v.head));return()=>listeners.delete(fn)},
setInput:async({text})=>{document.querySelector('#input').value=text},submitInput:async()=>{throw Error('隔离预览不发送剧情')},
openOverlay:({render,onClose})=>{const box=document.createElement('div');document.body.append(box);const r=ReactDOMClient.createRoot(box);const close=()=>{r.unmount();box.remove();onClose?.()};r.render(render({gameId,close}));return{close}}};
window.__ModuleLoader__={load:({factory})=>factory(id=>{if(id!=='react')throw Error(id);return React}).apply({tavernUi:ui,effect:()=>{}})};
let encounterRoot;
window.addEventListener('load',()=>{ReactDOMClient.createRoot(document.querySelector('#panel')).render(registrations.panel.render({gameId}));document.querySelector('#story').onclick=async()=>{const story=await(await fetch('/story',{method:'POST'})).json();await sync();const status=await(await fetch('/status')).json();registrations.marker.pattern.lastIndex=0;const match=registrations.marker.pattern.exec(story.text)?.[0];encounterRoot ||= ReactDOMClient.createRoot(document.querySelector('#encounter'));encounterRoot.render(match?registrations.marker.render({gameId,turn:status.head.turn,streaming:false,match}):null)};setInterval(sync,500)});
window.addEventListener('error',e=>{document.querySelector('#error').textContent=e.message});
`;
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>两个固定包 · 隔离预览</title><style>body{margin:0;background:#f7f7f8;color:#182638;font:14px/1.5 system-ui,sans-serif}header,footer{max-width:950px;margin:auto;padding:16px}header{display:flex;gap:12px;align-items:center}header small{flex:1;color:#566779}#panel{max-width:950px;margin:auto;background:#fff;border:1px solid #e1e7ee;border-radius:8px}button{padding:8px 12px}textarea{box-sizing:border-box;width:100%;min-height:80px;border:1px solid #c9d4e0;border-radius:6px;padding:10px}#error{color:#b92c41}</style><body><header><strong>隔离预览</strong><small>示例数据保存在内存；AI使用本地固定回复，不调用真实模型。</small><button id="story">模拟下一轮剧情遭遇</button></header><main id="panel"></main><div id="encounter"></div><footer><label>预览输入框<textarea id="input" placeholder="只在主动填入续写后出现摘要"></textarea></label><p id="error" role="alert"></p></footer><script src="/react.js"></script><script>${bootstrap}</script><script src="/client.js"></script></body></html>`;
const manifest = JSON.parse(await readFile(path.join(root, 'assets/manifest.json'), 'utf8'));
const assets = new Set(manifest.files);
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const sendJson = (value, status = 200) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
    if (url.pathname === '/health') return sendJson({ app: 'dsh-tavern-game-simple', version: 32, build: packageInfo.version, pid: process.pid });
    if (url.pathname === '/rpc' && req.method === 'POST') {
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 256 * 1024) throw Error('请求过大'); }
      const { route, args } = JSON.parse(body), handler = routes.get(route);
      if (!handler) throw Error('未知路由：' + route);
      return sendJson(await handler(args));
    }
    if (url.pathname === '/status') return sendJson({ head, revision, modelCalls });
    if (url.pathname === '/story' && req.method === 'POST') {
      head = { ...head, turn: head.turn + 1, textVersion: 'preview-v' + (head.turn + 1) };
      const rawText = '两位演练队友遭遇了拦路挑战者。你与演练挑战者的决斗正式开始。';
      const turn = { ...head, text: rawText, rawText, variables: copy(variables) };
      turns.set(head.turn, turn); revision++;
      // Exercise the real race: settled head is observable before the plugin's queued save.
      setTimeout(() => { Promise.resolve(callbacks.settled(turn)).then(() => { revision++ }).catch(error => console.error(error)) }, 250).unref();
      return sendJson({ ok: true, text: rawText });
    }
    if (url.pathname === '/react.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(await reactBundle()); }
    if (url.pathname === '/client.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(await readFile(path.join(root, 'client.js'))); }
    if (url.pathname.startsWith('/assets/')) {
      const file = decodeURIComponent(url.pathname.slice(8));
      if (!assets.has(file)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': file.endsWith('.wav') ? 'audio/wav' : 'image/png' });
      return res.end(await readFile(path.join(root, 'assets', file)));
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html);
  } catch (error) { res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ message: error.message, code: error.code })); }
});
server.listen(Number(process.env.PORT || 0), '127.0.0.1', () => console.log('PREVIEW_URL=http://127.0.0.1:' + server.address().port));
