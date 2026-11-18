#!/usr/bin/env node
/**
 * 冲充电 · 截图识别（OCR）真引擎联调（CDP）
 * ====================================
 * 与 ocr-check.mjs 的区别：这里跑**真实** Tesseract 引擎与**真实**截图，
 * 覆盖 mock 测不到的部分：分栏模式是否生效、语言包体积、端到端字段抽取、
 * 小图放大兜底、Worker 释放后可重建。
 *
 * 用法：
 *   SHOT=/path/to/shot.jpg node docs/ocr-real-check.mjs
 *
 * 前置：本地 8000 服务 + 9333 无头 Chrome。
 *
 * 退出码：0 全通过；1 有失败项。
 */
import { readFileSync, statSync } from 'node:fs';

const PORT = process.env.CDP_PORT || 9333;
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000/charging-tracker.html';
const SHOT = process.env.SHOT
  || '/Users/hanchong/.workbuddy/clipboard-images/clipboard-2026-11-18T09-08-53-638Z-ce2112d1.jpg';
const LANG_PACK = 'app/vendor/tesseract/chi_sim.traineddata.gz';
const EXPECT = { kwh: 35.698, cost: 24.07 };

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
};

/* ---- 0. 本地文件侧检查 ---- */
console.log('0. 语言包文件');
const size = statSync(LANG_PACK).size;
ok('语言包已换成 fast（< 2MB）', size < 2 * 1024 * 1024, size + ' B');

const b64 = readFileSync(SHOT).toString('base64');

const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let seq = 0; const pending = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
};
const send = (method, params) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, timeout: 180000 });
  if (r.result && r.result.exceptionDetails) {
    return { __exc: String(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text) };
  }
  return r.result?.result?.value;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await send('Page.enable');
await send('Runtime.enable');

/* 清掉旧缓存，保证下载的是磁盘上真实的语言包 */
await send('Page.navigate', { url: BASE + '?cb=' + Date.now() });
await wait(2500);
await ev("caches.keys().then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k);}));})"
  + ".then(function(){return navigator.serviceWorker.getRegistrations();})"
  + ".then(function(rs){return Promise.all(rs.map(function(r){return r.unregister();}));})"
  + ".then(function(){return 'cleared';})");
await send('Page.navigate', { url: BASE + '?cb=' + Date.now() });
await wait(3000);

console.log('1. 引擎与分栏模式');
const info = await ev(`(async function () {
  var t0 = performance.now();
  await OCR.load();
  var w = await OCR.worker();
  var tLoad = Math.round(performance.now() - t0);
  return { hasTerminate: typeof (w && w.terminate), loadMs: tLoad,
           packBytes: (await (await fetch('vendor/tesseract/chi_sim.traineddata.gz', { method: 'HEAD' })).headers.get('content-length')) };
})()`);
if (info && info.__exc) { ok('引擎初始化', false, info.__exc); }
else {
  ok('引擎初始化成功', true, '加载 ' + info.loadMs + 'ms');
  ok('worker() 返回真实 Worker', info.hasTerminate === 'function');
  ok('语言包响应 < 2MB（fast 生效）', Number(info.packBytes) < 2 * 1024 * 1024, info.packBytes + ' B');
}

console.log('2. 真实截图端到端识别');
const shot = await ev(`(async function () {
  var b64 = "${b64}";
  var s = atob(b64), a = new Uint8Array(s.length);
  for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
  var blob = new Blob([a], { type: 'image/jpeg' });
  var t0 = performance.now();
  var prepared = await OCR.prepare(blob);
  var prepMs = Math.round(performance.now() - t0);
  var r = await OCR.recognize(prepared);
  var recMs = Math.round(performance.now() - t0);
  var text = (r.text || '');
  var conf = r.confidence || 0;
  var f = OCR.extractFields(text, conf);
  return { conf: conf, prepMs: prepMs, recMs: recMs,
           kwh: f.kWh && f.kWh.value, kwhL: f.kWh && f.kWh.level,
           cost: f.totalCost && f.totalCost.value, costL: f.totalCost && f.totalCost.level,
           date: f.date && f.date.value,
           head: text.split('\\n').slice(0, 6).join(' | ') };
})()`);
if (shot && shot.__exc) ok('识别未抛错', false, shot.__exc);
else {
  ok('识别未抛错', true, '置信度 ' + shot.conf + '，prepare ' + shot.prepMs + 'ms，识别 ' + shot.recMs + 'ms');
  ok('充电量 = ' + EXPECT.kwh, shot.kwh === EXPECT.kwh, String(shot.kwh));
  ok('充电量为高置信', shot.kwhL === 'high', shot.kwhL);
  ok('金额 = ' + EXPECT.cost, shot.cost === EXPECT.cost, String(shot.cost));
  ok('金额为高置信', shot.costL === 'high', shot.costL);
}

console.log('3. 小图放大兜底');
const small = await ev(`(async function () {
  var b64 = "${b64}";
  var s = atob(b64), a = new Uint8Array(s.length);
  for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
  var bmp = await createImageBitmap(new Blob([a], { type: 'image/jpeg' }));
  var scale = 900 / Math.max(bmp.width, bmp.height);
  var cv = document.createElement('canvas');
  cv.width = Math.round(bmp.width * scale); cv.height = Math.round(bmp.height * scale);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  if (bmp.close) bmp.close();
  var small = await new Promise(function (r) { cv.toBlob(function (b) { r(b); }, 'image/jpeg', 0.9); });
  var t0 = performance.now();
  var prepared = await OCR.prepare(small);
  var pbmp = await createImageBitmap(prepared);
  var edge = Math.max(pbmp.width, pbmp.height);
  if (pbmp.close) pbmp.close();
  var r = await OCR.recognize(prepared);
  var f = OCR.extractFields(r.text || '', r.confidence || 0);
  return { edge: edge, ms: Math.round(performance.now() - t0),
           kwh: f.kWh && f.kWh.value, kwhL: f.kWh && f.kWh.level,
           cost: f.totalCost && f.totalCost.value, costL: f.totalCost && f.totalCost.level };
})()`);
if (small && small.__exc) ok('小图流程未抛错', false, small.__exc);
else {
  ok('小图放大后长边进入稳定区间', small.edge >= 1100 && small.edge <= 2048, String(small.edge));
  ok('小图金额仍为 ' + EXPECT.cost, small.cost === EXPECT.cost, String(small.cost));
  ok('小图金额为高置信', small.costL === 'high', small.costL);
  ok('小图电量仍可读出', small.kwh === EXPECT.kwh, String(small.kwh));
}

console.log('4. HEIC 与释放');
ok('构造 HEIC 头被识别', await ev(
  "(function(){var b=new Uint8Array([0,0,0,24,102,116,121,112,104,101,105,99]);"
  + "return OCR.isHeic(new Blob([b],{type:'image/heic'}));})()"));
const rel = await ev(`(async function () {
  OCR.dispose();
  var cleared = OCR._worker === null;
  var w = await OCR.worker();
  var rebuilt = typeof (w && w.terminate) === 'function';
  OCR.dispose();
  return { cleared: cleared, rebuilt: rebuilt };
})()`);
ok('dispose 后 _worker 置空', rel && rel.cleared === true);
ok('dispose 后能重建 Worker', rel && rel.rebuilt === true);

console.log('\n结果：' + pass + ' 通过 · ' + fail + ' 失败');
ws.close();
process.exit(fail ? 1 : 0);
