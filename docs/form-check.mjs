#!/usr/bin/env node
/**
 * 冲充电 · 表单改版专项校验（CDP）
 * ================================
 * 覆盖 v2.7 扁平卡片表单的结构与交互：
 * 上次记录提示条已移除、补充信息默认可见、类型双大卡、日期 chips、SOC 步进器、
 * 以及记一笔/车辆/设置三页的卡片化与保存链路。
 *
 * 用法：
 *   BASE_URL=http://127.0.0.1:8000/charging-tracker.html node docs/form-check.mjs
 *
 * 前置：与 flow-check.mjs 相同（本地 8000 服务 + 9333 无头 Chrome）。
 *
 * 退出码：0 全通过；1 有失败项。
 */
const PORT = process.env.CDP_PORT || 9333;
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000/charging-tracker.html';

const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let seq = 0; const pending = new Map(); const listeners = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); return; }
  if (d.method && listeners.has(d.method)) listeners.get(d.method).forEach((fn) => fn(d.params));
};
const send = (method, params) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const once = (method) => new Promise((r) => { const arr = listeners.get(method) || []; arr.push(r); listeners.set(method, arr); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await send('Page.enable');
await send('Runtime.enable');
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: "window.__errs=[];window.addEventListener('error',function(e){window.__errs.push(String((e&&e.message)||e.error));});"
});
const ld = once('Page.loadEventFired');
await send('Page.navigate', { url: BASE + '?cb=' + Date.now() });
await Promise.race([ld, wait(4000)]);
await wait(600);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name); } };

/* 空库时先载入基础数据，否则记一笔页会被「请先添加车辆」拦掉 */
if (!(await ev("window.VehicleMgr ? VehicleMgr.list().length : 0"))) {
  await ev("App.loadBaseData && App.loadBaseData()");
  await wait(500);
}

console.log('1. 结构');
ok('已无「上次记录」提示条', !(await ev("!!document.getElementById('cfLastHint')")));
ok('已无「补充信息」折叠按钮', !(await ev("!!document.getElementById('cfMoreBtn')")));
ok('已无折叠容器', !(await ev("!!document.getElementById('cfExtra')")));
ok('类型是双大卡', (await ev("document.querySelectorAll('#cf_chargeTypeSegment .type-card').length")) === 2);
ok('电量/金额是大数字行', (await ev("document.querySelectorAll('#chargeFormPage .bignum-row').length")) === 2);
ok('日期是 chips', (await ev("document.querySelectorAll('#cfDateChips .chip').length")) === 4);
ok('SOC 步进器两组', (await ev("document.querySelectorAll('#chargeFormPage .stepper').length")) === 2);
ok('表单卡片化', (await ev("document.querySelectorAll('#chargeFormPage .fcard').length")) >= 3);

console.log('2. 补充信息默认可见（不折叠）');
await ev("App.openChargePage()");
await wait(400);
for (const id of ['cf_socBefore', 'cf_socAfter', 'cf_odometer', 'cf_note']) {
  const vis = await ev(`(function(){var e=document.getElementById('${id}');if(!e)return false;var r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).display!=='none';})()`);
  ok(id + ' 可见', vis);
}

console.log('3. 类型切换');
await ev("document.querySelector('#cf_chargeTypeSegment .type-card[data-val=slow]').click()");
await wait(150);
ok('慢充选中', (await ev("document.getElementById('cf_chargeType').value")) === 'slow');
ok('慢充 aria-pressed', (await ev("document.querySelector('#cf_chargeTypeSegment .type-card[data-val=slow]').getAttribute('aria-pressed')")) === 'true');
ok('快充取消选中', (await ev("document.querySelector('#cf_chargeTypeSegment .type-card[data-val=fast]').getAttribute('aria-pressed')")) === 'false');

console.log('4. 日期 chips');
await ev("document.querySelector('#cfDateChips .chip[data-offset=\"1\"]').click()");
await wait(200);
const y = await ev("document.getElementById('cf_date').value");
ok('点昨天写入日期', /^\d{4}-\d{2}-\d{2}$/.test(y));
ok('昨天 chip 选中', (await ev("document.querySelector('#cfDateChips .chip[data-offset=\"1\"]').getAttribute('aria-pressed')")) === 'true');
ok('今天 chip 取消', (await ev("document.querySelector('#cfDateChips .chip[data-offset=\"0\"]').getAttribute('aria-pressed')")) === 'false');
ok('手选行仍收起', !(await ev("document.getElementById('cfDateOtherRow').classList.contains('open')")));
await ev("document.getElementById('cfDateOther').click()");
await wait(200);
ok('点其他展开手选行', await ev("document.getElementById('cfDateOtherRow').classList.contains('open')"));
await ev("document.getElementById('cf_date').value='2020-01-02';document.getElementById('cf_date').dispatchEvent(new Event('input',{bubbles:true}))");
await wait(200);
ok('手选日期后「其他」选中', (await ev("document.getElementById('cfDateOther').getAttribute('aria-pressed')")) === 'true');
ok('手选日期后近三日 chip 取消', (await ev("document.querySelectorAll('#cfDateChips .chip[data-offset][aria-pressed=true]').length")) === 0);

console.log('5. SOC 步进器');
await ev("document.getElementById('cf_socBefore').value=''");
await ev("document.querySelector('.step-btn[data-target=cf_socBefore][data-step=\"1\"]').click()");
await wait(120);
ok('空值从 placeholder 20 加到 21', (await ev("document.getElementById('cf_socBefore').value")) === '21');
await ev("document.querySelector('.step-btn[data-target=cf_socBefore][data-step=\"-1\"]').click()");
await wait(120);
ok('减回 20', (await ev("document.getElementById('cf_socBefore').value")) === '20');
await ev("document.getElementById('cf_socAfter').value='5'");
for (let i = 0; i < 6; i++) await ev("document.querySelector('.step-btn[data-target=cf_socAfter][data-step=\"-1\"]').click()");
await wait(150);
ok('下限钳到 0', (await ev("document.getElementById('cf_socAfter').value")) === '0');
await ev("document.getElementById('cf_socAfter').value='95'");
for (let i = 0; i < 12; i++) await ev("document.querySelector('.step-btn[data-target=cf_socAfter][data-step=\"1\"]').click()");
await wait(150);
ok('上限钳到 100', (await ev("document.getElementById('cf_socAfter').value")) === '100');

console.log('6. 校验与保存');
await ev("document.getElementById('cf_date').value='';App.saveCharge()");
await wait(200);
ok('空日期报错', (await ev("document.getElementById('cfFormMsg').textContent")) === '请选择日期');
ok('空日期时手选行被展开', await ev("document.getElementById('cfDateOtherRow').classList.contains('open')"));
ok('日期行红框', await ev("document.getElementById('cf_date').closest('.field').classList.contains('invalid')"));
await ev("document.getElementById('cf_date').value='" + y + "';document.getElementById('cf_kWh').value='';App.saveCharge()");
await wait(200);
ok('空度数报错', (await ev("document.getElementById('cfFormMsg').textContent")) === '请输入充电度数');
await ev("document.getElementById('cf_date').value='" + y + "';document.getElementById('cf_kWh').value='40';document.getElementById('cf_totalCost').value='30';App.saveCharge()");
await wait(400);
ok('保存后表单保留（连续记账）', await ev("document.getElementById('chargeFormPage').classList.contains('show')"));
ok('保存后表单已清空', (await ev("document.getElementById('cf_kWh').value")) === '');

console.log('7. 车辆页 / 设置页');
await ev("App.openVehicleModal()");
await wait(350);
ok('车辆页卡片化', (await ev("document.querySelectorAll('#vehicleFormPage .fcard').length")) >= 2);
ok('车辆页无旧 field-group', (await ev("document.querySelectorAll('#vehicleFormPage .field-group').length")) === 0);
ok('车辆页字段仍在', (await ev("!!document.getElementById('vf_batteryCapacity') && !!document.getElementById('vf_supportsFastCharge')")));
await ev("App.closeVehiclePage()");
await wait(300);
await ev("App.openSettings()");
await wait(400);
ok('设置页分组扁平化', (await ev("(function(){var g=document.querySelector('#settingsBody .group');return g?getComputedStyle(g).backgroundImage==='none':false;})()")));
ok('云同步分组仍在', (await ev("document.getElementById('settingsBody').innerText")).includes('云同步'));

console.log('8. 控制台错误');
const errs = await ev("(window.__errs||[]).join(' | ')");
ok('无未捕获错误' + (errs ? '：' + errs : ''), !errs);

console.log('\n结果：' + pass + ' 通过 · ' + fail + ' 失败');
ws.close();
process.exit(fail ? 1 : 0);
