/* ============================================================
   mock.js —— 冲充电 × Smartisan 演示原型 · 统一数据源
   所有页面从本文件读取，禁止四处硬编码。
   ============================================================ */
const DB = {
  vehicles: [
    { id: 1, brand: "智己", name: "智己 L6", capacity: 75, isFast: true },
    { id: 2, brand: "比亚迪", name: "汉 EV", capacity: 82, isFast: true }
  ],
  currentVehicleId: 1,
  charges: [
    { id: 1, vehicleId: 1, date: "2026-09-14", type: "slow", kWh: 24.8, cost: 40.2, odometer: 12480, socBefore: 28, socAfter: 98 },
    { id: 2, vehicleId: 1, date: "2026-09-11", type: "fast", kWh: 31.6, cost: 63.2, odometer: 12260, socBefore: 12, socAfter: 96 },
    { id: 3, vehicleId: 1, date: "2026-09-06", type: "slow", kWh: 22.4, cost: 35.8, odometer: 12005, socBefore: 34, socAfter: 92 },
    { id: 4, vehicleId: 1, date: "2026-09-02", type: "slow", kWh: 26.1, cost: 41.5, odometer: 11786, socBefore: 25, socAfter: 99 },
    { id: 5, vehicleId: 1, date: "2026-08-28", type: "fast", kWh: 30.2, cost: 62.4, odometer: 11520, socBefore: 18, socAfter: 95 },
    { id: 6, vehicleId: 1, date: "2026-08-22", type: "slow", kWh: 23.7, cost: 38.0, odometer: 11290, socBefore: 30, socAfter: 93 },
    { id: 7, vehicleId: 1, date: "2026-08-17", type: "fast", kWh: 29.4, cost: 61.1, odometer: 11040, socBefore: 15, socAfter: 97 },
    { id: 8, vehicleId: 1, date: "2026-08-11", type: "slow", kWh: 24.0, cost: 38.9, odometer: 10805, socBefore: 33, socAfter: 94 },
    { id: 9, vehicleId: 1, date: "2026-08-05", type: "slow", kWh: 25.5, cost: 40.9, odometer: 10570, socBefore: 27, socAfter: 100 },
    { id: 10, vehicleId: 1, date: "2026-07-29", type: "fast", kWh: 28.8, cost: 60.9, odometer: 10320, socBefore: 20, socAfter: 96 },
    { id: 11, vehicleId: 1, date: "2026-07-22", type: "slow", kWh: 22.9, cost: 36.4, odometer: 10085, socBefore: 31, socAfter: 91 },
    { id: 12, vehicleId: 1, date: "2026-07-15", type: "slow", kWh: 24.6, cost: 39.3, odometer: 9850, socBefore: 29, socAfter: 95 }
  ],
  health: {
    socPercent: 76,                 // 电池健康度
    currentCapacity: 62.3,          // kWh
    ratedCapacity: 82.0,
    trend: [   // 容量月度趋势（月份 -> 平均实测容量 kWh）
      { m: "2026-03", kWh: 66.1 },
      { m: "2026-04", kWh: 65.4 },
      { m: "2026-05", kWh: 64.8 },
      { m: "2026-06", kWh: 64.0 },
      { m: "2026-07", kWh: 63.2 },
      { m: "2026-08", kWh: 62.9 },
      { m: "2026-09", kWh: 62.3 }
    ],
    items: [
      { label: "当前实测容量", val: "62.3 kWh", note: "近 5 次样本中位数" },
      { label: "标称容量", val: "82.0 kWh", note: "车型手册" },
      { label: "容量保持率", val: "76%", note: "距 85% 警戒线偏近" },
      { label: "健康指数", val: "良好", note: "容量×0.6 + 习惯×0.4" }
    ]
  },
  advice: {
    overview: [
      { label: "快充占比", val: "33%", note: "建议 ≤ 50%" },
      { label: "深放频率", val: "2 次/月", note: "起点 < 20%" },
      { label: "过充频率", val: "3 次/月", note: "终点 > 90%" },
      { label: "综合评分", val: "78", note: "习惯良好" }
    ],
    suggestions: [
      { level: "good", title: "总里程电耗仅 13.2 度/百公里", desc: "近两月有效样本稳定，驾驶与补能都高效。", action: "保持现状即可" },
      { level: "ok", title: "深放频率略高", desc: "本月有 2 次在 20% 以下才充电，长期会加速老化。", action: "提前到 25% 以上补能" },
      { level: "warn", title: "过充集中在快充站", desc: "快充 3 次都充到 >90%，峰值段压降明显、伤害明显。", action: "快充充到 85% 即走" }
    ],
    compare: {
      slow: { name: "慢充策略", kWh: 24.8, costPu: 1.21, cost: 30.0, note: "谷电 + 少过充" },
      fast: { name: "快充策略", kWh: 24.8, costPu: 1.60, cost: 39.7, note: "峰电 + 充到 98%" }
    }
  },
  months: ["2026-07", "2026-08", "2026-09"]
};

/* 便捷派生：某月充电合计（金额 / 度数 / 快慢充分布） */
DB.summaryFor = function (month) {
  const list = this.charges.filter(c => c.date.slice(0, 7) === month);
  const fast = list.filter(c => c.type === "fast").length;
  const slow = list.length - fast;
  const cost = list.reduce((s, c) => s + c.cost, 0);
  const kWh = list.reduce((s, c) => s + c.kWh, 0);
  return { count: list.length, fast, slow, cost, kWh };
};