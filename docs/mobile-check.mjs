#!/usr/bin/env node
/**
 * 冲充电 · 移动端视口检查（CDP）
 * ================================
 * 无头 Chrome 的 --window-size 最小只能到约 500px，直接用 500 宽截图会漏掉
 * 375px 下的溢出与串位。本脚本通过 DevTools 协议强制设定真实视口宽度，
 * 在 375 / 414 / 768 三档下逐个页面扫描：
 *
 *   1. 整页横向溢出（documentElement.scrollWidth > viewport）
 *   2. 元素内容溢出自身盒（已用省略号裁切的跳过，那属于预期）
 *   3. 元素越出视口左右边界
 *   4. 可点目标小于 44×44
 *
 * 用法：
 *   node docs/mobile-check.mjs                 # 全量检查
 *   node docs/mobile-check.mjs 375             # 只查 375
 *   node docs/mobile-check.mjs 375 --shot      # 同时存截图到 /tmp
 *
 * 前置：先启动带调试端口的 Chrome
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
 *     --headless=new --no-sandbox --disable-gpu --remote-debugging-port=9333 \
 *     --user-data-dir=/tmp/cdp-profile about:blank &
 */

import { writeFileSync } from 'node:fs';

const PORT = process.env.CDP_PORT || 9333;
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000/charging-tracker.html';
const args = process.argv.slice(2);
const only = args.find((a) => /^\d+$/.test(a));
const wantShot = args.includes('--shot');
const emptyMode = args.includes('--empty');

const WIDTHS = only ? [Number(only)] : [375, 414, 768];

const SEED = {
  vehicles: [{
    id: 'v1', name: '智己 L6', brand: '智己', model: 'L6',
    batteryCapacity: 75, supportsFastCharge: true, maxChargePower: 120, note: ''
  }],
  charges: [
    ['2026-08-15', 'fast', 42.5, 54.40, 18, 82, 12000],
    ['2026-08-28', 'slow', 31.0, 38.20, 25, 90, 12350],
    ['2026-09-10', 'fast', 40.2, 51.30, 20, 85, 12700],
    ['2026-09-22', 'slow', 28.5, 34.80, 30, 88, 13020],
    ['2026-10-05', 'fast', 45.5, 58.10, 15, 80, 13380],
    ['2026-10-18', 'slow', 33.0, 40.20, 22, 92, 13720],
    ['2026-10-28', 'fast', 42.5, 54.40, 18, 82, 14060],
    ['2026-11-01', 'slow', 30.0, 36.50, 28, 90, 14390]
  ].map((r, i) => ({
    id: 'c' + i, vehicleId: 'v1', date: r[0], chargeType: r[1], kWh: r[2],
    totalCost: r[3], unitPrice: +(r[3] / r[2]).toFixed(2),
    socBefore: r[4], socAfter: r[5], odometer: r[6], note: ''
  })),
  settings: { currentVehicleId: 'v1' }
};

/* ---------------- 极简 CDP 客户端 ---------------- */
async function connect() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  if (!page) throw new Error('找不到可用的 page target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let seq = 0;
  const pending = new Map();
  const listeners = new Map();

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
    } else if (msg.method && listeners.has(msg.method)) {
      listeners.get(msg.method).slice().forEach((fn) => fn(msg.params));
    }
  };

  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });

  const once = (method) => new Promise((res) => {
    const h = (p) => {
      listeners.set(method, (listeners.get(method) || []).filter((f) => f !== h));
      res(p);
    };
    listeners.set(method, (listeners.get(method) || []).concat(h));
  });

  return { send, once, close: () => ws.close() };
}

/* ---------------- 页面内测量脚本 ---------------- */
const PROBE = `(() => {
  function path(el) {
    var parts = [];
    while (el && el.nodeType === 1 && parts.length < 4) {
      var s = el.tagName.toLowerCase();
      if (el.id) { parts.unshift(s + '#' + el.id); break; }
      var cls = (el.className || '').toString().trim().split(/\\s+/).filter(Boolean).slice(0, 2);
      if (cls.length) s += '.' + cls.join('.');
      parts.unshift(s);
      el = el.parentElement;
    }
    return parts.join(' > ');
  }
  var res = {
    vw: innerWidth, vh: innerHeight,
    docOverflow: document.documentElement.scrollWidth - innerWidth,
    overflow: [], outside: [], small: [], minor: [], clipped: 0
  };
  var all = document.querySelectorAll('body *');
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
    var r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;

    // 越出视口
    if (r.right > innerWidth + 1 || r.left < -1) {
      if (res.outside.length < 12) res.outside.push({ sel: path(el), l: Math.round(r.left), r: Math.round(r.right) });
      continue;
    }
    // 内容溢出自身（省略号裁切属于预期）
    var ell = cs.textOverflow === 'ellipsis';
    var hid = cs.overflow === 'hidden' || cs.overflowX === 'hidden';
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
      if (ell && hid) { res.clipped++; continue; }
      if (res.overflow.length < 12) res.overflow.push({ sel: path(el), sw: el.scrollWidth, cw: el.clientWidth });
    }
  }
  // 可点目标：只对关键操作做 44px 硬要求，其余（chip / 分段控件）只提示
  var CRITICAL = '.nav-btn,.page-back-btn,.btn-accent,.re-btn,.settings-row-dark,.history-item-dark,.tab-item,.tab-add-btn,.ds-icon-btn';
  var tappable = document.querySelectorAll('button, a, [onclick], input:not([type=hidden]), select, textarea');
  for (var j = 0; j < tappable.length; j++) {
    var t = tappable[j];
    if (t.closest('svg')) continue;
    var cs2 = getComputedStyle(t);
    if (cs2.display === 'none' || cs2.visibility === 'hidden') continue;
    var tr = t.getBoundingClientRect();
    if (tr.width === 0 && tr.height === 0) continue;
    // 命中区：元素自身盒 + 绝对定位伪元素扩展（不改变视觉，但真实可点）
    var effH = tr.height;
    var after = getComputedStyle(t, '::after');
    if (after && after.content !== 'none' && after.position === 'absolute') {
      var ah = parseFloat(after.height);
      if (!isNaN(ah)) effH = Math.max(effH, ah);
    }
    if (effH < 44) {
      var critical = t.matches(CRITICAL) || t.closest(CRITICAL);
      var rec = { sel: path(t), w: Math.round(tr.width), h: Math.round(tr.height), hit: Math.round(effH) };
      if (critical && res.small.length < 12) res.small.push(rec);
      else if (!critical && res.minor.length < 8) res.minor.push(rec);
    }
  }
  // 滚动到底，检查内容是否被固定底栏永久遮挡
  res.bottomOverlap = null;
  var bar = document.querySelector('.tabbar-dark');
  // 覆盖页（z=200）会盖住底栏，此时不应把底栏算作遮挡物
  var barVisible = false;
  if (bar) {
    var br0 = bar.getBoundingClientRect();
    var hit = document.elementFromPoint(br0.left + br0.width / 2, br0.top + br0.height / 2);
    barVisible = !!(hit && (hit === bar || bar.contains(hit)));
  }
  if (bar && barVisible) {
    var maxScroll = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - innerHeight;
    window.scrollTo(0, maxScroll);
    document.documentElement.scrollTop = maxScroll;
    document.body.scrollTop = maxScroll;
    var bt = bar.getBoundingClientRect().top;
    var nodes = document.querySelectorAll('.main *, .page-overlay.show *');
    var maxBottom = -1, worst = '';
    for (var k = 0; k < nodes.length; k++) {
      var n = nodes[k];
      if (n.closest('.tabbar-dark')) continue;
      var cs3 = getComputedStyle(n);
      if (cs3.position === 'fixed' || cs3.display === 'none' || cs3.visibility === 'hidden') continue;
      var br = n.getBoundingClientRect();
      if (br.height === 0) continue;
      if (br.bottom > maxBottom) { maxBottom = br.bottom; worst = path(n); }
    }
    if (maxBottom > bt + 1) res.bottomOverlap = { gap: Math.round(maxBottom - bt), sel: worst };
    window.scrollTo(0, 0);
  }
  return JSON.stringify(res);
})()`;

/* ---------------- 主流程 ---------------- */
const VIEWS = emptyMode
  ? [{ name: 'empty-records', js: null }, { name: 'empty-settings', js: 'App.openSettings()' }]
  : [
  { name: 'records', js: null },
  { name: 'stats', js: "App.switchTab('stats')" },
  { name: 'settings', js: "App.openSettings()" },
  { name: 'charge-form', js: "App.openSettings();App.closeSettings();App.openChargePage()" },
  { name: 'vehicle-form', js: "App.closeChargePage(true);App.openVehicleModal()" },
  { name: 'sheet', js: "App.closeVehiclePage(true);App.switchTab('stats');App.showChartSheet('month','2026-10')" }
];

const cdp = await connect();
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
const SEED_JSON = JSON.stringify(emptyMode
  ? { vehicles: [], charges: [], settings: { currentVehicleId: null } }
  : SEED);
await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
  source: `try{localStorage.setItem('ev_charging_data_v1', ${JSON.stringify(SEED_JSON)})}catch(e){}`
});

let issues = 0;
const report = [];

for (const width of WIDTHS) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height: 812, deviceScaleFactor: 2, mobile: true
  });

  for (const view of VIEWS) {
    const loaded = cdp.once('Page.loadEventFired');
    await cdp.send('Page.navigate', { url: BASE + '?t=' + Date.now() });
    await loaded;
    await new Promise((r) => setTimeout(r, 260));

    if (view.js) {
      await cdp.send('Runtime.evaluate', { expression: `(()=>{try{${view.js}}catch(e){return 'ERR '+e.message}})()`, returnByValue: true });
      await new Promise((r) => setTimeout(r, 220));
    }

    const raw = await cdp.send('Runtime.evaluate', { expression: PROBE, returnByValue: true });
    const r = JSON.parse(raw.result.value);
    const bad = r.docOverflow > 1 || r.overflow.length || r.outside.length || r.small.length || r.bottomOverlap;
    if (bad) issues++;

    console.log(`\n[${width}px] ${view.name}  (视口 ${r.vw}×${r.vh})`);
    if (r.docOverflow > 1) console.log(`  ! 整页横向溢出 ${r.docOverflow}px`);
    if (r.bottomOverlap) console.log(`  ! 滚动到底后内容被底栏压住 ${r.bottomOverlap.gap}px  ${r.bottomOverlap.sel}`);
    for (const o of r.overflow) console.log(`  ! 内容溢出 ${o.sel}  (${o.sw} > ${o.cw})`);
    for (const o of r.outside) console.log(`  ! 越出视口 ${o.sel}  (left ${o.l} / right ${o.r})`);
    for (const o of r.small) console.log(`  ! 关键点击目标不足 44px ${o.sel}  ${o.w}×${o.h}`);
    for (const o of r.minor) console.log(`  · 次要控件 ${o.h}px（命中区 ${o.hit}px）${o.sel}`);
    if (!bad) console.log(`  ok${r.clipped ? `（${r.clipped} 处按预期省略号裁切）` : ''}`);

    if (wantShot) {
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      writeFileSync(`/tmp/m_${width}_${view.name}.png`, Buffer.from(shot.data, 'base64'));
    }
    report.push({ width, view: view.name, ...r });
  }
}

cdp.close();
writeFileSync('/tmp/mobile-report.json', JSON.stringify(report, null, 1));

console.log('\n' + '='.repeat(60));
console.log(`检查 ${WIDTHS.length} 档宽度 × ${VIEWS.length} 个界面，异常 ${issues} 处`);
console.log(wantShot ? '截图已存 /tmp/m_<宽度>_<界面>.png' : '加 --shot 可同时存截图');
console.log('='.repeat(60));
process.exit(issues ? 1 : 0);
