/* 保存按钮悬浮固定验证 */
const { chromium } = require('/Users/hanchong/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.goto('http://127.0.0.1:8080/charging-tracker.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.evaluate(() => App.openChargePage());
  await page.waitForTimeout(400);
  // 滚动到顶部检查按钮位置
  await page.evaluate(() => { document.getElementById('chargeFormPage').scrollTop = 0; });
  await page.waitForTimeout(200);
  const atTop = await page.evaluate(() => {
    const bar = document.querySelector('#chargeFormPage-form .record-btn-row');
    const cs = getComputedStyle(bar);
    const r = bar.getBoundingClientRect();
    const btn = document.querySelector('#chargeFormPage-form .btn-accent');
    return {
      position: cs.position, zIndex: cs.zIndex, bottom: r.bottom,
      viewportH: window.innerHeight,
      btnVisible: btn.getBoundingClientRect().height > 0,
      btnBottomOfViewport: Math.round(r.bottom - window.innerHeight)
    };
  });
  // 滚动到底部检查按钮仍固定
  await page.evaluate(() => { document.getElementById('chargeFormPage').scrollTop = 9999; });
  await page.waitForTimeout(200);
  const atBottom = await page.evaluate(() => {
    const r = document.querySelector('#chargeFormPage-form .record-btn-row').getBoundingClientRect();
    return { positionFixedStable: Math.round(r.bottom - window.innerHeight) };
  });
  await page.screenshot({ path: '/Users/hanchong/Desktop/项目文件/充电 BETA/冲充电/.screenshots/v4-floating-save.png' });
  console.log(JSON.stringify({ atTop, atBottom, errors }, null, 2));
  await browser.close();
})();