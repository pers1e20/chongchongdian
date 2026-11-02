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
    },

    exportJSON: function () {
      var blob = new Blob([JSON.stringify(this.data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'ev-charging-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      URL.revokeObjectURL(url);
    },

    /* 读取并校验导入文件，不写库 */
    SNAP_KEY: 'ev_backup_preimport_v1',

    readImportFile: function (file, callback) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var imported;
        try { imported = JSON.parse(e.target.result); }
        catch (err) { callback('导入失败：文件不是合法 JSON', null); return; }
        if (!imported || !(imported.vehicles instanceof Array) || !(imported.charges instanceof Array)) {
          callback('文件格式不正确：缺少 vehicles / charges 数组', null); return;
        }
        callback(null, imported);
      };
      reader.onerror = function () { callback('文件读取失败', null); };
      reader.readAsText(file);
    },

    /* 应用导入：先给当前库拍快照，再整库替换 */
    applyImport: function (imported) {
      try { localStorage.setItem(this.SNAP_KEY, JSON.stringify({ at: Date.now(), data: this.data })); } catch (e) {}
      this.data = imported;
      if (!this.data.settings) this.data.settings = { currentVehicleId: null };
      var vid = this.data.settings.currentVehicleId;
      var exists = this.data.vehicles.some(function (v) { return v.id === vid; });
      if (!exists) this.data.settings.currentVehicleId = this.data.vehicles[0] ? this.data.vehicles[0].id : null;
      this.save();
    },

    peekImportSnapshot: function () {
      try {
        var raw = localStorage.getItem(this.SNAP_KEY);
        if (!raw) return null;
        var snap = JSON.parse(raw);
        if (!snap || !snap.at || !snap.data) return null;
        var d = new Date(snap.at);
        return { at: snap.at, label: (d.getMonth() + 1) + '月' + d.getDate() + '日' };
      } catch (e) { return null; }
    },

    restoreImportSnapshot: function () {
      var snap = this.peekImportSnapshot();
      if (!snap) return false;
      this.data = snap.data;
      localStorage.removeItem(this.SNAP_KEY);
      this.save();
      return true;
    },

    clearAll: function () {
      this.data = { vehicles: [], charges: [], settings: { currentVehicleId: null } };
      this.save();
    }
  };

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
      if (ov.avgPrice > 0 && eff.enough) {
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
      var socBeforeCount = 0, socAfterCount = 0;
      charges.forEach(function (c) {
        if (c.chargeType === CHARGE_TYPE.FAST) fastCount++;
        // 0 表示「未记录」：既不计入深放，也不进分母；否则未填 SOC 的记录会被误判为深放
        if (c.socBefore > 0) {
          socBeforeCount++;
          if (c.socBefore < cfg.deepDischargeThreshold) deepDischargeCount++;
        }
        if (c.socAfter > 0) {
          socAfterCount++;
          if (c.socAfter > cfg.overChargeThreshold) overChargeCount++;
        }
      });
      var fastRatio = fastCount / total;
      var deepRatio = socBeforeCount ? deepDischargeCount / socBeforeCount : 0;
      var overRatio = socAfterCount ? overChargeCount / socAfterCount : 0;
      var fastPenalty = Math.max(0, (fastRatio - cfg.fastChargeHabitRatio) * 80);
      var deepPenalty = deepRatio * 60;
      var overPenalty = overRatio * 40;
      var score = Math.max(0, Math.round(100 - fastPenalty - deepPenalty - overPenalty));
      var factors = [
        { name: '快充占比', value: Math.round(fastRatio * 100) + '%', impact: fastPenalty > 0 ? '偏高' : '正常', penalty: Math.round(fastPenalty) },
        { name: '深放频率', value: socBeforeCount ? Math.round(deepRatio * 100) + '%' : '—', impact: socBeforeCount ? (deepPenalty > 0 ? '偏高' : '正常') : '未记录', penalty: Math.round(deepPenalty) },
        { name: '过充频率', value: socAfterCount ? Math.round(overRatio * 100) + '%' : '—', impact: socAfterCount ? (overPenalty > 0 ? '偏高' : '正常') : '未记录', penalty: Math.round(overPenalty) }
      ];
      return { score: score, factors: factors, fastRatio: fastRatio, deepRatio: deepRatio, overRatio: overRatio, socBeforeCount: socBeforeCount, socAfterCount: socAfterCount };
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
      else if (habit.socBeforeCount > 0 && habit.overRatio < 0.1 && habit.deepRatio < 0.2) tips.push({ icon: 'check', title: '充电区间控制良好', text: '你大多数充电都保持在 ' + cfg.deepDischargeThreshold + '%-' + cfg.overChargeThreshold + '% 的健康区间，对电池寿命非常友好。' });

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
   * UI 渲染与事件
   * ============================================================ */
  var App = {
    currentTab: 'records',
    analysisSub: 'stats',
    statsYear: null,
    editingChargeId: null,
    editingVehicleId: null,
    chargeAdvancedOpen: false,

    init: function () {
      Store.load();
      this.bindEvents();
      this.renderAll();
      // 首次启动时同步底部导航高亮为当前页（首页），避免静态标记停留在其他页签
      document.querySelectorAll('.tabbar-dark .tab-item').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === App.currentTab); });
      // 系统/浏览器返回：若当前处于覆盖页（记一笔 / 车辆表单）则先关闭它，而非退出应用
      window.addEventListener('popstate', function () {
        if (App._overlayDepth > 0) {
          App._overlayDepth = Math.max(0, App._overlayDepth - 1);
          var vp = document.getElementById('vehicleFormPage');
          if (vp && vp.classList.contains('show')) App.closeVehiclePage(true);
          else App.closeChargePage(true);
        }
      });
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

      // 度数 × 单价 = 金额：单价不露在界面上，由金额÷度数反推
      var kWhInput = document.getElementById('cf_kWh');
      var priceInput = document.getElementById('cf_unitPrice');
      var costInput = document.getElementById('cf_totalCost');

      var formEl = document.getElementById('chargeFormPage-form');

      // 度数变化：若单价来自「上次」套用，则金额跟着单价走；否则由金额反推单价
      function onKwhInput() {
        var k = parseFloat(kWhInput && kWhInput.value) || 0;
        var p = parseFloat(priceInput && priceInput.value) || 0;
        var c = parseFloat(costInput && costInput.value) || 0;
        if (k > 0 && p > 0 && formEl && formEl.dataset.priceMode === 'last') {
          costInput.value = (k * p).toFixed(2);
          return;
        }
        if (k > 0 && c > 0 && priceInput) priceInput.value = (c / k).toFixed(2);
      }

      // 金额变化：用户改金额即视为放弃套用单价
      function onCostInput() {
        if (formEl) formEl.dataset.priceMode = '';
        var k = parseFloat(kWhInput && kWhInput.value) || 0;
        var c = parseFloat(costInput && costInput.value) || 0;
        if (k > 0 && c > 0 && priceInput) priceInput.value = (c / k).toFixed(2);
      }

      if (kWhInput) kWhInput.addEventListener('input', onKwhInput);
      if (costInput) costInput.addEventListener('input', onCostInput);
    },

    switchTab: function (tab) {
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
        case 'records': this.renderRecords(); break;
        case 'stats': this.renderAnalysis(); break;
        case 'settings': this.renderProfile(); break;
      }
    },

    /* 设置页不占 Tab，从右上角齿轮进入 */
    openSettings: function () {
      this.settingsReturn = (this.currentTab === 'settings') ? (this.settingsReturn || 'records') : this.currentTab;
      this.switchTab('settings');
    },

    closeSettings: function () {
      this.switchTab(this.settingsReturn || 'records');
    },

    renderAll: function () {
      this.renderTab(this.currentTab);
    },

    /* ---- 记录页顶部：车辆 / 设置 / 本月汇总 ---- */
    recordsHeaderHTML: function (vehicle, vid) {
      var html = '<div class="home-nav-dark">'
        + '<span class="nav-title">' + (vehicle ? vehicle.name : '冲充电') + '</span>'
        + '<button class="nav-btn" onclick="App.openSettings()" aria-label="设置">' + Icons.settings + '</button>'
        + '</div>';
      if (!vid) return html;
      var ov = Stats.overview(vid);
      var avg = ov.thisMonthKWh > 0 ? ov.thisMonthCost / ov.thisMonthKWh : 0;
      html += '<div class="month-strip" onclick="App.switchTab(\'stats\')">'
        + '<div class="ms-left"><div class="ms-value">¥' + Utils.fmtMoney(ov.thisMonthCost) + '</div>'
        + '<div class="ms-sub">' + Utils.monthLabel(Utils.monthKey(Utils.today())) + ' · ' + ov.thisMonthCount + ' 次 · 均价 ¥' + Utils.fmtMoney(avg) + '/度</div></div>'
        + '<span class="ms-arrow">›</span></div>';
      return html;
    },

    /* ---- 趋势图容器（左侧固定Y轴 + 右侧可横滑图表） ---- */
    recordsFilter: 'all',
    recordsMonthFilter: '',
    recordsYearFilter: '',

    renderRecords: function () {
      var vehicle = VehicleMgr.current();
      var vid = vehicle ? vehicle.id : null;
      var panel = document.getElementById('panel-records');
      if (!vid) {
        panel.innerHTML = this.recordsHeaderHTML(null, null)
          + '<div class="records-empty">' + Icons.doc + '<div class="re-title">还没有车辆</div><div class="re-sub">先添加一辆车，再开始记录充电</div><button class="re-btn" onclick="App.openSettings()">去添加车辆</button></div>';
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

      // 顶部：车辆名 + 设置入口 + 本月汇总
      html += this.recordsHeaderHTML(vehicle, vid);

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
      var cap = BatteryHealth.capacityHealth(vid);
      var habit = BatteryHealth.habitScore(vid);
      var nominal = cap.nominal || 0;
      var cell = function (label, value) {
        return '<div class="ds-cell"><div class="dc-label">' + label + '</div><div class="dc-value">' + value + '</div></div>';
      };

      var body = '<div class="ds-hero"><div class="dh-label">容量保持率</div>'
        + '<div class="dh-value">' + (cap.index === null ? '—' : cap.index + '<span class="dc-unit">%</span>') + '</div>'
        + '<div class="dh-sub">' + (cap.index === null
          ? '记录充电前后 SOC 后可估算'
          : (nominal > 0 ? '实测 ' + Utils.fmt(cap.currentEstimate, 1) + ' / 标称 ' + nominal + ' kWh' : '车辆未填写标称容量'))
        + '</div></div>';

      body += '<div class="ds-grid">'
        + cell('充电习惯', habit.score)
        + cell('深放频率', habit.socBeforeCount ? Math.round(habit.deepRatio * 100) + '<span class="dc-unit">%</span>' : '—')
        + cell('过充频率', habit.socAfterCount ? Math.round(habit.overRatio * 100) + '<span class="dc-unit">%</span>' : '—')
        + '</div>';

      var lo = nominal > 0 ? nominal * 0.7 : 0;
      var hi = nominal > 0 ? nominal * 1.08 : Infinity;
      var raw = [];
      ChargeMgr.listByVehicle(vid).forEach(function (c) {
        var sd = (c.socAfter || 0) - (c.socBefore || 0);
        if (sd >= 30 && (c.kWh || 0) > 0) {
          var v = c.kWh / (sd / 100);
          raw.push({ date: c.date, sd: sd, kwh: c.kWh, cap: v, ok: !(nominal > 0 && (v < lo || v > hi)) });
        }
      });
      raw.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });

      body += '<div class="ds-title">容量估算明细</div>';
      if (raw.length) {
        body += '<div class="ds-grid">';
        raw.slice(0, 8).forEach(function (r) {
          body += '<div class="ds-cell"><div class="dc-label">' + r.date + ' · SOC ' + r.sd + '%</div>'
            + '<div class="dc-value">' + Utils.fmt(r.cap, 1) + '<span class="dc-unit">kWh</span>'
            + (r.ok ? '' : ' <span class="dc-unit">已剔除</span>') + '</div></div>';
        });
        body += '</div>';
      } else {
        body += '<div class="ds-note">暂无有效样本：需记录充电前后 SOC（跨度 ≥30%）与充入度数。</div>';
      }
      body += '<div class="ds-note"><b>说明：</b>单次容量 = 充入度数 ÷ SOC 跨度；仅取跨度 ≥30% 的记录，超出标称 0.7~1.08 倍的视为读数偏差剔除。容量保持率取最近 5 次估算的中位数。</div>';

      return { title: '电池', sub: '容量与充电习惯', body: body };
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
      if (Number(c.socBefore) > 0 && Number(c.socAfter) > 0) subParts.push(c.socBefore + '→' + c.socAfter + '%');
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

    statsNavHTML: function () {
      return '<div class="home-nav-dark">'
        + '<span class="nav-title">统计</span>'
        + '<button class="nav-btn" onclick="App.openSettings()" aria-label="设置">' + Icons.settings + '</button>'
        + '</div>';
    },

    renderAnalysis: function () {
      var vehicle = VehicleMgr.current();
      var vid = vehicle ? vehicle.id : null;
      var panel = document.getElementById('panel-stats');
      if (!vid) {
        panel.innerHTML = this.statsNavHTML()
          + '<div class="records-empty" style="margin:24px 16px;">' + Icons.car
          + '<div class="re-title">还没有车辆</div><div class="re-sub">添加车辆后才能查看统计</div>'
          + '<button class="re-btn" onclick="App.openSettings()">去添加车辆</button></div>';
        return;
      }

      var yearFilter = this.statsYear;
      var scope = this.analysisScopeByYear(yearFilter);
      var months = yearFilter ? Utils.yearMonths(parseInt(yearFilter)) : Utils.chartRange(vid, 12);
      var metric = this.statsTrend || 'cost';
      var heroLabel = yearFilter ? (yearFilter + ' 年') : '累计';
      var html = this.statsNavHTML();

      var years = Utils.availableYears(vid);
      if (years.length) {
        html += '<div class="year-filter-dark">';
        html += '<button class="year-chip-dark' + (!yearFilter ? ' active' : '') + '" onclick="App.setStatsYear(\'\')">全部</button>';
        years.forEach(function (y) {
          html += '<button class="year-chip-dark' + (String(yearFilter) === y ? ' active' : '') + '" onclick="App.setStatsYear(\'' + y + '\')">' + y + '</button>';
        });
        html += '</div>';
      }

      /* ---- 费用 ---- */
      html += '<div class="analysis-hero-dark">';
      html += '<div class="ah-label">' + heroLabel + '充电总费用' + this.periodDeltaHTML(yearFilter, vid, scope) + '</div>';
      html += '<div class="ah-value">¥' + Utils.fmtMoney(scope.cost) + '</div>';
      html += '<div class="ah-trend"><span class="trend-val">' + scope.count + ' 次</span>'
        + '<span class="trend-label">均价 ¥' + Utils.fmtMoney(scope.avgPrice) + '/度 · 充入 ' + Utils.fmt(scope.kWh, 1) + ' 度</span></div>';
      html += '</div>';

      var md = this.statsMetricData(metric, vid, months);
      var line = this.buildAnalysisLine(md.monthly);
      html += '<div class="trend-chart-dark">';
      html += '<div class="trend-head"><div class="tc-title">' + md.name + ' · ' + heroLabel + '</div>'
        + '<div class="metric-seg">';
      [['cost', '费用'], ['kwh', '度数'], ['price', '电价'], ['eff', '电耗']].forEach(function (o) {
        html += '<button class="metric-seg-item' + (metric === o[0] ? ' active' : '') + '" onclick="App.setStatsTrend(\'' + o[0] + '\')">' + o[1] + '</button>';
      });
      html += '</div></div>';
      html += '<div class="line-chart-dark"><svg class="line-svg" viewBox="0 0 300 120" preserveAspectRatio="none">';
      html += '<path class="line-area" d="' + line.area + '"/>';
      html += '<path class="line-stroke" d="' + line.d + '" vector-effect="non-scaling-stroke"/>';
      line.pts.forEach(function (p, i) {
        var last = i === line.pts.length - 1;
        var mk = md.monthly[i] ? md.monthly[i].monthKey : '';
        var tip = md.monthly[i] ? (md.monthly[i].label + ' · ' + md.fmt(md.monthly[i].value) + md.unit) : '';
        html += '<rect class="pt' + (last ? ' pt-last' : '') + '" x="' + (p[0] - 2.5) + '" y="' + (p[1] - 1) + '" width="5" height="2" rx="1" onclick="App.showChartSheet(\'month\',\'' + mk + '\')"><title>' + tip + '</title></rect>';
      });
      html += '</svg></div>';
      html += '<div class="line-chart-dark" style="height:auto;"><div class="x-labels">' + line.xlabels + '</div></div>';
      html += '</div>';

      var total = scope.fastCount + scope.slowCount;
      var fPct = total > 0 ? Math.round(scope.fastCount / total * 100) : 0;
      html += '<div class="donut-dark"><div class="dc-title">快慢充比例</div><div class="donut-row-dark">';
      html += this.buildDonut(scope.fastCount, scope.slowCount);
      html += '<div class="donut-legend-dark">';
      html += '<div class="legend-item"><span class="dot dot-fast"></span><span class="ll-label">快充</span><span class="ll-value">' + fPct + '%</span></div>';
      html += '<div class="legend-item"><span class="dot dot-slow"></span><span class="ll-label">慢充</span><span class="ll-value">' + (100 - fPct) + '%</span></div>';
      html += '</div></div></div>';

      var fa = 0, sa = 0, fc = 0, sc = 0;
      (vid ? ChargeMgr.list(vid) : []).forEach(function (c) {
        if (yearFilter && !(c.date && c.date.slice(0, 4) === String(yearFilter))) return;
        if ((c.chargeType || '') === 'fast') { fa += (Number(c.totalCost) || 0); fc += (Number(c.kWh) || 0); }
        else { sa += (Number(c.totalCost) || 0); sc += (Number(c.kWh) || 0); }
      });
      var fAvg = fc > 0 ? fa / fc : 0, sAvg = sc > 0 ? sa / sc : 0;
      if (fAvg > 0 && sAvg > 0) {
        var pd = fAvg - sAvg;
        if (pd >= 0.05) html += '<div class="price-diff-hint">' + Icons.zap + '<span>快充均价 <b>¥' + Utils.fmtMoney(fAvg) + '</b>/度 · 慢充 <b>¥' + Utils.fmtMoney(sAvg) + '</b>/度，改慢充可省钱</span></div>';
        else if (pd > -0.01) html += '<div class="price-diff-hint ok"><span>快慢充价差不大（¥' + Utils.fmtMoney(pd) + '/度），成本已较优</span></div>';
      }

      /* ---- 电耗 ---- */
      var eff = Stats.avgEfficiency(vid, yearFilter);
      var pkm = Stats.pricePerKm(vid, yearFilter);
      html += '<div class="profile-section-title-dark">电耗</div>';
      html += '<div class="stats-summary-dark">'
        + '<div class="ss-item"><div class="ss-v">' + (eff.enough ? Utils.fmt(eff.avg, 1) + '<em>度/100km</em>' : '—') + '</div><div class="ss-l">百公里电耗</div></div>'
        + '<div class="ss-item"><div class="ss-v">' + (pkm.hasData ? '¥' + Utils.fmt(pkm.value, 2) : '—') + '</div><div class="ss-l">每公里成本</div></div>'
        + '<div class="ss-item"><div class="ss-v">' + eff.count + '<em>组</em></div><div class="ss-l">有效样本</div></div>'
        + '</div>';
      html += '<div class="ss-note">' + this.effNote(eff) + '</div>';

      /* ---- 电池 ---- */
      var cap = BatteryHealth.capacityHealth(vid);
      var habit = BatteryHealth.habitScore(vid);
      html += '<div class="profile-section-title-dark">电池</div>';
      html += '<div class="stats-summary-dark" onclick="App.showChartSheet(\'battery\',\'\')">'
        + '<div class="ss-item"><div class="ss-v">' + (cap.index === null ? '—' : cap.index + '<em>%</em>') + '</div><div class="ss-l">容量保持率</div></div>'
        + '<div class="ss-item"><div class="ss-v">' + habit.score + '</div><div class="ss-l">充电习惯</div></div>'
        + '<div class="ss-item"><div class="ss-v">' + (habit.socBeforeCount ? Math.round(habit.deepRatio * 100) + '<em>%</em>' : '—') + '</div><div class="ss-l">深放频率</div></div>'
        + '</div>';
      html += '<div class="ss-note">' + this.capNote(cap) + '</div>';

      /* ---- 建议 ---- */
      var rec = Recommender.generate(vid);
      html += '<div class="profile-section-title-dark">建议</div>';
      html += '<div class="advice-summary-dark" onclick="App.showChartSheet(\'advice\',\'\')">'
        + '<span>' + rec.summary + '</span><span class="as-arrow">›</span></div>';

      html += '<div style="height:24px;"></div>';
      panel.innerHTML = html;
    },

    effNote: function (eff) {
      if (!eff.count) return '记录两次里程不同的充电后，可算出百公里电耗。';
      if (!eff.enough) return '已有 ' + eff.count + ' 组样本，再记 ' + (3 - eff.count) + ' 次可给出平均电耗。';
      return '基于 ' + eff.count + ' 组样本，已剔除异常值。';
    },

    capNote: function (cap) {
      if (cap.index === null) return '记录充电前后 SOC（跨度 ≥30%）后可估算容量。';
      if (!cap.enough) return '仅 ' + cap.sampleCount + ' 组样本，再记 ' + (3 - cap.sampleCount) + ' 次可确认。';
      return '基于最近 ' + cap.sampleCount + ' 组有效样本。';
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

    setStatsTrend: function (mode) {
      this.statsTrend = mode;
      this.renderAnalysis();
    },

    statsMetricData: function (mode, vid, months) {
      var mc = Stats.monthlyCost(vid, months);
      if (mode === 'kwh') {
        var m1 = mc.map(function (x) { return { label: x.label, value: x.totalKWh || 0, monthKey: x.monthKey, totalKWh: x.totalKWh }; });
        return { monthly: m1, name: '月度充入度数', unit: ' 度', fmt: function (v) { return Utils.fmt(v, 1); } };
      }
      if (mode === 'price') {
        var m2 = mc.map(function (x) { return { label: x.label, value: (x.totalKWh > 0) ? (Number(x.value) / x.totalKWh) : 0, monthKey: x.monthKey }; });
        return { monthly: m2, name: '月度平均电价', unit: ' 元/度', fmt: function (v) { return '¥' + Utils.fmt(v, 2); } };
      }
      if (mode === 'eff') {
        var m3 = Stats.monthlyEfficiency(vid, months);
        return { monthly: m3, name: '月度百公里电耗', unit: ' kWh/100km', fmt: function (v) { return Utils.fmt(v, 1); } };
      }
      return { monthly: mc, name: '月度充电费用', unit: '', fmt: function (v) { return '¥' + Utils.fmt(v, 2); } };
    },

    periodDeltaHTML: function (yearFilter, vid, scope) {
      var charges = vid ? ChargeMgr.list(vid) : [];
      var curC = scope.cost, refC = 0, refN = 0, label;
      if (yearFilter) {
        var py = String(parseInt(yearFilter, 10) - 1);
        charges.forEach(function (c) { if (c.date && c.date.slice(0, 4) === py) { refC += (Number(c.totalCost) || 0); refN++; } });
        label = '较' + py + '年';
      } else {
        var t = new Date();
        t.setDate(1);
        t.setMonth((new Date().getMonth()) - 1);
        var lastMk = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-01',
          curMk = Utils.monthKey(Utils.today());
        refC = 0; curC = 0;
        charges.forEach(function (c) {
          var k = Utils.monthKey(c.date);
          if (k === curMk) curC += (Number(c.totalCost) || 0);
          else if (k === lastMk) { refC += (Number(c.totalCost) || 0); refN++; }
        });
        label = '环比上月';
      }
      if (!refN && refC === 0 && curC === 0) return '';
      var pc = refC > 0 ? Math.round((curC - refC) / refC * 1000) / 10 : null;
      if (pc !== null && Math.abs(pc) < 0.1) return '<span class="ah-delta flat">— ' + label + '</span>';
      var up = pc !== null && pc >= 0;
      var arrow = up ? '▲' : '▼';
      return '<span class="ah-delta ' + (pc !== null ? (up ? 'up' : 'down') : 'flat') + '">' + (pc !== null ? '<b>' + arrow + '</b> ' + Math.abs(pc) + '%' : '首月') + ' <em>' + label + '</em></span>';
    },

    adviceSheet: function (vid) {
      var rec = Recommender.generate(vid);
      return { title: '充电建议', sub: rec.summary || '', body: this.buildAdvicePanel(vid) };
    },

    /* 渲染充电建议列表（此前只有调用没有实现，点击必抛 TypeError） */
    buildAdvicePanel: function (vid) {
      var rec = Recommender.generate(vid);
      var tips = (rec && rec.tips) || [];
      if (!tips.length) return '<div class="ds-empty">当前没有需要调整的地方。</div>';
      return '<div class="advice-list">' + tips.map(function (t) {
        var kind = t.icon === 'alert' ? 'warn' : (t.icon === 'check' ? 'ok' : 'info');
        return '<div class="advice-item advice-' + kind + '">'
          + '<span class="advice-icon">' + (Icons[t.icon] || Icons.info || '') + '</span>'
          + '<div class="advice-body"><div class="advice-title">' + (t.title || '') + '</div>'
          + '<div class="advice-text">' + (t.text || '') + '</div></div></div>';
      }).join('') + '</div>';
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
        + '<circle class="donut-track" cx="50" cy="50" r="40" fill="none" stroke-width="12"/>';
      if (total > 0) {
        var dfast = fast / total * C;
        if (fast > 0) html += '<circle class="donut-seg donut-fast" cx="50" cy="50" r="40" fill="none" stroke-width="12" stroke-dasharray="' + dfast.toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 50 50)"/>';
        if (slow > 0) html += '<circle class="donut-seg donut-slow" cx="50" cy="50" r="40" fill="none" stroke-width="12" stroke-dasharray="' + (C - dfast).toFixed(1) + ' ' + C.toFixed(1) + '" stroke-dashoffset="' + (-dfast).toFixed(1) + '" transform="rotate(-90 50 50)"/>';
      }
      html += '</svg>';
      return html;
    },

    setStatsYear: function (year) {
      this.statsYear = year ? String(year) : null;
      this.renderAnalysis();
    },

    renderProfile: function () {
      var vehicles = VehicleMgr.list();
      var currentV = VehicleMgr.current();
      var html = '';

      html += '<div class="home-nav-dark">'
        + '<button class="nav-btn" onclick="App.closeSettings()" aria-label="返回">'
        + '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        + '</button>'
        + '<span class="nav-title">设置</span>'
        + '<span class="nav-btn" aria-hidden="true"></span></div>';

      /* ---- 车辆 ---- */
      html += '<div class="profile-section-title-dark">车辆</div>';
      html += '<div class="profile-list-dark"><div class="settings-list-dark">';
      vehicles.forEach(function (v) {
        var isCur = currentV && currentV.id === v.id;
        html += '<div class="settings-row-dark" onclick="App.detailVehicle(\'' + v.id + '\')">'
          + '<div class="sr-icon ic-gold">' + Icons.car + '</div>'
          + '<span class="sr-label">' + v.name + '</span>'
          + (v.batteryCapacity ? '<span class="sr-value">' + v.batteryCapacity + ' kWh</span>' : '')
          + (isCur
            ? '<span class="sr-value" style="color:var(--sys-green);">当前</span>'
            : '<button class="sr-switch" onclick="event.stopPropagation();App.selectVehicle(\'' + v.id + '\')">切换</button>')
          + '<span class="sr-chevron">›</span></div>';
      });
      html += '<div class="settings-row-dark" onclick="App.openVehicleModal()">'
        + '<div class="sr-icon ic-teal">' + Icons.plus + '</div>'
        + '<span class="sr-label">添加车辆</span><span class="sr-chevron">›</span></div>';
      html += '</div></div>';

      /* ---- 数据 ---- */
      html += '<div class="profile-section-title-dark">数据</div>';
      html += '<div class="profile-list-dark"><div class="settings-list-dark">';
      html += '<div class="settings-row-dark" onclick="App.exportData()">'
        + '<div class="sr-icon ic-blue">' + Icons.download + '</div><span class="sr-label">导出数据</span><span class="sr-value">JSON</span><span class="sr-chevron">›</span></div>';
      html += '<label class="settings-row-dark" style="cursor:pointer;">'
        + '<div class="sr-icon ic-teal">' + Icons.upload + '</div><span class="sr-label">导入数据</span><span class="sr-value">JSON</span><span class="sr-chevron">›</span>'
        + '<input type="file" id="importInput" accept=".json" style="display:none;"></label>';
      var snap = Store.peekImportSnapshot();
      if (snap) {
        html += '<div class="settings-row-dark" onclick="App.restoreImportSnapshot()">'
          + '<div class="sr-icon ic-orange">' + Icons.clock + '</div><span class="sr-label">恢复导入前的数据</span>'
          + '<span class="sr-value">' + snap.label + '</span><span class="sr-chevron">›</span></div>';
      }
      html += '</div></div>';
      html += '<div class="ss-note">换手机或清缓存前先导出；导入会整库替换。</div>';

      /* ---- 高级 ---- */
      html += '<div class="profile-section-title-dark">高级</div>';
      html += '<div class="profile-list-dark"><div class="settings-list-dark">';
      html += '<div class="settings-row-dark" onclick="App.toggleMigrationNote()" id="migrationToggle">'
        + '<div class="sr-icon ic-gold">' + Icons.info + '</div><span class="sr-label">技术说明</span><span class="sr-chevron">›</span></div>';
      html += '<div class="settings-row-dark" onclick="App.clearAllData()">'
        + '<div class="sr-icon ic-red">' + Icons.trash + '</div><span class="sr-label" style="color:var(--sys-red);">清空所有数据</span><span class="sr-chevron">›</span></div>';
      html += '</div></div>';
      html += '<div class="form-section-collapse" id="migrationCollapse"><div class="migration-note">'
        + '<p>纯前端单页应用，数据只存在本机 <code>localStorage</code>（key <code>ev_charging_data_v1</code>）。</p>'
        + '<p style="margin-top:8px;">导出的 JSON 就是整库快照，可直接改名为备份保存。</p></div></div>';

      html += '<div class="settings-version">冲充电 v2.1 · 本地存储</div>';

      document.getElementById('panel-settings').innerHTML = html;
      this.bindSettingsEvents();
    },
    bindSettingsEvents: function () {
      var self = this;
      var importInput = document.getElementById('importInput');
      if (importInput) importInput.onchange = function () {
        var file = this.files && this.files[0];
        this.value = '';
        if (!file) return;
        Store.readImportFile(file, function (err, data) {
          if (err) { self.toast(err, 'error'); return; }
          var n = data.charges.length, v = data.vehicles.length;
          self.showConfirm('导入数据',
            '将用该文件替换现有全部数据（' + v + ' 辆车 · ' + n + ' 条记录）。当前数据会先存为快照，可在「数据管理」里恢复。',
            function () {
              Store.applyImport(data);
              self.toast('导入成功', 'success');
              setTimeout(function () { location.reload(); }, 500);
            });
        });
      };
    },

    exportData: function () {
      Store.exportJSON();
      this.toast('已导出备份文件', 'success');
    },

    clearAllData: function () {
      this.showConfirm('清空所有数据', '确定清空所有数据？此操作不可恢复，建议先导出备份。', function () {
        Store.clearAll();
        location.reload();
      });
    },

    restoreImportSnapshot: function () {
      var snap = Store.peekImportSnapshot();
      if (!snap) { this.toast('没有可恢复的快照', 'error'); return; }
      var self = this;
      this.showConfirm('恢复导入前的数据',
        '将用 ' + snap.label + ' 的导入前快照替换当前全部数据。',
        function () {
          Store.restoreImportSnapshot();
          self.toast('已恢复', 'success');
          setTimeout(function () { location.reload(); }, 500);
        });
    },

    selectVehicle: function (id) {
      VehicleMgr.setCurrent(id);
      this.closeModals();
      this.renderAll();
      this.toast('已切换车辆', 'success');
    },

    /* ---- 记一笔（独立页面） ---- */
    previousTab: 'records',

    openChargePage: function (id) {
      this.editingChargeId = id || null;
      var vehicle = VehicleMgr.current();
      if (!vehicle) { this.toast('请先添加车辆', 'warn'); this.openSettings(); return; }

      this.previousTab = this.currentTab;

      var form = document.getElementById('chargeFormPage-form');
      form.reset();
      form.dataset.priceMode = '';
      document.getElementById('cf_vehicleId').value = vehicle.id;
      document.getElementById('cf_date').value = Utils.today();

      // 重置分段按钮为快充
      document.querySelectorAll('#cf_chargeTypeSegment .form-segment-btn').forEach(function (b) {
        b.classList.toggle('active', b.dataset.val === 'fast');
      });
      document.getElementById('cf_chargeType').value = 'fast';

      if (id) {
        var c = ChargeMgr.get(id);
        if (c) {
          document.getElementById('cf_date').value = c.date;
          // 未记录的 0 回填为空，避免看起来像填过 0
          var put = function (elId, val) {
            document.getElementById(elId).value = (Number(val) > 0) ? val : '';
          };
          put('cf_odometer', c.odometer);
          put('cf_kWh', c.kWh);
          put('cf_unitPrice', c.unitPrice);
          put('cf_totalCost', c.totalCost);
          put('cf_socBefore', c.socBefore);
          put('cf_socAfter', c.socAfter);
          document.getElementById('cf_chargeType').value = c.chargeType;
          document.querySelectorAll('#cf_chargeTypeSegment .form-segment-btn').forEach(function (b) {
            b.classList.toggle('active', b.dataset.val === c.chargeType);
          });
          document.getElementById('cf_note').value = c.note || '';
          // 已有补充信息时展开
          var hasExtra = Number(c.odometer) > 0 || Number(c.socBefore) > 0 || Number(c.socAfter) > 0 || !!c.note;
          this.setChargeExtra(hasExtra);
        }
        document.getElementById('chargeFormPageTitle').textContent = '编辑记录';
      } else {
        document.getElementById('cf_chargeType').value = 'fast';
        this.setChargeExtra(false);
        document.getElementById('chargeFormPageTitle').textContent = '记一笔';
      }

      this.renderLastHint();
      document.getElementById('chargeFormPage').classList.add('show');
      document.getElementById('chargeFormPage').scrollTop = 0;
      // 压入历史栈，使系统级返回（浏览器返回键/手势）先关闭本页而非退出应用
      this._overlayDepth = (this._overlayDepth || 0) + 1;
      history.pushState({ implOverlay: true, t: Date.now() }, '');
    },

    /* 「上次」条：显示最近一条记录，点击套用其电价 */
    renderLastHint: function () {
      var el = document.getElementById('cfLastHint');
      if (!el) return;
      var v = VehicleMgr.current();
      var last = v ? ChargeMgr.list(v.id)[0] : null;
      if (!last) { el.style.display = 'none'; return; }
      el.style.display = 'block';
      var price = last.kWh > 0 ? last.totalCost / last.kWh : 0;
      var d = last.date.split('-');
      el.innerHTML = '上次 ' + parseInt(d[1], 10) + '/' + parseInt(d[2], 10)
        + ' · ' + Utils.fmt(last.kWh, 1) + ' 度 · ¥' + Utils.fmtMoney(last.totalCost)
        + (price > 0 ? ' · <b>¥' + Utils.fmtMoney(price) + '/度</b>（点击套用）' : '');
      el.dataset.price = price > 0 ? price.toFixed(2) : '';
    },

    fillLastCharge: function () {
      var el = document.getElementById('cfLastHint');
      var p = el ? el.dataset.price : '';
      if (!p) { this.toast('上次记录没有电价', 'warn'); return; }
      document.getElementById('cf_unitPrice').value = p;
      var formEl = document.getElementById('chargeFormPage-form');
      if (formEl) formEl.dataset.priceMode = 'last';
      var k = parseFloat(document.getElementById('cf_kWh').value) || 0;
      if (k > 0) {
        document.getElementById('cf_totalCost').value = (k * parseFloat(p)).toFixed(2);
        this.toast('已按 ¥' + p + '/度 算出金额', 'success');
      } else {
        this.toast('已套用 ¥' + p + '/度，输入度数后自动算金额', 'success');
      }
    },

    setChargeExtra: function (open) {
      var box = document.getElementById('cfExtra');
      var btn = document.getElementById('cfMoreBtn');
      if (box) box.classList.toggle('open', !!open);
      if (btn) btn.style.display = open ? 'none' : 'block';
    },

    toggleChargeExtra: function () {
      var box = document.getElementById('cfExtra');
      this.setChargeExtra(box ? !box.classList.contains('open') : true);
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
      var kWhEl = document.getElementById('cf_kWh');
      var costEl = document.getElementById('cf_totalCost');
      var priceEl = document.getElementById('cf_unitPrice');
      var dateEl = document.getElementById('cf_date');

      var kWh = parseFloat(kWhEl.value);
      var cost = parseFloat(costEl.value);
      if (!dateEl.value) { this.shakeSaveBtn(); this.toast('请选择日期', 'warn'); return; }
      if (!(kWh > 0)) { this.shakeSaveBtn(); this.toast('请输入充电度数', 'warn'); return; }

      var price = parseFloat(priceEl.value) || 0;
      if (!(cost > 0) && price > 0) cost = kWh * price;
      if (!(price > 0) && cost > 0) price = cost / kWh;

      var data = {
        vehicleId: document.getElementById('cf_vehicleId').value,
        date: dateEl.value,
        odometer: document.getElementById('cf_odometer').value,
        chargeType: document.getElementById('cf_chargeType').value,
        kWh: kWh,
        unitPrice: price.toFixed(2),
        totalCost: cost > 0 ? cost.toFixed(2) : 0,
        socBefore: document.getElementById('cf_socBefore').value,
        socAfter: document.getElementById('cf_socAfter').value,
        note: document.getElementById('cf_note').value
      };

      if (this.editingChargeId) {
        ChargeMgr.update(this.editingChargeId, data);
        this.closeChargePage();
        this.renderAll();
        this.toast('已保存修改', 'success');
        return;
      }

      ChargeMgr.add(data);
      this.renderAll();
      // 连续补录：清空数值字段，保留日期与类型
      kWhEl.value = '';
      costEl.value = '';
      priceEl.value = '';
      document.getElementById('cf_socBefore').value = '';
      document.getElementById('cf_socAfter').value = '';
      document.getElementById('cf_odometer').value = '';
      document.getElementById('cf_note').value = '';
      this.setChargeExtra(false);
      this.renderLastHint();
      this.toast('已记一笔', 'success');
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
      var page = document.getElementById('vehicleFormPage');
      if (!form || !page) { this.toast('车辆表单未加载', 'error'); return; }
      form.reset();
      if (id) {
        var v = VehicleMgr.get(id);
        if (v) {
          document.getElementById('vf_name').value = v.name || '';
          document.getElementById('vf_brand').value = v.brand || '';
          document.getElementById('vf_model').value = v.model || '';
          // 未记录的 0 回填为空，避免看起来像填过 0
          document.getElementById('vf_batteryCapacity').value = Number(v.batteryCapacity) > 0 ? v.batteryCapacity : '';
          document.getElementById('vf_maxChargePower').value = Number(v.maxChargePower) > 0 ? v.maxChargePower : '';
          document.getElementById('vf_supportsFastCharge').checked = v.supportsFastCharge !== false;
          document.getElementById('vf_note').value = v.note || '';
        }
        document.getElementById('vehicleModalTitle').textContent = '编辑车辆';
      } else {
        document.getElementById('vf_supportsFastCharge').checked = true;
        document.getElementById('vehicleModalTitle').textContent = '添加车辆';
      }
      page.classList.add('show');
      page.scrollTop = 0;
      // 压入历史栈，使系统返回先关闭本页而非退出应用
      this._overlayDepth = (this._overlayDepth || 0) + 1;
      history.pushState({ implOverlay: true, t: Date.now() }, '');
    },

    closeVehiclePage: function (silent) {
      var page = document.getElementById('vehicleFormPage');
      if (page) page.classList.remove('show');
      this.editingVehicleId = null;
      if (!silent && this._overlayDepth > 0) {
        this._overlayDepth = Math.max(0, this._overlayDepth - 1);
        history.back();
      }
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
      this.closeVehiclePage();
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
