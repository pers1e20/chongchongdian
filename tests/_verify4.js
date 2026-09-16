/* 需求1-3 验证脚本（静默关闭表单，避免 history 导航干扰） */
const { chromium } = require('/Users/hanchong/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto('http://127.0.0.1:8080/charging-tracker.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const out = {};

  const centerGap = () => page.evaluate(() => {
    const nav = document.querySelector('#panel-' + App.currentTab + ' .home-nav-dark');
    const title = nav.querySelector('.nav-title');
    const r = nav.getBoundingClientRect();
    const t = title.getBoundingClientRect();
    return { title: title.textContent, centerGap: Math.round(Math.abs((t.left + t.width / 2) - (r.left + r.width / 2))) };
  });

  // 需求1: 各页标题居中
  await page.evaluate(() => App.switchTab('home')); await page.waitForTimeout(250);
  out.need1_home = await centerGap();
  await page.evaluate(() => App.switchTab('records')); await page.waitForTimeout(250);
  out.need1_records = await centerGap();
  await page.evaluate(() => App.switchTab('analysis')); await page.waitForTimeout(250);
  out.need1_analysis = await centerGap();
  await page.evaluate(() => App.switchTab('profile')); await page.waitForTimeout(250);
  out.need1_profile = await centerGap();

  // 需求2: 表单结构 + 成本预览 + 截图
  out.need2_chargeForm = await page.evaluate(() => {
    App.openChargePage();
    return new Promise(res => {
      setTimeout(() => {
        const exists = id => !!document.getElementById(id);
        const formLists = document.querySelectorAll('#chargeFormPage-form .form-list-dark').length;
        const groupTitles = Array.from(document.querySelectorAll('#chargeFormPage-form .form-group-title-dark')).map(e => e.textContent.trim());
        const hasSeg = !!document.querySelector('#cf_chargeTypeSegment .form-segment-btn.active');
        const previewInitial = document.getElementById('cf_costPreview').textContent;
        document.getElementById('cf_kWh').value = '42.5';
        document.getElementById('cf_unitPrice').value = '1.28';
        App.refreshCostPreview();
        res({
          formLists, groupTitles, hasSeg, previewInitial,
          previewAfterInput: document.getElementById('cf_costPreview').textContent,
          previewDetail: document.getElementById('cf_costPreviewDetail').textContent,
          ids: { date: exists('cf_date'), kWh: exists('cf_kWh'), unitPrice: exists('cf_unitPrice'), totalCost: exists('cf_totalCost'), socB: exists('cf_socBefore'), socA: exists('cf_socAfter'), odo: exists('cf_odometer'), note: exists('cf_note') },
          hasAccentBtn: !!document.querySelector('#chargeFormPage-form .btn-accent'),
          hasSummaryCard: !!document.querySelector('#chargeFormPage-form .record-summary-dark')
        });
      }, 350);
    });
  });
  await page.screenshot({ path: '/Users/hanchong/Desktop/项目文件/充电 BETA/冲充电/.screenshots/v4-charge-form.png' });
  await page.evaluate(() => App.closeChargePage(true));
  await page.waitForTimeout(250);

  // 需求3: 首页柱状图点击 → 当月数据
  await page.evaluate(() => App.switchTab('home')); await page.waitForTimeout(300);
  out.need3_homeBar = await page.evaluate(() => {
    return new Promise(res => {
      const bars = Array.from(document.querySelectorAll('.mini-chart .bar'));
      if (!bars.length) return res({ hasBars: false });
      const target = bars.find(b => b.getAttribute('title') && b.getAttribute('title') !== '¥0.00') || bars[bars.length - 1];
      target.click();
      setTimeout(() => {
        const sheet = document.getElementById('dataSheet');
        res({
          hasBars: true, clickedTitle: target.getAttribute('title'),
          sheetShow: sheet.classList.contains('show'),
          headSub: sheet.querySelector('.data-sheet-head .ds-sub')?.textContent,
          heroValue: sheet.querySelector('.ds-hero .dh-value')?.textContent,
          cellCount: sheet.querySelectorAll('.ds-cell').length
        });
      }, 400);
    });
  });
  await page.evaluate(() => App.closeChartSheet()); await page.waitForTimeout(200);

  // 需求3: 先开统计弹层再点图表，验证头部重建
  out.need3_afterStatThenBar = await page.evaluate(() => {
    return new Promise(res => {
      const stat = document.querySelector('.stat-mini-dark[onclick*="showStatDetail"]') || document.querySelector('[onclick*="showStatDetail"]');
      if (stat) stat.click();
      setTimeout(() => {
        App.closeChartSheet();
        setTimeout(() => {
          const bars = Array.from(document.querySelectorAll('.mini-chart .bar'));
          const target = bars.find(b => b.getAttribute('title') && b.getAttribute('title') !== '¥0.00') || bars[bars.length - 1];
          target.click();
          setTimeout(() => {
            const sheet = document.getElementById('dataSheet');
            res({ hasStat: !!stat, sheetShow: sheet.classList.contains('show'),
              headTitle: sheet.querySelector('.data-sheet-head h3')?.textContent,
              headSub: sheet.querySelector('.data-sheet-head .ds-sub')?.textContent,
              heroValue: sheet.querySelector('.ds-hero .dh-value')?.textContent,
              cellCount: sheet.querySelectorAll('.ds-cell').length });
          }, 400);
        }, 100);
      }, 300);
    });
  });
  await page.evaluate(() => App.closeChartSheet()); await page.waitForTimeout(200);

  // 分析页趋势线点点击
  await page.evaluate(() => App.switchTab('analysis')); await page.waitForTimeout(350);
  out.need3_analysisLine = await page.evaluate(() => {
    return new Promise(res => {
      const circles = Array.from(document.querySelectorAll('.line-chart-dark circle[onclick]'));
      if (!circles.length) return res({ hasCirc: false });
      circles[circles.length - 1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      setTimeout(() => {
        const sheet = document.getElementById('dataSheet');
        res({ hasCirc: true, sheetShow: sheet.classList.contains('show'),
          headSub: sheet.querySelector('.data-sheet-head .ds-sub')?.textContent,
          heroValue: sheet.querySelector('.ds-hero .dh-value')?.textContent,
          cellCount: sheet.querySelectorAll('.ds-cell').length });
      }, 400);
    });
  });
  await page.evaluate(() => App.closeChartSheet()); await page.waitForTimeout(200);

  // 标题居中截图
  await page.evaluate(() => App.switchTab('records')); await page.waitForTimeout(300);
  await page.screenshot({ path: '/Users/hanchong/Desktop/项目文件/充电 BETA/冲充电/.screenshots/v4-title-center.png' });

  console.log(JSON.stringify(out, null, 2));
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})();