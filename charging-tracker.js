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
    infinity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.178 8c5.384 0 5.384 8 0 8-5.384 0-7.356-8-12.74-8-5.384 0-5.384 8 0 8 5.384 0 7.356-8 12.74-8z" stroke-linecap="round" stroke-linejoin="round"/></svg>'
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

    save: function () { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); },

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
        var dist = charges[i].odometer - charges[i - 1].odometer;
        if (dist > 0 && charges[i].kWh > 0)
          results.push({ date: charges[i].date, monthKey: Utils.monthKey(charges[i].date), value: (charges[i].kWh / dist) * 100, distance: dist });
      }
      return results;
    },
    overview: function (vid, year) {
      var charges = vid ? Store.data.charges.filter(function (c) { return c.vehicleId === vid; }) : Store.data.charges;
      if (year) {
        var y = String(year);
        charges = charges.filter(function (c) { return c.date.slice(0, 4) === y; });
      }
      var totalCost = 0, totalKWh = 0, count = charges.length, fastCount = 0, slowCount = 0;
      var thisMonth = Utils.monthKey(Utils.today()), thisMonthCost = 0, thisMonthKWh = 0;
      charges.forEach(function (c) {
        totalCost += c.totalCost || 0; totalKWh += c.kWh || 0;
        if (c.chargeType === CHARGE_TYPE.FAST) fastCount++; else slowCount++;
        if (Utils.monthKey(c.date) === thisMonth) { thisMonthCost += c.totalCost || 0; thisMonthKWh += c.kWh || 0; }
      });
      var sorted = vid ? this.sortedCharges(vid) : [];
      var eff = this.kWhPer100km(sorted);
      var avgEff = eff.length ? eff.reduce(function (s, e) { return s + e.value; }, 0) / eff.length : 0;
      var avgPrice = totalKWh > 0 ? totalCost / totalKWh : 0;
      return { totalCost: totalCost, totalKWh: totalKWh, chargeCount: count, fastCount: fastCount, slowCount: slowCount, thisMonthCost: thisMonthCost, thisMonthKWh: thisMonthKWh, avgEff: avgEff, avgPrice: avgPrice };
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
      return months.map(function (k) {
        return { label: Utils.monthShort(k), value: map[k] || 0, monthKey: k, totalKWh: kWhMap[k] || 0 };
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
    }
  };

  /* ============================================================
   * 电池健康综合评估
   * ============================================================ */
  var BatteryHealth = {
    estimateCapacity: function (vid) {
      var charges = ChargeMgr.listByVehicle(vid);
      var estimates = [];
      charges.forEach(function (c) {
        var socDelta = c.socAfter - c.socBefore;
        if (socDelta >= 30 && c.kWh > 0)
          estimates.push({ date: c.date, monthKey: Utils.monthKey(c.date), capacity: c.kWh / (socDelta / 100) });
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
    },

    _renderYAxis: function (opts, maxV, H, padT, ch) {
      var el = opts.yaxisId ? document.getElementById(opts.yaxisId) : null;
      if (!el) return;
      var html = '';
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
      var padL = 8, padR = 12, padT = 22, padB = 36;
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
      var color = opts.color || '#5B8FA8';

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
        // 面积填充
        ctx.beginPath();
        ctx.moveTo(pts[0].x, padT + ch);
        pts.forEach(function (p) { ctx.lineTo(p.x, p.y); });
        ctx.lineTo(pts[pts.length - 1].x, padT + ch);
        ctx.closePath();
        var grad = ctx.createLinearGradient(0, padT, 0, padT + ch);
        grad.addColorStop(0, color + '40'); grad.addColorStop(1, color + '05');
        ctx.fillStyle = grad; ctx.fill();
        // 折线
        ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2.5;
        pts.forEach(function (p, idx) { if (idx === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
        ctx.stroke();
        // 数据点 + 横轴月份标签
        ctx.textAlign = 'center'; ctx.font = '10px sans-serif';
        pts.forEach(function (p, idx) {
          ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#fff'; ctx.fill();
          ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = '#64738a';
          // 首尾标签向内对齐，避免贴近边缘时溢出
          ctx.textAlign = (idx === 0) ? 'left' : (idx === pts.length - 1 ? 'right' : 'center');
          var labelX = (idx === 0) ? Math.max(p.x + 4, padL) : (idx === pts.length - 1 ? Math.min(p.x - 4, W - padR) : p.x);
          ctx.fillText(p.d.label, labelX, padT + ch + 18);
        });
        // 选中点的数据标签（默认隐藏，点击该点展示，点击其他区域隐藏）
        if (opts.labelFormat && selected >= 0 && pts[selected] && pts[selected].d.value > 0) {
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

      this._attachTouch(canvas, pts, opts);
    },

    bar: function (canvas, data, opts) {
      opts = opts || {};
      var ctx = canvas.getContext('2d');
      var dpr = window.devicePixelRatio || 1;
      var baseW = canvas.clientWidth || 300;
      var H = canvas.clientHeight || 200;
      // y 轴刻度与单位已抽离到左侧固定列，画布内不再保留左轴数值
      var padL = 8, padR = 12, padT = 26, padB = 36;
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
      var color = opts.color || '#5B8FA8';

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
      this.bindEvents();
      this.bindAnalysisSegments();
      this.renderAll();
    },

    bindEvents: function () {
      var self = this;
      document.querySelectorAll('.tab-btn').forEach(function (btn) {
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

      if (kWhInput) kWhInput.addEventListener('input', function () { updateAutoCalc('kWh'); });
      if (priceInput) priceInput.addEventListener('input', function () { updateAutoCalc('unitPrice'); });
      if (costInput) costInput.addEventListener('input', function () { updateAutoCalc('totalCost'); });

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
      document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === tab); });
      document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.toggle('active', p.id === 'panel-' + tab); });
      this.renderTab(tab);
      // FAB 只在有车辆时显示
      var fab = document.getElementById('fabAddCharge');
      if (fab) fab.style.display = (tab === 'home' || tab === 'records') ? 'flex' : 'none';
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

      // 英雄概览卡
      html += '<div class="hero-card">';
      html += '<div class="hero-top">';
      html += '<div>';
      html += '<div class="hero-label">本月充电费用</div>';
      html += '<div class="hero-amount">¥' + Utils.fmtMoney(ov.thisMonthCost) + '</div>';
      html += '<div class="hero-amount-sub">充入 ' + Utils.fmt(ov.thisMonthKWh, 1) + ' 度 · ' + vehicle.name + '</div>';
      html += '</div>';
      html += '</div>';
      html += '<div class="hero-stats">';
      html += '<div class="hero-stat-item"><div class="hs-label">累计充电</div><div class="hs-value">' + Utils.fmt(ov.totalKWh, 0) + ' 度</div></div>';
      html += '<div class="hero-stat-item"><div class="hs-label">充电次数</div><div class="hs-value">' + ov.chargeCount + ' 次</div></div>';
      html += '<div class="hero-stat-item"><div class="hs-label">平均电价</div><div class="hs-value">¥' + Utils.fmtMoney(ov.avgPrice) + '</div></div>';
      html += '</div>';
      html += '<div class="hero-actions">';
      html += '<button class="hero-btn hero-btn-primary" onclick="App.openChargeModal()">' + Icons.plus + '记一笔充电</button>';
      html += '<button class="hero-btn hero-btn-ghost" onclick="App.switchTab(\'analysis\')">' + Icons.chart + '查看分析</button>';
      html += '</div>';
      html += '</div>';

      // 费用趋势（支持横滑查看全部历史）
      var costMonths = Utils.chartRange(vid, 6);
      var costData = Stats.monthlyCost(vid, costMonths);
      var yearTag = Utils.yearRangeTag(costMonths);
      html += '<div class="card card-chart"><h3>' + Icons.trend + '充电费用趋势<span class="chart-year-tag">' + yearTag + '</span></h3>' + this.chartWrap('homeCostChart') + '</div>';

      // 最近记录（卡片式）
      var recent = ChargeMgr.list(vid).slice(0, 3);
      html += '<div class="card"><div class="card-head"><h3>' + Icons.clock + '最近充电</h3>'
        + '<button class="btn-mini" onclick="App.switchTab(\'records\')">查看全部</button></div>';
      if (recent.length === 0) {
        html += '<div class="empty-state" style="padding:20px;">' + Icons.bolt + '<p>暂无充电记录</p>'
          + '<button class="btn btn-primary btn-block" onclick="App.openChargeModal()">' + Icons.plus + '记一笔充电</button></div>';
      } else {
        html += '<div class="charge-list">';
        var self = this;
        recent.forEach(function (c) {
          html += self.chargeCardHTML(c, false);
        });
        html += '</div>';
      }
      html += '</div>';

      document.getElementById('panel-home').innerHTML = html;
      var self = this;
      this.drawChart('homeCostChart', function (canvas) {
        Charts.line(canvas, Stats.monthlyCost(vid, Utils.chartRange(vid, 6)), {
          yaxisId: 'homeCostChartY', color: '#5B8FA8', digits: 0, minSpan: 64,
          labelFormat: function (d) {
            return '¥' + Utils.fmtMoney(d.value) + (d.totalKWh > 0 ? '\n' + Utils.fmt(d.totalKWh, 0) + '度' : '');
          },
          tooltipFormat: function (d) {
            var t = d.label + ': ¥' + Utils.fmtMoney(d.value);
            if (d.totalKWh > 0) t += ' · ' + Utils.fmt(d.totalKWh, 1) + ' 度';
            return t;
          },
          yFormat: function (v) { return '¥' + v.toFixed(0); }
        });
      });
    },

    statCard: function (color, icon, title, value, sub) {
      return '<div class="stat-card ' + color + '">'
        + '<div class="stat-head"><span class="stat-ic">' + icon + '</span><span class="stat-title">' + title + '</span></div>'
        + '<div class="stat-value">' + value + '</div>'
        + '<div class="stat-sub">' + sub + '</div></div>';
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
      var charges = ChargeMgr.list(vid);
      var html = '';

      if (!vid) {
        html = '<div class="empty-state">' + Icons.doc + '<p>请先添加车型</p></div>';
        document.getElementById('panel-records').innerHTML = html;
        return;
      }

      html += '<div class="card"><div class="card-head"><h3>' + Icons.doc + '充电记录</h3>'
        + '<button class="btn btn-primary" onclick="App.openChargePage()">' + Icons.plus + '添加</button></div>';

      if (charges.length === 0) {
        html += '<div class="empty-state" style="padding:20px;">' + Icons.bolt + '<p>还没有充电记录</p>'
          + '<button class="btn btn-primary btn-block" onclick="App.openChargePage()">' + Icons.plus + '记一笔充电</button></div>';
      } else {
        // 筛选标签
        html += '<div class="filter-chips">';
        html += '<button class="filter-chip ' + (this.recordsFilter === 'all' ? 'active' : '') + '" onclick="App.setRecordsFilter(\'all\')">全部</button>';
        html += '<button class="filter-chip ' + (this.recordsFilter === 'slow' ? 'active' : '') + '" onclick="App.setRecordsFilter(\'slow\')">慢充</button>';
        html += '<button class="filter-chip ' + (this.recordsFilter === 'fast' ? 'active' : '') + '" onclick="App.setRecordsFilter(\'fast\')">快充</button>';
        html += '</div>';

        // 日期筛选（年份 + 月份级联）
        var years = Utils.availableYears(vid);

        html += '<div class="date-filter-bar">';
        html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6" stroke-linecap="round"/><line x1="8" y1="2" x2="8" y2="6" stroke-linecap="round"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
        // 年份下拉
        html += '<select onchange="App.setRecordsYear(this.value)">';
        html += '<option value="">全部年份</option>';
        years.forEach(function (y) {
          html += '<option value="' + y + '"' + (App.recordsYearFilter === y ? ' selected' : '') + '>' + y + '年</option>';
        });
        html += '</select>';
        // 月份下拉（随所选年份联动）
        var months = [];
        charges.forEach(function (c) {
          if (App.recordsYearFilter && c.date.slice(0, 4) !== App.recordsYearFilter) return;
          var mk = Utils.monthKey(c.date);
          if (months.indexOf(mk) < 0) months.push(mk);
        });
        months.sort(function (a, b) { return b.localeCompare(a); });
        html += '<select onchange="App.setRecordsMonth(this.value)">';
        html += '<option value="">全部月份</option>';
        months.forEach(function (mk) {
          html += '<option value="' + mk + '"' + (App.recordsMonthFilter === mk ? ' selected' : '') + '>' + Utils.monthLabel(mk) + '</option>';
        });
        html += '</select>';
        if (this.recordsYearFilter || this.recordsMonthFilter) {
          html += '<button class="filter-reset" onclick="App.setRecordsYear(\'\');App.setRecordsMonth(\'\')">重置</button>';
        }
        html += '</div>';

        // 过滤记录
        var filtered = charges;
        if (this.recordsFilter !== 'all') {
          filtered = filtered.filter(function (c) { return c.chargeType === App.recordsFilter; });
        }
        if (this.recordsYearFilter) {
          filtered = filtered.filter(function (c) { return c.date.slice(0, 4) === App.recordsYearFilter; });
        }
        if (this.recordsMonthFilter) {
          filtered = filtered.filter(function (c) { return Utils.monthKey(c.date) === App.recordsMonthFilter; });
        }

        if (filtered.length === 0) {
          html += '<div class="empty-state" style="padding:20px;"><p>没有匹配的记录</p></div>';
        } else {
          // 按月度分组
          var groups = {};
          filtered.forEach(function (c) {
            var mk = Utils.monthKey(c.date);
            if (!groups[mk]) groups[mk] = [];
            groups[mk].push(c);
          });
          var sortedMonths = Object.keys(groups).sort(function (a, b) { return b.localeCompare(a); });
          var self = this;

          sortedMonths.forEach(function (mk) {
            var monthCharges = groups[mk];
            var monthCost = 0, monthKWh = 0;
            monthCharges.forEach(function (c) { monthCost += c.totalCost || 0; monthKWh += c.kWh || 0; });

            html += '<div class="month-group">';
            html += '<div class="month-group-header">';
            html += '<div class="month-group-title">' + Utils.monthLabel(mk) + ' · ' + monthCharges.length + ' 次</div>';
            html += '<div class="month-group-summary">';
            html += '<span>' + Icons.zap + Utils.fmt(monthKWh, 1) + ' 度</span>';
            html += '<span>' + Icons.coin + '¥' + Utils.fmtMoney(monthCost) + '</span>';
            html += '</div>';
            html += '</div>';
            html += '<div class="charge-list">';
            monthCharges.forEach(function (c) {
              html += self.chargeCardHTML(c, true);
            });
            html += '</div>';
            html += '</div>';
          });
        }
      }
      html += '</div>';

      document.getElementById('panel-records').innerHTML = html;
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
      this.analysisSub = sub;
      document.querySelectorAll('.segment-btn').forEach(function (b) {
        b.classList.toggle('active', b.dataset.sub === sub);
      });
      this.renderAnalysis();
    },

    /* ---- 分析（分段切换） ---- */
    renderAnalysis: function () {
      var vehicle = VehicleMgr.current();
      var vid = vehicle ? vehicle.id : null;
      var container = document.getElementById('analysis-content');
      if (!vid) {
        container.innerHTML = '<div class="empty-state">'
          + '<img class="empty-state-illustration" src="assets/stats-empty.png" alt="暂无数据">'
          + '<p>请先添加车型</p></div>';
        return;
      }
      switch (this.analysisSub) {
        case 'stats': container.innerHTML = this.renderStatsHTML(vid); this.drawStatsCharts(vid); break;
        case 'health': container.innerHTML = this.renderHealthHTML(vid); this.drawHealthCharts(vid); break;
        case 'recommend': container.innerHTML = this.renderRecommendHTML(vid, vehicle); break;
      }
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

      html += '<div class="stat-cards">';
      html += this.statCard('blue', Icons.coin, '总费用', '¥' + Utils.fmtMoney(ov.totalCost), ov.chargeCount + ' 次');
      html += this.statCard('green', Icons.zap, '总度数', Utils.fmt(ov.totalKWh, 1) + ' 度', '均价 ¥' + Utils.fmtMoney(ov.avgPrice) + '/度');
      html += this.statCard('amber', Icons.gauge, '平均电耗', Utils.fmt(ov.avgEff, 1) + ' 度', 'kWh/100km');
      html += this.statCard('purple', Icons.infinity, '快慢充比', Math.round(ratio.fast * 100) + ':' + Math.round(ratio.slow * 100), '快' + ov.fastCount + ' / 慢' + ov.slowCount);
      html += '</div>';

      // 趋势月份：指定年份显示整年（当年截至当前月），否则展示全部历史（可横滑）
      var months = yearFilter ? Utils.yearMonths(yearFilter) : Utils.chartRange(vid, 6);
      var yearTag = Utils.yearRangeTag(months);
      html += '<div class="card card-chart"><h3>' + Icons.trend + '月度充电费用趋势<span class="chart-year-tag">' + yearTag + '</span></h3>' + this.chartWrap('statsCostChart') + '</div>';
      html += '<div class="card card-chart"><h3>' + Icons.gauge + '月度百公里电耗趋势<span class="chart-year-tag">' + yearTag + '</span></h3>' + this.chartWrap('statsEffChart') + '</div>';
      html += '<div class="card"><h3>' + Icons.battery + '快慢充占比</h3><div class="donut-wrap"><canvas id="statsDonut" class="chart donut"></canvas>';
      html += '<div class="donut-legend"><div class="legend-item"><div class="legend-dot" style="background:#8A6A3A"></div>快充 ' + ratio.fastCount + ' 次</div>'
        + '<div class="legend-item"><div class="legend-dot" style="background:#5B8FA8"></div>慢充 ' + ratio.slowCount + ' 次</div></div></div></div>';
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
          yaxisId: 'statsCostChartY', color: '#5B8FA8', digits: 0, minSpan: 64,
          labelFormat: function (d) {
            return '¥' + Utils.fmtMoney(d.value) + (d.totalKWh > 0 ? '\n' + Utils.fmt(d.totalKWh, 0) + '度' : '');
          },
          tooltipFormat: function (d) {
            var t = d.label + ': ¥' + Utils.fmtMoney(d.value);
            if (d.totalKWh > 0) t += ' · ' + Utils.fmt(d.totalKWh, 1) + ' 度';
            return t;
          },
          yFormat: function (v) { return '¥' + v.toFixed(0); }
        });
      });
      this.drawChart('statsEffChart', function (canvas) {
        Charts.bar(canvas, Stats.monthlyEfficiency(vid, months), {
          yaxisId: 'statsEffChartY', color: '#5B8FA8', digits: 1, minSpan: 58,
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
      var color = health.index >= 85 ? '#4A7A6B' : (health.index >= 70 ? '#5B8FA8' : (health.index >= 50 ? '#8A6A3A' : '#8A3A4A'));
      var html = '';

      // 1. 电池容量分析（置顶）
      if (health.currentEstimate && health.nominal > 0) {
        var pct = Math.round(health.capacityRatio * 100);
        var warn = pct < HEALTH_CONFIG.capacityWarningRatio * 100;
        html += '<div class="card capacity-card"><h3>' + Icons.battery + '电池容量分析</h3>';
        html += '<div class="capacity-main">';
        html += '<div><div class="capacity-num"><span class="cap-value">' + Utils.fmt(health.currentEstimate, 1) + '</span><span class="cap-unit">kWh</span></div>'
          + '<span class="cap-nominal">标称容量 ' + health.nominal + ' kWh</span></div>';
        html += '<span class="capacity-retention' + (warn ? ' warn' : '') + '">' + (warn ? '低于标准' : '保持率') + ' ' + pct + '%</span>';
        html += '</div>';
        html += '<div class="health-bar-wrap"><div class="health-bar"><div class="health-bar-fill" style="width:' + Math.min(100, pct) + '%;background:' + color + '"></div></div></div>';
        if (warn) html += '<p class="warn-text">实测容量低于标称的 ' + Math.round(HEALTH_CONFIG.capacityWarningRatio * 100) + '%，建议关注电池健康并前往检测。</p>';
        html += '<p class="capacity-note"><b>口径说明：</b>实测容量由「单次充入度数 ÷ 充电前后电量(SOC)变化比例」估算，并取近 5 次的中位数，用于监控电池随时间的老化趋势。</p>';
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

      // 品牌标识
      html += '<div class="brand-header">'
        + '<img src="assets/logo.png" alt="冲充电" class="brand-logo">'
        + '<div class="brand-text"><div class="brand-name">冲充电</div>'
        + '<div class="brand-slogan">充电记账 · 电池健康分析</div></div></div>';

      // 车辆管理
      html += '<div class="card"><div class="card-head"><h3>' + Icons.car + '我的车辆</h3>'
        + '<button class="btn btn-sm btn-primary" onclick="App.openVehicleModal()">' + Icons.plus + '添加</button></div>';
      if (vehicles.length === 0) {
        html += '<div class="empty-state" style="padding:26px 20px;">' + Icons.car
          + '<p>还没有添加车辆</p>'
          + '<p class="empty-sub">添加车辆后即可记录充电，统计费用与电耗</p>'
          + '<button class="btn btn-sm btn-primary" onclick="App.openVehicleModal()">' + Icons.plus + '添加车辆</button></div>';
      } else {
        html += '<div class="vehicle-list">';
        vehicles.forEach(function (v) {
          html += '<div class="vehicle-card" onclick="App.detailVehicle(\'' + v.id + '\')">'
            + '<div class="vehicle-avatar">' + Icons.car + '</div>'
            + '<div class="vehicle-info">'
            + '<div class="vehicle-name">' + v.name + '</div>'
            + '<div class="vehicle-meta">' + (v.brand || '') + ' ' + (v.model || '') + '</div>'
            + '</div>'
            + '<div class="vehicle-chevron">›</div>'
            + '</div>';
        });
        html += '</div>';
      }
      html += '</div>';

      // 数据管理
      html += '<div class="card"><h3>' + Icons.settings + '数据管理</h3><div class="settings-list">';
      html += this.settingsItem('blue', Icons.download, '导出备份', '将所有数据导出为 JSON 文件', '<button class="btn btn-primary" id="btnExport">导出</button>');
      html += this.settingsItem('green', Icons.upload, '导入备份', '从 JSON 文件恢复数据', '<label class="btn btn-outline" style="cursor:pointer;">导入<input type="file" id="importInput" accept=".json" style="display:none;"></label>');
      html += this.settingsItem('amber', Icons.play, '我的数据', '载入智己 L6 及近期充电记录', '<button class="btn btn-outline" id="btnMyData" onclick="App.loadMyData()">载入</button>');
      html += this.settingsItem('red', Icons.trash, '清空所有数据', '删除全部数据，不可恢复', '<button class="btn-mini danger" id="btnClear" style="padding:9px 16px;font-size:14px;">清空</button>');
      html += '</div></div>';

      // 迁移说明（折叠）
      html += '<div class="card"><div class="form-section-toggle" onclick="App.toggleMigrationNote()" id="migrationToggle">';
      html += '<span>' + Icons.info + '小程序 / App 迁移说明</span>';
      html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9" stroke-linecap="round" stroke-linejoin="round"/></svg></div>';
      html += '<div class="form-section-collapse" id="migrationCollapse"><div class="migration-note"><p>本应用采用<strong>数据层与渲染层分离</strong>的架构，便于迁移：</p>'
        + '<p style="margin-top:8px;"><strong>1. 微信小程序：</strong>将 <code>charging-tracker.js</code> 中的 <code>localStorage</code> 替换为 <code>wx.setStorageSync</code> / <code>wx.getStorageSync</code>，渲染层将 DOM 操作替换为 WXML + <code>setData</code>。</p>'
        + '<p style="margin-top:8px;"><strong>2. 原生 App：</strong>将 <code>Store</code> 的存储替换为 SQLite 或 AsyncStorage（React Native）。</p>'
        + '<p style="margin-top:8px;"><strong>3. 云同步：</strong>数据结构已含 <code>id</code> / <code>createdAt</code> 字段，可直接作为数据库 Schema。</p>'
        + '<p style="margin-top:8px;"><strong>4. 车型库扩展：</strong>当前为手动填写，后续可新增 <code>vehicles_db</code> 表预置主流车型参数。</p></div></div></div>';

      html += '<div class="card" style="text-align:center;color:var(--text-light);font-size:12px;"><p>冲充电 v4.0 · 数据存储于本地浏览器</p></div>';

      document.getElementById('panel-profile').innerHTML = html;
      // 重新绑定设置按钮事件
      this.bindSettingsEvents();
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
      // 隐藏 FAB 和 tab-bar
      var fab = document.getElementById('fabAddCharge');
      if (fab) fab.style.display = 'none';

      var form = document.getElementById('chargeFormPage-form');
      form.reset();
      document.getElementById('cf_vehicleId').value = vehicle.id;
      document.getElementById('cf_date').value = Utils.today();

      // 重置互算提示
      var calcHint = document.getElementById('autoCalcHint');
      if (calcHint) calcHint.style.display = 'none';

      // 重置分段按钮为慢充
      document.querySelectorAll('#cf_chargeTypeSegment .form-segment-btn').forEach(function (b) {
        b.classList.toggle('active', b.dataset.val === 'slow');
      });
      document.getElementById('cf_chargeType').value = 'slow';

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
      document.getElementById('chargeFormPage').classList.add('show');
    },

    closeChargePage: function () {
      document.getElementById('chargeFormPage').classList.remove('show');
      this.editingChargeId = null;
      // 恢复 FAB
      var fab = document.getElementById('fabAddCharge');
      if (fab) fab.style.display = (this.currentTab === 'home' || this.currentTab === 'records') ? 'flex' : 'none';
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
      var btn = document.querySelector('#chargeFormPage-form .btn[type=submit]');
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
    },

    loadMyData: function () {
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
      this.renderAll();
      this.toast('已载入我的数据：' + v.name, 'success');
    }
  };

  window.App = App;
  document.addEventListener('DOMContentLoaded', function () { App.init(); });
})();
