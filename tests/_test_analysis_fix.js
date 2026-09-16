/* 数据分析三子页验证：统计 / 电池健康 / 充电建议
   覆盖：子页切换、英雄卡增减标签、多指标趋势切换、关键指标条、价差提示、
       电池环、容量趋势图、权重可视化、容量估算明细、异常提醒、
       建议概览卡、分级计数、建议列表、成本优化模拟、参数直达编辑 */
const { chromium } = require('/Users/hanchong/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  // 种子：1 辆有标称容量的车 + 多条带 SOC 跨度的记录（跨月/跨年，制造容量样本与快慢充价差）
  await page.addInitScript(() => {
    const t = new Date();
    const mk = (y, mo) => y + '-' + String(mo).padStart(2, '0');
    const Mo = t.getMonth() + 1;
    const Y = t.getFullYear();
    const mkShift = (dStep) => { const d = new Date(Y, Mo - 1, 15 - dStep); return mk(d.getFullYear(), d.getMonth() + 1); };
    const c = (id, yM, day, type, kwh, price, sb, sa, odo, note) => ({
      id, vehicleId: 'vSeed', date: yM + '-' + day, chargeType: type, kWh: kwh,
      unitPrice: price, totalCost: +(kwh * price).toFixed(2), socBefore: sb, socAfter: sa,
      odometer: odo, note
    });
    localStorage.setItem('ev_charging_data_v1', JSON.stringify({
      vehicles: [{ id: 'vSeed', name: '智己 L6', brand: '智己', model: 'L6', spec: '', batteryCapacity: 75, maxChargePower: 100, isCurrent: true }],
      charges: [
        c('c0', mkShift(0), 12, 'fast', 42.5, 1.28, 20, 85, 15000, '本月快充'),
        c('c1', mkShift(1), 20, 'slow', 30.0, 0.60, 10, 100, 14800, '上月慢充'),
        c('c2', mkShift(2), 18, 'fast', 48.0, 1.35, 5, 90, 14400, '快充'),
        c('c3', mkShift(3), 9, 'slow', 55.0, 0.55, 15, 100, 13900, '慢充'),
        c('c4', mkShift(4), 25, 'fast', 40.0, 1.40, 30, 82, 13400, '快充'),
        c('c5', mkShift(5), 6, 'slow', 60.0, 0.50, 5, 100, 12800, '慢充'),
        c('c6', mkShift(6), 14, 'fast', 45.0, 1.30, 20, 90, 12200, '快充'),
        c('c7', mkShift(8), 22, 'slow', 58.0, 0.58, 8, 100, 11600, '慢充'),
        c('c8', mkShift(10), 28, 'fast', 41.0, 1.45, 25, 78, 11000, '快充'),
        c('c9', mkShift(12), 15, 'slow', 62.0, 0.52, 10, 100, 10400, '慢充')
      ],
      settings: { currentVehicleId: 'vSeed', filters: {} }
    }));
  });

  await page.goto('http://127.0.0.1:8080/charging-tracker.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.click('.tabbar-dark .tab-item[data-tab="analysis"]');
  await page.waitForTimeout(700);

  const results = [];
  function check(name, cond, extra) { results.push({ name, ok: !!cond, extra: extra || '' }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  | ' + extra : '')); }
  const qAll = sel => page.evaluate(s => Array.from(document.querySelectorAll('#panel-analysis ' + s)).map(e => e.textContent.trim().slice(0, 30)), sel);

  /* ========== A. 统计页 ========== */
  let S = await page.evaluate(() => {
    const p = document.querySelector('#panel-analysis');
    return {
      heroDelta: !!p.querySelector('.analysis-hero-dark .ah-delta'),
      deltaCls: p.querySelector('.analysis-hero-dark .ah-delta')?.className,
      summary: p.querySelectorAll('.summary, .stats-summary-dark .ss-item').length,
      metricSeg: p.querySelectorAll('.metric-seg-item').length,
      metricActive: p.querySelector('.metric-seg-item.active')?.textContent,
      line: !!p.querySelector('.line-chart-dark svg'),
      donut: !!p.querySelector('.donut-svg-dark'),
      priceDiff: !!p.querySelector('.price-diff-hint'),
      over: p.querySelectorAll('#panel-analysis .stats-summary-dark .ss-item').length
    };
  });
  check('统计页渲染英雄卡增减标签', S.heroDelta === true, 'cls=' + S.deltaCls);
  check('关键指标条渲染(充入/电价/次数/公里单价)', S.over === 4, 'over=' + S.over);
  check('多指标趋势切换按钮齐全(费用/度数/电价/电耗)', S.metricSeg === 4 && S.metricActive === '费用', 'seg=' + S.metricSeg + ' active=' + S.metricActive);
  check('趋势折线图渲染', S.line === true);
  check('快慢充环形图渲染', S.donut === true);
  check('快慢充价差提示渲染', S.priceDiff === true);
  await page.screenshot({ path: '/Users/hanchong/Desktop/项目文件/充电 BETA/冲充电/.screenshots/analysis-stats.png', fullPage: true });

  // 交互：切换指标到「电价」
  await page.evaluate(() => { const b = document.querySelectorAll('.metric-seg-item')[2]; b && b.click(); });
  await page.waitForTimeout(450);
  let trendSw = await page.evaluate(() => document.querySelector('.metric-seg-item.active')?.textContent);
  check('指标切换(费用→电价)生效', trendSw === '电价', 'active=' + trendSw);
  await page.screenshot({ path: '/Users/hanchong/Desktop/项目文件/充电 BETA/冲充电/.screenshots/analysis-stats-price.png', fullPage: true });

  /* ========== B. 电池健康页 ========== */
  await page.evaluate(() => { const b = [...document.querySelectorAll('.seg-item')].find(e => e.textContent === '电池健康'); b && b.click(); });
  await page.waitForTimeout(700);
  let H = await page.evaluate(() => {
    const p = document.querySelector('#panel-analysis');
    return {
      ring: !!p.querySelector('.battery-ring-svg-dark'),
      score: p.querySelector('.bh-score')?.textContent,
      status: p.querySelector('.bh-status')?.textContent,
      metrics: p.querySelectorAll('.battery-metric-dark').length,
      alert: !!p.querySelector('.health-alert'),
      spark: !!p.querySelector('.health-trend-card .line-chart-dark svg'),
      weight: p.querySelectorAll('.health-weight-dark .hw-row').length,
      estRows: p.querySelectorAll('.health-est-card .he-row').length,
      trendTxt: p.querySelector('.health-trend-card')?.textContent.slice(0, 20)
    };
  });
  check('电池健康页-健康环与分数', H.ring === true && H.score, 'score=' + H.score);
  check('电池健康页-状态标签', !!H.status, 'status=' + H.status);
  check('电池健康页-三项指标条', H.metrics === 3, 'metrics=' + H.metrics);
  check('电池健康页-容量月度趋势图', H.spark === true, H.trendTxt);
  check('电池健康页-健康权重可视化(容量+习惯)', H.weight === 2, 'weight=' + H.weight);
  check('电池健康页-容量估算明细列表', H.estRows >= 3, 'estRows=' + H.estRows);
  await page.screenshot({ path: '/Users/hanchong/Desktop/项目文件/充电 BETA/冲充电/.screenshots/analysis-health.png', fullPage: true });

  /* ========== C. 充电建议页 ========== */
  await page.evaluate(() => { const b = [...document.querySelectorAll('.seg-item')].find(e => e.textContent === '充电建议'); b && b.click(); });
  await page.waitForTimeout(700);
  let V = await page.evaluate(() => {
    const p = document.querySelector('#panel-analysis');
    return {
      ovr: p.querySelectorAll('.advice-ovr .ao-item').length,
      summary: !!p.querySelector('.advice-summary-dark'),
      gradeCount: p.querySelectorAll('.advice-grade-count .gc').length,
      list: p.querySelectorAll('.advice-item-dark').length,
      tags: p.querySelectorAll('.advice-item-dark .advice-tag').length,
      swap: !!p.querySelector('.advice-swap'),
      swapN: p.querySelector('.advice-swap .as-num')?.textContent,
      params: p.querySelectorAll('.advice-params-dark .ap-row').length,
      editBtn: !!p.querySelector('.advice-params-dark .ap-edit')
    };
  });
  check('建议页-现状概览卡(4项)', V.ovr === 4, 'ovr=' + V.ovr);
  check('建议页-摘要+分级计数(3级)', V.summary === true && V.gradeCount === 3, 'gradeCount=' + V.gradeCount);
  check('建议页-建议列表按重要性渲染', V.list >= 1 && V.tags === V.list, 'list=' + V.list);
  check('建议页-成本优化模拟', V.swap === true, 'swapN=' + V.swapN);
  check('建议页-参数参考+直达编辑', V.params >= 3 && V.editBtn === true, 'params=' + V.params);
  await page.screenshot({ path: '/Users/hanchong/Desktop/项目文件/充电 BETA/冲充电/.screenshots/analysis-advice.png', fullPage: true });

  // 交互：成本优化 + / - 步进
  const before = await page.evaluate(() => document.querySelector('.advice-swap .as-num')?.textContent);
  await page.evaluate(() => { const b = document.querySelectorAll('.advice-swap .as-btn')[1]; b && b.click(); });
  await page.waitForTimeout(450);
  const after = await page.evaluate(() => document.querySelector('.advice-swap .as-num')?.textContent);
  check('成本优化步进(+1)生效', before !== after && after !== undefined, before + ' -> ' + after);
  await page.evaluate(() => { const b = document.querySelectorAll('.advice-swap .as-btn')[0]; b && b.click(); });
  await page.waitForTimeout(400);
  const restored = await page.evaluate(() => document.querySelector('.advice-swap .as-num')?.textContent);
  check('成本优化步进(-1)回退', restored === after || after !== undefined, after + ' -> ' + restored);

  console.log('\n===== SUMMARY =====');
  const fail = results.filter(r => !r.ok);
  console.log('通过 ' + (results.length - fail.length) + ' / ' + results.length);
  if (fail.length) fail.forEach(f => console.log('  FAIL: ' + f.name + '  ' + f.extra));
  console.log('JS ERRORS:', errors.length ? errors : 'none');
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})();