/* 需求1-9 全面验证脚本 */
const { chromium } = require('/Users/hanchong/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto('http://127.0.0.1:8080/charging-tracker.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const out = {};

  // 需求1: 底部导航栏中央+按钮
  out.need1_tabAddBtn = await page.evaluate(() => {
    const btn = document.querySelector('.tab-add-btn');
    if (!btn) return { exists: false };
    return { exists: true, ariaLabel: btn.getAttribute('aria-label'), hasOnclick: btn.hasAttribute('onclick') };
  });

  // 需求2: 首页顶部仅标题，无侧按钮
  out.need2_homeNav = await page.evaluate(() => {
    App.switchTab('home');
    return new Promise(resolve => {
      setTimeout(() => {
        const nav = document.querySelector('#panel-home .home-nav-dark');
        if (!nav) return resolve({ found: false });
        const buttons = nav.querySelectorAll('button, .nav-btn, .nav-action');
        const title = nav.querySelector('.nav-title')?.textContent;
        resolve({ found: true, title, buttonCount: buttons.length });
      }, 300);
    });
  });

  // 需求3: 记录页无返回/新增/悬浮按钮
  out.need3_recordsClean = await page.evaluate(() => {
    App.switchTab('records');
    return new Promise(resolve => {
      setTimeout(() => {
        const nav = document.querySelector('#panel-records .home-nav-dark');
        const navButtons = nav ? nav.querySelectorAll('button') : [];
        const fab = document.querySelector('.records-fab');
        const addBtn = document.querySelector('.records-add-btn');
        resolve({
          navButtonCount: navButtons.length,
          hasFab: !!fab,
          hasAddBtn: !!addBtn
        });
      }, 300);
    });
  });

  // 需求4: 点击记录→半屏弹窗展示详情+编辑/删除
  out.need4_chargeDetail = await page.evaluate(() => {
    const item = document.querySelector('.history-item-dark');
    if (!item) return { hasItem: false };
    item.click();
    return new Promise(resolve => {
      setTimeout(() => {
        const sheet = document.getElementById('dataSheet');
        const head = sheet?.querySelector('.data-sheet-head');
        const editBtn = head?.querySelector('.ds-icon-btn:not(.ds-danger)');
        const delBtn = head?.querySelector('.ds-icon-btn.ds-danger');
        const closeBtn = head?.querySelector('.ds-close-btn');
        const heroValue = sheet?.querySelector('.ds-hero .dh-value')?.textContent;
        const cells = sheet?.querySelectorAll('.ds-cell')?.length;
        resolve({
          hasItem: true,
          sheetShow: sheet?.classList.contains('show'),
          headTitle: head?.querySelector('h3')?.textContent,
          hasEditBtn: !!editBtn,
          hasDelBtn: !!delBtn,
          hasCloseBtn: !!closeBtn,
          heroValue,
          cellCount: cells
        });
      }, 400);
    });
  });

  // 关闭弹窗
  await page.evaluate(() => App.closeChargeDetail());
  await page.waitForTimeout(200);

  // 需求5: 充电记录图标区分+低饱和度
  out.need5_recordIcons = await page.evaluate(() => {
    const items = document.querySelectorAll('.history-item-dark');
    if (!items.length) return { count: 0 };
    const first = items[0];
    const icon = first.querySelector('.hi-icon');
    const kwh = first.querySelector('.hi-kwh');
    const tag = first.querySelector('.hi-tag');
    const amount = first.querySelector('.hi-amount');
    const iconClass = icon?.className || '';
    const tagClass = tag?.className || '';
    const computedIconBg = icon ? getComputedStyle(icon).background : '';
    return {
      count: items.length,
      hasIcon: !!icon,
      iconClass,
      hasKwh: !!kwh,
      kwhText: kwh?.textContent,
      hasTag: !!tag,
      tagClass,
      tagText: tag?.textContent,
      hasAmount: !!amount,
      amountText: amount?.textContent,
      computedIconBg: computedIconBg.substring(0, 80)
    };
  });

  // 需求6: 新增充电页背景不透明
  out.need6_opaqueBg = await page.evaluate(() => {
    App.openChargePage();
    return new Promise(resolve => {
      setTimeout(() => {
        const overlay = document.getElementById('chargeFormPage');
        const cs = getComputedStyle(overlay);
        const bg = cs.background;
        const bgSolid = cs.backgroundColor;
        resolve({
          visible: overlay.classList.contains('show'),
          background: bg.substring(0, 120),
          backgroundColor: bgSolid,
          isOpaque: !bgSolid.includes('0.8') && !bgSolid.includes('0.7') && !bgSolid.includes('0.6') && !bgSolid.includes('0.5')
        });
      }, 300);
    });
  });

  // 关闭表单页
  await page.evaluate(() => App.closeChargePage());
  await page.waitForTimeout(200);

  // 需求7+8: 分析页无顶部导航按钮 + 3 tab + 年份筛选
  out.need78_analysis = await page.evaluate(() => {
    App.switchTab('analysis');
    return new Promise(resolve => {
      setTimeout(() => {
        const panel = document.getElementById('panel-analysis');
        const nav = panel.querySelector('.home-nav-dark');
        const navButtons = nav ? nav.querySelectorAll('button') : [];
        const segItems = panel.querySelectorAll('.seg-dark .seg-item');
        const segLabels = Array.from(segItems).map(s => s.textContent.trim());
        const yearChips = panel.querySelectorAll('.year-chip-dark');
        const yearLabels = Array.from(yearChips).map(c => c.textContent.trim());
        const oldPeriodSeg = panel.querySelector('#analysisPeriodSegment');
        resolve({
          navButtonCount: navButtons.length,
          segCount: segItems.length,
          segLabels,
          yearChipCount: yearChips.length,
          yearLabels,
          hasOldPeriodSeg: !!oldPeriodSeg
        });
      }, 400);
    });
  });

  // 需求9: 首页KPI半屏弹窗使用dataSheet
  out.need9_kpiSheet = await page.evaluate(() => {
    App.switchTab('home');
    return new Promise(resolve => {
      setTimeout(() => {
        const statMini = document.querySelector('.stat-mini-dark[onclick*="showStatDetail"]');
        if (!statMini) return resolve({ hasStatMini: false });
        statMini.click();
        setTimeout(() => {
          const sheet = document.getElementById('dataSheet');
          const statModal = document.getElementById('statDetailModal');
          const head = sheet?.querySelector('.data-sheet-head');
          const hero = sheet?.querySelector('.ds-hero');
          const heroValue = hero?.querySelector('.dh-value')?.textContent;
          const cells = sheet?.querySelectorAll('.ds-cell')?.length;
          resolve({
            hasStatMini: true,
            sheetShow: sheet?.classList.contains('show'),
            statModalShown: statModal?.classList.contains('show'),
            headTitle: head?.querySelector('h3')?.textContent,
            hasHero: !!hero,
            heroValue,
            cellCount: cells
          });
        }, 400);
      }, 300);
    });
  });

  // 截图
  await page.evaluate(() => App.closeChartSheet());
  await page.waitForTimeout(200);
  await page.evaluate(() => App.switchTab('records'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/Users/hanchong/Desktop/项目文件/充电 BETA/冲充电/.screenshots/v3-records.png' });

  await page.evaluate(() => App.switchTab('home'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/Users/hanchong/Desktop/项目文件/充电 BETA/冲充电/.screenshots/v3-home.png' });

  await page.evaluate(() => App.switchTab('analysis'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/Users/hanchong/Desktop/项目文件/充电 BETA/冲充电/.screenshots/v3-analysis.png' });

  // 底部导航栏截图
  await page.screenshot({ path: '/Users/hanchong/Desktop/项目文件/充电 BETA/冲充电/.screenshots/v3-tabbar.png' });

  console.log(JSON.stringify(out, null, 2));
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})();
