/* 重新验证保存按钮悬浮固定 + 干净截图 */
const { chromium } = require('/Users/hanchong/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.goto('http://127.0.0.1:8080/charging-tracker.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.evaluate(() => App.openChargePage());
  await page.waitForTimeout(900); // 等滑动动画 + 可能的 toast 消失

  // 滚动到中间，检查保存按钮是否悬浮（滚动后仍贴底）
  await page.evaluate(() => {
    const body = document.querySelector('#chargeFormPage');
    if (body) body.scrollTop = 400;
  });
  await page.waitForTimeout(300);

  const state = await page.evaluate(() => {
    const bar = document.querySelector('#chargeFormPage-form .record-btn-row');
    const btn = document.querySelector('#chargeFormPage-form .btn-accent');
    if (!bar || !btn) return { missing: true };
    const br = bar.getBoundingClientRect();
    const btnr = btn.getBoundingClientRect();
    const toasts = Array.from(document.querySelectorAll('.toast, [class*=toast]')).map(t => {
      const tr = t.getBoundingClientRect();
      return { visible: tr.height > 0, bottom: Math.round(tr.bottom), text: (t.textContent||'').trim().slice(0,20) };
    });
    return {
      barPosition: getComputedStyle(bar).position,
      barZ: getComputedStyle(bar).zIndex,
      barBottomOffset: Math.round(innerHeight - br.bottom),
      btnHeight: Math.round(btnr.height),
      btnWidth: Math.round(btnr.width),
      overlapToast: toasts.filter(t => t.visible && t.bottom >= br.top)
    };
  });

  await page.screenshot({ path: '/Users/hanchong/Desktop/项目文件/充电 BETA/冲充电/.screenshots/verify7-save-floating.png' });
  console.log(JSON.stringify({ state, errors }, null, 2));
  await browser.close();
})();