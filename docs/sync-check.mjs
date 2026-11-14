#!/usr/bin/env node
/**
 * 冲充电 · 云同步校验（CDP + mock GitHub Gist API）
 * ================================================
 * 用 Page.addScriptToEvaluateOnNewDocument 注入 fetch 假实现，把
 * api.github.com/gists 映射到页面内存（gists 存 sessionStorage，跨刷新保留），
 * 再走真实 UI 驱动完整链路：
 *
 *   1. 设置页出现「云同步」区块，开关默认关闭
 *   2. 填令牌 + 开开关 → 自动创建私有 Gist 并上传整库
 *   3. 记账 → 3s 防抖后自动上传
 *   4. 第二台设备填同一令牌 → 首次对账弹确认框 → 确认后本机与云端一致
 *   5. 令牌失效 → 自动暂停同步
 *   6. 关闭开关 → 不再上传
 *
 * 用法：
 *   BASE_URL=http://127.0.0.1:8000/charging-tracker.html node docs/sync-check.mjs
 *
 * 前置：先启动带调试端口的 Chrome（同 flow-check.mjs）
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
 *     --headless=new --no-sandbox --disable-gpu --remote-debugging-port=9333 \
 *     --user-data-dir=/tmp/cdp-profile about:blank &
 *
 * 退出码：0 全通过；1 有失败项。
 */

const PORT = process.env.CDP_PORT || 9333;
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000/charging-tracker.html';

/* ---------- 注入到页面的 fetch 假实现 ---------- */
const MOCK_SOURCE = `
(function () {
  var KEY = '__mock_gists_v1';
  var gists = {};
  try { gists = JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch (e) { gists = {}; }
  var seq = 0;
  Object.keys(gists).forEach(function (k) {
    var m = k.match(/gist_(\\d+)/);
    if (m) seq = Math.max(seq, +m[1]);
  });
  function persist() {
    try { sessionStorage.setItem(KEY, JSON.stringify(gists)); } catch (e) {}
  }
  window.__mock = {
    reset: function () { gists = {}; persist(); },
    dump: function () { return JSON.parse(JSON.stringify(gists)); },
    /* 清存储会连带清掉 sessionStorage，测试在清之前备份、重载后用 hydrate 还原 */
    hydrate: function (json) {
      try { gists = JSON.parse(json); } catch (e) { gists = {}; }
      seq = 0;
      Object.keys(gists).forEach(function (k) {
        var m = k.match(/gist_(\\d+)/);
        if (m) seq = Math.max(seq, +m[1]);
      });
      persist();
    }
  };
  function json(obj, status) {
    var code = status === undefined ? 200 : status;
    return {
      ok: code >= 200 && code < 300,
      status: code,
      json: function () { return Promise.resolve(obj); }
    };
  }
  window.fetch = function (url, opts) {
    var method = (opts && opts.method) || 'GET';
    var body = opts && opts.body ? JSON.parse(opts.body) : null;
    var auth = (opts && opts.headers) ? (opts.headers.Authorization || '') : '';
    var u = String(url);
    return Promise.resolve().then(function () {
      if (auth === 'Bearer bad-token') return json({ message: 'Bad credentials' }, 401);
      if (/\\/gists\\?/.test(u) && method === 'GET') {
        return json(Object.keys(gists).map(function (id) {
          return {
            id: id, description: gists[id].description, public: gists[id].public,
            updated_at: gists[id].updated_at, files: gists[id].files
          };
        }));
      }
      if (/\\/gists$/.test(u) && method === 'POST') {
        var id = 'gist_' + (++seq);
        gists[id] = {
          id: id, description: body.description, public: body.public,
          files: body.files, updated_at: new Date().toISOString()
        };
        persist();
        return json(gists[id], 201);
      }
      var m = u.match(/\\/gists\\/(gist_[A-Za-z0-9]+)$/);
      if (m) {
        var g = gists[m[1]];
        if (!g) return json({ message: 'Not Found' }, 404);
        if (method === 'GET') {
          return json({
            id: g.id, description: g.description, public: g.public,
            updated_at: g.updated_at, files: g.files
          });
        }
        if (method === 'PATCH') {
          Object.keys(body.files).forEach(function (k) { g.files[k] = body.files[k]; });
          g.updated_at = new Date().toISOString();
          persist();
          return json({ id: g.id, files: g.files, updated_at: g.updated_at });
        }
      }
      return json({ message: 'unexpected ' + method + ' ' + u }, 500);
    });
  };
})();
`;

/* ---------- CDP 连接（独立浏览器上下文，保证存储隔离、可重复跑） ---------- */
const version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
if (!version.webSocketDebuggerUrl) throw new Error('无法连接浏览器');
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

let seq = 0;
const pending = new Map();
const listeners = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const q = pending.get(m.id);
    pending.delete(m.id);
    m.error ? q.reject(new Error(m.error.message)) : q.resolve(m.result);
  } else if (m.method && listeners.has(m.method)) {
    listeners.get(m.method).forEach((fn) => fn(m.params));
  }
};
const rawSend = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, { resolve, reject });
  const msg = { id, method, params };
  if (sessionId) msg.sessionId = sessionId;
  ws.send(JSON.stringify(msg));
});

const { browserContextId } = await rawSend('Target.createBrowserContext');
const { targetId } = await rawSend('Target.createTarget', { url: 'about:blank', browserContextId });
const { sessionId } = await rawSend('Target.attachToTarget', { targetId, flatten: true });
const send = (method, params = {}) => rawSend(method, params, sessionId);
const on = (method, fn) => listeners.set(method, (listeners.get(method) || []).concat(fn));
const once = (method) => new Promise((resolve) => {
  const fn = (x) => {
    listeners.set(method, (listeners.get(method) || []).filter((f) => f !== fn));
    resolve(x);
  };
  on(method, fn);
});

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
await send('Page.addScriptToEvaluateOnNewDocument', { source: MOCK_SOURCE });

const errors = [];
on('Runtime.exceptionThrown', (p) => {
  errors.push(p.exceptionDetails.exception?.description || p.exceptionDetails.text);
});
on('Runtime.consoleAPICalled', (p) => {
  if (p.type === 'error') errors.push(p.args.map((a) => a.value ?? a.description).join(' '));
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  return r.exceptionDetails ? undefined : r.result.value;
};
const click = async (expr, ms = 300) => { await ev(expr); await wait(ms); };
const ready = async () => {
  for (let i = 0; i < 50; i++) {
    if (await ev("document.readyState === 'complete' && typeof App === 'object'")) return true;
    await wait(100);
  }
  return false;
};
const reload = async (mock) => {
  const ld = once('Page.loadEventFired');
  await send('Page.navigate', { url: BASE + '?cb=' + Date.now() });
  await ld;
  await ready();
  await wait(250);
  if (mock) await ev('window.__mock.hydrate(' + JSON.stringify(mock) + ')');
};
/* 轮询直到表达式为真；表达式写成 IIFE，异常时返回 false */
const until = async (expr, ms = 9000, step = 150) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await ev('(function(){try{return !!' + expr + ';}catch(e){return false;}})()')) return true;
    await wait(step);
  }
  return false;
};
const storage = () => ev("JSON.parse(localStorage.getItem('ev_charging_data_v1') || 'null')");
const syncCfg = () => ev("JSON.parse(localStorage.getItem('ev_sync_config_v1') || 'null')");
const gistDump = () => ev("window.__mock.dump()");
const statusText = () => ev("(document.getElementById('syncStatusLine')||{}).textContent || ''");

const ORIGIN = new URL(BASE).origin;
/* 清本机存储：必须先离开页面，否则旧文档里的同步逻辑会把配置写回来。
   注意 Storage.clearDataForOrigin 会连带清掉 sessionStorage，
   所以先备份 mock 的 Gist 库，交给 reload 还原。 */
const wipeStorage = async () => {
  const mock = await ev("sessionStorage.getItem('__mock_gists_v1')");
  await send('Page.navigate', { url: 'about:blank' });
  await wait(400);
  await send('Storage.clearDataForOrigin', { origin: ORIGIN, storageTypes: 'local_storage' });
  return mock;
};

let pass = 0, fail = 0;
const check = (name, ok, extra) => {
  if (ok) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); }
};
const section = (t) => console.log('\n' + t);

/* ---------- 启动 ---------- */
const ld = once('Page.loadEventFired');
await send('Page.navigate', { url: BASE + '?cb=' + Date.now() });
await ld;
await ready();
await wait(250);
/* 干净起点：清掉数据与同步配置，但保留 seed 标记（模拟「已清空过」的老用户） */
const m0 = await wipeStorage();
await reload(m0);
await ev("window.__mock.reset(); localStorage.removeItem('ev_charging_data_v1'); localStorage.setItem('ev_seed_v1','1');");
await reload();

section('1. 设置页渲染');
await click("App.openSettings()", 400);
check('出现「云同步」分组', (await ev("document.getElementById('settingsBody').innerText")).includes('云同步'));
check('出现令牌输入框', await ev("!!document.getElementById('syncToken')"));
check('出现「立即同步」入口', (await ev("document.getElementById('settingsBody').innerText")).includes('立即同步'));
check('开关默认关闭', !(await ev("document.getElementById('syncEnabled').checked")));
check('状态显示未开启', (await statusText()).includes('未开启'));

section('2. 首次开启：创建私有 Gist 并上传');
await ev("(function(){var el=document.getElementById('syncToken');el.value='test-token';el.dispatchEvent(new Event('change'));})()");
await ev("(function(){var sw=document.getElementById('syncEnabled');sw.checked=true;sw.dispatchEvent(new Event('change'));})()");
const created = await until("JSON.parse(localStorage.getItem('ev_sync_config_v1')||'{}').gistId", 8000);
check('已创建 Gist 并记下 id', created);
const cfg1 = await syncCfg();
const dump1 = await gistDump();
check('Gist 为私有', !!cfg1.gistId && dump1[cfg1.gistId].public === false);
const content1 = JSON.parse(dump1[cfg1.gistId].files['ev-charging-data.json'].content);
check('快照含本机数据', content1.data && Array.isArray(content1.data.vehicles) && Array.isArray(content1.data.charges));
check('已记录同步时间', cfg1.lastSyncAt > 0);
check('页脚标注云同步已开启', (await ev("document.getElementById('settingsBody').innerText")).includes('云同步已开启'));

section('3. 记账后自动上传（3s 防抖）');
/* 走真实 UI：建车 → 记账 */
await click("[...document.querySelectorAll('#settingsBody .row')].find(b=>b.textContent.includes('添加车辆')).click()", 350);
await ev("document.getElementById('vf_name').value='同步测试车'");
await click("document.querySelector('#vehicleFormPage .nav-btn[type=submit]').click()", 500);
await click("App.closeSettings()", 350);
await click("document.querySelector('.tab-add').click()", 350);
await ev("document.getElementById('cf_kWh').value='40';document.getElementById('cf_totalCost').value='30';document.getElementById('cf_date').value='2026-11-14'");
await click("document.querySelector('#chargeFormPage .nav-btn[type=submit]').click()", 500);
await click("App.closeChargePage()", 350);
const s2 = await storage();
check('记录已写入', s2 && s2.charges.length === 1, JSON.stringify(s2 && s2.charges.length));
const pushed = await until(
  "(function(){var c=JSON.parse(localStorage.getItem('ev_sync_config_v1')||'{}');if(!c.gistId)return false;var g=window.__mock.dump()[c.gistId];if(!g)return false;var d=JSON.parse(g.files['ev-charging-data.json'].content);return d.data.charges.length===1;})()",
  10000
);
check('3s 防抖后自动上传', pushed);
const cfg2 = await syncCfg();
check('localRev 与 remoteRev 一致', cfg2.localRev === cfg2.remoteRev && cfg2.localRev > 0,
  cfg2.localRev + ' / ' + cfg2.remoteRev);

section('4. 第二台设备：首次对账弹确认框');
/* 清掉本机数据与同步配置，模拟新设备；首次启动会种入 33 条基础数据 */
const m4 = await wipeStorage();
await reload(m4);
const s3 = await storage();
check('新设备种入基础数据', s3 && s3.charges.length === 33, String(s3 && s3.charges.length));
await click("App.openSettings()", 400);
await ev("(function(){var el=document.getElementById('syncToken');el.value='test-token';el.dispatchEvent(new Event('change'));})()");
await ev("(function(){var sw=document.getElementById('syncEnabled');sw.checked=true;sw.dispatchEvent(new Event('change'));})()");
const confirmShown = await until(
  "document.getElementById('confirmModal').classList.contains('show') && document.getElementById('confirmTitle').textContent==='云端已有备份'",
  6000
);
check('弹出「云端已有备份」确认框', confirmShown);
await click("App.confirmOk()", 600);
const pulled = await until(
  "(function(){var c=JSON.parse(localStorage.getItem('ev_sync_config_v1')||'{}');if(!c.gistId)return false;var g=window.__mock.dump()[c.gistId];if(!g)return false;var d=JSON.parse(g.files['ev-charging-data.json'].content);var s=JSON.parse(localStorage.getItem('ev_charging_data_v1')||'{}');return s.charges.length===d.data.charges.length&&s.vehicles.length===d.data.vehicles.length;})()",
  8000
);
check('确认后本机与云端一致', pulled);
const cfg4 = await syncCfg();
check('第二台设备复用同一 Gist', !!cfg4.gistId && cfg4.gistId === cfg2.gistId);

section('5. 令牌失效自动暂停');
await ev("(function(){var el=document.getElementById('syncToken');el.value='bad-token';el.dispatchEvent(new Event('change'));})()");
await click("App.syncNow()", 500);
const paused = await until("JSON.parse(localStorage.getItem('ev_sync_config_v1')||'{}').enabled===false", 8000);
check('令牌失效后自动暂停', paused);
check('状态提示令牌无效', (await statusText()).includes('令牌无效'));

section('6. 关闭开关后不再上传');
await ev("(function(){var el=document.getElementById('syncToken');el.value='test-token';el.dispatchEvent(new Event('change'));})()");
await ev("(function(){var sw=document.getElementById('syncEnabled');sw.checked=true;sw.dispatchEvent(new Event('change'));})()");
await until("JSON.parse(localStorage.getItem('ev_sync_config_v1')||'{}').lastSyncAt>0", 8000);
const before = (await syncCfg()).lastSyncAt;
await ev("(function(){var sw=document.getElementById('syncEnabled');sw.checked=false;sw.dispatchEvent(new Event('change'));})()");
await click("App.closeSettings()", 350);
await click("document.querySelector('.tab-add').click()", 350);
await ev("document.getElementById('cf_kWh').value='20';document.getElementById('cf_totalCost').value='15';document.getElementById('cf_date').value='2026-11-15'");
await click("document.querySelector('#chargeFormPage .nav-btn[type=submit]').click()", 500);
await click("App.closeChargePage()", 350);
await wait(5000);
const after = (await syncCfg()).lastSyncAt;
check('关闭后不再上传', after === before, before + ' → ' + after);

section('7. 收尾');
check('控制台无报错', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log('\n================================================');
console.log(`结果：${pass} 通过 · ${fail} 失败`);
console.log('================================================');
process.exit(fail ? 1 : 0);
