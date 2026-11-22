#!/usr/bin/env node
/**
 * 冲充电 · 截图识别（OCR）专项校验（CDP）
 * ====================================
 * 覆盖 v1 的核心原则与闭环：
 *   入口显隐 / 预填不自动保存 / 低置信只描红 / pendingExtra 角标 /
 *   详情页补录入口 / 收敛开关 / 控制台无错。
 *
 * 识别链路用 mock（覆盖 OCR.pickImage / OCR._prepareImpl / OCR._recognizeImpl），
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
ok('识别入口在表单底部、保存按钮上方', await ev("(function(){var b=document.getElementById('cfOcrBtn');return !!b&&b.previousElementSibling&&b.previousElementSibling.classList.contains('fcard')&&b.nextElementSibling&&b.nextElementSibling.classList.contains('action-bar');})()"));
ok('识别入口高度不低于 56px', await ev("document.getElementById('cfOcrBtn').getBoundingClientRect().height>=56"));

console.log('3. 识别确认页 → 预填（mock，不自动保存）');
const before = await ev("window.__charges().length");
/* 先验证「点了就选图、未选中不弹识别层」 */
await ev("window.__pickCalled=false;OCR.pickImage=function(){window.__pickCalled=true;return new Promise(function(){});};App.startOcr()");
await wait(150);
ok('点击先调起选图', await ev("window.__pickCalled===true"));
ok('未选中图片时不显示识别层', !(await ev("document.getElementById('ocrOverlay').classList.contains('show')")));
await ev("OCR.pickImage=function(){return Promise.resolve(new Blob(['x'],{type:'image/png'}));};"
  + "OCR._prepareImpl=function(f){return Promise.resolve(f);};"
  + "OCR._recognizeImpl=function(){return Promise.resolve({text:'充电量 42.5 度\\n实付 ¥30.00\\n2026-11-18 12:30',confidence:92});};");
await ev("App.startOcr()");
await wait(450);
/* 识别成功后先进确认页，不直接填表 */
ok('识别后显示确认页', await ev("document.getElementById('ocrResultView').classList.contains('active')"));
ok('确认页展示原图', await ev("!!document.getElementById('ocrPreview').getAttribute('src')"));
ok('确认页列出可编辑电量字段', await ev("!!document.getElementById('ocrF_kWh')&&document.getElementById('ocrF_kWh').value==='42.5'"));
ok('确认页列出可编辑金额字段', await ev("!!document.getElementById('ocrF_totalCost')"));
ok('确认页有「填入表单」按钮', await ev("!!document.getElementById('ocrCommitBtn')"));
ok('确认页有「重新识别」按钮', await ev("!!document.getElementById('ocrRescanBtn')"));
ok('确认页有「手动填写」按钮', await ev("!!document.getElementById('ocrManualBtn2')"));
/* 点原图可放大核验 */
await ev("App.openOcrLightbox()");
await wait(120);
ok('点原图打开大图核验', await ev("document.getElementById('ocrLightbox').classList.contains('show')&&!!document.getElementById('ocrLightboxImg').getAttribute('src')"));
await ev("App.closeOcrLightbox()");
await wait(120);
ok('关闭大图核验层', !(await ev("document.getElementById('ocrLightbox').classList.contains('show')")));
ok('确认前未预填表单', (await ev("document.getElementById('cf_kWh').value")) === '');
/* 点「填入表单」后才预填 */
await ev("document.getElementById('ocrCommitBtn').click()");
await wait(250);
ok('度数已预填', (await ev("document.getElementById('cf_kWh').value")) === '42.5');
ok('金额已预填', (await ev("document.getElementById('cf_totalCost').value")) === '30');
ok('日期已预填', (await ev("document.getElementById('cf_date').value")) === '2026-11-18');
ok('填入后识别层已关闭', !(await ev("document.getElementById('ocrOverlay').classList.contains('show')")));
ok('预填不自动保存', (await ev("window.__charges().length")) === before);
await ev("OCR._prepareImpl=null;OCR._recognizeImpl=null;");

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

console.log('9. 分栏模式与 Worker 生命周期');
await ev("OCR._createWorkerImpl=function(){window.__createCount=(window.__createCount||0)+1;"
  + "return Promise.resolve({setParameters:function(p){window.__psm=p;return Promise.resolve();},"
  + "recognize:function(){return Promise.resolve({data:{text:'',confidence:0}});},"
  + "terminate:function(){window.__terminated=(window.__terminated||0)+1;}});};");
await ev("OCR._worker=null;OCR._workerPromise=null;window.__createCount=0;window.__psm=null;window.__terminated=0;");
await ev("OCR.worker()");
await wait(400);
ok('显式设置分栏模式 AUTO(3)', (await ev("window.__psm && window.__psm.tessedit_pageseg_mode")) === '3');
ok('_worker 是真实 Worker 而非 Promise', (await ev("typeof (OCR._worker && OCR._worker.terminate)")) === 'function');
ok('worker() 去重，只创建一次', (await ev("window.__createCount")) === 1);
await ev("OCR.dispose()");
ok('dispose 真正调用 terminate', (await ev("window.__terminated")) === 1);
ok('dispose 后 _worker 置空', (await ev("OCR._worker === null")));
await ev("OCR._createWorkerImpl=null;OCR._worker=null;OCR._workerPromise=null;");

console.log('10. 金额抽取容错');
ok('PSM6 噪声文本（¥ 读成 x）抽出 24.07', (await ev(
  "(OCR.extractFields('充电 费 应 付 金 客 x24.07',64).totalCost||{}).value")) === 24.07);
ok('PSM3 文本抽出 24.07 且高置信', await ev(
  "(function(){var f=OCR.extractFields('充电费应付金额 Y24.07',76).totalCost||{};return f.value===24.07&&f.level==='high';})()"));
ok('多金额行优先「应付」而非「电费」', (await ev(
  "(OCR.extractFields('电费 Y17.56\\n服务费 Y6.51\\n应付：Y24.07',76).totalCost||{}).value")) === 24.07);
ok('千分位 1,234.56 解析正确', (await ev(
  "(OCR.extractFields('应付 ¥1,234.56',90).totalCost||{}).value")) === 1234.56);
ok('小数点被读成逗号 24,07', (await ev(
  "(OCR.extractFields('应付 24,07',90).totalCost||{}).value")) === 24.07);
ok('标签与数值换行版式', (await ev(
  "(OCR.extractFields('应付金额\\n¥24.07',90).totalCost||{}).value")) === 24.07);
ok('「充电费用」标题不跨行抓度数', await ev(
  "(function(){var f=OCR.extractFields('充电费用\\n广安路充电站 35.698 度',80);return !f.totalCost;})()"));
ok('误读 1756 判低置信（不预填）', await ev(
  "(function(){var f=OCR.extractFields('充电量 35.698 度\\n应付 1756',75).totalCost||{};return f.level==='low';})()"));

console.log('11. HEIC 检测与图片缩放');
ok('HEIC 文件头识别为 true', await ev(
  "(function(){var b=new Uint8Array([0,0,0,24,102,116,121,112,104,101,105,99]);"
  + "return OCR.isHeic(new Blob([b],{type:'image/heic'}));})()"));
ok('PNG 头识别为 false', (await ev(
  "(function(){var b=new Uint8Array([137,80,78,71,13,10,26,10]);"
  + "return OCR.isHeic(new Blob([b],{type:'image/png'}));})()")) === false);
ok('checkImage 对 HEIC 抛 OCR_HEIC', await ev(
  "(function(){var b=new Uint8Array([0,0,0,24,102,116,121,112,104,101,105,99]);"
  + "return OCR.checkImage(new Blob([b],{type:'image/heic'})).then(function(){return false;},"
  + "function(e){return e.code==='OCR_HEIC';});})()"));
await ev("window.__mkBlob=function(w,h){var cv=document.createElement('canvas');cv.width=w;cv.height=h;"
  + "return new Promise(function(r){cv.toBlob(function(b){r(b);},'image/jpeg',0.9);});};"
  + "window.__edge=function(b){return createImageBitmap(b).then(function(m){var l=Math.max(m.width,m.height);"
  + "if(m.close)m.close();return l;});};");
ok('900 小图放大进入稳定区间', await ev(
  "window.__mkBlob(900,1200).then(function(b){return OCR.prepare(b);}).then(window.__edge).then(function(l){return l>=1100&&l<=2048;})"));
ok('3000 大图降采样到 2048', await ev(
  "window.__mkBlob(3000,2000).then(function(b){return OCR.prepare(b);}).then(window.__edge).then(function(l){return l<=2048;})"));
ok('1500 中等图保持原样', await ev(
  "window.__mkBlob(1500,1000).then(function(b){return OCR.prepare(b);}).then(window.__edge).then(function(l){return l===1500;})"));

console.log('12. 错误分类提示');
await ev("OCR.checkImage=function(){var e=new Error('x');e.code='OCR_HEIC';return Promise.reject(e);};");
await ev("App.startOcr()");
await wait(400);
ok('HEIC → 标题「不支持的图片格式」', (await ev("document.getElementById('ocrTitle').textContent")) === '不支持的图片格式');
ok('HEIC 状态文案含 HEIC', (await ev("document.getElementById('ocrStatus').textContent")).includes('HEIC'));
ok('失败时旋转动画停止', await ev("document.getElementById('ocrSpinner').hidden===true"));
await ev("App.hideOcrOverlay()");
await ev("OCR.checkImage=function(f){return Promise.resolve(f);};"
  + "OCR._recognizeImpl=function(){return Promise.reject(undefined);};");
await ev("App.startOcr()");
await wait(400);
ok('undefined 错误归类为引擎下载失败', (await ev("document.getElementById('ocrTitle').textContent")) === '识别引擎下载失败');
await ev("App.hideOcrOverlay()");
await ev("OCR._recognizeImpl=null;OCR.pickImage=function(){return Promise.reject(new Error('已取消选择'));};");
await ev("App.startOcr()");
await wait(400);
const cancelShown = await ev("document.getElementById('ocrOverlay').classList.contains('show')");
ok('取消选择不显示失败层', cancelShown === false);

console.log('13. 确认页交互与长文本清洗');
/* 值清洗：长串/单位/多小数点 → 提取首个合法数字 */
ok('清洗：带单位长串', (await ev("App.cleanOcrValue('kWh','35.698度度度充电完成')")) === '35.698');
ok('清洗：千分位金额', (await ev("App.cleanOcrValue('totalCost','¥1,234.56元')")) === '1');
ok('清洗：合法数字原样', (await ev("App.cleanOcrValue('totalCost','24.07')")) === '24.07');
ok('清洗：日期格式校验', (await ev("App.cleanOcrValue('date','2026-11-18 12:30')")) === '');
ok('清洗：合法日期保留', (await ev("App.cleanOcrValue('date','2026-11-18')")) === '2026-11-18');
/* 端到端：确认页填长串 → 填入表单 → 输入框拿到合法值 */
await ev("App.hideOcrOverlay();App.openChargePage();");
await wait(250);
await ev("App.showOcrResult({kWh:{value:'35.698度度',confidence:0.9,level:'high'},"
  + "totalCost:{value:'24.07元',confidence:0.9,level:'high'},"
  + "date:{value:'2026-11-18',confidence:0.9,level:'high'}},new Blob(['x'],{type:'image/png'}))");
await wait(150);
ok('确认页可编辑框已清洗长串', (await ev("document.getElementById('ocrF_kWh').value")) === '35.698');
ok('确认页金额框已清洗单位', (await ev("document.getElementById('ocrF_totalCost').value")) === '24.07');
/* number 输入框天然拒绝长串：塞入非法值后 value 为空，提交不会污染表单 */
await ev("document.getElementById('ocrF_kWh').value='35.698度度'");
ok('number 框拒绝长串', (await ev("document.getElementById('ocrF_kWh').value")) === '');
await ev("document.getElementById('ocrCommitBtn').click()");
await wait(200);
ok('表单未被长串污染', (await ev("document.getElementById('cf_kWh').value")) === '');
ok('表单输入框无 badInput', (await ev("document.getElementById('cf_kWh').validity.badInput")) === false);
await ev("App.closeChargePage()");
await wait(200);
/* 手动填写按钮 */
await ev("App.showOcrResult({kWh:{value:'40',confidence:0.9,level:'high'}},new Blob(['x'],{type:'image/png'}))");
await wait(150);
await ev("document.getElementById('ocrManualBtn2').click()");
await wait(150);
ok('确认页「手动」关闭识别层', !(await ev("document.getElementById('ocrOverlay').classList.contains('show')")));

console.log('14. 控制台错误');
const errs = await ev("(window.__errs||[]).join(' | ')");
ok('无未捕获错误' + (errs ? '：' + errs : ''), !errs);

console.log('\n结果：' + pass + ' 通过 · ' + fail + ' 失败');
ws.close();
process.exit(fail ? 1 : 0);
