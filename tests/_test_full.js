/* 完整回归测试：确保 需求「应用问题1/2/3」修复后无回归
   覆盖：启动首屏 / 四个页签 / 记录列表渲染 / 详情弹层(编辑/关闭) / 删除 / 新增表单 / 保存 / 浏览器返回 / 首页右上角无多余元素 */
const { chromium } = require('/Users/hanchong/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  // 种子数据：1 辆车 + 2 条充电记录（一条在本月），使各页有数据可断言
  await page.addInitScript(() => {
    const t = new Date();
    let yM = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0');
    const prev = new Date(t.getFullYear(), t.getMonth() - 1, 15);
    const pM = prev.getFullYear() + '-' + String(prev.getMonth() + 1).padStart(2, '0');
    localStorage.setItem('ev_charging_data_v1', JSON.stringify({
      vehicles: [{ id: 'vSeed', name: '智己 L6', brand: '智己', model: 'L6', spec: '', maxChargePower: 100, isCurrent: true }],
      charges: [
        { id: 'cCur', vehicleId: 'vSeed', date: yM + '-12', chargeType: 'fast', kWh: 42.5, unitPrice: 1.28, totalCost: 54.40, socBefore: 20, socAfter: 85, odometer: 15000, note: '本月快充记录' },
        { id: 'cPrev', vehicleId: 'vSeed', date: pM + '-20', chargeType: 'slow', kWh: 30.0, unitPrice: 0.60, totalCost: 18.00, socBefore: 10, socAfter: 100, odometer: 14800, note: '上月慢充记录' }
      ],
      settings: { currentVehicleId: 'vSeed', filters: {} }
    }));
  });

  await page.goto('http://127.0.0.1:8080/charging-tracker.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const results = [];
  function check(name, cond, extra) { results.push({ name, ok: !!cond, extra: extra || '' }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  | ' + extra : '')); }
  const q = s => page.evaluate(sel => document.querySelector(sel), s);

  /* ========== 1. 启动首屏 ========== */
  let S = await page.evaluate(() => ({
    formShow: document.querySelector('#chargeFormPage').classList.contains('show'),
    homeActive: document.querySelector('#panel-home').classList.contains('active'),
    recordsActive: document.querySelector('#panel-records').classList.contains('active'),
    tabActive: document.querySelector('.tabbar-dark .tab-item.active')?.dataset.tab,
    hero: document.querySelector('.home-hero-dark .amount')?.textContent,
    heroSub: document.querySelector('.home-hero-dark .hero-sub')?.textContent,
    navEls: Array.from(document.querySelectorAll('#panel-home .home-nav-dark *')).map(e => e.className),
    anyChart: !!document.querySelector('#panel-home .mini-chart')
  }));
  check('问题1: 首屏不自动弹出添加记录页', S.formShow === false, 'formShow=' + S.formShow);
  check('首屏默认显示首页', S.homeActive === true && S.recordsActive === false, 'home=' + S.homeActive + ' records=' + S.recordsActive);
  check('问题3: 首页右上角无多余元素(仅居中标题)', S.navEls.length === 1 && S.navEls[0] === 'nav-title', JSON.stringify(S.navEls));
  check('启动时底部导航高亮「首页」', S.tabActive === 'home', 'tabActive=' + S.tabActive);
  check('首页数据正常渲染(非0)', S.hero && !/^¥0/.test(S.hero || ''), 'hero=' + S.hero);
  await page.screenshot({ path: '/Users/hanchong/Desktop/项目文件/充电 BETA/冲充电/.screenshots/full-1-home.png' });

  /* ========== 2. 记录页 ========== */
  await page.click('.tabbar-dark .tab-item[data-tab="records"]');
  await page.waitForTimeout(600);
  let R = await page.evaluate(() => ({
    active: document.querySelector('#panel-records').classList.contains('active'),
    navEls: Array.from(document.querySelectorAll('#panel-records .home-nav-dark *')).map(e => e.className),
    items: document.querySelectorAll('#panel-records .history-item-dark').length,
    staticResidual: document.querySelectorAll('#panel-records .history-item-dark').length,
    anyOldDate: document.querySelector('#panel-records')?.textContent.includes('5月30日')
  }));
  check('记录页可正常进入', R.active === true);
  check('记录页顶栏仅标题(无多余按钮)', JSON.stringify(R.navEls) === JSON.stringify(['nav-title']), JSON.stringify(R.navEls));
  check('记录列表按数据渲染(2条)', R.items === 2, 'items=' + R.items);
  check('不残留上月默认种子旧数据', R.anyOldDate !== true);
  // 单条布局：度数/快慢充/日期都有
  let item = await page.evaluate(() => {
    const el = document.querySelector('#panel-records .history-item-dark');
    if (!el) return null;
    return { kwh: el.querySelector('.hi-kwh')?.textContent, tag: el.querySelector('.hi-tag')?.textContent, date: el.querySelector('.hi-date-val')?.textContent, amount: el.querySelector('.hi-amount')?.textContent };
  });
  check('记录单条布局完整(度·快慢充·日期·金额)', item && item.kwh && item.tag && item.date && item.amount, JSON.stringify(item));
  await page.screenshot({ path: '/Users/hanchong/Desktop/项目文件/充电 BETA/冲充电/.screenshots/full-2-records.png' });

  /* ========== 3. 详情弹层 ========== */
  await page.click('#panel-records .history-item-dark');
  await page.waitForTimeout(500);
  let D = await page.evaluate(() => {
    const s = document.querySelector('#dataSheet');
    return { show: s.classList.contains('show'), head: s.querySelector('.data-sheet-head h3')?.textContent, hero: s.querySelector('.ds-hero .dh-value')?.textContent, hasEdit: !!s.querySelector('.ds-action-row .ds-icon-btn'), cells: s.querySelectorAll('.ds-cell .dc-label').length };
  });
  check('点击记录弹出详情(半屏)', D.show === true && D.head === '充电详情', JSON.stringify(D));
  check('详情含编辑按钮', D.hasEdit === true);
  await page.screenshot({ path: '/Users/hanchong/Desktop/项目文件/充电 BETA/冲充电/.screenshots/full-3-detail.png' });

  /* 详情 - 编辑入口打开编辑页覆盖层 */
  await page.evaluate(() => document.querySelector('#dataSheet .ds-action-row .ds-icon-btn').click());
  await page.waitForTimeout(500);
  let E = await page.evaluate(() => ({ show: document.querySelector('#chargeFormPage').classList.contains('show'), title: document.querySelector('#chargeFormPageTitle').textContent, v: document.querySelector('#cf_totalCost').value }));
  check('详情→编辑打开添加记录页(标题=编辑)', E.show === true && E.title === '编辑充电记录', JSON.stringify(E));
  // 编辑页返回按钮
  await page.evaluate(() => document.querySelector('#chargeFormPage .page-back-btn').click());
  await page.waitForTimeout(500);
  let Back = await page.evaluate(() => ({ formShow: document.querySelector('#chargeFormPage').classList.contains('show'), detailShow: document.querySelector('#dataSheet').classList.contains('show') }));
  check('编辑页返回后关闭覆盖层', Back.formShow === false);

  /* 删除（重新打开详情，走详情删除，确认弹窗） */
  await page.click('#panel-records .history-item-dark');
  await page.waitForTimeout(450);
  await page.evaluate(() => document.querySelector('#dataSheet .ds-action-row .ds-icon-btn.ds-danger').click());
  await page.waitForTimeout(400);
  const modal = await page.evaluate(() => document.getElementById('confirmModal')?.classList.contains('show'));
  if (modal) { await page.click('#confirmOkBtn'); }
  await page.waitForTimeout(600);
  let afterDel = await page.evaluate(() => ({ items: document.querySelectorAll('#panel-records .history-item-dark').length, detailShow: document.querySelector('#dataSheet').classList.contains('show') }));
  check('删除记录后列表更新(2→1)', afterDel.items === 1, 'items=' + afterDel.items);

  /* 关闭详情 */
  await page.evaluate(() => { const c = document.querySelector('#dataSheet .ds-close-btn'); c && c.click(); });
  await page.waitForTimeout(300);

  /* ========== 4. 新增充电记录 ========== */
  await page.click('.tabbar-dark .tab-add-btn');
  await page.waitForTimeout(500);
  let F = await page.evaluate(() => ({ show: document.querySelector('#chargeFormPage').classList.contains('show'), title: document.querySelector('#chargeFormPageTitle').textContent }));
  check('问题: 点底部+可打开新增页', F.show === true && F.title === '添加充电记录', JSON.stringify(F));
  await page.screenshot({ path: '/Users/hanchong/Desktop/项目文件/充电 BETA/冲充电/.screenshots/full-4-form.png' });

  // 填表并保存（度数→自动算费用）
  await page.fill('#cf_kWh', '50');
  await page.fill('#cf_unitPrice', '1.20');
  await page.waitForTimeout(200);
  let costAuto = await page.inputValue('#cf_totalCost');
  check('互算: 度数×单价=总费用', Math.abs(parseFloat(costAuto) - 60) < 0.01, 'cost=' + costAuto);
  await page.click('#chargeFormPage-form .btn-accent');
  await page.waitForTimeout(700);
  let Saved = await page.evaluate(() => ({
    formShow: document.querySelector('#chargeFormPage').classList.contains('show'),
    tab: document.querySelector('.tabbar-dark .tab-item.active')?.dataset.tab,
    toast: document.querySelector('.toast')?.textContent
  }));
  check('保存后覆盖层关闭', Saved.formShow === false);
  check('保存后返回进入时所在页(记录)', Saved.tab === 'records', 'tab=' + Saved.tab);
  await page.screenshot({ path: '/Users/hanchong/Desktop/项目文件/充电 BETA/冲充电/.screenshots/full-5-after-save.png' });

  /* ========== 5. 浏览器返回（popstate）关闭新增页 ========== */
  await page.click('.tabbar-dark .tab-add-btn');
  await page.waitForTimeout(400);
  const opened = await page.evaluate(() => document.querySelector('#chargeFormPage').classList.contains('show'));
  await page.goBack();
  await page.waitForTimeout(500);
  let Pop = await page.evaluate(() => ({ formShow: document.querySelector('#chargeFormPage').classList.contains('show'), visible: document.querySelector('.tab-panel.active')?.id }));
  check('浏览器返回优先关闭新增页(不退出应用)', opened === true && Pop.formShow === false, 'before=' + opened + ' afterFormShow=' + Pop.formShow);

  /* ========== 6. 分析页 ========== */
  await page.click('.tabbar-dark .tab-item[data-tab="analysis"]');
  await page.waitForTimeout(600);
  let A = await page.evaluate(() => ({ active: document.querySelector('#panel-analysis').classList.contains('active'), hasChart: !!document.querySelector('#panel-analysis svg'), cards: document.querySelectorAll('#panel-analysis .stat-card').length }));
  check('分析页可正常进入并渲染', A.active === true && (A.hasChart || A.cards > 0), JSON.stringify(A));
  await page.screenshot({ path: '/Users/hanchong/Desktop/项目文件/充电 BETA/冲充电/.screenshots/full-6-analysis.png' });

  /* ========== 7. 我的页 ========== */
  await page.click('.tabbar-dark .tab-item[data-tab="profile"]');
  await page.waitForTimeout(500);
  let P = await page.evaluate(() => ({ active: document.querySelector('#panel-profile').classList.contains('active'), vehicle: document.querySelector('#panel-profile').textContent.includes('智己') }));
  check('我的页可正常进入并显示车型', P.active === true && P.vehicle === true, JSON.stringify(P));
  await page.screenshot({ path: '/Users/hanchong/Desktop/项目文件/充电 BETA/冲充电/.screenshots/full-7-profile.png' });

  console.log('\n===== SUMMARY =====');
  const fail = results.filter(r => !r.ok);
  console.log('通过 ' + (results.length - fail.length) + ' / ' + results.length);
  if (fail.length) fail.forEach(f => console.log('  FAIL: ' + f.name));
  console.log('JS ERRORS:', errors.length ? errors : 'none');
  await browser.close();
  process.exit(fail.length ? 1 : 0);
})();