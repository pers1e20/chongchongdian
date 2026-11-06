#!/usr/bin/env node
/**
 * 冲充电 · 功能流程校验（CDP）
 * ================================
 * 用真实点击跑完整链路，覆盖「新增车辆被遮挡」「currentVehicleId 失效」
 * 这两个曾经让用户以为点击无效的故障，以及基础数据的首次写入与手动重灌。
 *
 * 用法：
 *   BASE_URL=http://127.0.0.1:8000/charging-tracker.html node docs/flow-check.mjs
 *
 * 前置：先启动带调试端口的 Chrome（与 mobile-check.mjs 相同）
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
 *     --headless=new --no-sandbox --disable-gpu --remote-debugging-port=9333 \
 *     --user-data-dir=/tmp/cdp-profile about:blank &
 *
 * 退出码：0 全通过；1 有失败项。
 */

const PORT = process.env.CDP_PORT || 9333;
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000/charging-tracker.html';

/* 每次新建一个空白 target：独立历史栈，也避开 Chrome 对 pushState 的频率限制 */
const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
if (!target || !target.webSocketDebuggerUrl) throw new Error('无法新建页面 target');
const ws = new WebSocket(target.webSocketDebuggerUrl);
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
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
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
/* 禁用 HTTP 缓存：否则 Service Worker / 浏览器缓存会命中旧版 JS，
   新增的 fuelCardHTML 等代码在页面上不存在，验收会误判为功能缺失 */
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });

const errors = [];
on('Runtime.exceptionThrown', (p) => {
  errors.push(p.exceptionDetails.exception?.description || p.exceptionDetails.text);
});
on('Runtime.consoleAPICalled', (p) => {
  if (p.type === 'error') errors.push(p.args.map((a) => a.value ?? a.description).join(' '));
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;
const click = async (expr, ms = 300) => { await ev(expr); await wait(ms); };
const ready = async () => {
  for (let i = 0; i < 50; i++) {
    if (await ev("document.readyState === 'complete' && typeof App === 'object'")) return true;
    await wait(100);
  }
  return false;
};
const reload = async () => {
  const ld = once('Page.loadEventFired');
  /* 换 query 强制走网络（配合 setCacheDisabled），避免刷新命中旧 JS */
  await send('Page.navigate', { url: BASE + '?cb=' + Date.now() });
  await ld;
  await ready();
  await wait(250);
};
const storage = () => ev("JSON.parse(localStorage.getItem('ev_charging_data_v1') || 'null')");

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
/* 模拟「用户已清空」：只清库不清标记，否则刷新会按首次安装写入基础数据 */
await ev("localStorage.clear(); localStorage.setItem('ev_seed_v1','1')");
await reload();

section('1. 首屏与空态');
check('默认落在统计', (await ev("App.currentTab")) === 'stats');
check('底栏顺序 统计 → 记录',
  (await ev("[...document.querySelectorAll('.tab-item')].map(b=>b.dataset.tab).join(',')")) === 'stats,records');
check('统计页签指示器已定位',
  /translateX\(/.test(await ev("document.querySelector('.tab-indicator').style.transform")));
check('统计页有车辆切换', await ev("!!document.querySelector('#panel-stats .nav-title-btn')"));
await click("App.switchTab('records')", 450);
check('记录页显示「还没有车辆」', (await ev("document.getElementById('panel-records').innerText")).includes('还没有车辆'));
check('记录列表为空', (await ev("document.querySelectorAll('.record-row').length")) === 0);
await click("document.querySelector('#panel-records .empty .btn').click()", 350);
check('设置页打开', await ev("document.getElementById('settingsPage').classList.contains('show')"));
await click("[...document.querySelectorAll('#settingsBody .row')].find(b=>b.textContent.includes('添加车辆')).click()", 350);
check('车辆表单打开', await ev("document.getElementById('vehicleFormPage').classList.contains('show')"));
check('车辆表单在最上层（保存按钮可命中）', await ev(`(function(){
  var btn=document.querySelector('#vehicleFormPage .nav-btn[type=submit]');
  var r=btn.getBoundingClientRect();
  var el=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
  return el===btn || btn.contains(el);
})()`));
check('支持快充开关 44×28', await ev(`(function(){
  var r=document.getElementById('vf_supportsFastCharge').getBoundingClientRect();
  return Math.round(r.width)===44 && Math.round(r.height)===28;
})()`));
await ev("document.getElementById('vf_name').value='验收车';document.getElementById('vf_batteryCapacity').value='60'");
await click("document.querySelector('#vehicleFormPage .nav-btn[type=submit]').click()", 450);
let s1 = await storage();
check('车辆已写入', s1 && s1.vehicles.length === 1, JSON.stringify(s1 && s1.vehicles.length));
check('currentVehicleId 指向新车', s1 && s1.settings.currentVehicleId === s1.vehicles[0].id);
check('车辆表单已关闭', !(await ev("document.getElementById('vehicleFormPage').classList.contains('show')")));
check('设置页出现该车', (await ev("document.getElementById('settingsBody').innerText")).includes('验收车'));
await click("App.closeSettings()", 400);
check('记录页标题为车名', (await ev("document.querySelector('#panel-records .nav-title-btn span').textContent")) === '验收车');

section('2. 记账 → 编辑 → 删除');
await click("document.querySelector('.tab-add').click()", 350);
check('记一笔页打开', await ev("document.getElementById('chargeFormPage').classList.contains('show')"));
await ev("document.getElementById('cf_kWh').value='40';document.getElementById('cf_totalCost').value='30';document.getElementById('cf_date').value='2026-11-04'");
await click("document.querySelector('#chargeFormPage .nav-btn[type=submit]').click()", 450);
let s2 = await storage();
check('记录已写入', s2 && s2.charges.length === 1, JSON.stringify(s2 && s2.charges.length));
check('保存后表单保留（连续记账）', await ev("document.getElementById('chargeFormPage').classList.contains('show')"));
check('列表已刷新为 1 条', (await ev("document.querySelectorAll('.record-row').length")) === 1);
await click("App.closeChargePage()", 350);
await click("document.querySelector('.record-row').click()", 350);
check('详情弹层打开', await ev("document.getElementById('sheetLayer').classList.contains('show')"));
await click("document.querySelector('#sheetActions .icon-btn').click()", 400);
check('编辑页打开且回填度数', (await ev("document.getElementById('cf_kWh').value")) === '40');
await ev("document.getElementById('cf_kWh').value='44'");
await click("document.querySelector('#chargeFormPage .action-bar button').click()", 450);
s2 = await storage();
check('编辑已保存', s2.charges[0].kWh === 44, String(s2.charges[0].kWh));
check('编辑后页面关闭', !(await ev("document.getElementById('chargeFormPage').classList.contains('show')")));

await click("document.querySelector('.record-row').click()", 350);
await click("document.querySelector('#sheetActions .icon-btn.danger').click()", 250);
check('删除确认框打开', await ev("document.getElementById('confirmModal').classList.contains('show')"));
await click("App.confirmOk()", 450);
s2 = await storage();
check('记录已删除', s2.charges.length === 0, String(s2.charges.length));

section('3. 车辆编辑 → 删除');
/* 记录页标题弹层里的行是「切换车辆」，编辑要走设置页的车辆行 */
await click("App.openSettings()", 300);
await click("[...document.querySelectorAll('#settingsBody .row')].find(b=>b.textContent.includes('验收车')).click()", 350);
check('车辆详情打开', (await ev("document.getElementById('sheetTitle').textContent")) === '车辆详情');
await click("document.querySelector('#sheetActions .icon-btn').click()", 400);
check('车辆编辑页打开', await ev("document.getElementById('vehicleFormPage').classList.contains('show')"));
await ev("document.getElementById('vf_name').value='验收车·改'");
await click("document.querySelector('#vehicleFormPage .nav-btn[type=submit]').click()", 450);
s1 = await storage();
check('车辆名称已更新', s1.vehicles[0].name === '验收车·改', s1.vehicles[0].name);
check('设置页车辆行跟随', (await ev("document.getElementById('settingsBody').innerText")).includes('验收车·改'));
await click("App.closeSettings()", 400);
check('记录页标题跟随', (await ev("document.querySelector('#panel-records .nav-title-btn span').textContent")) === '验收车·改');

await click("App.openSettings()", 300);
await click("[...document.querySelectorAll('#settingsBody .row')].find(b=>b.textContent.includes('验收车·改')).click()", 350);
await click("document.querySelector('#sheetActions .icon-btn.danger').click()", 250);
await click("App.confirmOk()", 450);
s1 = await storage();
check('车辆已删除', s1.vehicles.length === 0, String(s1.vehicles.length));
await click("App.closeSettings()", 400);
check('回到空态', (await ev("document.getElementById('panel-records').innerText")).includes('还没有车辆'));

section('4. 清空后不自动种回');
await click("App.openSettings()", 300);
await click("App.clearAllData()", 200);
await click("App.confirmOk()", 800);
await reload();
await click("App.switchTab('records')", 450);
check('清空后仍为空', (await ev("document.getElementById('panel-records').innerText")).includes('还没有车辆'));
check('已写 seed 标记', (await ev("localStorage.getItem('ev_seed_v1')")) === '1');

section('5. 手动载入基础数据');
await click("App.openSettings()", 300);
check('设置页有「载入基础数据」', (await ev("document.getElementById('settingsBody').innerText")).includes('载入基础数据'));
await click("App.loadBaseData()", 250);
await click("App.confirmOk()", 600);
let s3 = await storage();
check('基础数据 33 条', s3 && s3.charges.length === 33, String(s3 && s3.charges.length));
check('车辆 1 辆', s3 && s3.vehicles.length === 1);
const total = s3.charges.reduce((a, c) => a + (Number(c.totalCost) || 0), 0);
check('总费用 ¥813.26', Math.abs(total - 813.26) < 0.005, total.toFixed(2));
check('快充 30 / 慢充 3',
  s3.charges.filter((c) => c.chargeType === 'fast').length === 30 &&
  s3.charges.filter((c) => c.chargeType === 'slow').length === 3);
await click("App.loadBaseData()", 250);
await click("App.confirmOk()", 500);
s3 = await storage();
check('重复载入不重复', s3.charges.length === 33, String(s3.charges.length));

section('6. 统计页');
await click("App.closeSettings()", 300);
check('记录页 33 行', (await ev("document.querySelectorAll('.record-row').length")) === 33);
await click("App.switchTab('stats')", 450);
check('Hero 累计 ¥813.26', (await ev("document.querySelector('.hero-value').textContent")) === '¥813.26');
check('累计口径不显示环比', (await ev("document.querySelector('.hero .delta')")) === null);
check('快慢充 91% / 9%', (await ev("[...document.querySelectorAll('.legend b')].map(x=>x.textContent).join('/')")) === '91%/9%');
await click("App.openYearSheet()", 300);
check('年份弹层含 全部 + 2026',
  (await ev("document.querySelectorAll('#sheetBody .row').length")) === 2);
await click("App.setStatsYear('2026')", 400);
check('2026 年 Hero', (await ev("document.querySelector('.hero-label').textContent")).includes('2026 年'));
await click("App.setStatsTrend('kwh')", 350);
check('度数趋势可切换', (await ev("document.querySelector('.card-title').textContent")) === '月度充入度数');

section('6.5 筛选');
await click("App.switchTab('records')", 400);
await click("App.openFilterSheet()", 300);
check('筛选弹层打开', (await ev("document.getElementById('sheetTitle').textContent")) === '筛选');
await click("[...document.querySelectorAll('#sheetBody .chip')].find(b=>b.textContent==='慢充').click()", 300);
await click("[...document.querySelectorAll('#sheetBody .btn')].find(b=>b.textContent==='应用').click()", 400);
check('慢充筛选 3 条', (await ev("document.querySelectorAll('.record-row').length")) === 3);
await click("App.clearFilters()", 350);
check('清除筛选恢复 33 条', (await ev("document.querySelectorAll('.record-row').length")) === 33);

section('6.6 滚动位置与动效');
await click("App.switchTab('records')", 400);
await ev("window.scrollTo(0, 480)");
await wait(150);
await click("App.switchTab('stats')", 400);
await click("App.switchTab('records')", 400);
const kept = await ev("window.scrollY");
check('切回记录页保留滚动位置', kept > 300, String(kept));
await ev("window.scrollTo(0, 0)");

await click("App.openSheet({title:'动效',body:'<div class=\"ds-empty\">x</div>'})", 80);
check('弹层入场显示', await ev("document.getElementById('sheetLayer').classList.contains('show')"));
await click("App.closeSheet()", 80);
check('弹层退场保留 is-closing', await ev("document.getElementById('sheetLayer').classList.contains('is-closing')"));
await wait(320);
check('弹层退场完成', await ev("!document.getElementById('sheetLayer').classList.contains('show') && !document.getElementById('sheetLayer').classList.contains('is-closing')"));

await click("App.openSettings()", 80);
check('设置页入场显示', await ev("document.getElementById('settingsPage').classList.contains('show')"));
await click("App.closeSettings()", 80);
check('设置页退场保留 is-closing', await ev("document.getElementById('settingsPage').classList.contains('is-closing')"));
await wait(240);
check('设置页退场完成', await ev("!document.getElementById('settingsPage').classList.contains('show')"));

section('6.7 油车对比');
/* 清到干净态：无车无记录，全部走真实 UI（ChargeMgr/VehicleMgr 未挂全局，不能直接调用） */
await click("App.openSettings()", 250);
await click("App.clearAllData()", 200);
await click("App.confirmOk()", 900);
await reload();
await click("App.switchTab('records')", 400);
/* 建车：空态「去添加车辆」→ 设置页 → 添加车辆 */
await click("document.querySelector('#panel-records .empty .btn').click()", 350);
await click("[...document.querySelectorAll('#settingsBody .row')].find(b=>b.textContent.includes('添加车辆')).click()", 350);
await ev("document.getElementById('vf_name').value='对比车';document.getElementById('vf_batteryCapacity').value='75'");
await click("document.querySelector('#vehicleFormPage .nav-btn[type=submit]').click()", 450);
await click("App.closeSettings()", 400);

/* 连续记 3 笔带里程的充电（表单保存后保留，可连续录入） */
await click("document.querySelector('.tab-add').click()", 400);
const addCharge = async (date, odo, kwh, cost) => {
  await ev(`(function(){
    document.getElementById('cf_date').value='${date}';
    document.getElementById('cf_odometer').value='${odo}';
    document.getElementById('cf_kWh').value='${kwh}';
    document.getElementById('cf_totalCost').value='${cost}';
  })()`);
  await click("document.querySelector('#chargeFormPage .action-bar button').click()", 450);
};
await addCharge('2026-09-01', 10000, 50, 50);
await addCharge('2026-09-08', 10400, 50, 50);
await addCharge('2026-09-15', 10800, 50, 60);
await click("App.closeChargePage()", 400);
let s4 = await storage();
check('对比车已写入 3 条带里程记录',
  !!(s4 && s4.charges.length === 3 && s4.charges.every(function (c) { return Number(c.odometer) > 0; })),
  JSON.stringify(s4 && s4.charges.length));

await click("App.switchTab('stats')", 450);
const statsEmpty = await ev("document.querySelector('#panel-stats').innerText");
check('未配置时只给设置入口', statsEmpty.includes('填一组油车参数'), statsEmpty.slice(0, 160));

await click("App.openSettings()", 300);
await ev("document.getElementById('fc_model').value='迈腾 330TSI'");
await ev("document.getElementById('fc_consumption').value='8'");
await ev("document.getElementById('fc_price').value='7.8'");
await ev("document.getElementById('fc_price').dispatchEvent(new Event('change'))");
await wait(350);
s4 = await storage();
check('对比油车已保存',
  !!(s4 && s4.settings && s4.settings.fuelCar && s4.settings.fuelCar.consumption === 8 && s4.settings.fuelCar.price === 7.8),
  JSON.stringify(s4 && s4.settings && s4.settings.fuelCar));
check('对比车型已保存', !!(s4 && s4.settings.fuelCar.model === '迈腾 330TSI'));
await click("App.closeSettings()", 400);

await click("App.switchTab('stats')", 450);
const statsText = await ev("document.querySelector('#panel-stats').innerText");
check('累计节省 ¥389.20', statsText.includes('¥389.20'), statsText.slice(0, 240));
check('每百公里 电 ¥13.75 / 油 ¥62.40', statsText.includes('电 ¥13.75') && statsText.includes('油 ¥62.40'));
check('显示区间数与样本提示', statsText.includes('2 个充电区间') && statsText.includes('样本较少'));

await click("App.switchTab('records')", 400);
await click("document.querySelectorAll('.record-row')[1].click()", 400);
const detailText = await ev("document.getElementById('sheetBody').innerText");
check('详情显示本次节省 ¥199.60', detailText.includes('¥199.60'), detailText.slice(0, 240));
check('详情显示里程与油电费', detailText.includes('400 km') && detailText.includes('油 ¥249.60') && detailText.includes('电 ¥50.00'), detailText.slice(0, 240));
await click("App.closeSheet()", 350);

await click("App.openMonthSheet('2026-09')", 400);
const monthText = await ev("document.getElementById('sheetBody').innerText");
check('月明细显示对比油车节省', monthText.includes('对比油车') && monthText.includes('¥389.20'), monthText.slice(0, 240));
await click("App.closeSheet()", 350);

section('7. 主题与收尾');
await click("App.openSettings()", 300);
await click("App.setTheme('dark')", 250);
check('深色生效', (await ev("document.documentElement.dataset.theme")) === 'dark');
await click("App.setTheme('light')", 250);
check('浅色生效', (await ev("document.documentElement.dataset.theme")) === 'light');
await click("App.setTheme('auto')", 200);
check('跟随系统生效', (await ev("document.documentElement.dataset.pref")) === 'auto');

check('控制台无报错', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log('\n================================================');
console.log(`结果：${pass} 通过 · ${fail} 失败`);
console.log('================================================');
ws.close();
await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`).catch(() => {});
process.exit(fail ? 1 : 0);
