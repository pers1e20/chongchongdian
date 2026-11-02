/* 需求3 最终验证：addInitScript 种子数据 + 单一交互，避免 history 竞态 */
const { chromium } = require('/Users/hanchong/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.addInitScript(() => {
    const t = new Date();
    const ym = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0');
    localStorage.setItem('ev_charging_data_v1', JSON.stringify({
      vehicles: [{ id: 'testV', name: '测试车', brand: '', model: 'TEST', spec: '', maxChargePower: 100, isCurrent: true }],
      charges: [{ id: 'c1', vehicleId: 'testV', date: ym + '-05', chargeType: 'fast', kWh: 42.5, unitPrice: 1.28, totalCost: 54.40, socBefore: 20, socAfter: 85, odometer: 15000, note: '测试记录' }],
      settings: { currentVehicleId: 'testV' }
    }));
  });

  await page.goto('http://127.0.0.1:8080/charging-tracker.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const out = {};
  await page.evaluate(() => App.switchTab('home')); await page.waitForTimeout(400);

  // 点击数据柱
  await page.evaluate(() => {
    const bars = Array.from(document.querySelectorAll('.mini-chart .bar'));
    const target = bars.find(b => b.getAttribute('title') && b.getAttribute('title') !== '¥0.00' && b.getAttribute('title') !== '0.00') || bars[bars.length - 1];
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    target.setAttribute('data-picked', target.getAttribute('title'));
  });
  await page.waitForTimeout(500);
  out.monthDetail = await page.evaluate(() => {
    const sheet = document.getElementById('dataSheet');
    return {
      pickedTitle: document.querySelector('.mini-chart .bar[data-picked]')?.getAttribute('data-picked'),
      sheetShow: sheet.classList.contains('show'),
      headTitle: sheet.querySelector('.data-sheet-head h3')?.textContent,
      headSub: sheet.querySelector('.data-sheet-head .ds-sub')?.textContent,
      heroValue: sheet.querySelector('.ds-hero .dh-value')?.textContent,
      heroSub: sheet.querySelector('.ds-hero .dh-sub')?.textContent,
      cells: Array.from(sheet.querySelectorAll('.ds-cell .dc-label')).map(l => l.textContent)
    };
  });
  await page.screenshot({ path: '/Users/hanchong/Desktop/项目文件/充电 BETA/冲充电/.screenshots/v4-chart-month-sheet.png' });

  console.log(JSON.stringify(out, null, 2));
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})();