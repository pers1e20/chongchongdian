/* ============================================================
   api.js —— 冲充电 × Smartisan 演示原型 · API Stub 层
   签名即未来真实接口；接入真实后端时仅替换实现，形状不变。
   ============================================================ */
const delay = (ms) => new Promise(r => setTimeout(r, ms));

/* GET /api/charges?month=YYYY-MM —— 充电记录列表 */
async function fetchCharges({ month } = {}) {
  await delay(320); // 模拟网络延迟，展示加载态
  // TODO: replace with fetch(`/api/charges?month=${month}`)
  let list = DB.charges;
  if (month) list = list.filter(c => c.date.slice(0, 7) === month);
  return { code: 0, data: list.slice(), total: list.length };
}

/* GET /api/summary?month=YYYY-MM —— 月度汇总指标 */
async function fetchSummary(month) {
  await delay(260);
  // TODO: replace with fetch(`/api/summary?month=${month}`)
  return { code: 0, data: DB.summaryFor(month) };
}

/* GET /api/health —— 电池健康全量 */
async function fetchHealth() {
  await delay(300);
  // TODO: replace with fetch('/api/health')
  return { code: 0, data: DB.health };
}

/* GET /api/advice —— 充电建议全量 */
async function fetchAdvice() {
  await delay(300);
  // TODO: replace with fetch('/api/advice')
  return { code: 0, data: DB.advice };
}

/* 演示用：删除一条记录（仅前端示例，不落库） */
async function deleteCharge(id) {
  await delay(200);
  // TODO: replace with DELETE /api/charges/:id
  DB.charges = DB.charges.filter(c => c.id !== id);
  return { code: 0 };
}