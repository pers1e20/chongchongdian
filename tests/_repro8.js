/* 需求「应用问题 1/2/3」复现：先跑一次，看当前未修复前状态 */
const { chromium } = require('/Users/hanchong/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto('http://127.0.0.1:8080/charging-tracker.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const snap = await page.evaluate(() => {
    const q = s => document.querySelector(s);
    const vis = el => { if (!el) return null; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      return { show: el.classList.contains('show'), active: el.classList.contains('active'), display: cs.display, opacity: cs.opacity, r: { t: r.top, b: r.bottom, l: r.left, w: r.width } }; };
    // 顶部可见的 nav 元素（top < 90）
    const topEls = Array.from(document.querySelectorAll('.home-nav-dark *, .page-header *')).filter(el => {
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.top < 90;
    }).map(el => ({ tag: el.tagName, cls: el.className, txt: (el.textContent||'').trim().slice(0,14), r: { l: Math.round(el.getBoundingClientRect().left), r: Math.round(el.getBoundingClientRect().right), t: Math.round(el.getBoundingClientRect().top) } }))
     .filter((e,i,a)=>a.findIndex(x=>x.cls===e.cls&&x.txt===e.txt)===i);
    return {
      chargeFormShow: q('#chargeFormPage')?.classList.contains('show'),
      chargeFormTitle: q('#chargeFormPageTitle')?.textContent,
      panelHomeActive: q('#panel-home')?.classList.contains('active'),
      panelRecordsActive: q('#panel-records')?.classList.contains('active'),
      panelAnalysisActive: q('#panel-analysis')?.classList.contains('active'),
      topEls
    };
  });
  console.log('首屏快照:', JSON.stringify(snap, null, 2));
  await page.screenshot({ path: '/Users/hanchong/Desktop/项目文件/充电 BETA/冲充电/.screenshots/repro-before-1.png' });

  // 模拟用户：若覆盖层强制打开，记录其返回前状态；点击返回按钮
  await page.evaluate(() => {
    // 记录当前 history 长度
    window.__histLen = history.length;
  });
  const hasBack = await page.evaluate(() => !!document.querySelector('#chargeFormPage.show .page-back-btn'));
  let afterBack = null;
  if (hasBack) {
    await page.evaluate(() => document.querySelector('#chargeFormPage .page-back-btn').click());
    await page.waitForTimeout(500);
    afterBack = await page.evaluate(() => {
      const q = s=>document.querySelector(s);
      return { chargeFormShow: q('#chargeFormPage').classList.contains('show'),
               homeActive: q('#panel-home').classList.contains('active'),
               recordsActive: q('#panel-records').classList.contains('active'),
               visiblePanel: Array.from(document.querySelectorAll('.tab-panel')).filter(p=>getComputedStyle(p).display!=='none').map(p=>p.id) };
    });
    await page.screenshot({ path: '/Users/hanchong/Desktop/项目文件/充电 BETA/冲充电/.screenshots/repro-after-back.png' });
  }
  console.log('点击返回后:', JSON.stringify(afterBack, null, 2));
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})();