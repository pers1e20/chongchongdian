/* 弹层内容与视觉验证 */
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

  // 1. 点击 8月 柱（有数据）→ 弹层明细
  await page.evaluate(() => {
    const bars = Array.from(document.querySelectorAll('.mini-chart .bar'));
    const b = bars.find(x => x.getAttribute('title') === '102.59');
    b.click();
  });
  await page.waitForTimeout(400);
  out.monthSheet = await page.evaluate(() => {
    const ds = document.getElementById('dataSheet');
    return {
      show: ds.classList.contains('show'),
      title: document.getElementById('dsTitle').textContent,
      sub: document.getElementById('dsSub').textContent,
      hero: document.querySelector('.ds-hero .dh-value')?.textContent,
      cells: Array.from(document.querySelectorAll('.ds-cell')).map(c => c.textContent.trim().replace(/\s+/g, ' '))
    };
  });
  await page.screenshot({ path: '/Users/hanchong/Desktop/项目文件/充电 BETA/冲充电/.screenshots/fix-month-sheet.png' });
  await page.evaluate(() => App.closeChartSheet());
  await page.waitForTimeout(200);

  // 2. 点击空数据月份（4月）→ 缺省态
  await page.evaluate(() => {
    const bars = Array.from(document.querySelectorAll('.mini-chart .bar'));
    bars[0].click();
  });
  await page.waitForTimeout(300);
  out.emptySheet = await page.evaluate(() => {
    const e = document.querySelector('.ds-empty');
    return { empty: !!e, title: e ? e.querySelector('.de-title').textContent : null, sub: e ? e.querySelector('.de-sub').textContent : null };
  });
  await page.evaluate(() => App.closeChartSheet());

  // 3. 分析页 → 环形图 + 电池环
  await page.evaluate(() => App.switchTab('analysis'));
  await page.waitForTimeout(400);
  await page.evaluate(() => { const el = document.querySelector('.donut-svg-dark'); if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(300);
  out.donutSheet = await page.evaluate(() => {
    return {
      show: document.getElementById('dataSheet').classList.contains('show'),
      title: document.getElementById('dsTitle').textContent,
      hero: document.querySelector('.ds-hero .dh-value')?.textContent,
      cells: Array.from(document.querySelectorAll('.ds-cell')).map(c => c.textContent.trim().replace(/\s+/g, ' '))
    };
  });
  await page.screenshot({ path: '/Users/hanchong/Desktop/项目文件/充电 BETA/冲充电/.screenshots/fix-donut-sheet.png' });
  await page.evaluate(() => App.closeChartSheet());
  await page.waitForTimeout(200);

  await page.evaluate(() => { const r = document.querySelector('.battery-ring-svg-dark'); if (r) r.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(300);
  out.batterySheet = await page.evaluate(() => {
    return {
      show: document.getElementById('dataSheet').classList.contains('show'),
      title: document.getElementById('dsTitle').textContent,
      hero: document.querySelector('.ds-hero .dh-value')?.textContent,
      cells: Array.from(document.querySelectorAll('.ds-cell')).map(c => c.textContent.trim().replace(/\s+/g, ' '))
    };
  });
  await page.screenshot({ path: '/Users/hanchong/Desktop/项目文件/充电 BETA/冲充电/.screenshots/fix-battery-sheet.png' });
  await page.evaluate(() => App.closeChartSheet());
  await page.waitForTimeout(200);

  // 4. 分析页趋势线圆点点击（第 8 个点 = 8月）
  await page.evaluate(() => {
    const circles = Array.from(document.querySelectorAll('.line-chart-dark circle'));
    const c = circles.find(x => x.getAttribute('onclick') && x.getAttribute('onclick').includes("'2026-08'"));
    if (c) c.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(300);
  out.lineSheet = await page.evaluate(() => {
    return {
      show: document.getElementById('dataSheet').classList.contains('show'),
      title: document.getElementById('dsTitle').textContent,
      hero: document.querySelector('.ds-hero .dh-value')?.textContent
    };
  });
  await page.screenshot({ path: '/Users/hanchong/Desktop/项目文件/充电 BETA/冲充电/.screenshots/fix-line-sheet.png' });
  await page.evaluate(() => App.closeChartSheet());

  // 5. 数据还原确认
  out.chargeCount = await page.evaluate(() => {
    const raw = localStorage.getItem('ev_charging_data_v1');
    return JSON.parse(raw).charges.length;
  });

  out.errors = errors.slice(0, 5);
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
