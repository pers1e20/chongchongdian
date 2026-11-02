/* 四个区域行为验证脚本 v2 */
const { chromium } = require('/Users/hanchong/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto('http://127.0.0.1:8080/charging-tracker.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const out = {};

  // 0. 初始状态
  out.initial = await page.evaluate(() => {
    const vis = Array.from(document.querySelectorAll('.tab-panel')).filter(p => p.classList.contains('active')).map(p => p.id);
    return { visiblePanels: vis, currentTab: App.currentTab, activeTabItem: document.querySelector('.tabbar-dark .tab-item.active')?.dataset.tab };
  });

  // 1. 重复 ID 检查
  out.dupIds = await page.evaluate(() => {
    const ids = ['chargeFormPage-form', 'cf_kWh', 'cf_unitPrice', 'cf_totalCost', 'cf_vehicleId', 'cf_chargeType', 'cf_date', 'cf_chargeTypeSegment', 'cf_socBefore', 'cf_socAfter', 'cf_odometer', 'autoCalcHint', 'cf_note'];
    const res = [];
    ids.forEach(id => {
      const n = document.querySelectorAll('#' + CSS.escape(id)).length;
      if (n > 1) res.push(id + '=' + n);
    });
    return res;
  });

  // 2. 首页 → 最近充电 → 编辑弹层取值（用 JS 触发保证可见性）
  await page.evaluate(() => App.switchTab('home'));
  await page.waitForTimeout(400);
  await page.evaluate(() => { document.querySelector('.recent-item-dark').click(); });
  await page.waitForTimeout(400);
  out.editFromHome = await page.evaluate(() => {
    const vis = document.getElementById('chargeFormPage').classList.contains('show');
    const kwh = document.getElementById('cf_kWh').value;
    const cost = document.getElementById('cf_totalCost').value;
    const date = document.getElementById('cf_date').value;
    const title = document.getElementById('chargeFormPageTitle').textContent;
    return { visible: vis, title, kWh: kwh, totalCost: cost, date };
  });
  await page.evaluate(() => App.closeChargePage());
  await page.waitForTimeout(200);

  // 3. 首页柱状图点击 → 半屏弹层
  const barInfo = await page.evaluate(() => {
    const bars = Array.from(document.querySelectorAll('.mini-chart .bar'));
    return bars.map(b => ({ title: b.getAttribute('title'), label: b.querySelector('.bar-label')?.textContent, hasOnclick: !!b.getAttribute('onclick') }));
  });
  await page.evaluate(() => { const b = document.querySelector('.mini-chart .bar'); if (b) b.click(); });
  await page.waitForTimeout(300);
  out.barClick = await page.evaluate(() => {
    const ds = document.getElementById('dataSheet');
    return { sheetShown: ds ? ds.classList.contains('show') : false, dsExists: !!ds };
  });
  await page.evaluate(() => App.closeChartSheet());
  out.barInfo = barInfo;

  // 4. 记录页
  await page.evaluate(() => App.switchTab('records'));
  await page.waitForTimeout(400);
  out.records = await page.evaluate(() => {
    return {
      yearGroups: document.querySelectorAll('.records-year-group').length,
      monthGroups: document.querySelectorAll('.records-month-group').length,
      items: document.querySelectorAll('.history-item-dark').length,
      fab: !!document.querySelector('.records-fab'),
      navAdd: !!document.querySelector('.nav-action'),
      toolbarAdd: !!document.querySelector('.records-add-btn'),
      dupFormInPanel: document.querySelectorAll('#panel-records #chargeFormPage-form').length
    };
  });

  // 5. 筛选面板开关
  await page.evaluate(() => { document.querySelector('.filter-toggle-btn').click(); });
  await page.waitForTimeout(300);
  out.filterOpen = await page.evaluate(() => !!document.getElementById('recordsFilterPanel'));
  await page.evaluate(() => { document.querySelector('.filter-toggle-btn').click(); });
  await page.waitForTimeout(300);
  out.filterClosed = await page.evaluate(() => !document.getElementById('recordsFilterPanel'));

  // 6. 记录页新增 → 表单打开
  await page.evaluate(() => { document.querySelector('.records-add-btn').click(); });
  await page.waitForTimeout(300);
  out.addFromRecords = await page.evaluate(() => {
    const vis = document.getElementById('chargeFormPage').classList.contains('show');
    const kwhEl = document.getElementById('cf_kWh');
    return { visible: vis, kWh: kwhEl ? kwhEl.value : 'MISSING', formCount: document.querySelectorAll('#chargeFormPage-form').length };
  });

  // 7. 联动：电量+单价 → 总费用
  await page.fill('#cf_kWh', '50');
  await page.fill('#cf_unitPrice', '1.2');
  await page.waitForTimeout(200);
  out.autoCalc = await page.evaluate(() => document.getElementById('cf_totalCost').value);

  // 8. 联动：总费用+电量 → 单价
  await page.fill('#cf_kWh', '50');
  await page.fill('#cf_totalCost', '60');
  await page.waitForTimeout(200);
  out.autoCalc2 = await page.evaluate(() => document.getElementById('cf_unitPrice').value);

  // 9. 提交保存（新增一条）→ 记录数增加
  const countCharges = () => page.evaluate(() => {
    const raw = localStorage.getItem('ev_charging_data_v1');
    if (!raw) return 0;
    try { return JSON.parse(raw).charges.length; } catch (e) { return 0; }
  });
  const before = await countCharges();
  await page.fill('#cf_date', '2026-09-14');
  await page.click('#chargeFormPage-form button[type=submit]');
  await page.waitForTimeout(600);
  const after = await countCharges();
  out.saveResult = { before, after, closed: await page.evaluate(() => !document.getElementById('chargeFormPage').classList.contains('show')) };

  // 10. 删除刚新增的记录（还原数据）
  await page.evaluate(() => {
    const raw = localStorage.getItem('ev_charging_data_v1');
    const data = JSON.parse(raw);
    const idx = data.charges.findIndex(c => c.date === '2026-09-14' && c.kWh === 50);
    if (idx >= 0) data.charges.splice(idx, 1);
    localStorage.setItem('ev_charging_data_v1', JSON.stringify(data));
  });
  await page.evaluate(() => App.renderAll());

  // 11. 分析页：图表点击
  await page.evaluate(() => App.switchTab('analysis'));
  await page.waitForTimeout(400);
  out.analysis = await page.evaluate(() => {
    return {
      lineCircles: document.querySelectorAll('.line-chart-dark circle').length,
      donutSvg: document.querySelectorAll('.donut-svg-dark').length,
      ringSvg: document.querySelectorAll('.battery-ring-svg-dark').length,
      circleOnclick: document.querySelectorAll('.line-chart-dark circle[onclick]').length,
      donutOnclick: document.querySelectorAll('.donut-svg-dark[onclick]').length,
      ringOnclick: document.querySelectorAll('.battery-ring-svg-dark[onclick]').length
    };
  });
  await page.evaluate(() => { const c = document.querySelector('.line-chart-dark circle'); if (c) c.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(300);
  out.lineClickSheet = await page.evaluate(() => document.getElementById('dataSheet').classList.contains('show'));
  await page.evaluate(() => App.closeChartSheet());

  // 12. 移动端溢出检查（设置页）
  await page.evaluate(() => App.switchTab('profile'));
  await page.waitForTimeout(400);
  out.mobileOverflow = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.settings-row-dark')).slice(0, 3).map(r => {
      const label = r.querySelector('.sr-label');
      const value = r.querySelector('.sr-value');
      return label ? {
        label: label.textContent.slice(0, 12),
        labelOverflow: label.scrollWidth > label.clientWidth + 1,
        valueOverflow: value ? value.scrollWidth > value.clientWidth + 1 : null
      } : null;
    });
  });

  // 13. KPI 卡片文本对齐
  await page.evaluate(() => App.switchTab('home'));
  await page.waitForTimeout(300);
  out.kpiAlign = await page.evaluate(() => {
    const el = document.querySelector('.kpi-dark .kpi-label');
    return el ? getComputedStyle(el).textAlign : 'MISSING';
  });

  out.errors = errors.slice(0, 5);
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
