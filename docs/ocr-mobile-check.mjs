#!/usr/bin/env node
/**
 * 冲充电 · 移动端截图识别验收（CDP，真引擎）
 * ====================================
 * 在 375×667 / dpr2 / mobile 视口下，用真实截图跑完整交互：
 * 入口位置与高度 → 点击先选图 → 真引擎预填 → 不自动保存 →
 * 小图放大 → HEIC 错误态 → 引擎下载失败 → 取消静默 → Worker 释放。
 *
 * 用法：
 *   SHOT=/path/to/shot.jpg node docs/ocr-mobile-check.mjs
 *
 * 前置：本地 8000 服务 + 9333 无头 Chrome。
 * 退出码：0 全通过；1 有失败项。
 */
import { readFileSync } from 'node:fs';

const PORT = process.env.CDP_PORT || 9333;
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000/charging-tracker.html';
const SHOT = process.env.SHOT
  || '/Users/hanchong/.workbuddy/clipboard-images/clipboard-2026-11-18T09-08-53-638Z-ce2112d1.jpg';

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
};

const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let seq = 0; const pending = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
};
const send = (method, params) => new Promise((res) => {
  const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params }));
});
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', {
    expression: expr, returnByValue: true, awaitPromise: true, timeout: 180000
  });
  if (r.result && r.result.exceptionDetails) {
    return { __exc: String(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text) };
  }
  return r.result?.result?.value;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 375, height: 667, deviceScaleFactor: 2, mobile: true
});
await send('Page.navigate', { url: BASE + '?cb=' + Date.now() });
await wait(2600);

/* 空库时载入基础数据，记一笔页需要车辆 */
await ev("window.VehicleMgr && !VehicleMgr.list().length && App.loadBaseData()");
await wait(500);
await ev("localStorage.setItem('ev_ocr_enabled_v1','1');localStorage.removeItem('ev_ocr_pending_only_v1')");
await ev("App.openChargePage()");
await wait(400);

console.log('1. 移动端入口');
ok('视口为 375px', (await ev("innerWidth")) === 375, String(await ev("innerWidth")));
ok('识别入口可见', await ev("(function(){var b=document.getElementById('cfOcrBtn');return !!b&&!b.hidden&&b.getBoundingClientRect().height>0;})()"));
ok('入口在表单底部、保存按钮上方', await ev("(function(){var b=document.getElementById('cfOcrBtn');return b.previousElementSibling.classList.contains('fcard')&&b.nextElementSibling.classList.contains('action-bar');})()"));
ok('入口高度 ≥56px', await ev("document.getElementById('cfOcrBtn').getBoundingClientRect().height>=56"));
ok('入口未溢出视口', await ev("(function(){var r=document.getElementById('cfOcrBtn').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;})()"));

console.log('2. 点击先选图');
const beforeCount = await ev("(function(){try{return (JSON.parse(localStorage.getItem('ev_charging_data_v1')||'{}').charges||[]).length;}catch(e){return 0;}})()");
await ev("window.__origPick=OCR.pickImage;window.__pickCalled=false;"
  + "OCR.pickImage=function(){window.__pickCalled=true;return new Promise(function(){});};App.startOcr()");
await wait(200);
ok('点击立即调起选图', await ev("window.__pickCalled===true"));
ok('未选图不显示识别层', !(await ev("document.getElementById('ocrOverlay').classList.contains('show')")));
await ev("OCR.pickImage=window.__origPick");

console.log('3. 真引擎识别（375px）');
const b64 = readFileSync(SHOT).toString('base64');
await ev(`window.__shotB64='${b64}';'ok'`);
await ev("window.__shotBlob=new Blob([Uint8Array.from(atob(window.__shotB64),function(c){return c.charCodeAt(0);})],{type:'image/jpeg'});'ok'");
/* 走真实链路：点击入口 → 选图 → 展示原图+扫描动效 → 识别 → 确认页 */
await ev("OCR.pickImage=function(){return Promise.resolve(window.__shotBlob);};App.startOcr();'started'");
const mid = await ev("({show:document.getElementById('ocrOverlay').classList.contains('show'),"
  + "scan:document.getElementById('ocrScanView').classList.contains('active'),"
  + "shot:!!document.getElementById('ocrShot').getAttribute('src'),"
  + "line:!!document.querySelector('.ocr-scanline')})");
ok('选图后显示识别层', mid.show === true, JSON.stringify(mid));
ok('识别中显示扫描视图', mid.scan === true, JSON.stringify(mid));
ok('识别中展示所选原图', mid.shot === true, JSON.stringify(mid));
ok('识别中有扫描动效', mid.line === true, JSON.stringify(mid));
/* 等确认页出现 */
let confirmed = false;
for (let i = 0; i < 40 && !confirmed; i++) {
  if (await ev("document.getElementById('ocrResultView').classList.contains('active')")) confirmed = true;
  else await wait(200);
}
ok('真引擎识别后进入确认页', confirmed === true);
ok('确认页展示原图', await ev("!!document.getElementById('ocrPreview').getAttribute('src')"));
ok('确认页电量可编辑且为 35.698', (await ev("document.getElementById('ocrF_kWh').value")) === '35.698');
ok('确认页金额可编辑且为 24.07', (await ev("document.getElementById('ocrF_totalCost').value")) === '24.07');
/* 点填入表单 */
await ev("document.getElementById('ocrCommitBtn').click()");
await wait(250);
ok('真引擎识别完成预填', (await ev("document.getElementById('cf_totalCost').value")) === '24.07');
ok('充电量 35.698 已预填', (await ev("document.getElementById('cf_kWh').value")) === '35.698');
ok('金额 24.07 已预填', (await ev("document.getElementById('cf_totalCost').value")) === '24.07');
ok('填入后识别层已关闭', !(await ev("document.getElementById('ocrOverlay').classList.contains('show')")));
ok('识别不自动保存', (await ev("(function(){try{return (JSON.parse(localStorage.getItem('ev_charging_data_v1')||'{}').charges||[]).length;}catch(e){return 0;}})()")) === beforeCount);

console.log('4. 小图放大兜底');
/* 用真实截图重采样到 900 长边：保留文字内容，只缩小尺寸 */
await ev("window.__smallBlob=createImageBitmap(window.__shotBlob).then(function(b){"
  + "var c=document.createElement('canvas');c.width=900;c.height=1920;"
  + "c.getContext('2d').drawImage(b,0,0,900,1920);if(b.close)b.close();"
  + "return new Promise(function(r){c.toBlob(r,'image/jpeg',0.92);});});"
  + "window.__smallBlob.then(function(b){window.__run2=App.runOcr(b);});'started'");
const r4 = await ev("(window.__run2||Promise.resolve()).then(function(){return 'done';},function(e){return 'err:'+((e&&e.message)||e);})");
ok('小图识别未抛错', r4 === 'done', String(r4));
let smallOk = false;
for (let i = 0; i < 30 && !smallOk; i++) {
  if (await ev("document.getElementById('ocrResultView').classList.contains('active')")) smallOk = true;
  else await wait(200);
}
ok('小图进入确认页', smallOk === true);
ok('小图确认页金额仍为 24.07', (await ev("document.getElementById('ocrF_totalCost').value")) === '24.07');
await ev("document.getElementById('ocrCommitBtn').click()");
await wait(200);
ok('小图金额仍为 24.07', (await ev("document.getElementById('cf_totalCost').value")) === '24.07');

console.log('5. HEIC 错误态');
await ev("(function(){var b=new Uint8Array([0,0,0,24,102,116,121,112,104,101,105,99]);"
  + "window.__heic=new Blob([b],{type:'image/heic'});})();App.runOcr(window.__heic)");
await wait(300);
ok('提示「不支持的图片格式」', (await ev("document.getElementById('ocrTitle').textContent")) === '不支持的图片格式');
ok('文案含 HEIC', (await ev("document.getElementById('ocrStatus').textContent")).includes('HEIC'),
  await ev("document.getElementById('ocrStatus').textContent"));
ok('不可重试（重试按钮禁用）', await ev("(function(){var b=document.getElementById('ocrRetryBtn');return !!b&&b.disabled;})()"));
ok('旋转动画已停止', await ev("document.getElementById('ocrSpinner').hidden===true"));
ok('错误层不溢出 375px', await ev("(function(){var b=document.querySelector('.ocr-box').getBoundingClientRect();"
  + "var s=document.getElementById('ocrStatus');return b.right<=innerWidth+1&&s.scrollWidth<=s.clientWidth+1;})()"));
await ev("App.hideOcrOverlay()");

console.log('6. 引擎下载失败');
await ev("window.__origRec=OCR._recognizeImpl;OCR._recognizeImpl=function(){return Promise.reject(undefined);};"
  + "App.runOcr(window.__shotBlob)");
await wait(300);
ok('提示「识别引擎下载失败」', (await ev("document.getElementById('ocrTitle').textContent")) === '识别引擎下载失败');
ok('可重试（重试按钮可用）', await ev("(function(){var b=document.getElementById('ocrRetryBtn');return !!b&&!b.disabled;})()"));
await ev("OCR._recognizeImpl=window.__origRec;App.hideOcrOverlay()");

console.log('7. 取消与释放');
await ev("OCR.pickImage=function(){return Promise.reject(new Error('已取消选择'));};App.startOcr()");
await wait(250);
ok('取消选图静默返回', !(await ev("document.getElementById('ocrOverlay').classList.contains('show')")));
await ev("OCR.pickImage=window.__origPick");
await ev("OCR.dispose()");
ok('dispose 后 Worker 置空', await ev("OCR._worker===null"));

console.log('\n结果：' + pass + ' 通过 · ' + fail + ' 失败');
ws.close();
process.exit(fail ? 1 : 0);
