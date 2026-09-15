/**
 * 新能源电车充电记录统计 App —— 数据与逻辑层 v2
 * charging-tracker.js
 * 重构：SVG 图标体系、4 标签导航、分析分段切换、图表触摸提示、折叠表单
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'ev_charging_data_v1';
  var CHARGE_TYPE = { SLOW: 'slow', FAST: 'fast' };
  var CHARGE_TYPE_LABEL = { slow: '慢充', fast: '快充' };

  var HEALTH_CONFIG = {
    deepDischargeThreshold: 20,
    overChargeThreshold: 90,
    fastChargeHabitRatio: 0.5,
    capacityWarningRatio: 0.85
  };

  /* ============================================================
   * SVG 图标库
   * ============================================================ */
  var Icons = {
    wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4 M3 5v14a2 2 0 0 0 2 2h16v-5 M18 12a2 2 0 0 0 0 4h4v-4z" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    zap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    battery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="6" width="18" height="12" rx="2"/><line x1="23" y1="13" x2="23" y2="11"/><line x1="6" y1="10" x2="6" y2="14" stroke-linecap="round"/><line x1="10" y1="10" x2="10" y2="14" stroke-linecap="round"/><line x1="14" y1="10" x2="14" y2="14" stroke-linecap="round"/></svg>',
    trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke-linecap="round" stroke-linejoin="round"/><polyline points="17 6 23 6 23 12" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    gauge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 14l4-4M3.34 19a10 10 0 1 1 17.32 0" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    coin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M9 9h4.5a2 2 0 0 1 0 4H9 M9 13h5a2 2 0 0 1 0 4H9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11M5 11h14M5 11v6a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h8v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-6" stroke-linecap="round"/><circle cx="8" cy="14" r="1" fill="currentColor"/><circle cx="16" cy="14" r="1" fill="currentColor"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18M7 14l3-3 3 3 5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 14 0v1" stroke-linecap="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12" stroke-linecap="round"/><line x1="12" y1="8" x2="12.01" y2="8" stroke-linecap="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19" stroke-linecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="6" x2="18" y2="18" stroke-linecap="round"/><line x1="6" y1="18" x2="18" y2="6" stroke-linecap="round"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3" stroke-linejoin="round"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6 M10 22h4 M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12L13 2z"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6" stroke-linecap="round"/><line x1="8" y1="2" x2="8" y2="6" stroke-linecap="round"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    power: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0 M12 2v10" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    infinity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.178 8c5.384 0 5.384 8 0 8-5.384 0-7.356-8-12.74-8-5.384 0-5.384 8 0 8 5.384 0 7.356-8 12.74-8z" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.5 19a4.5 4.5 0 0 0 .42-8.98 5.5 5.5 0 0 0-10.6 1.76A4 4 0 0 0 7 19h10.5z" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    syncIcon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    keyIcon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15 8 18 11 21 8l-3-3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  /* ============================================================
   * 数据存储层
   * ============================================================ */
  var Store = {
    data: { vehicles: [], charges: [], settings: { currentVehicleId: null } },

    load: function () {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          this.data = JSON.parse(raw);
          if (!this.data.vehicles) this.data.vehicles = [];
          if (!this.data.charges) this.data.charges = [];
          if (!this.data.settings) this.data.settings = { currentVehicleId: null };
        } catch (e) { console.error('数据解析失败', e); }
      }
      return this.data;
    },

    save: function () {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      if (typeof Sync !== 'undefined' && Sync.markLocalChange) Sync.markLocalChange();
    },

    /* 静默保存：仅落盘，不触发同步水印（用于拉取云端后应用，避免误回推） */
    saveSilently: function () { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); },

    exportJSON: function () {
      var blob = new Blob([JSON.stringify(this.data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'ev-charging-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      URL.revokeObjectURL(url);
    },

    importJSON: function (file, callback) {
      var reader = new FileReader();
      var self = this;
      reader.onload = function (e) {
        try {
          var imported = JSON.parse(e.target.result);
          if (!imported.vehicles || !imported.charges) { callback(false, '文件格式不正确'); return; }
          self.data = imported;
          if (!self.data.settings) self.data.settings = { currentVehicleId: null };
          self.save();
          callback(true, '导入成功');
        } catch (err) { callback(false, '导入失败：' + err.message); }
      };
      reader.readAsText(file);
    },

    clearAll: function () {
      this.data = { vehicles: [], charges: [], settings: { currentVehicleId: null } };
      this.save();
    }
  };

  /* ============================================================
   * 云同步（私有 Gist 自动备份）
   * localStorage 仍为主库；每次保存节流推送到私有 Gist；
   * 启动/手动同步时按「后写覆盖」拉取。令牌独立存储，不随数据导出。
   * ============================================================ */
  var Sync = {
    CFG_KEY: 'ev_sync_cfg_v1',
    FILE: 'ev-charging-backup.json',
    cfg: null,
    pushTimer: null,
    pulling: false,

    loadCfg: function () {
      if (this.cfg) return this.cfg;
      this.cfg = { enabled: false, token: '', gistId: '', lastPushedMs: 0, lastLocalMs: 0,
                   lastPullMs: 0, lastSyncAt: 0, lastErr: '', device: (navigator.userAgent || '').slice(0, 50) };
      try {
        var raw = localStorage.getItem(this.CFG_KEY);
        if (raw) { var c = JSON.parse(raw); for (var k in this.cfg) if (c[k] !== undefined) this.cfg[k] = c[k]; }
      } catch (e) {}
      return this.cfg;
    },
    saveCfg: function () { try { localStorage.setItem(this.CFG_KEY, JSON.stringify(this.cfg)); } catch (e) {} },
    headers: function () {
      return {
        'Authorization': 'Bearer ' + this.cfg.token,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      };
    },
    _api: function (method, url, body) {
      return fetch('https://api.github.com' + url, {
        method: method, headers: this.headers(), body: body ? JSON.stringify(body) : undefined
      }).then(function (r) {
        if (!r.ok) {
          return r.json().then(function (j) {
            var msg = (j && (j.message || j.errors && j.errors[0] && j.errors[0].message)) || ('HTTP ' + r.status);
            throw new Error(String(msg));
          });
        }
        return r.json();
      });
    },

    endpoint: function () { return 'https://api.github.com/gists' + (this.cfg.gistId ? '/' + this.cfg.gistId : ''); },

    /* 每次本地保存时标记并节流推送 */
    markLocalChange: function () {
      var c = this.loadCfg();
      if (!c.enabled || !c.token) return;
      c.lastLocalMs = Date.now();
      this.saveCfg();
      if (this.pulling) return;
      var self = this;
      if (this.pushTimer) clearTimeout(this.pushTimer);
      this.pushTimer = setTimeout(function () { self.pushTimer = null; self.push(); }, 1500);
    },

    push: function () {
      var self = this, c = this.loadCfg();
      if (!c.enabled || !c.token) return Promise.resolve();
      var content = this.snapshot();
      if (!c.gistId) {
        return this._api('POST', '/gists', { description: '冲充电 · EV 充电账单同步备份', 'public': false, files: (function () { var o = {}; o[self.FILE] = { content: content }; return o; })() })
          .then(function (g) {
            c.gistId = g.id; c.lastPushedMs = Date.now(); c.lastErr = ''; self.saveCfg();
            self.toast('数据已备份到私有 Gist', 'success');
          })
          .catch(function (e) { self.fail(e); });
      }
      var patch = { files: {} };
      patch.files[this.FILE] = { content: content };
      return this._api('PATCH', '/gists/' + c.gistId, patch)
        .then(function () { c.lastPushedMs = Date.now(); c.lastErr = ''; self.saveCfg(); })
        .catch(function (e) { self.fail(e); });
    },

    pull: function () {
      var self = this, c = this.loadCfg();
      return new Promise(function (resolve) {
        if (!c.enabled || !c.token || !c.gistId || self.pulling) { resolve(); return; }
        self.pulling = true;
        self._api('GET', '/gists/' + c.gistId).then(function (g) {
            var file = g.files && g.files[self.FILE];
            var serverMs = Date.parse(g.updated_at) || 0;
            if (file && serverMs > c.lastPushedMs && serverMs > c.lastLocalMs) {
              try {
                var remote = JSON.parse(file.content || '{}');
                if (remote && remote.vehicles && remote.charges) {
                  Store.data = remote;
                  if (!Store.data.settings) Store.data.settings = { currentVehicleId: null };
                  Store.saveSilently();
                  c.lastLocalMs = serverMs;
                  if (App && App.renderAll) App.renderAll();
                  self.toast('已从云端同步数据', 'success');
                }
              } catch (e) {}
            }
            c.lastPullMs = Date.now(); c.lastSyncAt = Date.now(); self.saveCfg();
            self.pulling = false; resolve();
          })
          .catch(function (e) { self.pulling = false; self.fail(e); resolve(); });
      });
    },

    syncNow: function () {
      var self = this;
      this.pull().then(function () {
        var c = self.loadCfg();
        if (c.lastLocalMs > c.lastPushedMs) { self.push(); }
        else { self.toast('已同步，数据一致', 'success'); }
      });
    },

    snapshot: function () { return JSON.stringify(Store.data); },

    fail: function (e) {
      var c = this.loadCfg();
      c.lastErr = String((e && (e.message || e)) || '未知错误');
      this.saveCfg();
      this.toast('同步失败：' + c.lastErr, 'error');
    },
    toast: function (msg, type) { if (App && App.toast) App.toast(msg, type); return; },

    /* 启动时：若已启用则拉取 */
    startup: function () { this.loadCfg(); if (this.cfg.enabled && this.cfg.token) this.pull(); },

    statusLine: function () {
      var c = this.loadCfg();
      if (!c.enabled) return '未启用';
      if (c.lastErr) return '最近出错：' + c.lastErr;
      var parts = [];
      if (c.gistId) parts.push('已备份到 Gist #' + c.gistId.slice(0, 7));
      if (c.lastSyncAt) parts.push('上次同步 ' + new Date(c.lastSyncAt).toLocaleTimeString());
      return parts.join(' · ') || '等待首次备份';
    }
  };

  /* 刷新「我的」页同步状态栏（设置区渲染后调用） */
  function SyncStatusUI(app) {
    var el = document.getElementById('syncStatus');
    if (el) el.textContent = Sync.statusLine();
  }

  /* ============================================================
   * 工具函数
   * ============================================================ */
  var Utils = {
    uid: function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },
    today: function () {
      var d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },
    monthKey: function (s) { return s.slice(0, 7); },
    monthLabel: function (k) { var p = k.split('-'); return p[0] + '年' + parseInt(p[1], 10) + '月'; },
    monthShort: function (k) { return parseInt(k.split('-')[1], 10) + '月'; },
    monthYear: function (k) { return k.split('-')[0]; },
    yearRangeTag: function (months) {
      if (!months || !months.length) return '';
      var first = months[0].split('-')[0];
      var last = months[months.length - 1].split('-')[0];
      return first === last ? first + '年' : first + '–' + last + '年';
    },
    fmt: function (n, d) { return (n === null || n === undefined || isNaN(n)) ? '--' : Number(n).toFixed(d || 1); },
    fmtMoney: function (n) { return (n === null || n === undefined || isNaN(n)) ? '--' : Number(n).toFixed(2); },
    sortByDate: function (arr, desc) { return arr.slice().sort(function (a, b) { return desc ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date); }); },
    recentMonths: function (n) {
      var months = [], now = new Date();
      for (var i = n - 1; i >= 0; i--) {
        var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
      }
      return months;
    },
    /** 可用年份（降序），供年度筛选 */
    availableYears: function (vid) {
      var arr = vid ? Store.data.charges.filter(function (c) { return c.vehicleId === vid; }) : Store.data.charges;
      var ym = {};
      arr.forEach(function (c) { ym[c.date.slice(0, 4)] = 1; });
      return Object.keys(ym).sort().reverse();
    },
    /** 某年的连续月份（1月~12月，当年截至当前月） */
    yearMonths: function (year) {
      var now = new Date();
      var endM = String(year) === String(now.getFullYear()) ? now.getMonth() + 1 : 12;
      var out = [];
      for (var m = 1; m <= endM; m++) out.push(String(year) + '-' + String(m).padStart(2, '0'));
      return out;
    },
    /**
     * 趋势图横轴月份范围（升序）：
     * 若存在早于近 n 个月窗口的历史数据，则从最早数据月一直覆盖到当月（可滑动查看全部历史），
     * 否则仅展示近 n 个月。
     */
    chartRange: function (vid, n) {
      n = n || 6;
      var arr = vid ? Store.data.charges.filter(function (c) { return c.vehicleId === vid; }) : Store.data.charges;
      var smap = {};
      arr.forEach(function (c) { smap[Utils.monthKey(c.date)] = 1; });
      var dataMonths = Object.keys(smap).sort();
      var recentStart = Utils.recentMonths(n)[0];
      var startKey = recentStart;
      if (dataMonths.length && dataMonths[0] < recentStart) startKey = dataMonths[0];
      var p = startKey.split('-'), sy = +p[0], sm = +p[1];
      var now = new Date(), ey = now.getFullYear(), em = now.getMonth() + 1;
      var out = [];
      var guard = 0;
      while ((sy < ey || (sy === ey && sm <= em)) && guard < 240) {
        out.push(sy + '-' + String(sm).padStart(2, '0'));
        sm++; if (sm > 12) { sm = 1; sy++; }
        guard++;
      }
      return out;
    }
  };

  /* ============================================================
   * 车型管理
   * ============================================================ */
  var VehicleMgr = {
    list: function () { return Store.data.vehicles; },
    get: function (id) { return Store.data.vehicles.find(function (v) { return v.id === id; }); },
    add: function (v) {
      var vehicle = {
        id: Utils.uid(), name: v.name || '未命名车辆', brand: v.brand || '', model: v.model || '',
        batteryCapacity: parseFloat(v.batteryCapacity) || 0,
        supportsFastCharge: v.supportsFastCharge !== false,
        maxChargePower: parseFloat(v.maxChargePower) || 0,
        note: v.note || '', createdAt: Date.now()
      };
      Store.data.vehicles.push(vehicle);
      if (!Store.data.settings.currentVehicleId) Store.data.settings.currentVehicleId = vehicle.id;
      Store.save();
      return vehicle;
    },
    update: function (id, v) {
      var vehicle = this.get(id);
      if (!vehicle) return null;
      ['name', 'brand', 'model', 'batteryCapacity', 'supportsFastCharge', 'maxChargePower', 'note']
        .forEach(function (k) { if (v[k] !== undefined) vehicle[k] = v[k]; });
      vehicle.batteryCapacity = parseFloat(vehicle.batteryCapacity) || 0;
      vehicle.maxChargePower = parseFloat(vehicle.maxChargePower) || 0;
      Store.save();
      return vehicle;
    },
    remove: function (id) {
      Store.data.vehicles = Store.data.vehicles.filter(function (v) { return v.id !== id; });
      Store.data.charges = Store.data.charges.filter(function (c) { return c.vehicleId !== id; });
      if (Store.data.settings.currentVehicleId === id)
        Store.data.settings.currentVehicleId = Store.data.vehicles[0] ? Store.data.vehicles[0].id : null;
      Store.save();
    },
    current: function () { return this.get(Store.data.settings.currentVehicleId); },
    setCurrent: function (id) { Store.data.settings.currentVehicleId = id; Store.save(); }
  };

  /* ============================================================
   * 充电记录管理
   * ============================================================ */
  var ChargeMgr = {
    list: function (vid) {
      var arr = vid ? Store.data.charges.filter(function (c) { return c.vehicleId === vid; }) : Store.data.charges;
      return Utils.sortByDate(arr, true);
    },
    listByVehicle: function (vid) {
      return Utils.sortByDate(Store.data.charges.filter(function (c) { return c.vehicleId === vid; }), false);
    },
    add: function (c) {
      var charge = {
        id: Utils.uid(), vehicleId: c.vehicleId, date: c.date || Utils.today(),
        odometer: parseFloat(c.odometer) || 0, chargeType: c.chargeType || CHARGE_TYPE.SLOW,
        kWh: parseFloat(c.kWh) || 0, unitPrice: parseFloat(c.unitPrice) || 0,
        totalCost: parseFloat(c.totalCost) || 0, socBefore: parseFloat(c.socBefore) || 0,
        socAfter: parseFloat(c.socAfter) || 0, note: c.note || '', createdAt: Date.now()
      };
      if (!charge.totalCost && charge.kWh && charge.unitPrice) charge.totalCost = charge.kWh * charge.unitPrice;
      Store.data.charges.push(charge);
      Store.save();
      return charge;
    },
    update: function (id, c) {
      var charge = Store.data.charges.find(function (x) { return x.id === id; });
      if (!charge) return null;
      ['vehicleId', 'date', 'odometer', 'chargeType', 'kWh', 'unitPrice', 'totalCost', 'socBefore', 'socAfter', 'note']
        .forEach(function (k) { if (c[k] !== undefined) charge[k] = c[k]; });
      ['odometer', 'kWh', 'unitPrice', 'totalCost', 'socBefore', 'socAfter']
        .forEach(function (k) { charge[k] = parseFloat(charge[k]) || 0; });
      Store.save();
      return charge;
    },
    remove: function (id) { Store.data.charges = Store.data.charges.filter(function (c) { return c.id !== id; }); Store.save(); },
    get: function (id) { return Store.data.charges.find(function (c) { return c.id === id; }); }
  };

  /* ============================================================
   * 统计分析引擎
   * ============================================================ */
  var Stats = {
    sortedCharges: function (vid) { return ChargeMgr.listByVehicle(vid); },
    kWhPer100km: function (charges) {
      var results = [];
      for (var i = 1; i < charges.length; i++) {
        var prev = charges[i - 1], cur = charges[i];
        var o0 = prev.odometer || 0, o1 = cur.odometer || 0;
        // 规则A：必须相邻两次记录都有有效里程且递增，单点或多条缺里程时不构成区间
        // 规则B：两次里程点之间若夹有里程/记录不完整的条目（o0/o1 任一为0）则区间不可靠，跳过
        if (o0 > 0 && o1 > o0 && cur.kWh > 0) {
          var dist = o1 - o0;
          results.push({ date: cur.date, monthKey: Utils.monthKey(cur.date), value: (cur.kWh / dist) * 100, distance: dist });
        }
      }
      return results;
    },
    // 电耗有效样本（可计算：相邻记录里程差 > 0），可按年份过滤
    effSamples: function (vid, year) {
      var eff = this.kWhPer100km(this.sortedCharges(vid));
      if (year) eff = eff.filter(function (e) { return e.date.slice(0, 4) === String(year); });
      return eff;
    },
    // 稳健均值：剔除超过 3 倍标准差的离群点后求平均，样本过少时直接取均值
    robustMean: function (values) {
      if (!values.length) return 0;
      if (values.length < 3) return values.reduce(function (s, v) { return s + v; }, 0) / values.length;
      var mean = values.reduce(function (s, v) { return s + v; }, 0) / values.length;
      var sq = 0;
      values.forEach(function (v) { var d = v - mean; sq += d * d; });
      var sd = Math.sqrt(sq / values.length);
      var kept = values.filter(function (v) { return Math.abs(v - mean) <= 3 * sd; });
      if (!kept.length) kept = values;
      return kept.reduce(function (s, v) { return s + v; }, 0) / kept.length;
    },
    // 平均电耗：返回稳健均值、有效样本数与样本明细
    // 规则D：有效样本不足 3 条时不计均值，界面显示「数据不足」，避免单条冒充结论
    avgEfficiency: function (vid, year) {
      var samples = this.effSamples(vid, year);
      var count = samples.length;
      var enough = count >= 3;
      var avg = 0;
      if (enough) {
        avg = this.robustMean(samples.map(function (e) { return e.value; }));
      } else if (count > 0) {
        avg = samples.reduce(function (s, e) { return s + e.value; }, 0) / count;
      }
      return { avg: avg, count: count, enough: enough, samples: samples };
    },
    overview: function (vid, year) {
      var charges = vid ? Store.data.charges.filter(function (c) { return c.vehicleId === vid; }) : Store.data.charges;
      if (year) {
        var y = String(year);
        charges = charges.filter(function (c) { return c.date.slice(0, 4) === y; });
      }
      var totalCost = 0, totalKWh = 0, count = charges.length, fastCount = 0, slowCount = 0;
      var thisMonth = Utils.monthKey(Utils.today()), thisMonthCost = 0, thisMonthKWh = 0, thisMonthCount = 0;
      charges.forEach(function (c) {
        totalCost += c.totalCost || 0; totalKWh += c.kWh || 0;
        if (c.chargeType === CHARGE_TYPE.FAST) fastCount++; else slowCount++;
        if (Utils.monthKey(c.date) === thisMonth) { thisMonthCost += c.totalCost || 0; thisMonthKWh += c.kWh || 0; thisMonthCount++; }
      });
      var effInfo = this.avgEfficiency(vid, year);
      var avgPrice = totalKWh > 0 ? totalCost / totalKWh : 0;
      return { totalCost: totalCost, totalKWh: totalKWh, chargeCount: count, fastCount: fastCount, slowCount: slowCount, thisMonthCost: thisMonthCost, thisMonthKWh: thisMonthKWh, thisMonthCount: thisMonthCount, avgEff: effInfo.avg, effCount: effInfo.count, avgPrice: avgPrice };
    },
    monthlyCost: function (vid, months) {
      if (!months) months = Utils.recentMonths(6);
      if (typeof months === 'number') months = Utils.recentMonths(months);
      var charges = vid ? Store.data.charges.filter(function (c) { return c.vehicleId === vid; }) : Store.data.charges;
      var map = {}, kWhMap = {};
      charges.forEach(function (c) {
        var k = Utils.monthKey(c.date);
        if (map[k] === undefined) { map[k] = 0; kWhMap[k] = 0; }
        map[k] += c.totalCost || 0; kWhMap[k] += c.kWh || 0;
      });
      var curKey = Utils.monthKey(Utils.today());
      return months.map(function (k) {
        return { label: Utils.monthShort(k), value: map[k] || 0, monthKey: k, totalKWh: kWhMap[k] || 0, isPartial: k === curKey };
      });
    },
    monthlyEfficiency: function (vid, months) {
      if (!months) months = Utils.recentMonths(6);
      if (typeof months === 'number') months = Utils.recentMonths(months);
      var sorted = this.sortedCharges(vid);
      var eff = this.kWhPer100km(sorted);
      var map = {};
      var kWhMap = {}, distMap = {};
      eff.forEach(function (e) {
        if (!map[e.monthKey]) { map[e.monthKey] = []; kWhMap[e.monthKey] = 0; distMap[e.monthKey] = 0; }
        map[e.monthKey].push(e.value);
        kWhMap[e.monthKey] += e.value * e.distance / 100;
        distMap[e.monthKey] += e.distance;
      });
      return months.map(function (k) {
        var arr = map[k] || [];
        var avg = arr.length ? arr.reduce(function (s, v) { return s + v; }, 0) / arr.length : 0;
        return { label: Utils.monthShort(k), value: avg, monthKey: k, totalKWh: kWhMap[k] || 0, totalDist: distMap[k] || 0 };
      });
    },
    chargeTypeRatio: function (vid, year) {
      var ov = this.overview(vid, year);
      var total = ov.chargeCount || 1;
      return { fast: ov.fastCount / total, slow: ov.slowCount / total, fastCount: ov.fastCount, slowCount: ov.slowCount };
    },
    /** 每公里单价（¥/km）= 平均电价 × 百公里电耗 / 100 */
    pricePerKm: function (vid, year) {
      var ov = this.overview(vid, year);
      var eff = this.avgEfficiency(vid, year);
      if (ov.avgPrice > 0 && eff.count > 0) {
        return { value: ov.avgPrice * eff.avg / 100, hasData: true, effCount: eff.count };
      }
      return { value: 0, hasData: false, effCount: eff.count };
    }
  };

  /* ============================================================
   * 电池健康综合评估
   * ============================================================ */
  var BatteryHealth = {
    estimateCapacity: function (vid) {
      var charges = ChargeMgr.listByVehicle(vid);
      var vehicle = VehicleMgr.get(vid);
      var nominal = vehicle ? (vehicle.batteryCapacity || 0) : 0;
      // 规则C：物理区间护栏——实测容量需落在 [标称×0.7, 标称×1.08] 内才合理，超限视为读数偏差/离群剔除
      var lo = nominal > 0 ? nominal * 0.7 : 0;
      var hi = nominal > 0 ? nominal * 1.08 : Infinity;
      var estimates = [];
      charges.forEach(function (c) {
        var socDelta = c.socAfter - c.socBefore;
        if (socDelta >= 30 && c.kWh > 0) {
          var cap = c.kWh / (socDelta / 100);
          if (cap >= lo && cap <= hi)
            estimates.push({ date: c.date, monthKey: Utils.monthKey(c.date), capacity: cap });
        }
      });
      return Utils.sortByDate(estimates, false);
    },
    capacityTrend: function (vid, months) {
      if (!months) months = Utils.recentMonths(6);
      if (typeof months === 'number') months = Utils.recentMonths(months);
      var estimates = this.estimateCapacity(vid);
      var map = {};
      estimates.forEach(function (e) { if (!map[e.monthKey]) map[e.monthKey] = []; map[e.monthKey].push(e.capacity); });
      return months.map(function (k) {
        var arr = (map[k] || []).slice().sort(function (a, b) { return a - b; });
        var median = arr.length ? arr[Math.floor(arr.length / 2)] : 0;
        return { label: Utils.monthShort(k), value: median };
      });
    },
    currentEstimate: function (vid) {
      var estimates = this.estimateCapacity(vid);
      if (!estimates.length) return null;
      var recent = estimates.slice(-5);
      var vals = recent.map(function (e) { return e.capacity; }).sort(function (a, b) { return a - b; });
      return vals[Math.floor(vals.length / 2)];
    },
    habitScore: function (vid) {
      var charges = ChargeMgr.listByVehicle(vid);
      if (charges.length === 0) return { score: 0, factors: [] };
      var cfg = HEALTH_CONFIG;
      var fastCount = 0, deepDischargeCount = 0, overChargeCount = 0, total = charges.length;
      charges.forEach(function (c) {
        if (c.chargeType === CHARGE_TYPE.FAST) fastCount++;
        if (c.socBefore < cfg.deepDischargeThreshold) deepDischargeCount++;
        if (c.socAfter > cfg.overChargeThreshold) overChargeCount++;
      });
      var fastRatio = fastCount / total, deepRatio = deepDischargeCount / total, overRatio = overChargeCount / total;
      var fastPenalty = Math.max(0, (fastRatio - cfg.fastChargeHabitRatio) * 80);
      var deepPenalty = deepRatio * 60;
      var overPenalty = overRatio * 40;
      var score = Math.max(0, Math.round(100 - fastPenalty - deepPenalty - overPenalty));
      var factors = [
        { name: '快充占比', value: Math.round(fastRatio * 100) + '%', impact: fastPenalty > 0 ? '偏高' : '正常', penalty: Math.round(fastPenalty) },
        { name: '深放频率', value: Math.round(deepRatio * 100) + '%', impact: deepPenalty > 0 ? '偏高' : '正常', penalty: Math.round(deepPenalty) },
        { name: '过充频率', value: Math.round(overRatio * 100) + '%', impact: overPenalty > 0 ? '偏高' : '正常', penalty: Math.round(overPenalty) }
      ];
      return { score: score, factors: factors, fastRatio: fastRatio, deepRatio: deepRatio, overRatio: overRatio };
    },
    /** 电池健康度（仅电池容量维度）= 实测容量 ÷ 标称容量，与充电习惯无关 */
    // 规则D：有效估算样本不足 3 组时不给出容量结论，显示「数据不足」
    capacityHealth: function (vid) {
      var vehicle = VehicleMgr.get(vid);
      var nominal = vehicle ? vehicle.batteryCapacity : 0;
      var estimates = this.estimateCapacity(vid);
      var sampleCount = estimates.length;
      var enough = sampleCount >= 3;
      var current = enough ? this.currentEstimate(vid) : (sampleCount ? this.currentEstimate(vid) : null);
      var retention = (current && nominal > 0) ? Math.min(1, current / nominal) : null;
      var index = retention === null ? null : Math.round(retention * 100);
      var status;
      if (index === null) { status = '补录电量后可用'; }
      else if (!enough) { status = '数据不足'; }
      else if (index >= 90) { status = '优秀'; }
      else if (index >= HEALTH_CONFIG.capacityWarningRatio * 100) { status = '良好'; }
      else { status = '需关注'; }
      return { index: index, retention: retention, currentEstimate: current, nominal: nominal, status: status, sampleCount: sampleCount, enough: enough };
    },
    healthIndex: function (vid) {
      var vehicle = VehicleMgr.get(vid);
      var nominal = vehicle ? vehicle.batteryCapacity : 0;
      var current = this.currentEstimate(vid);
      var habit = this.habitScore(vid);
      var capacityRatio = (current && nominal > 0) ? Math.min(1, current / nominal) : 1;
      var index = Math.round(capacityRatio * 60 + habit.score * 0.4);
      var status, advice;
      if (index >= 85) { status = '优秀'; advice = '电池状态良好，继续保持当前充电习惯。'; }
      else if (index >= 70) { status = '良好'; advice = '电池状态正常，可优化充电习惯以延长寿命。'; }
      else if (index >= 50) { status = '一般'; advice = '建议减少快充频率，避免深放和过充。'; }
      else { status = '需关注'; advice = '电池健康度偏低，建议前往售后检测。'; }
      return { index: index, status: status, advice: advice, capacityRatio: capacityRatio, currentEstimate: current, nominal: nominal, habit: habit };
    }
  };

  /* ============================================================
   * 充电方式推荐引擎
   * ============================================================ */
  var Recommender = {
    generate: function (vid) {
      var vehicle = VehicleMgr.get(vid);
      var charges = ChargeMgr.listByVehicle(vid);
      var tips = [];
      if (!vehicle) return { tips: [], summary: '请先添加车型信息。' };
      if (charges.length < 3) return { tips: [{ icon: 'info', title: '数据积累中', text: '充电记录较少（少于3次），积累更多数据后将给出更精准的推荐。' }], summary: '数据积累中' };

      var ratio = Stats.chargeTypeRatio(vid);
      var ov = Stats.overview(vid);
      var habit = BatteryHealth.habitScore(vid);
      var cfg = HEALTH_CONFIG;

      if (ratio.fast > cfg.fastChargeHabitRatio && vehicle.supportsFastCharge) {
        var slowPrice = this.avgPriceByType(vid, CHARGE_TYPE.SLOW);
        var fastPrice = this.avgPriceByType(vid, CHARGE_TYPE.FAST);
        var savePerKWh = fastPrice - slowPrice;
        tips.push({ icon: 'alert', title: '快充占比偏高', text: '当前快充占比 ' + Math.round(ratio.fast * 100) + '%。频繁快充会加速电池老化，' + (savePerKWh > 0 ? '且慢充平均每度便宜 ' + Utils.fmtMoney(savePerKWh) + ' 元。' : '') + '建议日常通勤优先使用家用慢充，长途出行再使用快充。' });
      }
      if (habit.deepRatio > 0.3) tips.push({ icon: 'alert', title: '经常低电量才充电', text: '有 ' + Math.round(habit.deepRatio * 100) + '% 的充电发生在电量低于 ' + cfg.deepDischargeThreshold + '% 时。长期深放会损伤电池，建议电量降至 30% 左右即开始充电。' });
      if (habit.overRatio > 0.3) tips.push({ icon: 'alert', title: '经常充满至高电量', text: '有 ' + Math.round(habit.overRatio * 100) + '% 的充电充至 ' + cfg.overChargeThreshold + '% 以上。日常使用建议充至 80%-90% 即可，可延长电池循环寿命。' });
      else if (habit.overRatio < 0.1 && habit.deepRatio < 0.2) tips.push({ icon: 'check', title: '充电区间控制良好', text: '你大多数充电都保持在 ' + cfg.deepDischargeThreshold + '%-' + cfg.overChargeThreshold + '% 的健康区间，对电池寿命非常友好。' });

      var slowPrice2 = this.avgPriceByType(vid, CHARGE_TYPE.SLOW);
      var fastPrice2 = this.avgPriceByType(vid, CHARGE_TYPE.FAST);
      if (slowPrice2 > 0 && fastPrice2 > 0 && fastPrice2 > slowPrice2) {
        var diff = fastPrice2 - slowPrice2;
        var potentialSave = diff * ov.totalKWh * ratio.fast * 0.5;
        if (potentialSave > 10) tips.push({ icon: 'info', title: '充电成本可优化', text: '快充均价 ' + Utils.fmtMoney(fastPrice2) + ' 元/度，慢充均价 ' + Utils.fmtMoney(slowPrice2) + ' 元/度，差价 ' + Utils.fmtMoney(diff) + ' 元/度。若将部分快充改为慢充，预计可节省约 ' + Utils.fmtMoney(potentialSave) + ' 元。' });
      }
      if (vehicle.batteryCapacity > 0) {
        if (!vehicle.supportsFastCharge) tips.push({ icon: 'info', title: '车型不支持快充', text: vehicle.name + ' 不支持快充，建议安装家用充电桩，利用夜间低谷电价慢充，兼顾成本和电池保护。' });
        else if (vehicle.maxChargePower > 0 && vehicle.maxChargePower < 50) tips.push({ icon: 'info', title: '快充功率有限', text: vehicle.name + ' 最大快充功率 ' + vehicle.maxChargePower + 'kW，长途出行建议提前规划充电站，日常以慢充为主即可满足需求。' });
      }
      if (tips.length === 0 || (habit.score >= 85 && ratio.fast < cfg.fastChargeHabitRatio)) tips.unshift({ icon: 'check', title: '充电习惯良好', text: '你的充电习惯对电池友好且成本合理，当前无需调整。' });
      var summary = habit.score >= 80 ? '充电策略健康' : (habit.score >= 60 ? '有优化空间' : '建议调整充电策略');
      return { tips: tips, summary: summary };
    },
    avgPriceByType: function (vid, type) {
      var charges = ChargeMgr.listByVehicle(vid).filter(function (c) { return c.chargeType === type && c.kWh > 0; });
      if (!charges.length) return 0;
      var totalCost = 0, totalKWh = 0;
      charges.forEach(function (c) { totalCost += c.totalCost || 0; totalKWh += c.kWh || 0; });
      return totalKWh > 0 ? totalCost / totalKWh : 0;
    }
  };

  /* ============================================================
   * Canvas 图表（增强版：触摸提示）
   * ============================================================ */
  var Charts = {
    _tooltip: null,
    _getTooltip: function () {
      var self = this;
      if (!this._tooltip) {
        this._tooltip = document.createElement('div');
        this._tooltip.className = 'chart-tooltip';
      }
      // 全局：点击图表之外的任意区域即隐藏数据标签/提示，并随组件隐藏
      if (!this._hideBound) {
        this._hideBound = true;
        document.addEventListener('click', function (e) {
          var t = e.target;
          if (!(t && t.closest && t.closest('.chart'))) self._hideTip();
        }, true);
      }
      return this._tooltip;
    },
    _hideTip: function () {
      if (this._tooltip) this._tooltip.classList.remove('show');
    },
    hide: function () {
      this._hideTip();
    },
    _attachTouch: function (canvas, pts, opts) {
      var tip = this._getTooltip();
      document.body.appendChild(tip);
      var padT = opts.padT || 28, padB = 36, padL = 48, padR = 16;
      var H = canvas.clientHeight || 200;
      var ch = H - padT - padB;

      function handle(e) {
        var rect = canvas.getBoundingClientRect();
        var x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        var y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
        var closest = null, minDist = 999;
        pts.forEach(function (p) {
          var d = Math.abs(p.px - x);
          if (d < minDist) { minDist = d; closest = p; }
        });
        if (closest && minDist < 40) {
          if (opts.tooltipFormat) {
            tip.textContent = opts.tooltipFormat(closest.d);
          } else {
            tip.textContent = closest.d.label + ': ' + (opts.yFormat ? opts.yFormat(closest.d.value) : Utils.fmt(closest.d.value, opts.digits || 1));
          }
          // 使用 fixed 定位，直接用视口坐标
          var tipX = rect.left + closest.px;
          var tipY = rect.top + closest.py;
          // 边界检查：防止超出视口
          var tipW = tip.offsetWidth || 100;
          var tipH = tip.offsetHeight || 30;
          if (tipX < tipW / 2) tipX = tipW / 2;
          if (tipX > window.innerWidth - tipW / 2) tipX = window.innerWidth - tipW / 2;
          // Y 边界检查：上方空间不足时改为下方显示
          if (tipY - tipH - 10 < 0) {
            tip.style.transform = 'translate(-50%, 0)';
            tip.style.marginTop = '8px';
          } else {
            tip.style.transform = 'translate(-50%, -100%)';
            tip.style.marginTop = '-8px';
          }
          tip.style.left = tipX + 'px';
          tip.style.top = tipY + 'px';
          tip.classList.add('show');
        } else {
          tip.classList.remove('show');
        }
      }
      canvas.addEventListener('touchstart', handle, { passive: true });
      canvas.addEventListener('touchmove', handle, { passive: true });
      canvas.addEventListener('mousemove', handle);
      canvas.addEventListener('mouseleave', function () { tip.classList.remove('show'); });
      // 手动触碰抬起或拖动取消时，气泡自动消失
      canvas.addEventListener('touchend', function () { tip.classList.remove('show'); });
      canvas.addEventListener('touchcancel', function () { tip.classList.remove('show'); });
    },

    _renderYAxis: function (opts, maxV, H, padT, ch) {
      var el = opts.yaxisId ? document.getElementById(opts.yaxisId) : null;
      if (!el) return;
      var html = '';
      if (opts.yunit) {
        html += '<span class="chart-yaxis-unit">' + opts.yunit + '</span>';
      }
      for (var i = 0; i <= 4; i++) {
        var yVal = maxV * i / 4;
        var y = padT + ch - (ch * i / 4);
        var txt = opts.yFormat ? opts.yFormat(yVal) : Utils.fmt(yVal, opts.digits || 0);
        html += '<span class="chart-yaxis-label" style="top:' + y.toFixed(1) + 'px">' + txt + '</span>';
      }
      el.innerHTML = html;
    },

    line: function (canvas, data, opts) {
      opts = opts || {};
      var ctx = canvas.getContext('2d');
      var dpr = window.devicePixelRatio || 1;
      var baseW = canvas.clientWidth || 300;
      var H = canvas.clientHeight || 200;
      // y 轴刻度与单位已抽离到左侧固定列，画布内不再保留左轴数值
      var padL = 8, padR = 8, padT = 22, padB = 36;
      var minSpan = opts.minSpan || 58;
      var renderW = opts.width || Math.max(baseW, padL + padR + data.length * minSpan);
      canvas.style.width = renderW + 'px';
      canvas.style.height = H + 'px';
      canvas.width = renderW * dpr; canvas.height = H * dpr;
      ctx.scale(dpr, dpr);

      var W = renderW;
      var cw = W - padL - padR, ch = H - padT - padB;
      var noData = !data.length || data.every(function (d) { return !d.value; });
      var maxV = noData ? 1 : Math.max.apply(null, data.map(function (d) { return d.value; })) * 1.15;
      var color = opts.color || '#8B9BAE';

      // 填充左侧固定 Y 轴（刻度 + 单位）
      this._renderYAxis(opts, maxV, H, padT, ch);

      var lastI = data.length - 1;
      var pts = data.map(function (d, i) {
        var x = padL + (data.length === 1 ? cw / 2 : cw * i / lastI);
        var y = noData ? padT + ch : padT + ch - (ch * d.value / maxV);
        return { x: x, y: y, px: x, py: y, d: d, i: i };
      });

      var selected = -1;
      var self = this;
      // 进行中月份（部分数据）：灰色虚线 + 空心点 + 灰色标签
      var partialColor = '#5F6B7A';
      var solidLast = -1;
      pts.forEach(function (p, i) { if (!p.d.isPartial) solidLast = i; });
      var hasPartial = pts.some(function (p) { return !!p.d.isPartial; });

      function paint() {
        ctx.clearRect(0, 0, W, H);
        if (noData) {
          ctx.fillStyle = '#64738a'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('暂无数据', W / 2, H / 2);
          return;
        }
        // 网格线（水平，全宽）
        ctx.strokeStyle = '#181820'; ctx.lineWidth = 1;
        for (var i = 0; i <= 4; i++) {
          var gy = padT + ch - (ch * i / 4);
          ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(W - padR, gy); ctx.stroke();
        }
        // 面积填充（仅完整月份）
        if (solidLast >= 0) {
          ctx.beginPath();
          ctx.moveTo(pts[0].x, padT + ch);
          for (var a = 0; a <= solidLast; a++) ctx.lineTo(pts[a].x, pts[a].y);
          ctx.lineTo(pts[solidLast].x, padT + ch);
          ctx.closePath();
          var grad = ctx.createLinearGradient(0, padT, 0, padT + ch);
          grad.addColorStop(0, color + '40'); grad.addColorStop(1, color + '05');
          ctx.fillStyle = grad; ctx.fill();
        }
        // 折线：完整月份实线，进行中月份灰色虚线
        ctx.lineJoin = 'round';
        if (solidLast >= 0) {
          ctx.strokeStyle = color; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
          for (var i = 1; i <= solidLast; i++) ctx.lineTo(pts[i].x, pts[i].y);
          ctx.stroke();
          if (solidLast < pts.length - 1) {
            ctx.strokeStyle = partialColor; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(pts[solidLast].x, pts[solidLast].y);
            for (var j = solidLast + 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        } else {
          ctx.strokeStyle = partialColor; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
          for (var k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        // 数据点 + 横轴月份标签
        ctx.textAlign = 'center'; ctx.font = '10px sans-serif';
        pts.forEach(function (p, idx) {
          ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          if (p.d.isPartial) {
            ctx.fillStyle = '#0C0C12'; ctx.fill();
            ctx.strokeStyle = partialColor; ctx.lineWidth = 1.5; ctx.stroke();
          } else {
            ctx.fillStyle = '#fff'; ctx.fill();
            ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
          }
          ctx.fillStyle = p.d.isPartial ? partialColor : '#64738a';
          // 首尾标签向内对齐，避免贴近边缘时溢出
          ctx.textAlign = (idx === 0) ? 'left' : (idx === pts.length - 1 ? 'right' : 'center');
          var labelX = (idx === 0) ? Math.max(p.x + 4, padL) : (idx === pts.length - 1 ? Math.min(p.x - 4, W - padR) : p.x);
          ctx.fillText(p.d.label, labelX, padT + ch + 18);
        });
        // 选中点的数据标签（默认隐藏，点击该点展示，点击其他区域隐藏）
        if (opts.labelFormat && selected >= 0 && pts[selected] && (pts[selected].d.value > 0 || pts[selected].d.isPartial)) {
          ctx.font = 'bold 10px sans-serif';
          var lines = String(opts.labelFormat(pts[selected].d)).split('\n');
          lines.forEach(function (ln, li) {
            ctx.fillStyle = (li === 0) ? (opts.labelColor || '#D8DDE4') : (opts.subLabelColor || '#64738a');
            var ly = pts[selected].y - 14 + li * 11;
            if (ly < 6) ly = pts[selected].y + 14 + li * 11;
            ctx.fillText(ln, pts[selected].x, ly);
          });
        }
      }

      paint();

      // 点击：选中/取消数据标签
      canvas.addEventListener('click', function (e) {
        var rect = canvas.getBoundingClientRect();
        var x = (e.clientX || e.pageX) - rect.left;
        var best = -1, bestD = 999;
        pts.forEach(function (p) {
          var d = Math.abs(p.px - x);
          if (d < bestD) { bestD = d; best = p.i; }
        });
        if (best >= 0 && bestD < 44) {
          selected = (selected === best) ? -1 : best;
        } else {
          selected = -1;
        }
        paint();
      });

      // 拖动/滚动图表时自动清除点选的数据标签并隐藏气泡
      var scrollerEl = canvas.closest ? canvas.closest('.chart-scroll') : null;
      if (scrollerEl) {
        scrollerEl.addEventListener('scroll', function () {
          if (selected >= 0) { selected = -1; paint(); }
          Charts._hideTip();
        }, { passive: true });
      }

      this._attachTouch(canvas, pts, opts);
    },

    bar: function (canvas, data, opts) {
      opts = opts || {};
      var ctx = canvas.getContext('2d');
      var dpr = window.devicePixelRatio || 1;
      var baseW = canvas.clientWidth || 300;
      var H = canvas.clientHeight || 200;
      // y 轴刻度与单位已抽离到左侧固定列，画布内不再保留左轴数值
      var padL = 8, padR = 8, padT = 26, padB = 36;
      var minSpan = opts.minSpan || 52;
      var renderW = opts.width || Math.max(baseW, padL + padR + data.length * minSpan);
      canvas.style.width = renderW + 'px';
      canvas.style.height = H + 'px';
      canvas.width = renderW * dpr; canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, renderW, H);

      var W = renderW;
      var cw = W - padL - padR, ch = H - padT - padB;

      if (!data.length || data.every(function (d) { return !d.value; })) {
        ctx.fillStyle = '#64738a'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('暂无数据', W / 2, H / 2);
        return;
      }
      var maxV = Math.max.apply(null, data.map(function (d) { return d.value; })) * 1.2 || 1;
      var color = opts.color || '#8B9BAE';

      // 填充左侧固定 Y 轴
      this._renderYAxis(opts, maxV, H, padT, ch);

      // 网格线（水平，全宽）
      ctx.strokeStyle = '#181820'; ctx.lineWidth = 1;
      for (var i = 0; i <= 4; i++) {
        var gy = padT + ch - (ch * i / 4);
        ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(W - padR, gy); ctx.stroke();
      }

      var barW = cw / data.length * 0.5;
      var lastI = data.length - 1;
      var pts = [];
      data.forEach(function (d, i) {
        var ccenter = padL + (data.length === 1 ? cw / 2 : cw * i / lastI);
        var x = ccenter - barW / 2;
        var barH = ch * d.value / maxV;
        var y = padT + ch - barH;
        var grad = ctx.createLinearGradient(0, y, 0, y + barH);
        grad.addColorStop(0, color); grad.addColorStop(1, color + '80');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, y, barW, barH, 4) : ctx.rect(x, y, barW, barH);
        ctx.fill();
        pts.push({ px: x + barW / 2, py: y, d: d });
        // 数据标签
        ctx.fillStyle = opts.labelColor || '#D8DDE4';
        ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
        if (d.value > 0) {
          var labelText = opts.labelFormat ? opts.labelFormat(d.value) : Utils.fmt(d.value, opts.digits || 1);
          ctx.fillText(labelText, x + barW / 2, y - 6);
        }
        // x轴标签
        ctx.fillStyle = '#64738a'; ctx.font = '10px sans-serif';
        ctx.textAlign = (i === 0) ? 'left' : (i === lastI ? 'right' : 'center');
        var lx = x + barW / 2;
        lx = (i === 0) ? Math.max(lx + 4, padL) : (i === lastI ? Math.min(lx - 4, W - padR) : lx);
        ctx.fillText(d.label, lx, padT + ch + 18);
      });
      this._attachTouch(canvas, pts, opts);
    },

    donut: function (canvas, segments, opts) {
      opts = opts || {};
      var ctx = canvas.getContext('2d');
      var dpr = window.devicePixelRatio || 1;
      var W = canvas.clientWidth, H = canvas.clientHeight || 160;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);

      var cx = W / 2, cy = H / 2;
      var r = Math.min(W, H) / 2 - 10;
      var total = segments.reduce(function (s, seg) { return s + seg.value; }, 0);
      if (total === 0) {
        ctx.fillStyle = '#64738a'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('暂无数据', cx, cy); return;
      }
      var start = -Math.PI / 2;
      segments.forEach(function (seg) {
        var angle = (seg.value / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, start, start + angle);
        ctx.arc(cx, cy, r * 0.6, start + angle, start, true);
        ctx.closePath();
        ctx.fillStyle = seg.color; ctx.fill();
        start += angle;
      });
      ctx.fillStyle = '#D8DDE4'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(opts.centerText || '', cx, cy + 5);
    }
  };

  /* ============================================================
   * UI 渲染与事件
   * ============================================================ */
  var App = {
    currentTab: 'home',
    analysisSub: 'stats',
    statsYear: null,
    editingChargeId: null,
    editingVehicleId: null,
    chargeAdvancedOpen: false,

    init: function () {
      Store.load();
      // 首次启动：无任何数据时自动写入默认车辆与充电记录（作为默认数据展示）
      if (Store.data.vehicles.length === 0 && Store.data.charges.length === 0) {
        this.seedDefaultData();
      }
      this.bindEvents();
      this.bindAnalysisSegments();
      this.renderAll();
      // 系统/浏览器返回：若当前处于「添加/编辑记录」内嵌页则先关闭它回到当前页/首页，而非退出应用
      window.addEventListener('popstate', function () {
        if (App._overlayDepth > 0) {
          App._overlayDepth = Math.max(0, App._overlayDepth - 1);
          App.closeChargePage(true);
        }
      });
      // 启动时拉取云端同步（若已启用）
      Sync.startup();
    },

    /* ---- 默认数据：首次启动自动写入（智己 L6 及充电记录） ---- */
    seedDefaultData: function () {
      var v = VehicleMgr.add({
        name: '智己 L6', brand: '智己', model: 'L6 max 标准版',
        batteryCapacity: 75, supportsFastCharge: true, maxChargePower: 153
      });
      // 价格为 0 的为慢充，其余皆为快充
      var records = [
        { d: '5月30日', cost: 63.93, kwh: 56.3, fast: true },
        { d: '6月2日', cost: 47.57, kwh: 62.1, fast: true },
        { d: '6月10日', cost: 0, kwh: 44.9, fast: false },
        { d: '6月13日', cost: 21.6, kwh: 44.1, fast: true },
        { d: '6月20日', cost: 0, kwh: 50, fast: false },
        { d: '6月23日', cost: 0, kwh: 19, fast: false },
        { d: '6月28日', cost: 8.65, kwh: 44.7, fast: true },
        { d: '7月4日', cost: 1.2, kwh: 12, fast: true },
        { d: '7月5日', cost: 19, kwh: 27, fast: true },
        { d: '7月6日', cost: 1.2, kwh: 22, fast: true },
        { d: '7月6日', cost: 15.5, kwh: 28, fast: true },
        { d: '7月11日', cost: 18.9, kwh: 35, fast: true },
        { d: '7月25日', cost: 38.23, kwh: 64.7, fast: true },
        { d: '8月9日', cost: 23.89, kwh: 48, fast: true },
        { d: '8月16日', cost: 31, kwh: 52, fast: true },
        { d: '8月26日', cost: 18.4, kwh: 30, fast: true },
        { d: '8月30日', cost: 29.3, kwh: 52, fast: true }
      ];
      var year = new Date().getFullYear();
      var months = { '5': '05', '6': '06', '7': '07', '8': '08' };
      var self = this;
      records.forEach(function (r) {
        var m = /^(\d+)月(\d+)日$/.exec(r.d);
        if (!m) return;
        var mm = months[String(parseInt(m[1], 10))] || String(m[1]).padStart(2, '0');
        var dd = String(parseInt(m[2], 10)).padStart(2, '0');
        ChargeMgr.add({
          vehicleId: v.id,
          date: year + '-' + mm + '-' + dd,
          odometer: 0, chargeType: r.fast ? 'fast' : 'slow',
          kWh: r.kwh, totalCost: r.cost,
          unitPrice: r.cost > 0 ? +(r.cost / r.kwh).toFixed(2) : 0,
          socBefore: 0, socAfter: 0
        });
      });
      setTimeout(function () { self.toast('已载入默认数据：' + v.name, 'success'); }, 400);
    },

    bindEvents: function () {
      var self = this;
      document.querySelectorAll('.tabbar-dark .tab-item').forEach(function (btn) {
        btn.addEventListener('click', function () { self.switchTab(btn.dataset.tab); });
      });
      var chargeForm = document.getElementById('chargeFormPage-form');
      if (chargeForm) {
        chargeForm.addEventListener('submit', function (e) { e.preventDefault(); self.saveCharge(); });
        // 原生必填校验拦截：任一必填字段未填即抖动按钮提示
        chargeForm.addEventListener('invalid', function () { self.shakeSaveBtn(); }, true);
      }
      var vehicleForm = document.getElementById('vehicleForm');
      if (vehicleForm) vehicleForm.addEventListener('submit', function (e) { e.preventDefault(); self.saveVehicle(); });

      document.querySelectorAll('.modal-close, .modal-overlay').forEach(function (el) {
        el.addEventListener('click', function () { self.closeModals(); });
      });

      // 充电类型分段按钮
      var segBtns = document.querySelectorAll('#cf_chargeTypeSegment .form-segment-btn');
      segBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          segBtns.forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          document.getElementById('cf_chargeType').value = btn.dataset.val;
        });
      });

      // 确认面板按钮
      var confirmOkBtn = document.getElementById('confirmOkBtn');
      if (confirmOkBtn) confirmOkBtn.addEventListener('click', function () { self.confirmOk(); });

      // 充电数据互算：度数 × 单价 = 总费用
      var kWhInput = document.getElementById('cf_kWh');
      var priceInput = document.getElementById('cf_unitPrice');
      var costInput = document.getElementById('cf_totalCost');
      var calcHint = document.getElementById('autoCalcHint');
      var calcText = document.getElementById('autoCalcText');

      function updateAutoCalc(changedField) {
        var k = parseFloat(kWhInput.value) || 0;
        var p = parseFloat(priceInput.value) || 0;
        var c = parseFloat(costInput.value) || 0;

        // 仅当触发字段有值时联动计算；清空字段时保持其他字段不变，避免误归零
        if (changedField === 'kWh') {
          if (k > 0) {
            if (p > 0) {
              costInput.value = (k * p).toFixed(2);
              showHint('已自动计算：' + k + ' 度 × ' + p + ' 元/度 = ' + (k * p).toFixed(2) + ' 元');
            } else if (c > 0) {
              priceInput.value = (c / k).toFixed(2);
              showHint('已自动计算：' + c + ' 元 ÷ ' + k + ' 度 = ' + (c / k).toFixed(2) + ' 元/度');
            }
          }
        } else if (changedField === 'unitPrice') {
          // 单价变了：度数、单价均有值时才自动算总费用
          if (k > 0 && p > 0) {
            costInput.value = (k * p).toFixed(2);
            showHint('已自动计算：' + k + ' 度 × ' + p + ' 元/度 = ' + (k * p).toFixed(2) + ' 元');
          }
        } else if (changedField === 'totalCost') {
          // 总费用变了：度数、总费用均有值时才自动算单价
          if (k > 0 && c > 0) {
            priceInput.value = (c / k).toFixed(2);
            showHint('已自动计算：' + c + ' 元 ÷ ' + k + ' 度 = ' + (c / k).toFixed(2) + ' 元/度');
          }
        }
      }

      function showHint(text) {
        if (calcHint && calcText) {
          calcText.textContent = text;
          calcHint.style.display = 'flex';
        }
      }

      function hideHint() {
        if (calcHint) calcHint.style.display = 'none';
      }

      // 同步「预计充电费用」预览卡（设计稿 record-summary-dark）
      self.refreshCostPreview = function () {
        var costPreview = document.getElementById('cf_costPreview');
        if (!costPreview) return;
        var costPreviewDetail = document.getElementById('cf_costPreviewDetail');
        var k = parseFloat(kWhInput.value) || 0;
        var p = parseFloat(priceInput.value) || 0;
        var c = parseFloat(costInput.value) || 0;
        var total = c > 0 ? c : (k > 0 && p > 0 ? k * p : 0);
        costPreview.textContent = '¥' + Utils.fmtMoney(total);
        if (k > 0 && p > 0 && total > 0) {
          costPreviewDetail.textContent = k + ' 度 × ¥' + Utils.fmtMoney(p) + '/度';
        } else if (total > 0) {
          costPreviewDetail.textContent = '总费用已填写';
        } else {
          costPreviewDetail.textContent = '输入电量和单价后自动计算';
        }
      };

      if (kWhInput) { kWhInput.addEventListener('input', function () { updateAutoCalc('kWh'); self.refreshCostPreview(); }); }
      if (priceInput) { priceInput.addEventListener('input', function () { updateAutoCalc('unitPrice'); self.refreshCostPreview(); }); }
      if (costInput) { costInput.addEventListener('input', function () { updateAutoCalc('totalCost'); self.refreshCostPreview(); }); }

      var exportBtn = document.getElementById('btnExport');
      if (exportBtn) exportBtn.addEventListener('click', function () { Store.exportJSON(); self.toast('已导出备份文件', 'success'); });
      var importInput = document.getElementById('importInput');
      if (importInput) importInput.addEventListener('change', function () {
        if (this.files[0]) Store.importJSON(this.files[0], function (ok, msg) { self.toast(msg, ok ? 'success' : 'error'); if (ok) location.reload(); });
      });
      var clearBtn = document.getElementById('btnClear');
      if (clearBtn) clearBtn.addEventListener('click', function () {
        self.showConfirm('清空所有数据', '确定清空所有数据？此操作不可恢复，建议先导出备份。', function () {
          Store.clearAll();
          location.reload();
        });
      });
    },

    bindAnalysisSegments: function () {
      var self = this;
      document.querySelectorAll('.segment-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          self.analysisSub = btn.dataset.sub;
          document.querySelectorAll('.segment-btn').forEach(function (b) { b.classList.toggle('active', b === btn); });
          self.renderAnalysis();
        });
      });
    },

    switchTab: function (tab) {
      Charts.hide();
      this.currentTab = tab;
      document.querySelectorAll('.tabbar-dark .tab-item').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === tab); });
      document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.toggle('active', p.id === 'panel-' + tab); });
      this.renderTab(tab);
      // 切换页签后回到顶部，避免新页签停留在上个页面的滚动位置
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    },

    renderTab: function (tab) {
      switch (tab) {
        case 'home': this.renderHome(); break;
        case 'records': this.renderRecords(); break;
        case 'analysis': this.renderAnalysis(); break;
        case 'profile': this.renderProfile(); break;
      }
    },

    renderAll: function () {
      this.renderVehiclePill();
      this.renderTab(this.currentTab);
    },

    renderVehiclePill: function () {
      var nameEl = document.getElementById('vehiclePillName');
      if (!nameEl) return;
      var v = VehicleMgr.current();
      nameEl.textContent = v ? v.name : '未选择';
    },

    /* ---- 首页 ---- */
    renderHome: function () {
      var vehicle = VehicleMgr.current();
      var vid = vehicle ? vehicle.id : null;
      var ov = Stats.overview(vid);
      var html = '';

      if (!vid) {
        html += '<div class="empty-state">'
          + '<img class="empty-state-illustration" src="assets/hero-empty.png" alt="添加车辆">'
          + '<p>还没有添加车辆，先添加一辆车开始记录吧</p>'
          + '<button class="btn btn-sm btn-primary" onclick="App.openVehicleModal()">' + Icons.plus + '添加车辆</button></div>';
        document.getElementById('panel-home').innerHTML = html;
        return;
      }

      // 顶部毛玻璃导航（设计稿 home-nav-dark · 仅标题，无侧按钮）
      html += '<div class="home-nav-dark">'
        + '<span class="nav-title">冲充电</span>'
        + '</div>';

      // 液态玻璃英雄卡（设计稿 home-hero-dark · 本月费用 + 副信息）
      var mv = Utils.monthKey(Utils.today()).slice(0, 4);
      var abit = Utils.fmtMoney(ov.thisMonthCost).split('.');
      html += '<div class="home-hero-dark">';
      html += '<div class="month-label">' + (this.monthLabelHome || Utils.monthLabel(Utils.monthKey(Utils.today()))) + ' · 本月费用</div>';
      html += '<div class="amount">¥' + abit[0] + (abit[1] ? '<span class="unit">.' + abit[1] + '</span>' : '') + '</div>';
      html += '<div class="hero-sub">';
      html += '<span class="sub-item">充入 <strong>' + Utils.fmt(ov.thisMonthKWh, 1) + '</strong> 度</span>';
      html += '<span class="sub-item">均价 <strong>¥' + Utils.fmtMoney(ov.thisMonthKWh > 0 ? ov.thisMonthCost / ov.thisMonthKWh : 0) + '</strong>/度</span>';
      html += '<span class="sub-item"><strong>' + ov.thisMonthCount + '</strong> 次</span>';
      html += '</div></div>';

      // KPI 图标网格（设计稿 kpi-grid-dark · 累计类 2x2）
      var pkm = Stats.pricePerKm(vid);
      html += '<div class="kpi-grid-dark">';
      html += '<div class="kpi-dark"><div class="kpi-icon ic-gold">' + Icons.coin + '</div><div class="kpi-value">¥' + Utils.fmtMoney(ov.totalCost) + '</div><div class="kpi-label">累计费用</div></div>';
      html += '<div class="kpi-dark"><div class="kpi-icon ic-teal">' + Icons.zap + '</div><div class="kpi-value">' + Utils.fmt(ov.totalKWh, 1) + '</div><div class="kpi-label">累计度数</div></div>';
      html += '<div class="kpi-dark"><div class="kpi-icon ic-blue">' + Icons.battery + '</div><div class="kpi-value">' + ov.chargeCount + '</div><div class="kpi-label">充电次数</div></div>';
      html += '<div class="kpi-dark"><div class="kpi-icon ic-orange">' + Icons.gauge + '</div><div class="kpi-value">' + (pkm.hasData ? '¥' + Utils.fmt(pkm.value, 2) : '—') + '</div><div class="kpi-label">每公里费用</div></div>';
      html += '</div>';

      // 费用趋势（设计稿 chart-card-dark + mini bar）
      html += '<div class="home-section-header"><h4>费用趋势</h4><span class="see-all" onclick="App.switchTab(\'analysis\');App.setAnalysisSub(\'stats\')">更多 ›</span></div>';
      html += '<div class="chart-card-dark"><div class="chart-title">近 6 个月充电费用</div><div class="mini-chart">';
      html += this.homeMiniChartHTML(vid);
      html += '</div></div>';

      // 关键指标网格（设计稿 stat-grid-dark）
      var effInfo = Stats.avgEfficiency(vid);
      var ratio = Stats.chargeTypeRatio(vid);
      var fastPct = Math.round(ratio.fast * 100);
      var slowPct = 100 - fastPct;
      var health = BatteryHealth.capacityHealth(vid);
      html += '<div class="home-section-header"><h4>关键指标</h4></div>';
      html += '<div class="stat-grid-dark">';
      html += '<div class="stat-mini-dark" onclick="App.switchTab(\'analysis\');App.setAnalysisSub(\'stats\')">'
        + '<div class="sm-icon-row"><div class="sm-icon ic-teal">' + Icons.gauge + '</div><span class="sm-label">平均电耗</span></div>'
        + '<div class="sm-value">' + (effInfo.enough ? Utils.fmt(effInfo.avg, 1) : (effInfo.count > 0 ? '不足' : '—')) + '</div>'
        + '<div class="sm-trend">' + (effInfo.enough ? 'kWh/100km' : (effInfo.count > 0 ? '数据样本不足' : '补录里程后可算')) + '</div></div>';
      html += '<div class="stat-mini-dark" onclick="App.showStatDetail(\'totalKWh\', \'' + vid + '\')">'
        + '<div class="sm-icon-row"><div class="sm-icon ic-gold">' + Icons.coin + '</div><span class="sm-label">平均电价</span></div>'
        + '<div class="sm-value">¥' + Utils.fmtMoney(ov.avgPrice) + '</div>'
        + '<div class="sm-trend">元/度</div></div>';
      html += '<div class="stat-mini-dark" onclick="App.showStatDetail(\'fastslow\', \'' + vid + '\')">'
        + '<div class="sm-icon-row"><div class="sm-icon ic-orange">' + Icons.infinity + '</div><span class="sm-label">快慢充比</span></div>'
        + '<div class="sm-value">' + fastPct + ':' + slowPct + '</div>'
        + '<div class="sm-trend">快充 ' + fastPct + '%</div></div>';
      html += '<div class="stat-mini-dark" onclick="App.switchTab(\'analysis\');App.setAnalysisSub(\'health\')">'
        + '<div class="sm-icon-row"><div class="sm-icon ic-purple">' + Icons.shield + '</div><span class="sm-label">电池健康</span></div>'
        + '<div class="sm-value">' + (health.index === null ? '—' : health.index) + '</div>'
        + '<div class="sm-trend">' + (health.index === null ? '补录电量后可算' : '健康指数') + '</div></div>';
      html += '</div>';

      // 最近充电（设计稿 recent-list-dark · 3 条）
      var recent = ChargeMgr.list(vid).slice(0, 3);
      html += '<div class="home-section-header"><h4>最近充电</h4><span class="see-all" onclick="App.switchTab(\'records\')">全部 ›</span></div>';
      html += '<div class="recent-list-dark">';
      if (recent.length === 0) {
        html += '<div class="records-empty" style="padding:22px;">' + Icons.bolt + '<div class="re-title">暂无充电记录</div><div class="re-sub">点击下方「记一笔」开始记录</div></div>';
      } else {
        var self2 = this;
        recent.forEach(function (c) {
          html += self2.recentItemDarkHTML(c);
        });
      }
      html += '</div>';

      document.getElementById('panel-home').innerHTML = html;
    },

    /* 首页迷你柱状费用图（设计稿 mini-chart · 6 个月） */
    homeMiniChartHTML: function (vid) {
      var months = Stats.monthlyCost(vid, Utils.recentMonths(6));
      var max = 1;
      months.forEach(function (d) { if (d.value > max) max = d.value; });
      if (max <= 0) max = 1;
      var html = '';
      months.forEach(function (d, i) {
        var h = Math.max(8, Math.round((d.value / max) * 100));
        var isLast = i === months.length - 1;
        html += '<div class="bar' + (isLast ? ' active' : ' muted') + '" style="height:' + h + '%;" title="' + Utils.fmtMoney(d.value) + '" onclick="App.showChartSheet(\'month\',\'' + d.monthKey + '\')">'
          + '<span class="bar-label">' + d.label + '</span></div>';
      });
      return html;
    },

    /* 首页最近充电卡片（设计稿 recent-item-dark） */
    recentItemDarkHTML: function (c) {
      var note = (c.note || '').replace(/[<>&]/g, function (ch) {
        return ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&amp;';
      });
      var title = note ? note : (c.chargeType === 'fast' ? '快充' : '慢充');
      var date = c.date.replace(/-/g, '.');
      var iconClass = c.chargeType === 'fast' ? 'ic-fast' : 'ic-slow';
      var iconSvg = c.chargeType === 'fast' ? Icons.zap : Icons.power;
      return '<div class="recent-item-dark" onclick="App.showChargeDetail(\'' + c.id + '\')">'
        + '<div class="ri-icon ' + iconClass + '">' + iconSvg + '</div>'
        + '<div class="ri-info"><div class="ri-title">' + Utils.fmt(c.kWh, 1) + ' 度</div><div class="ri-sub">' + date + '</div></div>'
        + '<div class="ri-amount">¥' + Utils.fmtMoney(c.totalCost) + '</div></div>';
    },

    statCard: function (color, icon, title, value, sub, key, vid) {
      return '<div class="stat-card ' + color + '" onclick="App.showStatDetail(\'' + key + '\', \'' + (vid || '') + '\')">'
        + '<div class="stat-head"><span class="stat-ic">' + icon + '</span><span class="stat-title">' + title + '</span></div>'
        + '<div class="stat-value">' + value + '</div>'
        + '<div class="stat-sub">' + sub + '</div></div>';
    },

    /* ---- 统计卡片详情弹窗 ---- */
    _sdRow: function (label, value) {
      return '<div class="ds-cell"><div class="dc-label">' + label + '</div><div class="dc-value" style="font-size:15px;">' + value + '</div></div>';
    },
    showStatDetail: function (key, vid) {
      vid = vid || Store.data.vehicles[0] && Store.data.vehicles[0].id;
      var year = this.statsYear ? String(this.statsYear) : null;
      var charges = vid ? Store.data.charges.filter(function (c) { return c.vehicleId === vid; }) : Store.data.charges;
      if (year) charges = charges.filter(function (c) { return c.date.slice(0, 4) === year; });

      var ov = Stats.overview(vid, this.statsYear);
      var ratio = Stats.chargeTypeRatio(vid, this.statsYear);
      var fastCount = 0, slowCount = 0, fastKWh = 0, slowKWh = 0;
      charges.forEach(function (c) {
        if (c.chargeType === CHARGE_TYPE.FAST) { fastCount++; fastKWh += c.kWh || 0; }
        else { slowCount++; slowKWh += c.kWh || 0; }
      });
      var costs = charges.map(function (c) { return c.totalCost || 0; }).filter(function (v) { return v > 0; });
      var maxC = costs.length ? Math.max.apply(null, costs) : 0;
      var minC = costs.length ? Math.min.apply(null, costs) : 0;
      var avgCost = charges.length ? ov.totalCost / charges.length : 0;
      var fastPct = charges.length ? Math.round(fastCount / charges.length * 100) : 0;

      var effInfo = Stats.avgEfficiency(vid, year);
      var eff = effInfo.samples;
      var effVal = effInfo.avg;

      var period = year ? year + '年' : '全部记录';
      var title = '', heroLabel = '', heroValue = '', heroSub = '', body = '';
      var self = this;

      if (key === 'totalCost') {
        title = '总费用'; heroLabel = '充电总费用'; heroValue = '¥' + Utils.fmtMoney(ov.totalCost);
        heroSub = period + ' · ' + ov.chargeCount + ' 次';
        body = '<div class="ds-hero"><div class="dh-label">' + heroLabel + '</div>'
          + '<div class="dh-value">' + heroValue + '</div>'
          + '<div class="dh-sub">' + heroSub + '</div></div>'
          + '<div class="ds-grid">'
          + this._sdRow('平均每次', '¥' + Utils.fmtMoney(avgCost))
          + this._sdRow('单次最高', '¥' + Utils.fmtMoney(maxC))
          + this._sdRow('单次最低', '¥' + Utils.fmtMoney(minC))
          + this._sdRow('本月费用', '¥' + Utils.fmtMoney(ov.thisMonthCost))
          + this._sdRow('充电次数', ov.chargeCount + ' 次')
          + '</div><div class="ds-note"><b>说明：</b>统计' + period + '内全部充电记录的总支出（快充 + 慢充），按每次充电的「总费用」累加；均价 = 总费用 ÷ 总度数。</div>';
      } else if (key === 'totalKWh') {
        title = '总度数'; heroLabel = '充电总度数'; heroValue = Utils.fmt(ov.totalKWh, 1) + ' 度';
        heroSub = period + ' · 均价 ¥' + Utils.fmtMoney(ov.avgPrice) + '/度';
        body = '<div class="ds-hero"><div class="dh-label">' + heroLabel + '</div>'
          + '<div class="dh-value">' + heroValue + '</div>'
          + '<div class="dh-sub">' + heroSub + '</div></div>'
          + '<div class="ds-grid">'
          + this._sdRow('平均单价', '¥' + Utils.fmtMoney(ov.avgPrice) + '/度')
          + this._sdRow('快充度数', Utils.fmt(fastKWh, 1) + ' 度 · ' + fastCount + ' 次')
          + this._sdRow('慢充度数', Utils.fmt(slowKWh, 1) + ' 度 · ' + slowCount + ' 次')
          + this._sdRow('本月度数', Utils.fmt(ov.thisMonthKWh, 1) + ' 度')
          + this._sdRow('充电次数', ov.chargeCount + ' 次')
          + '</div><div class="ds-note"><b>说明：</b>统计' + period + '内充入电池的总电量，按每次充电「度数」累加；并按快充 / 慢充分别汇总。</div>';
      } else if (key === 'avgEff') {
        title = '平均电耗';
        var effValStr = effInfo.enough ? Utils.fmt(effVal, 1) + ' 度/100km' : (eff.length ? '数据不足' : '—');
        heroLabel = '百公里平均电耗'; heroValue = effInfo.enough ? Utils.fmt(effVal, 1) : '—';
        heroSub = period + ' · ' + eff.length + ' 组有效样本';
        var effList = '';
        if (eff.length) {
          effList = '<div class="ds-grid">';
          eff.forEach(function (e) {
            effList += '<div class="ds-cell"><div class="dc-label">' + e.date + '</div><div class="dc-value" style="font-size:14px;">' + Utils.fmt(e.value, 1) + '<span class="dc-unit">度/100km</span></div></div>';
          });
          effList += '</div>';
        }
        body = '<div class="ds-hero"><div class="dh-label">' + heroLabel + '</div>'
          + '<div class="dh-value">' + heroValue + '</div>'
          + '<div class="dh-sub">' + heroSub + '</div></div>'
          + '<div class="ds-grid">'
          + this._sdRow('有效样本', eff.length + ' 组')
          + '</div>' + (effList || '')
          + '<div class="ds-note"><b>说明：</b>电耗 = 相邻两次充电间「充入度数 ÷ 行驶里程 × 100」。仅纳入两次里程都有效的区间；需至少 3 组有效样本才给出均值。</div>';
      } else if (key === 'pricePerKm') {
        title = '每公里单价';
        var pkmData = Stats.pricePerKm(vid, year);
        var pkmVal = pkmData.hasData ? '¥' + Utils.fmt(pkmData.value, 2) : '—';
        heroLabel = '每公里充电费用'; heroValue = pkmData.hasData ? '¥' + Utils.fmt(pkmData.value, 2) : '—';
        heroSub = period + ' · ' + effInfo.count + ' 组有效样本';
        body = '<div class="ds-hero"><div class="dh-label">' + heroLabel + '</div>'
          + '<div class="dh-value">' + heroValue + '</div>'
          + '<div class="dh-sub">' + heroSub + '</div></div>'
          + '<div class="ds-grid">'
          + this._sdRow('平均电价', '¥' + Utils.fmtMoney(ov.avgPrice) + '/度')
          + this._sdRow('百公里电耗', effInfo.enough ? Utils.fmt(effVal, 1) + ' 度/100km' : (effInfo.count > 0 ? '数据不足' : '—'))
          + this._sdRow('有效样本', effInfo.count + ' 组')
          + '</div><div class="ds-note"><b>说明：</b>每公里单价 = 平均电价 × 百公里电耗 ÷ 100。需要补录里程数据后方可计算。</div>';
      } else if (key === 'fastslow') {
        title = '快慢充比';
        heroLabel = '快慢充比例'; heroValue = fastPct + ':' + (100 - fastPct);
        heroSub = period + ' · ' + charges.length + ' 次充电';
        body = '<div class="ds-hero"><div class="dh-label">' + heroLabel + '</div>'
          + '<div class="dh-value">' + heroValue + '</div>'
          + '<div class="dh-sub">' + heroSub + '</div></div>'
          + '<div class="ds-grid">'
          + this._sdRow('快充', fastCount + ' 次 · ' + fastPct + '%')
          + this._sdRow('慢充', slowCount + ' 次 · ' + (100 - fastPct) + '%')
          + this._sdRow('快充度数', Utils.fmt(fastKWh, 1) + ' 度')
          + this._sdRow('慢充度数', Utils.fmt(slowKWh, 1) + ' 度')
          + '</div><div class="ds-note"><b>说明：</b>展示充电方式的选择偏好。建议在电量 20%–80% 区间快慢结合，日常以慢充为主、长途应急用快充。</div>';
      } else {
        return;
      }

      var sheet = document.getElementById('dataSheet');
      if (!sheet) return;
      var head = document.querySelector('.data-sheet-head');
      if (head) {
        head.innerHTML = '<div>'
          + '<h3 id="dsTitle">' + title + '</h3>'
          + '<div class="ds-sub">' + period + '</div></div>'
          + '<button type="button" class="ds-close-btn" onclick="App.closeChartSheet()" aria-label="关闭">'
          + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="6" x2="18" y2="18" stroke-linecap="round"/><line x1="6" y1="18" x2="18" y2="6" stroke-linecap="round"/></svg></button>';
      }
      document.getElementById('dsBody').innerHTML = body;
      sheet.classList.add('show');
    },
    closeStatDetail: function () {
      this.closeChartSheet();
      var head = document.querySelector('.data-sheet-head');
      if (head) {
        head.innerHTML = '<div>'
          + '<h3 id="dsTitle">数据明细</h3>'
          + '<div class="ds-sub" id="dsSub"></div></div>'
          + '<button type="button" class="ds-close-btn" onclick="App.closeChartSheet()" aria-label="关闭">'
          + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="6" x2="18" y2="18" stroke-linecap="round"/><line x1="6" y1="18" x2="18" y2="6" stroke-linecap="round"/></svg></button>';
      }
    },

    /* ---- 趋势图容器（左侧固定Y轴 + 右侧可横滑图表） ---- */
    chartWrap: function (id) {
      return '<div class="chart-fixed"><div class="chart-yaxis" id="' + id + 'Y"></div>'
        + '<div class="chart-body"><div class="chart-scroll"><canvas id="' + id + '" class="chart"></canvas></div></div></div>';
    },

    /* ---- 充电记录卡片HTML ---- */
    chargeCardHTML: function (c, showActions) {
      var typeIcon = c.chargeType === 'fast' ? Icons.zap : Icons.power;
      var typeLabel = CHARGE_TYPE_LABEL[c.chargeType];
      var html = '<div class="charge-card ' + c.chargeType + '" onclick="App.toggleChargeCard(this, \'' + c.id + '\')">';
      html += '<div class="charge-card-main">';
      html += '<div class="charge-card-icon">' + typeIcon + '</div>';
      html += '<div class="charge-card-body">';
      html += '<div class="charge-card-top">';
      html += '<span class="charge-card-date">' + c.date + '</span>';
      html += '<span class="charge-card-amount">¥' + Utils.fmtMoney(c.totalCost) + '</span>';
      html += '</div>';
      html += '<div class="charge-card-meta">';
      html += '<span>' + Icons.zap + Utils.fmt(c.kWh, 1) + ' 度</span>';
      html += '<span>' + typeIcon + typeLabel + '</span>';
      if (c.socBefore || c.socAfter) html += '<span>' + Icons.battery + c.socBefore + '%→' + c.socAfter + '%</span>';
      html += '</div>';
      html += '</div>';
      html += '</div>';
      // 展开详情
      html += '<div class="charge-card-detail">';
      html += '<div class="charge-detail-grid">';
      if (c.odometer) html += '<div class="charge-detail-item"><div class="cd-label">里程表</div><div class="cd-value">' + c.odometer + ' km</div></div>';
      if (c.unitPrice) html += '<div class="charge-detail-item"><div class="cd-label">单价</div><div class="cd-value">¥' + Utils.fmtMoney(c.unitPrice) + '/度</div></div>';
      html += '<div class="charge-detail-item"><div class="cd-label">度数</div><div class="cd-value">' + Utils.fmt(c.kWh, 1) + ' kWh</div></div>';
      html += '<div class="charge-detail-item"><div class="cd-label">总费用</div><div class="cd-value">¥' + Utils.fmtMoney(c.totalCost) + '</div></div>';
      if (c.note) html += '<div class="charge-detail-item" style="grid-column:1/-1;"><div class="cd-label">备注</div><div class="cd-value">' + c.note + '</div></div>';
      html += '</div>';
      if (showActions !== false) {
        html += '<div class="charge-card-actions">';
        html += '<button class="btn-mini" onclick="event.stopPropagation();App.editCharge(\'' + c.id + '\')">' + Icons.edit + '编辑</button>';
        html += '<button class="btn-mini danger" onclick="event.stopPropagation();App.deleteCharge(\'' + c.id + '\')">' + Icons.trash + '删除</button>';
        html += '</div>';
      }
      html += '</div>';
      html += '</div>';
      return html;
    },

    toggleChargeCard: function (el, id) {
      el.classList.toggle('expanded');
    },

    /* ---- 充电记录 ---- */
    recordsFilter: 'all',
    recordsMonthFilter: '',
    recordsYearFilter: '',

    renderRecords: function () {
      var vehicle = VehicleMgr.current();
      var vid = vehicle ? vehicle.id : null;
      var panel = document.getElementById('panel-records');
      if (!vid) {
        panel.innerHTML = '<div class="home-nav-dark">'
          + '<span class="nav-title">充电记录</span></div>'
          + '<div class="records-empty">' + Icons.doc + '<div class="re-title">请先添加车型</div><div class="re-sub">添加车型后才能记录充电</div><button class="re-btn" onclick="App.switchTab(\'profile\')">去添加车辆</button></div>';
        return;
      }

      var charges = ChargeMgr.list(vid).slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
      var filter = this.recordsFilter || 'all';
      var yrF = this.recordsYearFilter || '';
      var moF = this.recordsMonthFilter || '';
      var fCount = this.recordsFilterCount();
      if (filter !== 'all') charges = charges.filter(function (c) { return c.chargeType === filter; });
      if (yrF) charges = charges.filter(function (c) { return (c.date || '').slice(0, 4) === yrF; });
      if (moF) charges = charges.filter(function (c) { return (c.date || '').slice(0, 7) === moF; });

      var html = '';

      // 顶部导航：仅标题（无返回/新增按钮，新增入口为底部导航栏中央+按钮）
      html += '<div class="home-nav-dark">'
        + '<span class="nav-title">充电记录</span>'
        + '</div>';

      // 工具栏：总数 + 筛选（默认隐藏面板）
      html += '<div class="records-toolbar-dark">'
        + '<div class="toolbar-title">全部记录<span class="tb-sub">' + charges.length + ' 条' + (fCount ? ' · 已筛选 ' + fCount + ' 项' : '') + '</span></div>'
        + '<div class="toolbar-actions">'
        + '<button class="filter-toggle-btn' + (fCount ? ' active' : '') + '" onclick="App.toggleRecordsFilter()">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        + '筛选' + (fCount ? '<span class="f-count">' + fCount + '</span>' : '') + '</button>'
        + '</div></div>';

      // 隐藏式筛选面板
      if (this.recordsFilterOpen) html += this.recordsFilterPanelHTML(vid, filter, yrF, moF);

      // 记录列表：按年份/月份分段 + 区间统计
      html += '<div class="records-list-wrap">';
      if (!charges.length) {
        html += '<div class="records-empty" style="margin-top:26px;">' + Icons.bolt
          + '<div class="re-title">' + (fCount ? '没有符合条件的记录' : '还没有充电记录') + '</div>'
          + '<div class="re-sub">' + (fCount ? '试试调整筛选条件' : '点击底部+按钮记录第一条充电') + '</div>'
          + '</div>';
      } else {
        var byYear = {};
        charges.forEach(function (c) { var y = (c.date || '').slice(0, 4) || '未知'; (byYear[y] = byYear[y] || []).push(c); });
        var years = Object.keys(byYear).sort().reverse();
        var self = this;
        years.forEach(function (y) {
          var list = byYear[y];
          var yCost = 0;
          list.forEach(function (c) { yCost += c.totalCost || 0; });
          html += '<div class="records-year-group"><div class="records-year-title">' + y + ' 年<span class="ry-count">¥' + Utils.fmtMoney(yCost) + ' · ' + list.length + ' 条</span></div>';
          var byMonth = {};
          list.forEach(function (c) { var m = (c.date || '').slice(0, 7); (byMonth[m] = byMonth[m] || []).push(c); });
          var months = Object.keys(byMonth).sort().reverse();
          months.forEach(function (mk) {
            var ml = byMonth[mk];
            var cost = 0, kwh = 0;
            ml.forEach(function (c) { cost += c.totalCost || 0; kwh += c.kWh || 0; });
            html += '<div class="records-month-group">'
              + '<div class="records-month-head">'
              + '<span class="rm-title">' + Utils.monthShort(mk) + '</span>'
              + '<div class="rm-stats">'
              + '<span class="rm-stat">费用 <b>¥' + Utils.fmtMoney(cost) + '</b></span>'
              + '<span class="rm-stat"><b>' + Utils.fmt(kwh, 1) + '</b> 度</span>'
              + '<span class="rm-stat"><b>' + ml.length + '</b> 次</span>'
              + '</div></div>'
              + '<div class="records-month-list">';
            ml.forEach(function (c) { html += self.recordItemHTML(c); });
            html += '</div></div>';
          });
          html += '</div>';
        });
      }
      html += '</div>';

      panel.innerHTML = html;
    },

    /* 隐藏式筛选面板内容 */
    recordsFilterPanelHTML: function (vid, filter, yrF, moF) {
      var html = '<div class="records-filter-panel open" id="recordsFilterPanel">';
      html += '<div class="rf-group"><div class="rf-label">充电类型</div><div class="rf-chips">';
      [['all', '全部'], ['fast', '快充'], ['slow', '慢充']].forEach(function (o) {
        html += '<button class="rf-chip' + (filter === o[0] ? ' active' : '') + '" onclick="App.setRecordsFilter(\'' + o[0] + '\')">' + o[1] + '</button>';
      });
      html += '</div></div>';
      var years = Utils.availableYears(vid);
      html += '<div class="rf-group"><div class="rf-label">年份</div><div class="rf-chips">';
      html += '<button class="rf-chip' + (!yrF ? ' active' : '') + '" onclick="App.setRecordsYear(\'\')">全部</button>';
      years.forEach(function (y) {
        html += '<button class="rf-chip' + (yrF === y ? ' active' : '') + '" onclick="App.setRecordsYear(\'' + y + '\')">' + y + ' 年</button>';
      });
      html += '</div></div>';
      if (yrF) {
        var ms = Utils.yearMonths(yrF);
        html += '<div class="rf-group"><div class="rf-label">月份</div><div class="rf-chips">';
        html += '<button class="rf-chip' + (!moF ? ' active' : '') + '" onclick="App.setRecordsMonth(\'\')">全部</button>';
        ms.forEach(function (mk) {
          html += '<button class="rf-chip' + (moF === mk ? ' active' : '') + '" onclick="App.setRecordsMonth(\'' + mk + '\')">' + Utils.monthShort(mk) + '</button>';
        });
        html += '</div></div>';
      }
      html += '</div>';
      return html;
    },

    recordsFilterCount: function () {
      var n = 0;
      if (this.recordsFilter && this.recordsFilter !== 'all') n++;
      if (this.recordsYearFilter) n++;
      if (this.recordsMonthFilter) n++;
      return n;
    },

    toggleRecordsFilter: function () {
      this.recordsFilterOpen = !this.recordsFilterOpen;
      this.renderRecords();
    },

    /* ---- 图表半屏数据弹层 ---- */
    showChartSheet: function (type, key) {
      var vehicle = VehicleMgr.current();
      var vid = vehicle ? vehicle.id : null;
      var sheet = document.getElementById('dataSheet');
      if (!sheet) return;
      var fn = this[type + 'Sheet'];
      if (typeof fn !== 'function') return;
      var res = fn.call(this, vid, key);
      if (!res) return;
      // 始终重建头部为标准图表标题结构，避免被详情/统计弹层覆盖后残留导致取不到 dsTitle/dsSub
      var head = document.querySelector('.data-sheet-head');
      if (head) {
        head.innerHTML = '<div>'
          + '<h3 id="dsTitle">数据明细</h3>'
          + '<div class="ds-sub" id="dsSub"></div></div>'
          + '<button type="button" class="ds-close-btn" onclick="App.closeChartSheet()" aria-label="关闭">'
          + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="6" x2="18" y2="18" stroke-linecap="round"/><line x1="6" y1="18" x2="18" y2="6" stroke-linecap="round"/></svg></button>';
      }
      document.getElementById('dsTitle').textContent = res.title;
      document.getElementById('dsSub').textContent = res.sub || '';
      document.getElementById('dsBody').innerHTML = res.body;
      sheet.classList.add('show');
    },

    closeChartSheet: function () {
      var sheet = document.getElementById('dataSheet');
      if (sheet) sheet.classList.remove('show');
    },

    /* 充电记录详情半屏弹层（点击记录项后展示，含编辑/删除） */
    showChargeDetail: function (id) {
      var c = ChargeMgr.get(id);
      if (!c) return;
      var sheet = document.getElementById('dataSheet');
      if (!sheet) return;
      var isFast = c.chargeType === 'fast';
      var typeLabel = isFast ? '快充' : '慢充';
      var unitPrice = c.kWh > 0 ? (Number(c.totalCost) || 0) / Number(c.kWh) : 0;
      var d = (c.date || '').split('-');
      var dateStr = d.length === 3 ? (d[0] + '年' + parseInt(d[1], 10) + '月' + parseInt(d[2], 10) + '日') : (c.date || '');

      var head = document.querySelector('.data-sheet-head');
      if (head) {
        head.innerHTML = '<div>'
          + '<h3>充电详情</h3>'
          + '<div class="ds-sub">' + dateStr + '</div></div>'
          + '<div class="ds-action-row">'
          + '<button class="ds-icon-btn" onclick="App.closeChargeDetail();App.openChargePage(\'' + id + '\')" aria-label="编辑">'
          + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
          + '<button class="ds-icon-btn ds-danger" onclick="App.deleteChargeFromDetail(\'' + id + '\')" aria-label="删除">'
          + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
          + '<button class="ds-close-btn" onclick="App.closeChargeDetail()" aria-label="关闭">'
          + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="6" x2="18" y2="18" stroke-linecap="round"/><line x1="6" y1="18" x2="18" y2="6" stroke-linecap="round"/></svg></button>'
          + '</div>';
      }

      var body = '<div class="ds-hero"><div class="dh-label">充电费用</div>'
        + '<div class="dh-value">¥' + Utils.fmtMoney(c.totalCost) + '</div>'
        + '<div class="dh-sub">' + typeLabel + ' · ' + Utils.fmt(c.kWh, 1) + ' 度</div></div>'
        + '<div class="ds-grid">'
        + '<div class="ds-cell"><div class="dc-label">充电度数</div><div class="dc-value">' + Utils.fmt(c.kWh, 1) + '<span class="dc-unit">度</span></div></div>'
        + '<div class="ds-cell"><div class="dc-label">充电单价</div><div class="dc-value">¥' + Utils.fmtMoney(unitPrice) + '<span class="dc-unit">/度</span></div></div>'
        + '<div class="ds-cell"><div class="dc-label">充电类型</div><div class="dc-value">' + typeLabel + '</div></div>'
        + '<div class="ds-cell"><div class="dc-label">日期</div><div class="dc-value" style="font-size:14px;">' + dateStr + '</div></div>';
      if (Number(c.odometer) > 0) body += '<div class="ds-cell"><div class="dc-label">里程读数</div><div class="dc-value">' + c.odometer + '<span class="dc-unit">km</span></div></div>';
      if (Number(c.socBefore) > 0 && Number(c.socAfter) > 0) body += '<div class="ds-cell"><div class="dc-label">SOC 变化</div><div class="dc-value">' + c.socBefore + '%→' + c.socAfter + '%</div></div>';
      body += '</div>';
      if (c.note) body += '<div class="ds-note">' + c.note.replace(/[<>&]/g, function (ch) { return ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&amp;'; }) + '</div>';

      document.getElementById('dsBody').innerHTML = body;
      sheet.classList.add('show');
    },

    closeChargeDetail: function () {
      this.closeChartSheet();
      var head = document.querySelector('.data-sheet-head');
      if (head) {
        head.innerHTML = '<div>'
          + '<h3 id="dsTitle">数据明细</h3>'
          + '<div class="ds-sub" id="dsSub"></div></div>'
          + '<button type="button" class="ds-close-btn" onclick="App.closeChartSheet()" aria-label="关闭">'
          + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="6" x2="18" y2="18" stroke-linecap="round"/><line x1="6" y1="18" x2="18" y2="6" stroke-linecap="round"/></svg></button>';
      }
    },

    deleteChargeFromDetail: function (id) {
      var self = this;
      this.showConfirm('删除充电记录', '确定删除这条充电记录？此操作不可恢复。', function () {
        ChargeMgr.remove(id);
        App.closeChargeDetail();
        App.renderAll();
        App.toast('已删除', 'success');
      });
    },

    /* 当月明细（柱状图 / 趋势线图点击） */
    monthSheet: function (vid, monthKey) {
      var charges = vid ? ChargeMgr.list(vid) : [];
      var sc = charges.filter(function (c) { return Utils.monthKey(c.date || '') === monthKey; });
      var cost = 0, kwh = 0, fast = 0, slow = 0;
      sc.forEach(function (c) {
        cost += c.totalCost || 0; kwh += c.kWh || 0;
        if (c.chargeType === 'fast') fast++; else slow++;
      });
      var label = Utils.monthLabel(monthKey);
      if (!sc.length) {
        return {
          title: label + ' 充电明细', sub: monthKey,
          body: '<div class="ds-empty">' + Icons.bolt + '<div class="de-title">该月暂无充电记录</div><div class="de-sub">选择其他月份，或点击「新增」记录一条充电</div></div>'
        };
      }
      var effInfo = this._monthEff(charges, monthKey);
      var avgPrice = kwh > 0 ? cost / kwh : 0;
      var fastPct = Math.round(fast / sc.length * 100);
      var body = '<div class="ds-hero"><div class="dh-label">' + label + ' · 充电费用</div>'
        + '<div class="dh-value">¥' + Utils.fmtMoney(cost) + '</div>'
        + '<div class="dh-sub">' + sc.length + ' 次充电 · 快充 ' + fastPct + '%</div></div>'
        + '<div class="ds-grid">'
        + '<div class="ds-cell"><div class="dc-label">充电度数</div><div class="dc-value">' + Utils.fmt(kwh, 1) + '<span class="dc-unit">度</span></div></div>'
        + '<div class="ds-cell"><div class="dc-label">充电次数</div><div class="dc-value">' + sc.length + '<span class="dc-unit">次</span></div></div>'
        + '<div class="ds-cell"><div class="dc-label">平均电价</div><div class="dc-value">¥' + Utils.fmtMoney(avgPrice) + '<span class="dc-unit">/度</span></div></div>'
        + '<div class="ds-cell"><div class="dc-label">平均电耗</div><div class="dc-value">' + (effInfo.enough ? Utils.fmt(effInfo.avg, 1) : '—') + '<span class="dc-unit">' + (effInfo.enough ? 'kWh/100km' : (effInfo.count > 0 ? '样本不足' : '无里程数据')) + '</span></div></div>'
        + '<div class="ds-cell"><div class="dc-label">快充</div><div class="dc-value">' + fast + '<span class="dc-unit">次</span></div></div>'
        + '<div class="ds-cell"><div class="dc-label">慢充</div><div class="dc-value">' + slow + '<span class="dc-unit">次</span></div></div>'
        + '</div>';
      return { title: label + ' 充电明细', sub: monthKey + ' · ' + sc.length + ' 条记录', body: body };
    },

    /* 当月内相邻有效里程区间电耗样本 */
    _monthEff: function (charges, monthKey) {
      var sc = charges.filter(function (c) { return Utils.monthKey(c.date || '') === monthKey; })
        .sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); });
      var vals = [];
      for (var i = 1; i < sc.length; i++) {
        var o0 = sc[i - 1].odometer || 0, o1 = sc[i].odometer || 0;
        if (o0 > 0 && o1 > o0 && sc[i].kWh > 0) vals.push((sc[i].kWh / (o1 - o0)) * 100);
      }
      return { count: vals.length, enough: vals.length >= 3, avg: vals.length ? vals.reduce(function (s, v) { return s + v; }, 0) / vals.length : 0 };
    },

    /* 快慢充比例明细（环形图点击） */
    donutSheet: function (vid) {
      var charges = vid ? ChargeMgr.list(vid) : [];
      var fast = 0, slow = 0, fastK = 0, slowK = 0;
      charges.forEach(function (c) {
        if (c.chargeType === 'fast') { fast++; fastK += c.kWh || 0; }
        else { slow++; slowK += c.kWh || 0; }
      });
      var total = fast + slow;
      if (!total) {
        return { title: '快慢充比例', sub: '全部记录', body: '<div class="ds-empty">' + Icons.bolt + '<div class="de-title">暂无充电记录</div><div class="de-sub">记录充电后即可查看快慢充分布</div></div>' };
      }
      var fPct = Math.round(fast / total * 100);
      var body = '<div class="ds-hero"><div class="dh-label">快慢充比例 · 全部记录</div>'
        + '<div class="dh-value">' + fPct + ' : ' + (100 - fPct) + '</div>'
        + '<div class="dh-sub">共 ' + total + ' 次充电</div></div>'
        + '<div class="ds-grid">'
        + '<div class="ds-cell"><div class="dc-label">快充次数</div><div class="dc-value">' + fast + '<span class="dc-unit">次</span></div></div>'
        + '<div class="ds-cell"><div class="dc-label">慢充次数</div><div class="dc-value">' + slow + '<span class="dc-unit">次</span></div></div>'
        + '<div class="ds-cell"><div class="dc-label">快充度数</div><div class="dc-value">' + Utils.fmt(fastK, 1) + '<span class="dc-unit">度</span></div></div>'
        + '<div class="ds-cell"><div class="dc-label">慢充度数</div><div class="dc-value">' + Utils.fmt(slowK, 1) + '<span class="dc-unit">度</span></div></div>'
        + '</div>';
      return { title: '快慢充比例', sub: '全部记录', body: body };
    },

    /* 电池健康明细（电池环点击） */
    batterySheet: function (vid) {
      var health = BatteryHealth.healthIndex(vid);
      if (!health || health.index === null || health.index === undefined) {
        return { title: '电池健康评估', sub: '当前车辆', body: '<div class="ds-empty">' + Icons.info + '<div class="de-title">暂无容量数据</div><div class="de-sub">记录带充电前后 SOC 的电量后可评估</div></div>' };
      }
      var idx = Math.round(health.index);
      var color = idx >= 85 ? '#22C55E' : (idx >= 70 ? '#8B9BAE' : (idx >= 50 ? '#F59E0B' : '#EF4444'));
      var capPct = Math.round((health.capacityRatio || 0) * 100);
      var habitPct = Math.round((health.habit && health.habit.score) || 0);
      var deepPct = Math.round(((health.habit && health.habit.deepRatio) || 0) * 100);
      var status = health.status || (idx >= 85 ? '优秀' : '良好');
      var body = '<div class="ds-hero"><div class="dh-label">电池健康指数</div>'
        + '<div class="dh-value" style="color:' + color + ';">' + idx + '</div>'
        + '<div class="dh-sub">' + status + '</div></div>'
        + '<div class="ds-grid">'
        + '<div class="ds-cell"><div class="dc-label">容量健康</div><div class="dc-value">' + capPct + '<span class="dc-unit">%</span></div></div>'
        + '<div class="ds-cell"><div class="dc-label">充电习惯</div><div class="dc-value">' + habitPct + '<span class="dc-unit">%</span></div></div>'
        + '<div class="ds-cell"><div class="dc-label">深放频率</div><div class="dc-value">' + deepPct + '<span class="dc-unit">%</span></div></div>'
        + '</div>';
      return { title: '电池健康评估', sub: '当前车辆', body: body };
    },

    recordItemHTML: function (c) {
      var m = c.date.split('-');
      var day = parseInt(m[2], 10), month = parseInt(m[1], 10);
      var isFast = c.chargeType === 'fast';
      var iconClass = isFast ? 'ic-fast' : 'ic-slow';
      var iconSvg = isFast ? Icons.zap : Icons.power;
      var note = (c.note || '').replace(/[<>&]/g, function (ch) {
        return ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&amp;';
      });
      var subParts = [];
      if (Number(c.socBefore) > 0 && Number(c.socAfter) > 0) subParts.push('SOC ' + c.socBefore + '%→' + c.socAfter + '%');
      if (note) subParts.push(note);
      return '<div class="history-item-dark" onclick="App.showChargeDetail(\'' + c.id + '\')">'
        + '<div class="hi-icon ' + iconClass + '">' + iconSvg + '</div>'
        + '<div class="hi-info">'
        + '<div class="hi-main">'
        + '<span class="hi-kwh">' + Utils.fmt(c.kWh, 1) + '</span><span class="hi-unit">度</span>'
        + (isFast ? '<span class="hi-tag fast">快充</span>' : '<span class="hi-tag slow">慢充</span>')
        + '</div>'
        + '<div class="hi-date-row"><span class="hi-date-val">' + month + '月' + day + '日</span>'
        + (subParts.length ? '<span class="hi-date-sep">·</span><span class="hi-meta">' + subParts.join(' · ') + '</span>' : '')
        + '</div>'
        + '</div>'
        + '<div class="hi-amount">¥' + Utils.fmtMoney(c.totalCost) + '</div>'
        + '</div>';
    },

    setRecordsMonth: function (mk) {
      this.recordsMonthFilter = mk;
      this.renderRecords();
    },

    setRecordsYear: function (yr) {
      this.recordsYearFilter = yr;
      // 切换年份时清空不属于该年份的月份筛选
      if (yr && this.recordsMonthFilter && this.recordsMonthFilter.slice(0, 4) !== yr) {
        this.recordsMonthFilter = '';
      }
      this.renderRecords();
    },

    setRecordsFilter: function (filter) {
      this.recordsFilter = filter;
      this.renderRecords();
    },

    setAnalysisSub: function (sub) {
      this.analysisSub = sub || 'stats';
      if (this.currentTab !== 'analysis') {
        this.switchTab('analysis');
      } else {
        this.renderAnalysis();
      }
    },

    /* ---- 分析（设计稿单页：本月 / 本年 / 全部） ---- */
    setAnalysisPeriod: function (p) {
      this.analysisPeriod = p;
      this.renderAnalysis();
    },

    renderAnalysis: function () {
      var vehicle = VehicleMgr.current();
      var vid = vehicle ? vehicle.id : null;
      var panel = document.getElementById('panel-analysis');
      if (!vid) {
        panel.innerHTML = this.analysisNavHtml()
          + '<div class="records-empty" style="margin:24px 16px;">' + Icons.car
          + '<div class="re-title">请先添加车型</div><div class="re-sub">添加车型后才能查看数据分析</div>'
          + '<button class="btn-accent" onclick="App.switchTab(\'profile\')">去添加车辆</button></div>';
        return;
      }

      var sub = this.analysisSub || 'stats';
      var yearFilter = this.statsYear;
      var html = '';

      html += this.analysisNavHtml();

      // 子标签栏（统计 / 电池健康 / 充电建议）
      html += '<div class="record-header-dark"><div class="seg-dark">';
      var subs = [['stats', '统计'], ['health', '电池健康'], ['advice', '充电建议']];
      subs.forEach(function (s) {
        html += '<button class="seg-item' + (sub === s[0] ? ' active' : '') + '" onclick="App.setAnalysisSub(\'' + s[0] + '\')">' + s[1] + '</button>';
      });
      html += '</div></div>';

      if (sub === 'health') {
        // 电池健康
        html += this.buildBatteryPanel(vid);
      } else if (sub === 'advice') {
        // 充电建议
        html += this.buildAdvicePanel(vid);
      } else {
        // 统计：年份筛选 + 费用英雄卡 + 趋势图 + 快慢充比例
        var years = Utils.availableYears(vid);
        if (years.length) {
          html += '<div class="year-filter-dark">';
          html += '<button class="year-chip-dark' + (!yearFilter ? ' active' : '') + '" onclick="App.setStatsYear(\'\')">全部</button>';
          years.forEach(function (y) {
            html += '<button class="year-chip-dark' + (String(yearFilter) === y ? ' active' : '') + '" onclick="App.setStatsYear(\'' + y + '\')">' + y + '</button>';
          });
          html += '</div>';
        }

        var scope = this.analysisScopeByYear(yearFilter);
        var months = yearFilter ? Utils.yearMonths(parseInt(yearFilter)) : Utils.chartRange(vid, 12);
        var monthly = Stats.monthlyCost(vid, months);
        var line = this.buildAnalysisLine(monthly);
        var heroLabel = yearFilter ? (yearFilter + ' 年') : '累计';

        // 总费用英雄卡
        html += '<div class="analysis-hero-dark">';
        html += '<div class="ah-label">' + heroLabel + '充电总费用</div>';
        html += '<div class="ah-value">¥' + Utils.fmtMoney(scope.cost) + '</div>';
        html += '<div class="ah-trend"><span class="trend-val">' + scope.count + ' 次</span>'
          + '<span class="trend-label">均价 ¥' + Utils.fmtMoney(scope.avgPrice) + '/度 · 充入 ' + Utils.fmt(scope.kWh, 1) + ' 度</span></div>';
        html += '</div>';

        // 月度费用趋势
        html += '<div class="trend-chart-dark"><div class="tc-title">月度费用趋势 · ' + heroLabel + '</div>';
        html += '<div class="line-chart-dark"><svg viewBox="0 0 300 120" preserveAspectRatio="none">';
        html += '<defs><linearGradient id="dgTrend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8B9BAE" stop-opacity="0.25"/><stop offset="100%" stop-color="#8B9BAE" stop-opacity="0"/></linearGradient></defs>';
        html += '<path d="' + line.area + '" fill="url(#dgTrend)"/>';
        html += '<path d="' + line.d + '" fill="none" stroke="#8B9BAE" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
        line.pts.forEach(function (p, i) {
          var r = i === line.pts.length - 1 ? 5 : 4;
          var extra = i === line.pts.length - 1 ? ' stroke="rgba(255,255,255,0.5)" stroke-width="2"' : '';
          var mk = monthly[i] ? monthly[i].monthKey : '';
          html += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + r + '" fill="#8B9BAE"' + extra + ' onclick="App.showChartSheet(\'month\',\'' + mk + '\')"/>';
        });
        html += '</svg></div>';
        html += '<div class="line-chart-dark" style="height:auto;"><div class="x-labels">' + line.xlabels + '</div></div>';
        html += '</div>';

        // 快慢充比例
        var total = scope.fastCount + scope.slowCount;
        var fPct = total > 0 ? Math.round(scope.fastCount / total * 100) : 0;
        html += '<div class="donut-dark"><div class="dc-title">快慢充比例</div><div class="donut-row-dark">';
        html += this.buildDonut(scope.fastCount, scope.slowCount);
        html += '<div class="donut-legend-dark">';
        html += '<div class="legend-item"><span class="dot" style="background:#8B9BAE;"></span><span class="ll-label">快充</span><span class="ll-value">' + fPct + '%</span></div>';
        html += '<div class="legend-item"><span class="dot" style="background:#2DD4BF;"></span><span class="ll-label">慢充</span><span class="ll-value">' + (100 - fPct) + '%</span></div>';
        html += '</div></div></div>';
      }

      html += '<div style="height:24px;"></div>';
      panel.innerHTML = html;
    },

    analysisNavHtml: function () {
      return '<div class="home-nav-dark">'
        + '<span class="nav-title">数据分析</span>'
        + '</div>';
    },

    analysisScopeByYear: function (yearFilter) {
      var vehicle = VehicleMgr.current();
      var vid = vehicle ? vehicle.id : null;
      var charges = vid ? ChargeMgr.list(vid) : [];
      var sc = charges.filter(function (c) {
        if (!c.date) return false;
        if (!yearFilter) return true;
        return c.date.slice(0, 4) === String(yearFilter);
      });
      var cost = 0, kWh = 0;
      sc.forEach(function (c) { cost += (Number(c.totalCost) || 0); kWh += (Number(c.kWh) || 0); });
      var fast = sc.filter(function (c) { return c.chargeType === 'fast'; }).length;
      return { cost: cost, kWh: kWh, count: sc.length, fastCount: fast, slowCount: sc.length - fast, avgPrice: kWh > 0 ? cost / kWh : 0 };
    },

    buildAdvicePanel: function (vid) {
      var vehicle = VehicleMgr.current();
      var rec = Recommender.generate(vid);
      if (!rec || !rec.tips || !rec.tips.length) {
        return '<div class="records-empty" style="margin:24px 16px;">' + Icons.info + '<div class="re-title">暂无建议</div></div>';
      }
      var iconMap = {
        check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13" stroke-linecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke-linecap="round"/></svg>',
        info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12" stroke-linecap="round"/><line x1="12" y1="8" x2="12.01" y2="8" stroke-linecap="round"/></svg>'
      };
      var clsMap = { check: 'advice-ok', alert: 'advice-warn', info: 'advice-info' };
      var html = '<div class="advice-summary-dark">' + rec.summary + '</div>';
      html += '<div class="advice-list-dark">';
      rec.tips.forEach(function (tip) {
        html += '<div class="advice-item-dark ' + (clsMap[tip.icon] || 'advice-info') + '">'
          + '<div class="advice-icon">' + (iconMap[tip.icon] || iconMap.info) + '</div>'
          + '<div class="advice-body"><div class="advice-title">' + tip.title + '</div>'
          + '<div class="advice-text">' + tip.text + '</div></div></div>';
      });
      html += '</div>';
      if (vehicle) {
        html += '<div class="advice-params-dark"><div class="ap-title">充电参数参考</div>'
          + '<div class="ap-row"><span>电池容量</span><b>' + vehicle.batteryCapacity + ' kWh</b></div>';
        if (vehicle.supportsFastCharge) html += '<div class="ap-row"><span>支持快充</span><b>是</b></div>';
        if (vehicle.maxChargePower > 0) html += '<div class="ap-row"><span>最大快充功率</span><b>' + vehicle.maxChargePower + ' kW</b></div>';
        html += '</div>';
      }
      return html;
    },

    analysisScope: function (period) {
      var vehicle = VehicleMgr.current();
      var vid = vehicle ? vehicle.id : null;
      var charges = vid ? ChargeMgr.list(vid) : [];
      var now = new Date();
      var curKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
      var curYear = String(now.getFullYear());
      var sc = charges.filter(function (c) {
        if (!c.date) return false;
        if (period === 'all') return true;
        if (period === 'month') return c.date.slice(0, 7) === curKey;
        return c.date.slice(0, 4) === curYear;
      });
      var cost = 0, kWh = 0;
      sc.forEach(function (c) { cost += (Number(c.totalCost) || 0); kWh += (Number(c.kWh) || 0); });
      var fast = sc.filter(function (c) { return c.chargeType === 'fast'; }).length;
      return { cost: cost, kWh: kWh, count: sc.length, fastCount: fast, slowCount: sc.length - fast, avgPrice: kWh > 0 ? cost / kWh : 0 };
    },

    analysisMonths: function (period, vid) {
      if (period === 'year') return Utils.yearMonths(new Date().getFullYear());
      return Utils.chartRange(vid, 6);
    },

    buildAnalysisLine: function (monthly) {
      var n = monthly.length;
      if (n === 0) monthly = [{ label: '—', value: 0 }];
      n = monthly.length;
      var W = 300, H = 120, lo, hi;
      var vals = monthly.map(function (m) { return +m.value || 0; });
      var max = Math.max.apply(null, vals);
      var min = Math.min.apply(null, vals);
      if (max === min) { lo = 0; hi = max || 1; } else { var pad = (max - min) * 0.15; lo = Math.max(0, min - pad); hi = max + pad; }
      var pts = [];
      for (var i = 0; i < n; i++) {
        var x = W * (n === 1 ? 0.5 : i / (n - 1));
        var y = H - 12 - ((vals[i] - lo) / (hi - lo)) * (H - 24);
        pts.push([x.toFixed(1), y.toFixed(1)]);
      }
      var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0] + ' ' + p[1]; }).join(' ');
      var area = d + ' L' + pts[n - 1][0] + ' ' + H + ' L' + pts[0][0] + ' ' + H + ' Z';
      var labels = monthly.map(function (m) { return m.label || '—'; });
      if (labels.length <= 6) {
        var xlabels = labels.map(function (lb) { return '<span>' + lb + '</span>'; }).join('');
      } else {
        var ids = [];
        for (var s = 0; s <= 5; s++) ids.push(Math.round(s * (labels.length - 1) / 5));
        xlabels = ids.map(function (idx) { return '<span>' + labels[idx] + '</span>'; }).join('');
      }
      return { d: d, area: area, pts: pts, xlabels: xlabels };
    },

    buildDonut: function (fast, slow) {
      var total = fast + slow;
      var C = Math.round(2 * Math.PI * 40 * 100) / 100;
      var html = '<svg class="donut-svg-dark" viewBox="0 0 100 100" onclick="App.showChartSheet(\'donut\',\'\')">'
        + '<circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="12"/>';
      if (total > 0) {
        var dfast = fast / total * C;
        if (fast > 0) html += '<circle cx="50" cy="50" r="40" fill="none" stroke="#8B9BAE" stroke-width="12" stroke-dasharray="' + dfast.toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 50 50)"/>';
        if (slow > 0) html += '<circle cx="50" cy="50" r="40" fill="none" stroke="#2DD4BF" stroke-width="12" stroke-dasharray="' + (C - dfast).toFixed(1) + ' ' + C.toFixed(1) + '" stroke-dashoffset="' + (-dfast).toFixed(1) + '" transform="rotate(-90 50 50)"/>';
      }
      html += '</svg>';
      return html;
    },

    buildBatteryPanel: function (vid) {
      var health = BatteryHealth.healthIndex(vid);
      if (!health || health.index === null || health.index === undefined) {
        return '<div class="battery-dark"><div class="bh-title">电池健康评估</div>'
          + '<div class="records-empty" style="padding:16px 8px;">' + Icons.info + '<div class="re-title">暂无容量数据</div><div class="re-sub">记录带充电前后 SOC 的电量后可评估</div></div></div>';
      }
      var idx = Math.round(health.index);
      var color = idx >= 85 ? '#22C55E' : (idx >= 70 ? '#8B9BAE' : (idx >= 50 ? '#F59E0B' : '#EF4444'));
      var capPct = Math.round((health.capacityRatio || 0) * 100);
      var habitPct = Math.round((health.habit && health.habit.score) || 0);
      var deepPct = Math.round(((health.habit && health.habit.deepRatio) || 0) * 100);
      var status = health.status || (idx >= 85 ? '优秀' : '良好');
      var metricBar = function (label, pct, c) {
        return '<div class="battery-metric-dark"><span class="bm-label">' + label + '</span>'
          + '<div class="bm-bar"><div class="bm-bar-fill" style="width:' + Math.min(100, pct) + '%;background:' + c + ';"></div></div>'
          + '<span class="bm-value">' + Math.min(100, pct) + '%</span></div>';
      };
      return '<div class="battery-dark"><div class="bh-title">电池健康评估</div>'
        + '<div class="battery-ring-row-dark">'
        + this.buildBatteryRing(idx, color)
        + '<div class="battery-ring-info-dark"><div class="bh-score">' + idx + '</div><div class="bh-label">健康指数</div>'
        + '<div class="bh-status" style="color:' + color + ';"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> ' + status + '</div></div>'
        + '</div>'
        + '<div class="battery-metrics-dark">'
        + metricBar('容量健康', capPct, color)
        + metricBar('充电习惯', habitPct, '#8B9BAE')
        + metricBar('深放频率', deepPct, deepPct >= 40 ? '#F59E0B' : '#3B82F6')
        + '</div></div>';
    },

    buildBatteryRing: function (pct, color) {
      var C = Math.round(2 * Math.PI * 50 * 100) / 100;
      var d = (Math.min(100, Math.max(0, pct)) / 100) * C;
      return '<svg class="battery-ring-svg-dark" viewBox="0 0 120 120" onclick="App.showChartSheet(\'battery\',\'\')">'
        + '<circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="8"/>'
        + '<circle cx="60" cy="60" r="50" fill="none" stroke="' + color + '" stroke-width="8" stroke-dasharray="' + d.toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 60 60)" stroke-linecap="round"/>'
        + '</svg>';
    },

    renderStatsHTML: function (vid) {
      var yearFilter = this.statsYear;
      var ov = Stats.overview(vid, yearFilter);
      var ratio = Stats.chargeTypeRatio(vid, yearFilter);
      var html = '';

      // 年度筛选（全部 + 各数据存在年份）
      var years = Utils.availableYears(vid);
      if (years.length) {
        html += '<div class="year-filter-bar">';
        html += '<button class="year-chip' + (yearFilter ? '' : ' active') + '" onclick="App.setStatsYear(\'\')">全部</button>';
        years.forEach(function (y) {
          html += '<button class="year-chip' + (String(yearFilter) === y ? ' active' : '') + '" onclick="App.setStatsYear(\'' + y + '\')">' + y + '年</button>';
        });
        html += '</div>';
      }

      // 分析总费用主卡（对齐设计稿「分析页」analysis-hero）
      html += '<div class="analysis-hero-dark">';
      html += '<div class="ah-label">' + (yearFilter ? yearFilter + ' 年' : '累计') + '充电总费用</div>';
      html += '<div class="ah-value">¥' + Utils.fmtMoney(ov.totalCost) + '</div>';
      html += '<div class="ah-trend"><span class="trend-val">' + ov.chargeCount + ' 次</span><span class="trend-label">本月 ¥' + Utils.fmtMoney(ov.thisMonthCost) + ' · 平均 ¥' + Utils.fmtMoney(ov.avgPrice) + '/度</span></div>';
      html += '</div>';

      html += '<div class="stat-cards">';
      html += this.statCard('blue', Icons.coin, '总费用', '¥' + Utils.fmtMoney(ov.totalCost), ov.chargeCount + ' 次', 'totalCost', vid);
      html += this.statCard('green', Icons.zap, '总度数', Utils.fmt(ov.totalKWh, 1) + ' 度', '均价 ¥' + Utils.fmtMoney(ov.avgPrice) + '/度', 'totalKWh', vid);
      var pkm = Stats.pricePerKm(vid, yearFilter);
      html += this.statCard('amber', Icons.gauge, '每公里单价', pkm.hasData ? '¥' + Utils.fmt(pkm.value, 2) : '—', pkm.hasData ? '¥/km · 基于 ' + pkm.effCount + ' 组' : '补录里程后可用', 'pricePerKm', vid);
      html += this.statCard('purple', Icons.infinity, '快慢充比', Math.round(ratio.fast * 100) + ':' + Math.round(ratio.slow * 100), '快' + ov.fastCount + ' / 慢' + ov.slowCount, 'fastslow', vid);
      html += '</div>';

      // 趋势月份：指定年份显示整年（当年截至当前月），否则展示全部历史（可横滑）
      var months = yearFilter ? Utils.yearMonths(yearFilter) : Utils.chartRange(vid, 6);
      var yearTag = Utils.yearRangeTag(months);
      html += '<div class="card card-chart"><h3>' + Icons.trend + '月度充电费用趋势<span class="chart-year-tag">' + yearTag + '</span></h3>' + this.chartWrap('statsCostChart') + '</div>';
      html += '<div class="card card-chart"><h3>' + Icons.gauge + '月度百公里电耗趋势<span class="chart-year-tag">' + yearTag + '</span></h3>' + this.chartWrap('statsEffChart') + '</div>';
      html += '<div class="card"><h3>' + Icons.battery + '快慢充占比</h3><div class="donut-wrap"><canvas id="statsDonut" class="chart donut"></canvas>';
      html += '<div class="donut-legend"><div class="legend-item"><div class="legend-dot" style="background:#F59E0B"></div>快充 ' + ratio.fastCount + ' 次</div>'
        + '<div class="legend-item"><div class="legend-dot" style="background:#8B9BAE"></div>慢充 ' + ratio.slowCount + ' 次</div></div></div></div>';
      return html;
    },

    setStatsYear: function (year) {
      this.statsYear = year ? String(year) : null;
      this.renderAnalysis();
    },

    drawStatsCharts: function (vid) {
      var ratio = Stats.chargeTypeRatio(vid, this.statsYear);
      var months = this.statsYear ? Utils.yearMonths(this.statsYear) : Utils.chartRange(vid, 6);
      var self = this;
      this.drawChart('statsCostChart', function (canvas) {
        Charts.line(canvas, Stats.monthlyCost(vid, months), {
          yaxisId: 'statsCostChartY', color: '#8B9BAE', digits: 0, minSpan: 64, yunit: '¥',
          labelFormat: function (d) {
            if (d.isPartial) return '本月进行中';
            return '¥' + Utils.fmtMoney(d.value) + (d.totalKWh > 0 ? '\n' + Utils.fmt(d.totalKWh, 0) + '度' : '');
          },
          tooltipFormat: function (d) {
            if (d.isPartial) return '本月截至目前 ¥' + Utils.fmtMoney(d.value) + '，记录后更新';
            var t = d.label + ': ¥' + Utils.fmtMoney(d.value);
            if (d.totalKWh > 0) t += ' · ' + Utils.fmt(d.totalKWh, 1) + ' 度';
            return t;
          },
          yFormat: function (v) { return v.toFixed(0); }
        });
      });
      this.drawChart('statsEffChart', function (canvas) {
        Charts.bar(canvas, Stats.monthlyEfficiency(vid, months), {
          yaxisId: 'statsEffChartY', color: '#8B9BAE', digits: 1, minSpan: 58,
          labelFormat: function (v) { return Utils.fmt(v, 1); },
          yFormat: function (v) { return v.toFixed(1); },
          tooltipFormat: function (d) {
            var text = d.label + ': ' + Utils.fmt(d.value, 1) + ' 度/100km';
            if (d.totalKWh > 0) text += ' · 充电 ' + Utils.fmt(d.totalKWh, 1) + ' 度';
            if (d.totalDist > 0) text += ' · 行驶 ' + Utils.fmt(d.totalDist, 0) + ' km';
            return text;
          }
        });
      });
      this.drawChart('statsDonut', function (canvas) {
        Charts.donut(canvas, [{ value: ratio.fastCount, color: '#f59e0b' }, { value: ratio.slowCount, color: '#3b82f6' }], { centerText: Math.round(ratio.fast * 100) + '% 快充' });
      });
    },

    renderHealthHTML: function (vid) {
      var health = BatteryHealth.healthIndex(vid);
      var color = health.index >= 85 ? '#22C55E' : (health.index >= 70 ? '#8B9BAE' : (health.index >= 50 ? '#F59E0B' : '#EF4444'));
      var html = '';

      // 1. 电池容量分析（置顶）
      if (health.currentEstimate && health.nominal > 0) {
        var pct = Math.round(health.capacityRatio * 100);
        var warn = pct < HEALTH_CONFIG.capacityWarningRatio * 100;
        html += '<div class="card capacity-card"><h3>' + Icons.battery + '电池容量分析</h3>';
        html += '<div class="capacity-main">';
        if (health.enough) {
          html += '<div><div class="capacity-num"><span class="cap-value">' + Utils.fmt(health.currentEstimate, 1) + '</span><span class="cap-unit">kWh</span></div>'
            + '<span class="cap-nominal">标称容量 ' + health.nominal + ' kWh</span></div>';
          html += '<span class="capacity-retention' + (warn ? ' warn' : '') + '">' + (warn ? '低于标准' : '保持率') + ' ' + pct + '%</span>';
          html += '</div>';
          html += '<div class="health-bar-wrap"><div class="health-bar"><div class="health-bar-fill" style="width:' + Math.min(100, pct) + '%;background:' + color + '"></div></div></div>';
          if (warn) html += '<p class="warn-text">实测容量低于标称的 ' + Math.round(HEALTH_CONFIG.capacityWarningRatio * 100) + '%，建议关注电池健康并前往检测。</p>';
        } else {
          html += '<div class="empty-state" style="padding:12px 0;">' + Icons.info + '<p style="font-size:13px;">有效样本 ' + health.sampleCount + ' 组，暂不足 3 组，<b>无法给出可靠容量结论</b>。请继续补录带 SOC 前后电量的充电记录。</p></div>';
        }
        html += '<p class="capacity-note"><b>口径说明：</b>实测容量由「单次充入度数 ÷ 充电前后电量(SOC)变化比例」估算，并取近 5 次的中位数；仅采纳落在标称容量 70%–108% 合理区间内的样本，异常读数自动剔除。需至少 3 组有效样本才形成结论，取中位数用于监控电池随时间的真实老化趋势。</p>';
        html += '</div>';
      } else if (health.nominal > 0) {
        html += '<div class="card capacity-card"><h3>' + Icons.battery + '电池容量分析</h3><div class="empty-state" style="padding:16px;">' + Icons.info + '<p style="font-size:13px;">需要记录充电前后SOC及充入度数才能估算实际容量</p></div></div>';
      }

      // 2. 容量估算趋势
      html += '<div class="card card-chart"><h3>' + Icons.trend + '容量估算趋势（按月中位数）</h3>' + this.chartWrap('healthCapChart') + '</div>';

      // 3. 综合健康度 + 充电习惯评分（合并，健康指数降权）
      html += '<div class="card"><h3>' + Icons.shield + '综合健康度</h3>';
      html += '<div class="health-summary">';
      html += '<div class="health-score-badge" style="color:' + color + ';border:2px solid ' + color + ';">' + health.index + '</div>';
      html += '<div class="health-summary-info">';
      html += '<div class="health-state" style="color:' + color + '">' + health.status + '</div>';
      html += '<div class="health-expl">综合健康度 = 电池容量保持率 × 60% + 充电习惯评分 × 40%，满分 100，综合评估电池损耗与充电日常习惯。</div>';
      html += '</div></div>';
      html += '<div class="health-advice">' + health.advice + '</div>';

      html += '<div class="health-habit-head">' + Icons.zap + '充电习惯评分：' + health.habit.score + ' 分</div>';
      html += '<table class="data-table"><thead><tr><th>评估项</th><th>数值</th><th>状态</th><th>扣分</th></tr></thead><tbody>';
      health.habit.factors.forEach(function (f) {
        html += '<tr><td>' + f.name + '</td><td>' + f.value + '</td>'
          + '<td><span class="' + (f.penalty > 0 ? 'text-warn' : 'text-ok') + '">' + f.impact + '</span></td>'
          + '<td>-' + f.penalty + '</td></tr>';
      });
      html += '</tbody></table></div>';
      return html;
    },

    drawHealthCharts: function (vid) {
      this.drawChart('healthCapChart', function (canvas) {
        Charts.line(canvas, BatteryHealth.capacityTrend(vid, Utils.chartRange(vid, 6)), { yaxisId: 'healthCapChartY', color: '#8b5cf6', digits: 1, minSpan: 58, yFormat: function (v) { return v.toFixed(0) + 'kWh'; } });
      });
    },

    renderRecommendHTML: function (vid, vehicle) {
      var rec = Recommender.generate(vid);
      var iconMap = { check: Icons.check, alert: Icons.alert, info: Icons.info };
      var clsMap = { check: 'tip-ok', alert: 'tip-warn', info: 'tip-info' };
      var html = '<div class="card"><div class="card-head"><h3>' + Icons.bulb + '充电策略评估：' + rec.summary + '</h3></div>';
      html += '<div class="tips-list">';
      rec.tips.forEach(function (tip) {
        html += '<div class="tip ' + clsMap[tip.icon] + '"><div class="tip-icon">' + (iconMap[tip.icon] || Icons.info) + '</div>'
          + '<div class="tip-body"><div class="tip-title">' + tip.title + '</div><div class="tip-text">' + tip.text + '</div></div></div>';
      });
      html += '</div></div>';

      html += '<div class="card"><h3>' + Icons.car + vehicle.name + ' 充电参数参考</h3>';
      html += '<table class="data-table"><tbody>';
      html += '<tr><td>电池容量</td><td>' + vehicle.batteryCapacity + ' kWh</td></tr>';
      html += '<tr><td>是否支持快充</td><td>' + (vehicle.supportsFastCharge ? '是' : '否') + '</td></tr>';
      if (vehicle.maxChargePower) html += '<tr><td>最大充电功率</td><td>' + vehicle.maxChargePower + ' kW</td></tr>';
      html += '<tr><td>建议日常充电区间</td><td>20% - 80%</td></tr>';
      html += '<tr><td>建议充电方式</td><td>' + (vehicle.supportsFastCharge ? '日常慢充，长途快充' : '家用慢充为主') + '</td></tr>';
      html += '</tbody></table></div>';
      return html;
    },

    /* ---- 我的（车型+设置） ---- */
    renderProfile: function () {
      var vehicles = VehicleMgr.list();
      var html = '';
      var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };

      // 顶部导航（设计稿 home-nav · 右侧 = 添加车辆）
      var currentV = VehicleMgr.current();
      html += '<div class="home-nav-dark"><span class="nav-title">我的</span>'
        + '<button class="nav-btn" onclick="App.openVehicleModal()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19" stroke-linecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke-linecap="round"/></svg></button></div>';

      // 头像区（设计稿 profile-header · 冷金属灰渐变头像）
      var totKWh = 0, totCnt = 0;
      if (currentV) { var om = Stats.overview(currentV.id); totKWh = om.totalKWh; totCnt = om.chargeCount; }
      var created = Store.data.settings && Store.data.settings.createdAt;
      var days = created ? Math.max(1, Math.ceil((Date.now() - new Date(created).getTime()) / 86400000)) : null;
      html += '<div class="profile-header-dark">';
      html += '<div class="profile-avatar-dark">冲</div>';
      html += '<div class="profile-info-dark"><div class="pi-name">冲冲用户</div>'
        + '<div class="pi-sub">' + (currentV ? '当前 · ' + currentV.name : '尚未添加车辆')
        + (days ? ' · 已使用 ' + days + ' 天' : '')
        + ' · 累计 ' + Utils.fmt(totKWh, 0) + ' 度</div></div>';
      html += '</div>';

      // 当前车辆统计卡（设计稿 vehicle-card · 点击进详情）
      if (currentV) {
        var omv = Stats.overview(currentV.id);
        var ev = Stats.avgEfficiency(currentV.id);
        var hv = BatteryHealth.capacityHealth(currentV.id);
        html += '<div class="vehicle-card-dark" onclick="App.detailVehicle(\'' + currentV.id + '\')">';
        html += '<div class="vehicle-header-dark"><div class="vehicle-icon-dark">' + Icons.car + '</div>'
          + '<div class="vehicle-info-dark"><div class="vi-name">' + currentV.name + '</div>'
          + '<div class="vi-detail">' + (currentV.brand || '') + ' ' + (currentV.model || '') + ' · 当前</div></div>'
          + '<span style="color:rgba(255,255,255,0.15);font-size:20px;">›</span></div>';
        html += '<div class="vehicle-stat-row-dark">';
        html += '<div class="vehicle-stat-item-dark"><div class="vsi-value">' + (ev.enough ? Utils.fmt(ev.avg, 1) : '—') + '</div><div class="vsi-label">电耗 kWh/100km</div></div>';
        html += '<div class="vehicle-stat-item-dark"><div class="vsi-value">' + Utils.fmt(omv.totalKWh, 0) + '</div><div class="vsi-label">累计度数</div></div>';
        html += '<div class="vehicle-stat-item-dark"><div class="vsi-value">' + (hv.index === null ? '—' : hv.index + '%') + '</div><div class="vsi-label">电池健康</div></div>';
        html += '</div></div>';
      }

      // 我的车辆（设计稿分组行）
      html += '<div class="profile-section-title-dark">车辆</div>';
      html += '<div class="profile-list-dark"><div class="settings-list-dark">';
      vehicles.forEach(function (v) {
        html += '<div class="settings-row-dark" onclick="App.detailVehicle(\'' + v.id + '\')">'
          + '<div class="sr-icon ic-gold">' + Icons.car + '</div>'
          + '<span class="sr-label">' + v.name + '</span>'
          + (currentV && currentV.id === v.id ? '<span class="sr-value" style="color:var(--sys-green);">当前</span>' : '')
          + '<span class="sr-chevron">›</span></div>';
      });
      html += '<div class="settings-row-dark" onclick="App.openVehicleModal()">'
        + '<div class="sr-icon ic-teal">' + Icons.plus + '</div>'
        + '<span class="sr-label">添加车辆</span><span class="sr-chevron">›</span></div>';
      html += '</div></div>';

      // 数据管理（设计稿分组：导出 / 导入 / 云同步 / 令牌 / 立即同步）
      var syncCfg = Sync.loadCfg();
      html += '<div class="profile-section-title-dark">数据管理</div>';
      html += '<div class="profile-list-dark"><div class="settings-list-dark">';
      html += '<div class="settings-row-dark" onclick="Store.exportJSON();App.toast(\'已导出备份文件\',\'success\')">'
        + '<div class="sr-icon ic-blue">' + Icons.download + '</div><span class="sr-label">导出数据</span><span class="sr-value">JSON</span><span class="sr-chevron">›</span></div>';
      html += '<label class="settings-row-dark" style="cursor:pointer;">'
        + '<div class="sr-icon ic-teal">' + Icons.upload + '</div><span class="sr-label">导入数据</span><span class="sr-value">JSON</span><span class="sr-chevron">›</span>'
        + '<input type="file" id="importInput" accept=".json" style="display:none;"></label>';
      html += '<div class="settings-row-dark" onclick="App.toggleSync()">'
        + '<div class="sr-icon ic-green">' + Icons.cloud + '</div><span class="sr-label">云同步备份</span>'
        + '<div class="toggle-dark' + (syncCfg.enabled ? ' on' : ' off') + '" id="syncToggle"></div></div>';
      html += '<div class="settings-row-dark">'
        + '<div class="sr-icon ic-purple">' + Icons.keyIcon + '</div><span class="sr-label">GitHub 令牌</span>'
        + '<input type="password" id="syncToken" placeholder="github_pat_…" value="' + esc(syncCfg.token || '') + '" style="width:120px;background:rgba(255,255,255,0.05);border:0.5px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.8);font-size:12px;font-family:var(--font-mono);padding:6px 8px;border-radius:8px;text-align:right;"></div>';
      html += '<div class="settings-row-dark" onclick="App.syncNow()">'
        + '<div class="sr-icon ic-orange">' + Icons.syncIcon + '</div><span class="sr-label">立即备份 / 同步</span><span class="sr-value" id="syncStatus">' + Sync.statusLine() + '</span><span class="sr-chevron">›</span></div>';
      html += '</div></div>';

      // 设置（含迁移说明）
      html += '<div class="profile-section-title-dark">设置</div>';
      html += '<div class="profile-list-dark"><div class="settings-list-dark">';
      html += '<div class="settings-row-dark" onclick="App.toggleMigrationNote()" id="migrationToggle">'
        + '<div class="sr-icon ic-gold">' + Icons.info + '</div><span class="sr-label">小程序 / App 迁移说明</span><span class="sr-chevron">›</span></div>';
      html += '</div></div>';
      html += '<div class="form-section-collapse" id="migrationCollapse"><div class="migration-note"><p>本应用采用<strong>数据层与渲染层分离</strong>的架构，便于迁移：</p>'
        + '<p style="margin-top:8px;"><strong>1. 微信小程序：</strong>将 <code>charging-tracker.js</code> 中的 <code>localStorage</code> 替换为 <code>wx.setStorageSync</code> / <code>wx.getStorageSync</code>，渲染层将 DOM 操作替换为 WXML + <code>setData</code>。</p>'
        + '<p style="margin-top:8px;"><strong>2. 原生 App：</strong>将 <code>Store</code> 的存储替换为 SQLite 或 AsyncStorage（React Native）。</p>'
        + '<p style="margin-top:8px;"><strong>3. 云同步：</strong>数据结构已含 <code>id</code> / <code>createdAt</code> 字段，可直接作为数据库 Schema。</p>'
        + '<p style="margin-top:8px;"><strong>4. 车型库扩展：</strong>当前为手动填写，后续可新增 <code>vehicles_db</code> 表预置主流车型参数。</p></div></div>';

      // 危险操作
      html += '<div class="profile-section-title-dark" style="color:var(--sys-red);">危险操作</div>';
      html += '<div class="profile-list-dark"><div class="settings-list-dark">';
      html += '<div class="settings-row-dark" onclick="App.showConfirm(\'清空所有数据\',\'确定清空所有数据？此操作不可恢复，建议先导出备份。\',function(){Store.clearAll();location.reload();})">'
        + '<div class="sr-icon ic-red">' + Icons.trash + '</div><span class="sr-label" style="color:var(--sys-red);">清空所有数据</span><span class="sr-chevron">›</span></div>';
      html += '</div></div>';

      // 版本脚注
      html += '<div style="text-align:center;padding:var(--sp-4) 0 var(--sp-6);">'
        + '<span style="font-size:12px;color:rgba(255,255,255,0.15);">冲充电 v2.0 · Dark Liquid Glass</span></div>';

      document.getElementById('panel-profile').innerHTML = html;
      // 绑定设置事件（导入 / 令牌）
      this.bindSettingsEvents();
    },

    toggleSync: function () {
      var cfg = Sync.loadCfg();
      cfg.enabled = !cfg.enabled;
      Sync.saveCfg();
      var el = document.getElementById('syncToggle');
      if (el) el.className = 'toggle-dark ' + (cfg.enabled ? 'on' : 'off');
      if (cfg.enabled && cfg.token && !cfg.gistId) Sync.push();
      this.toast(cfg.enabled ? '已启用云同步备份' : '已关闭云同步备份', 'success');
      var st = document.getElementById('syncStatus');
      if (st) st.textContent = Sync.statusLine();
    },

    syncNow: function () {
      var tEl = document.getElementById('syncToken');
      var token = tEl ? tEl.value.trim() : '';
      if (token) {
        var cfg = Sync.loadCfg(); cfg.token = token; cfg.enabled = true; Sync.saveCfg();
        var tg = document.getElementById('syncToggle'); if (tg) tg.className = 'toggle-dark on';
      }
      Sync.syncNow();
      setTimeout(function () {
        var st = document.getElementById('syncStatus');
        if (st) st.textContent = Sync.statusLine();
      }, 1200);
    },

    settingsItem: function (color, icon, title, desc, action) {
      return '<div class="settings-item"><div class="settings-item-left"><div class="settings-icon ' + color + '">' + icon + '</div>'
        + '<div class="settings-item-info"><div class="si-title">' + title + '</div><div class="si-desc">' + desc + '</div></div></div>'
        + action + '</div>';
    },

    bindSettingsEvents: function () {
      var self = this;
      var exportBtn = document.getElementById('btnExport');
      if (exportBtn) exportBtn.onclick = function () { Store.exportJSON(); self.toast('已导出备份文件', 'success'); };
      var importInput = document.getElementById('importInput');
      if (importInput) importInput.onchange = function () {
        if (this.files[0]) Store.importJSON(this.files[0], function (ok, msg) { self.toast(msg, ok ? 'success' : 'error'); if (ok) location.reload(); });
      };
      var clearBtn = document.getElementById('btnClear');
      if (clearBtn) clearBtn.onclick = function () {
        self.showConfirm('清空所有数据', '确定清空所有数据？此操作不可恢复，建议先导出备份。', function () {
          Store.clearAll();
          location.reload();
        });
      };

      // 数据同步控件
      var syncEnable = document.getElementById('syncEnable');
      if (syncEnable) syncEnable.onchange = function () {
        var cfg = Sync.loadCfg();
        cfg.enabled = syncEnable.checked;
        Sync.saveCfg();
        if (cfg.enabled && cfg.token && !cfg.gistId) Sync.push();
        else self.toast(cfg.enabled ? '已启用自动同步' : '已关闭自动同步', 'success');
        SyncStatusUI(self);
      };
      var syncToken = document.getElementById('syncToken');
      if (syncToken) syncToken.onchange = function () {
        var v = syncToken.value.trim();
        if (v) { var cfg = Sync.loadCfg(); cfg.token = v; Sync.saveCfg(); self.toast('令牌已保存', 'success'); SyncStatusUI(self); }
      };
      var btnSync = document.getElementById('btnSyncNow');
      if (btnSync) btnSync.onclick = function () {
        var t = syncToken ? syncToken.value.trim() : '';
        if (t) { var cfg = Sync.loadCfg(); cfg.token = t; cfg.enabled = true; if (syncEnable) syncEnable.checked = true; Sync.saveCfg(); }
        Sync.syncNow();
        setTimeout(function () { SyncStatusUI(self); }, 1200);
      };
    },

    /* ---- 车辆选择器 ---- */
    openVehiclePicker: function () {
      var vehicles = VehicleMgr.list();
      var current = VehicleMgr.current();
      var listEl = document.getElementById('vehiclePickerList');
      if (vehicles.length === 0) {
        listEl.innerHTML = '<div class="empty-state" style="padding:20px;"><p>还没有车辆</p>'
          + '<button class="btn btn-sm btn-primary" onclick="App.closeModals();App.openVehicleModal()">' + Icons.plus + '添加车辆</button></div>';
      } else {
        listEl.innerHTML = '<div class="vehicle-list">' + vehicles.map(function (v) {
          return '<div class="vehicle-card" style="cursor:pointer;" onclick="App.selectVehicle(\'' + v.id + '\')">'
            + '<div class="vehicle-avatar">' + Icons.car + '</div>'
            + '<div class="vehicle-info"><div class="vehicle-name">' + v.name + '</div>'
            + '<div class="vehicle-meta">' + (v.brand || '') + ' ' + (v.model || '') + '</div></div>'
            + (current && current.id === v.id ? '<div style="color:var(--primary)">' + Icons.check + '</div>' : '')
            + '</div>';
        }).join('') + '</div>'
          + '<button class="btn btn-outline btn-block" style="margin-top:12px;" onclick="App.closeModals();App.openVehicleModal()">' + Icons.plus + '添加新车辆</button>';
      }
      document.getElementById('vehiclePickerModal').classList.add('show');
    },

    selectVehicle: function (id) {
      VehicleMgr.setCurrent(id);
      this.closeModals();
      this.renderAll();
      this.toast('已切换车辆', 'success');
    },

    /* ---- 充电表单页面（独立页面） ---- */
    previousTab: 'home',

    openChargePage: function (id) {
      this.editingChargeId = id || null;
      var vehicle = VehicleMgr.current();
      if (!vehicle) { this.toast('请先添加车型', 'warn'); this.switchTab('profile'); return; }

      this.previousTab = this.currentTab;

      var form = document.getElementById('chargeFormPage-form');
      form.reset();
      document.getElementById('cf_vehicleId').value = vehicle.id;
      document.getElementById('cf_date').value = Utils.today();

      // 重置互算提示
      var calcHint = document.getElementById('autoCalcHint');
      if (calcHint) calcHint.style.display = 'none';

      // 重置分段按钮为快充
      document.querySelectorAll('#cf_chargeTypeSegment .form-segment-btn').forEach(function (b) {
        b.classList.toggle('active', b.dataset.val === 'fast');
      });
      document.getElementById('cf_chargeType').value = 'fast';

      if (id) {
        var c = ChargeMgr.get(id);
        if (c) {
          document.getElementById('cf_date').value = c.date;
          document.getElementById('cf_odometer').value = c.odometer;
          document.getElementById('cf_chargeType').value = c.chargeType;
          document.querySelectorAll('#cf_chargeTypeSegment .form-segment-btn').forEach(function (b) {
            b.classList.toggle('active', b.dataset.val === c.chargeType);
          });
          document.getElementById('cf_kWh').value = c.kWh;
          document.getElementById('cf_unitPrice').value = c.unitPrice;
          document.getElementById('cf_totalCost').value = c.totalCost;
          document.getElementById('cf_socBefore').value = c.socBefore;
          document.getElementById('cf_socAfter').value = c.socAfter;
          document.getElementById('cf_note').value = c.note || '';
        }
        document.getElementById('chargeFormPageTitle').textContent = '编辑充电记录';
      } else {
        document.getElementById('chargeFormPageTitle').textContent = '添加充电记录';
      }
      if (typeof this.refreshCostPreview === 'function') this.refreshCostPreview();
      document.getElementById('chargeFormPage').classList.add('show');
      document.getElementById('chargeFormPage').scrollTop = 0;
      // 压入历史栈，使系统级返回（浏览器返回键/手势）先关闭本页而非退出应用
      this._overlayDepth = (this._overlayDepth || 0) + 1;
      history.pushState({ implOverlay: true, t: Date.now() }, '');
    },

    closeChargePage: function (silent) {
      document.getElementById('chargeFormPage').classList.remove('show');
      this.editingChargeId = null;
      // 常规关闭（×/保存/页面返回按钮）：弹出历史栈与 popstate 保持同步
      if (!silent && this._overlayDepth > 0) {
        this._overlayDepth = Math.max(0, this._overlayDepth - 1);
        history.back();
      }
    },

    // 兼容旧调用
    openChargeModal: function (id) { this.openChargePage(id); },

    toggleChargeAdvanced: function () {
      // 不再使用折叠区，保留方法兼容
    },

    toggleMigrationNote: function () {
      var toggle = document.getElementById('migrationToggle');
      var collapse = document.getElementById('migrationCollapse');
      if (toggle && collapse) {
        toggle.classList.toggle('open');
        collapse.classList.toggle('open');
      }
    },

    shakeSaveBtn: function () {
      var btn = document.querySelector('#chargeFormPage-form .btn-accent');
      if (!btn) return;
      btn.classList.remove('shake');
      void btn.offsetWidth; // 重置动画
      btn.classList.add('shake');
    },

    saveCharge: function () {
      var data = {
        vehicleId: document.getElementById('cf_vehicleId').value,
        date: document.getElementById('cf_date').value,
        odometer: document.getElementById('cf_odometer').value,
        chargeType: document.getElementById('cf_chargeType').value,
        kWh: document.getElementById('cf_kWh').value,
        unitPrice: document.getElementById('cf_unitPrice').value,
        totalCost: document.getElementById('cf_totalCost').value,
        socBefore: document.getElementById('cf_socBefore').value,
        socAfter: document.getElementById('cf_socAfter').value,
        note: document.getElementById('cf_note').value
      };
      if (!data.date) { this.shakeSaveBtn(); this.toast('请选择日期', 'warn'); return; }
      if (!data.kWh) { this.shakeSaveBtn(); this.toast('请输入充电度数', 'warn'); return; }
      if (this.editingChargeId) ChargeMgr.update(this.editingChargeId, data);
      else ChargeMgr.add(data);
      this.closeChargePage();
      this.renderAll();
      this.toast('保存成功', 'success');
    },

    editCharge: function (id) { this.openChargeModal(id); },
    deleteCharge: function (id) {
      this.showConfirm('删除充电记录', '确定删除这条充电记录？此操作不可恢复。', function () {
        ChargeMgr.remove(id);
        App.renderAll();
        App.toast('已删除', 'success');
      });
    },

    detailVehicle: function (id) {
      var v = VehicleMgr.get(id);
      if (!v) return;
      var body = '<div class="vehicle-detail-head">'
        + '<div class="vehicle-avatar large">' + Icons.car + '</div>'
        + '<div><div class="vehicle-name" style="font-size:18px;">' + v.name + '</div>'
        + '<div class="vehicle-meta" style="margin-top:4px;">' + (v.brand || '') + ' ' + (v.model || '') + '</div></div>'
        + '</div>';
      if (v.note) {
        body += '<div class="vehicle-detail-note">' + Icons.info + ' <span>' + v.note + '</span></div>';
      }
      document.getElementById('vehicleDetailBody').innerHTML = body;
      document.getElementById('vdEdit').onclick = function () { App.closeModals(); App.editVehicle(id); };
      document.getElementById('vdDelete').onclick = function () { App.closeModals(); App.deleteVehicle(id); };
      document.getElementById('vehicleDetailModal').classList.add('show');
    },

    openVehicleModal: function (id) {
      this.editingVehicleId = id || null;
      var form = document.getElementById('vehicleForm');
      form.reset();
      if (id) {
        var v = VehicleMgr.get(id);
        if (v) {
          document.getElementById('vf_name').value = v.name;
          document.getElementById('vf_brand').value = v.brand || '';
          document.getElementById('vf_model').value = v.model || '';
          document.getElementById('vf_batteryCapacity').value = v.batteryCapacity;
          document.getElementById('vf_maxChargePower').value = v.maxChargePower || '';
          document.getElementById('vf_supportsFastCharge').checked = v.supportsFastCharge;
          document.getElementById('vf_note').value = v.note || '';
        }
        document.getElementById('vehicleModalTitle').textContent = '编辑车辆';
      } else {
        document.getElementById('vf_supportsFastCharge').checked = true;
        document.getElementById('vehicleModalTitle').textContent = '添加车辆';
      }
      document.getElementById('vehicleModal').classList.add('show');
    },

    saveVehicle: function () {
      var data = {
        name: document.getElementById('vf_name').value.trim(),
        brand: document.getElementById('vf_brand').value.trim(),
        model: document.getElementById('vf_model').value.trim(),
        batteryCapacity: document.getElementById('vf_batteryCapacity').value,
        maxChargePower: document.getElementById('vf_maxChargePower').value,
        supportsFastCharge: document.getElementById('vf_supportsFastCharge').checked,
        note: document.getElementById('vf_note').value.trim()
      };
      if (!data.name) { this.toast('请输入车辆名称', 'warn'); return; }
      if (!data.batteryCapacity) { this.toast('请输入电池容量', 'warn'); return; }
      if (this.editingVehicleId) VehicleMgr.update(this.editingVehicleId, data);
      else VehicleMgr.add(data);
      this.closeModals();
      this.renderAll();
      this.toast('保存成功', 'success');
    },

    editVehicle: function (id) { this.openVehicleModal(id); },
    deleteVehicle: function (id) {
      var v = VehicleMgr.get(id);
      this.showConfirm('删除车辆', '确定删除「' + (v ? v.name : '') + '」及其所有充电记录？此操作不可恢复。', function () {
        VehicleMgr.remove(id);
        App.renderAll();
        App.toast('已删除', 'success');
      });
    },

    /* ---- 自定义确认面板 ---- */
    _confirmCallback: null,
    showConfirm: function (title, text, callback) {
      document.getElementById('confirmTitle').textContent = title;
      document.getElementById('confirmText').textContent = text;
      this._confirmCallback = callback;
      document.getElementById('confirmModal').classList.add('show');
    },
    closeConfirm: function () {
      document.getElementById('confirmModal').classList.remove('show');
      this._confirmCallback = null;
    },
    confirmOk: function () {
      var cb = this._confirmCallback;
      this.closeConfirm();
      if (cb) cb();
    },

    closeModals: function () {
      document.querySelectorAll('.modal').forEach(function (m) { m.classList.remove('show'); });
      this.editingChargeId = null;
      this.editingVehicleId = null;
    },

    drawChart: function (id, fn) {
      var canvas = document.getElementById(id);
      if (canvas) requestAnimationFrame(function () {
        fn(canvas);
        // 若图表处于横向滚动容器中，默认滚动到右侧展示最新数据
        var wrap = canvas.parentElement;
        if (wrap && wrap.classList && wrap.classList.contains('chart-scroll')) {
          wrap.scrollLeft = wrap.scrollWidth;
        }
      });
    },

    toast: function (msg, type) {
      var t = document.createElement('div');
      t.className = 'toast' + (type ? ' ' + type : '');
      var iconSvg = type === 'success' ? Icons.check : (type === 'error' ? Icons.alert : (type === 'warn' ? Icons.alert : Icons.check));
      t.innerHTML = iconSvg + '<span>' + msg + '</span>';
      document.body.appendChild(t);
      setTimeout(function () { t.classList.add('show'); }, 10);
      setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 2000);
    }
  };

  window.App = App;
  document.addEventListener('DOMContentLoaded', function () { App.init(); });
})();
