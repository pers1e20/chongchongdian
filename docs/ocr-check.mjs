#!/usr/bin/env node
/**
 * 冲充电 · 截图识别（OCR）专项校验（CDP）
 * ====================================
 * 覆盖 v1 的核心原则与闭环：
 *   入口显隐 / 预填不自动保存 / 低置信只描红 / pendingExtra 角标 /
 *   详情页补录入口 / 收敛开关 / 控制台无错。
 *
 * 识别链路用 mock（覆盖 OCR.pickAndRecognize 与 OCR._recognizeImpl），
 * 不下载真引擎，保证脚本快且稳定。
 *
 * 用法：
 *   BASE_URL=http://127.0.0.1:8000/charging-tracker.html node docs/ocr-check.mjs
 *
 * 前置：与 form-check.mjs 相同（本地 8000 服务 + 9333 无头 Chrome）。
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
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
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
await ev("localStorage.setItem('ev_ocr_enabled_v1','1');localStorage.removeItem('ev_ocr_pending_only_v1')");
/* 记录数据在 localStorage（ChargeMgr 未暴露到全局），统一从这里读 */
await ev("window.__charges=function(){try{return JSON.parse(localStorage.getItem('ev_charging_data_v1')||'{}').charges||[];}catch(e){return[];}};");

console.log('1. 结构');
ok('记一笔页有「截图识别」入口', await ev("!!document.getElementById('cfOcrBtn')"));
ok('有本地识别提示文案', await ev("!!document.getElementById('cfOcrHint')"));
ok('有识别中轻提示层', await ev("!!document.getElementById('ocrOverlay')"));
await ev("App.openSettings()");
await wait(400);
ok('设置页有「截图识别」开关', await ev("!!document.getElementById('ocrEnabled')"));
ok('设置页有「待补充」范围开关', await ev("!!document.getElementById('ocrPendingOnly')"));
await ev("App.closeSettings()");
await wait(300);

console.log('2. 入口显隐');
await ev("localStorage.setItem('ev_ocr_enabled_v1','1');App.openChargePage()");
await wait(300);
ok('开启时入口可见', !(await ev("document.getElementById('cfOcrBtn').hidden")));
const firstId = await ev("(function(){var a=window.__charges();return a.length?a[0].id:'';})()");
ok('编辑态不显示入口', await ev(`(function(){App.openChargePage('${firstId}');return document.getElementById('cfOcrBtn').hidden;})()`));
await ev("App.closeChargePage()");
await wait(250);
await ev("localStorage.setItem('ev_ocr_enabled_v1','0');App.openChargePage()");
await wait(300);
ok('关闭时入口隐藏', await ev("document.getElementById('cfOcrBtn').hidden"));
ok('关闭时提示文案隐藏', await ev("document.getElementById('cfOcrHint').hidden"));
await ev("App.closeChargePage()");
await wait(250);
await ev("localStorage.setItem('ev_ocr_enabled_v1','1');App.openChargePage()");
await wait(300);

console.log('3. 识别预填（mock，不自动保存）');
const before = await ev("window.__charges().length");
await ev("OCR.pickAndRecognize = function(){ return Promise.resolve({ blob:{}, text:'充电量 42.5 度\\n实付 ¥30.00\\n2026-11-18 12:30', confidence:92 }); };");
await ev("App.startOcr()");
await wait(400);
ok('度数已预填', (await ev("document.getElementById('cf_kWh').value")) === '42.5');
ok('金额已预填', (await ev("document.getElementById('cf_totalCost').value")) === '30');
ok('日期已预填', (await ev("document.getElementById('cf_date').value")) === '2026-11-18');
ok('识别层已关闭', !(await ev("document.getElementById('ocrOverlay').classList.contains('show')")));
ok('预填不自动保存', (await ev("window.__charges().length")) === before);

console.log('4. 保存后写入「待补充」');
await ev("App.saveCharge()");
await wait(400);
ok('保存后记录 +1', (await ev("window.__charges().length")) === before + 1);
ok('pendingExtra 已写入', await ev("(function(){var a=window.__charges();return a[a.length-1].pendingExtra===true;})()"));
await ev("App.renderRecords()");
await wait(200);
ok('列表显示「待补充」角标', (await ev("document.getElementById('panel-records').innerHTML")).includes('待补充'));

console.log('5. 详情页补录入口');
const lastId = await ev("(function(){var a=window.__charges();return a[a.length-1].id;})()");
await ev(`App.showChargeDetail('${lastId}')`);
await wait(350);
ok('详情含「补充 SOC / 里程」', (await ev("document.getElementById('sheetBody').innerHTML")).includes('补充 SOC / 里程'));
await ev("document.querySelector('#sheetBody button.btn-block').click()");
await wait(350);
ok('点击进入编辑态', await ev("document.getElementById('chargeFormPage').classList.contains('show')"));
ok('编辑的是该条记录', (await ev("App.editingChargeId")) === lastId);
await ev("App.closeChargePage()");
await wait(250);

console.log('6. 低置信只描红不填值');
await ev("App.openChargePage()");
await wait(250);
await ev("App.applyOcrResult({kWh:{value:999,confidence:0.2,level:'low',source:'',warn:''},"
  + "totalCost:{value:12.34,confidence:0.95,level:'high',source:'标签',warn:''},"
  + "date:{value:'2026-11-18',confidence:0.9,level:'high',source:'截图',warn:''}})");
await wait(300);
ok('低置信字段未填值', (await ev("document.getElementById('cf_kWh').value")) === '');
ok('低置信字段描红', await ev("document.getElementById('cf_kWh').closest('.field').classList.contains('invalid')"));
ok('高置信字段已填值', (await ev("document.getElementById('cf_totalCost').value")) === '12.34');
ok('聚焦第一个核心待核对字段', (await ev("document.activeElement && document.activeElement.id")) === 'cf_kWh');
ok('表单给出核对提示', (await ev("document.getElementById('cfFormMsg').textContent")).includes('请核对'));
await ev("App.closeChargePage()");
await wait(250);

console.log('7. 「待补充」范围收敛开关');
await ev("localStorage.setItem('ev_ocr_pending_only_v1','1');App.openChargePage()");
await wait(250);
await ev("App.applyOcrResult({kWh:{value:40,confidence:0.95,level:'high',source:'',warn:''},"
  + "totalCost:{value:30,confidence:0.95,level:'high',source:'',warn:''}})");
await wait(200);
await ev("App.saveCharge()");
await wait(400);
ok('收敛后：识别来源仍标记', await ev("(function(){var a=window.__charges();return a[a.length-1].pendingExtra===true;})()"));
await ev("App.openChargePage()");
await wait(250);
await ev("document.getElementById('cf_kWh').value='41';document.getElementById('cf_totalCost').value='31';App.saveCharge()");
await wait(400);
ok('收敛后：手动记账不标记', await ev("(function(){var a=window.__charges();return a[a.length-1].pendingExtra===false;})()"));
await ev("localStorage.removeItem('ev_ocr_pending_only_v1')");

console.log('8. 开关持久化');
await ev("App.openSettings()");
await wait(400);
await ev("var s=document.getElementById('ocrEnabled');s.checked=false;s.dispatchEvent(new Event('change',{bubbles:true}))");
await wait(200);
ok('关闭状态已写入 localStorage', (await ev("localStorage.getItem('ev_ocr_enabled_v1')")) === '0');
await ev("var s=document.getElementById('ocrEnabled');s.checked=true;s.dispatchEvent(new Event('change',{bubbles:true}))");
await wait(200);
ok('开启状态已写入 localStorage', (await ev("localStorage.getItem('ev_ocr_enabled_v1')")) === '1');
ok('页脚版本号未受影响', (await ev("document.getElementById('settingsFoot').textContent")).includes('冲充电 v2.8'));

console.log('9. 控制台错误');
const errs = await ev("(window.__errs||[]).join(' | ')");
ok('无未捕获错误' + (errs ? '：' + errs : ''), !errs);

console.log('\n结果：' + pass + ' 通过 · ' + fail + ' 失败');
ws.close();
process.exit(fail ? 1 : 0);
