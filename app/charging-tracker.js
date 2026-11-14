/**
 * 新能源电车充电记录统计 App —— 数据与逻辑层 v2
 * charging-tracker.js
 * 重构：SVG 图标体系、4 标签导航、分析分段切换、图表触摸提示、折叠表单
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'ev_charging_data_v1';
  var SEED_KEY = 'ev_seed_v1';
  var CHARGE_TYPE = { SLOW: 'slow', FAST: 'fast' };
  var CHARGE_TYPE_LABEL = { slow: '慢充', fast: '快充' };

  var HEALTH_CONFIG = {
    deepDischargeThreshold: 20,
    overChargeThreshold: 90,
    fastChargeHabitRatio: 0.5,
    capacityWarningRatio: 0.85
  };

  /* ============================================================
   * 图标与占位（全部走 HTML 内联 symbol，尺寸由 CSS 控制）
   * ============================================================ */
  function svgIcon(name, cls) {
    return '<svg class="i' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  }

  var Icons = {
    chevronLeft: svgIcon('chevron-left'),
    chevronRight: svgIcon('chevron-right'),
    chevronDown: svgIcon('chevron-down'),
    gear: svgIcon('gear'),
    filter: svgIcon('filter'),
    plus: svgIcon('plus'),
    close: svgIcon('close'),
    check: svgIcon('check'),
    checkMark: svgIcon('check', 'check'),
    alert: svgIcon('alert'),
    info: svgIcon('info'),
    bolt: svgIcon('bolt'),
    plug: svgIcon('plug'),
    battery: svgIcon('battery'),
    gauge: svgIcon('gauge'),
    card: svgIcon('card'),
    chart: svgIcon('chart'),
    car: svgIcon('car'),
    doc: svgIcon('doc'),
    download: svgIcon('download'),
    upload: svgIcon('upload'),
    trash: svgIcon('trash'),
    edit: svgIcon('edit'),
    calendar: svgIcon('calendar'),
    clock: svgIcon('clock'),
    sun: svgIcon('sun'),
    moon: svgIcon('moon'),
    auto: svgIcon('auto'),
    shield: svgIcon('shield'),
    bulb: svgIcon('bulb')
  };

  /* 空态线稿：96×72，1.25px，currentColor */
  var Illustrations = {
    car: '<svg viewBox="0 0 96 72" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + '<path d="M14 52v-5c0-1.7 1.1-3.2 2.7-3.6l9.3-2.4 6.2-8h27.6l6.2 8 9.3 2.4c1.6.4 2.7 1.9 2.7 3.6v5z"/>'
      + '<path d="M14 46h68"/>'
      + '<circle cx="28" cy="52" r="5.5"/><circle cx="68" cy="52" r="5.5"/>'
      + '<path d="M48 8l-5 8h4l-1 6 6-9h-4l1-5z"/></svg>',
records: '<svg viewBox="0 0 96 72" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + '<path d="M30 10h36v52l-6-4-6 4-6-4-6 4-6-4-6 4z"/>'
      + '<path d="M40 24h16M40 32h16M40 40h10"/></svg>',
    stats: '<svg viewBox="0 0 96 72" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + '<path d="M16 58h64M16 58V12"/>'
      + '<path d="M24 46h8M38 46h8M52 46h8M66 46h8" stroke-dasharray="2 5"/></svg>',
    filter: '<svg viewBox="0 0 96 72" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + '<path d="M18 16h56L54 42v16l-12 6V42z"/><circle cx="62" cy="44" r="10"/><path d="M69 51l9 9"/></svg>'
  };

  /* ============================================================
   * 主题（三态：auto / light / dark）
   * ============================================================ */
  var THEME_KEY = 'ev_theme_v1';
  var THEME_COLORS = { light: '#F2F2F7', dark: '#000000' };
  var Theme = {
    pref: function () { return document.documentElement.dataset.pref || 'auto'; },
    apply: function (pref, persist) {
      var dark = pref === 'dark' || (pref === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      var root = document.documentElement;
      root.dataset.theme = dark ? 'dark' : 'light';
      root.dataset.pref = pref;
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', dark ? THEME_COLORS.dark : THEME_COLORS.light);
      var sb = document.getElementById('statusBarMeta');
      if (sb) sb.setAttribute('content', dark ? 'black-translucent' : 'default');
      if (persist) { try { localStorage.setItem(THEME_KEY, pref); } catch (e) {} }
    },
    init: function () {
      this.apply(this.pref(), false);
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var self = this;
      var onChange = function () { if (self.pref() === 'auto') self.apply('auto', false); };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    },
    set: function (pref) { this.apply(pref, true); }
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
      } else if (!localStorage.getItem(SEED_KEY) && Seed.hasData()) {
        /* 首次启动：写入基础数据。解析失败时不覆盖原库，也不种数据。 */
        try {
          this.data = Seed.build();
          this.save();
          localStorage.setItem(SEED_KEY, '1');
        } catch (e) { console.warn('基础数据写入失败', e); }
      }
      this.repair();
      /* 旧库没有版本号：补一个，云同步靠它判断数据新旧 */
      if (!this.data._updatedAt) this.save();
      return this.data;
    },

    /* 兜底：currentVehicleId 指向已删除/不存在的车时回退到第一辆，避免「有车却显示空态」 */
    repair: function () {
      if (!this.data.settings) this.data.settings = { currentVehicleId: null };
      /* 旧数据没有对比油车配置：补一个「未配置」空位，界面据此显示设置入口 */
      if (!this.data.settings.fuelCar || typeof this.data.settings.fuelCar !== 'object') {
        this.data.settings.fuelCar = { model: '', consumption: 0, price: 0 };
      }
      var list = this.data.vehicles || [];
      var cur = this.data.settings.currentVehicleId;
      var exists = cur && list.some(function (v) { return v.id === cur; });
      if (!exists) {
        var next = list[0] ? list[0].id : null;
        if (next !== cur) {
          this.data.settings.currentVehicleId = next;
          try { this.save(); } catch (e) {}
        }
      }
      return this.data.settings.currentVehicleId;
    },

    /* rev 只在云同步回写远端数据时传入；平时取当前时间当版本号 */
    save: function (rev) {
      this.data._updatedAt = (rev === undefined || rev === null) ? Date.now() : (Number(rev) || 0);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      if (typeof Sync !== 'undefined' && !Sync._suppressPush) Sync.schedulePush();
    },

    exportJSON: function () {
      /* 导出不含内部版本号 _updatedAt，保持与旧版备份格式一致 */
      var copy = {};
      Object.keys(this.data).forEach(function (k) {
        if (k !== '_updatedAt') copy[k] = this.data[k];
      }, this);
      var blob = new Blob([JSON.stringify(copy, null, 2)], { type: 'application/json' });
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
      if (!this.data.vehicles) this.data.vehicles = [];
      if (!this.data.charges) this.data.charges = [];
      this.repair();
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
      /* 记住「用户主动清空」，刷新后不再自动种回基础数据 */
      try { localStorage.setItem(SEED_KEY, '1'); } catch (e) {}
    }
  };

  /* ============================================================
   * 云同步：GitHub Gist（私有 Gist 存整库快照）
   * 触发：写入后 3s 防抖 push；启动 / 回前台 / 手动 pull
   * 冲突：LWW（比较快照 updatedAt），多设备最后一次写入生效
   * ============================================================ */
  var SYNC_KEY = 'ev_sync_config_v1';
  var SYNC_FILE = 'ev-charging-data.json';
  var SYNC_DESC = '冲充电数据备份';
  var SYNC_DEBOUNCE = 3000;

  var Sync = {
    cfg: null,
    _pushTimer: null,
    _pushing: false,
    _pulling: false,
    _suppressPush: false,
    /* 内存里的最新状态文案：设置页重渲染时不回退成「等待首次同步」 */
    _statusText: '',

    defaults: function () {
      return { enabled: false, gistId: '', token: '', localRev: 0, remoteRev: 0, lastSyncAt: 0, lastError: '' };
    },

    load: function () {
      var cfg = null;
      try {
        var raw = localStorage.getItem(SYNC_KEY);
        if (raw) cfg = JSON.parse(raw);
      } catch (e) { cfg = null; }
      var d = this.defaults();
      if (cfg && typeof cfg === 'object') {
        d.enabled = !!cfg.enabled;
        d.gistId = typeof cfg.gistId === 'string' ? cfg.gistId : '';
        d.token = typeof cfg.token === 'string' ? cfg.token : '';
        d.localRev = Number(cfg.localRev) || 0;
        d.remoteRev = Number(cfg.remoteRev) || 0;
        d.lastSyncAt = Number(cfg.lastSyncAt) || 0;
        d.lastError = typeof cfg.lastError === 'string' ? cfg.lastError : '';
      }
      this.cfg = d;
      return d;
    },

    save: function () {
      try { localStorage.setItem(SYNC_KEY, JSON.stringify(this.cfg)); } catch (e) {}
    },

    init: function () { this.load(); },

    isReady: function () { return !!(this.cfg && this.cfg.enabled && this.cfg.token); },

    /* 本机数据版本号（Store.data._updatedAt） */
    dataRev: function () { return Number((Store.data && Store.data._updatedAt) || 0); },

    hasLocalCharges: function () {
      return !!(Store.data && Store.data.charges && Store.data.charges.length);
    },

    /* ---------- 调度 ---------- */
    schedulePush: function () {
      if (!this.isReady() || this._pushing || this._suppressPush) return;
      var self = this;
      if (this._pushTimer) clearTimeout(this._pushTimer);
      this._pushTimer = setTimeout(function () {
        self._pushTimer = null;
        self.push(true);
      }, SYNC_DEBOUNCE);
    },

    /* 立即上传（切后台时兜底） */
    flush: function () {
      if (!this.isReady()) return;
      if (this._pushTimer) { clearTimeout(this._pushTimer); this._pushTimer = null; }
      this.push(true);
    },

    /* ---------- 请求 ---------- */
    _request: function (method, url, body) {
      var headers = {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      };
      if (this.cfg.token) headers['Authorization'] = 'Bearer ' + this.cfg.token;
      var opts = { method: method, headers: headers };
      if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
      return fetch(url, opts);
    },

    _wrap: function (rev) {
      return JSON.stringify({
        app: 'charging-tracker',
        version: 2,
        updatedAt: rev || this.dataRev() || Date.now(),
        data: Store.data
      });
    },

    _unwrap: function (content) {
      var obj;
      try { obj = JSON.parse(content); } catch (e) { return null; }
      if (!obj || typeof obj !== 'object') return null;
      var data = obj.data;
      if (!data || !(data.vehicles instanceof Array) || !(data.charges instanceof Array)) return null;
      return { updatedAt: Number(obj.updatedAt) || 0, data: data };
    },

    /* 找到或新建备份 Gist：先按文件名搜，避免多设备各建一个 */
    _ensureGist: function () {
      var self = this;
      if (this.cfg.gistId) return Promise.resolve({ id: this.cfg.gistId, created: false });
      return this._request('GET', 'https://api.github.com/gists?per_page=100')
        .then(function (res) {
          if (!res.ok) throw { status: res.status };
          return res.json();
        })
        .then(function (list) {
          var found = null;
          (list || []).forEach(function (g) {
            if (!g || !g.files || !g.files[SYNC_FILE]) return;
            if (!found || String(g.updated_at) > String(found.updated_at)) found = g;
          });
          if (found) {
            self.cfg.gistId = found.id;
            self.save();
            return { id: found.id, created: false };
          }
          var rev = self.dataRev() || Date.now();
          var files = {};
          files[SYNC_FILE] = { content: self._wrap(rev) };
          return self._request('POST', 'https://api.github.com/gists', {
            description: SYNC_DESC,
            public: false,
            files: files
          }).then(function (res) {
            if (!res.ok) throw { status: res.status };
            return res.json();
          }).then(function (g) {
            self.cfg.gistId = g.id;
            self.cfg.localRev = rev;
            self.cfg.remoteRev = rev;
            self.cfg.lastSyncAt = Date.now();
            self.cfg.lastError = '';
            self.save();
            return { id: g.id, created: true };
          });
        });
    },

    /* ---------- 上传 ---------- */
    push: function (silent, allowRetry) {
      if (this._pushing || !this.isReady()) return;
      var self = this;
      this._pushing = true;
      this._setStatus('syncing', '正在上传…');
      this._ensureGist().then(function (info) {
        if (info.created) {
          self._pushing = false;
          self._setStatus('ok', '上次同步：' + self.fmtTime(self.cfg.lastSyncAt));
          if (!silent) App.toast('已同步到云端', 'success');
          return null;
        }
        var files = {};
        files[SYNC_FILE] = { content: self._wrap() };
        return self._request('PATCH', 'https://api.github.com/gists/' + info.id, { files: files })
          .then(function (res) {
            if (!res.ok) throw { status: res.status };
            return res.json();
          });
      }).then(function () {
        var now = Date.now();
        var rev = self.dataRev() || now;
        self.cfg.localRev = rev;
        self.cfg.remoteRev = rev;
        self.cfg.lastSyncAt = now;
        self.cfg.lastError = '';
        self.save();
        self._pushing = false;
        self._setStatus('ok', '上次同步：' + self.fmtTime(now));
        if (!silent) App.toast('已同步到云端', 'success');
      }).catch(function (err) {
        self._pushing = false;
        var kind = self.errKind(err);
        if (kind === 'notfound' && allowRetry !== false) {
          self.cfg.gistId = '';
          self.save();
          self._setStatus('warn', '云端备份丢失，正在重建…');
          self.push(silent, false);
          return;
        }
        self.fail(kind, silent);
      });
    },

    /* ---------- 下载 ---------- */
    pull: function (silent, allowRetry) {
      if (this._pulling || this._pushing || !this.isReady()) return;
      var self = this;
      this._pulling = true;
      this._setStatus('syncing', '正在连接…');
      this._ensureGist().then(function (info) {
        if (info.created) {
          self._pulling = false;
          self._setStatus('ok', '已创建云端备份（' + self.fmtTime(self.cfg.lastSyncAt) + '）');
          if (!silent) App.toast('已创建云端备份', 'success');
          return null;
        }
        return self._request('GET', 'https://api.github.com/gists/' + info.id)
          .then(function (res) {
            if (!res.ok) throw { status: res.status };
            return res.json();
          });
      }).then(function (g) {
        if (!g) return;
        self._pulling = false;
        var file = g.files && g.files[SYNC_FILE];
        var snap = file && file.content ? self._unwrap(file.content) : null;
        if (!snap) {
          self._setStatus('warn', '云端为空，正在上传本机数据');
          self.push(silent);
          return;
        }
        var remoteAt = snap.updatedAt || 0;
        var localAt = self.dataRev();
        var firstContact = !self.cfg.localRev;
        if (firstContact && remoteAt > 0 && self.hasLocalCharges()) {
          /* 本机从未对账且两边都有数据：不静默覆盖，交给用户决定 */
          App.showConfirm('云端已有备份',
            '云端备份时间 ' + self.fmtTime(remoteAt) + '，本机有 ' + Store.data.charges.length + ' 条记录。首次同步会用云端数据覆盖本机，是否继续？',
            function () { self.acceptRemote(snap, silent); });
          return;
        }
        if (firstContact || remoteAt > localAt) { self.acceptRemote(snap, silent); return; }
        if (remoteAt < localAt) {
          self._setStatus('warn', '本机较新，正在上传');
          self.push(silent);
          return;
        }
        self.cfg.remoteRev = remoteAt;
        self.cfg.lastSyncAt = Date.now();
        self.cfg.lastError = '';
        self.save();
        self._setStatus('ok', '已是最新（' + self.fmtTime(self.cfg.lastSyncAt) + '）');
      }).catch(function (err) {
        self._pulling = false;
        var kind = self.errKind(err);
        if (kind === 'notfound' && allowRetry !== false) {
          self.cfg.gistId = '';
          self.save();
          self.pull(silent, false);
          return;
        }
        if (kind === 'notfound') {
          self._setStatus('warn', '云端备份不存在，将在下次写入时重建');
          return;
        }
        self.fail(kind, silent);
      });
    },

    /* 用远端快照替换本机数据 */
    acceptRemote: function (snap, silent) {
      var rev = Number(snap.updatedAt) || Date.now();
      this._suppressPush = true;
      try {
        Store.data = snap.data;
        if (!Store.data.settings) Store.data.settings = { currentVehicleId: null };
        Store.repair();
        Store.save(rev);
      } finally {
        this._suppressPush = false;
      }
      this.cfg.localRev = rev;
      this.cfg.remoteRev = rev;
      this.cfg.lastSyncAt = Date.now();
      this.cfg.lastError = '';
      this.save();
      this._setStatus('ok', '上次同步：' + this.fmtTime(this.cfg.lastSyncAt));
      if (!silent) App.toast('已从云端更新', 'success');
      App.renderAll();
    },

    /* ---------- 开关 ---------- */
    enable: function () {
      if (!this.cfg.token) { App.toast('请先填写 GitHub 令牌', 'error'); return; }
      this.cfg.enabled = true;
      this.cfg.lastError = '';
      this.save();
      this.pull(false);
    },

    disable: function () {
      this.cfg.enabled = false;
      this.cfg.lastError = '';
      this.save();
      this._setStatus('off', '未开启');
    },

    /* ---------- 辅助 ---------- */
    fail: function (kind, silent) {
      if (kind === 'offline') {
        this._setStatus('warn', '离线，已暂存，联网后自动上传');
        return;
      }
      if (kind === 'auth') {
        this.cfg.enabled = false;
        this.cfg.lastError = 'auth';
        this.save();
        this._setStatus('error', '令牌无效，已暂停同步');
        App.toast('同步失败：令牌无效，已暂停', 'error');
        return;
      }
      this.cfg.lastError = kind;
      this.save();
      this._setStatus('error', '同步失败：' + kind);
      if (!silent) App.toast('同步失败：' + kind, 'error');
    },

    errKind: function (err) {
      if (!err) return 'unknown';
      if (err.status === 401 || err.status === 403) return 'auth';
      if (err.status === 404) return 'notfound';
      if (err.status === 422) return 'invalid';
      if (err.status) return 'http-' + err.status;
      /* fetch 网络错误没有 status */
      return 'offline';
    },

    fmtTime: function (ts) {
      if (!ts) return '—';
      var d = new Date(ts);
      function p(n) { return n < 10 ? '0' + n : '' + n; }
      return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + p(d.getHours()) + ':' + p(d.getMinutes());
    },

    _setStatus: function (kind, text) {
      this._statusText = text;
      var el = document.getElementById('syncStatusLine');
      if (el) {
        el.textContent = text;
        el.style.color = kind === 'error' ? 'var(--c-danger)'
          : (kind === 'warn' ? 'var(--c-warn)' : 'var(--c-text-3)');
      }
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
    fmt: function (n, d) { return (n === null || n === undefined || isNaN(n)) ? '--' : Number(n).toFixed(d === undefined || d === null ? 1 : d); },
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
      /* 旧 id 失效时也要把新车设为当前，不能只在字段为空时回填 */
      if (!this.current()) Store.data.settings.currentVehicleId = vehicle.id;
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
   * 基础数据（首次启动自动写入 / 设置内手动载入）
   * ============================================================ */
  var Seed = {
    base: function () { return window.CHARGING_BASE_DATA || null; },

    hasData: function () {
      var b = this.base();
      return !!(b && b.vehicle && b.charges && b.charges.length);
    },

    makeCharge: function (r, vid, i) {
      return {
        id: Utils.uid(), vehicleId: vid,
        date: r[0], chargeType: r[1] === 'slow' ? 'slow' : 'fast',
        kWh: Number(r[2]) || 0, unitPrice: Number(r[3]) || 0, totalCost: Number(r[4]) || 0,
        odometer: Number(r[5]) || 0, socBefore: 0, socAfter: 0, note: '',
        createdAt: 1780000000000 + i
      };
    },

    build: function () {
      var b = this.base();
      var v = {
        id: 'veh-base',
        name: b.vehicle.name || '我的车',
        brand: b.vehicle.brand || '',
        model: b.vehicle.model || '',
        batteryCapacity: Number(b.vehicle.batteryCapacity) || 0,
        supportsFastCharge: b.vehicle.supportsFastCharge !== false,
        maxChargePower: Number(b.vehicle.maxChargePower) || 0,
        note: b.vehicle.note || '',
        createdAt: Date.now()
      };
      var charges = b.charges.map(function (r, i) { return Seed.makeCharge(r, v.id, i); });
      return { vehicles: [v], charges: charges, settings: { currentVehicleId: v.id } };
    },

    /* 去重签名：车辆 + 日期 + 度数 + 金额（度数 3 位、金额 2 位归一） */
    sig: function (c) {
      return c.vehicleId + '|' + c.date + '|' +
        (Number(c.kWh) || 0).toFixed(3) + '|' + (Number(c.totalCost) || 0).toFixed(2);
    },

    apply: function () {
      if (!this.hasData()) return 0;
      var b = this.base();
      var name = b.vehicle.name || '我的车';
      var hit = Store.data.vehicles.filter(function (v) { return v.name === name; })[0];
      var vid;
      if (hit) vid = hit.id;
      else {
        var v = VehicleMgr.add({
          name: name,
          brand: b.vehicle.brand || '',
          model: b.vehicle.model || '',
          batteryCapacity: b.vehicle.batteryCapacity,
          supportsFastCharge: b.vehicle.supportsFastCharge !== false,
          maxChargePower: b.vehicle.maxChargePower,
          note: b.vehicle.note || ''
        });
        vid = v.id;
      }

      var seen = {};
      Store.data.charges.forEach(function (c) { if (c.vehicleId === vid) seen[Seed.sig(c)] = 1; });

      var n = 0;
      b.charges.forEach(function (r, i) {
        var c = Seed.makeCharge(r, vid, i);
        var s = Seed.sig(c);
        if (seen[s]) return;
        seen[s] = 1;
        Store.data.charges.push(c);
        n++;
      });
      if (n) {
        /* 显式载入后切到该车，保证用户立刻看到新记录 */
        Store.data.settings.currentVehicleId = vid;
        Store.save();
      }
      try { localStorage.setItem(SEED_KEY, '1'); } catch (e) {}
      return n;
    }
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
          results.push({ id: cur.id, date: cur.date, monthKey: Utils.monthKey(cur.date), value: (cur.kWh / dist) * 100, distance: dist, kWh: Number(cur.kWh) || 0, cost: Number(cur.totalCost) || 0 });
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
        /* 无样本的月份返回 null（而非 0），避免趋势图把空月画成「掉到 0」的假骤降 */
        var avg = arr.length ? arr.reduce(function (s, v) { return s + v; }, 0) / arr.length : null;
        return { label: Utils.monthShort(k), value: avg, count: arr.length, monthKey: k, totalKWh: kWhMap[k] || 0, totalDist: distMap[k] || 0 };
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
   * 对比油车：全局参照参数（车型 / 油耗 / 油价）
   * 未配置（油耗或油价为 0）时，界面只给入口不出现数字
   * ============================================================ */
  var FuelCar = {
    get: function () {
      var s = (Store.data && Store.data.settings) || {};
      var f = s.fuelCar;
      if (!f || typeof f !== 'object') return { model: '', consumption: 0, price: 0 };
      return {
        model: String(f.model || ''),
        consumption: Number(f.consumption) || 0,
        price: Number(f.price) || 0
      };
    },
    set: function (patch) {
      if (!Store.data.settings) Store.data.settings = { currentVehicleId: null };
      var cur = this.get();
      Store.data.settings.fuelCar = {
        model: (patch && patch.model !== undefined) ? String(patch.model).slice(0, 40) : cur.model,
        consumption: (patch && patch.consumption !== undefined) ? (Number(patch.consumption) || 0) : cur.consumption,
        price: (patch && patch.price !== undefined) ? (Number(patch.price) || 0) : cur.price
      };
      Store.save();
    },
    isConfigured: function () {
      var f = this.get();
      return f.consumption > 0 && f.price > 0;
    }
  };

  /* ============================================================
   * 油车对比计算：沿用 Stats.kWhPer100km 的区间口径
   *   距离 = 本条里程 − 上条里程；油费 = 距离/100 × 油耗 × 油价
   *   电费 = 本条充电金额；节省 = 油费 − 电费
   * ============================================================ */
  var FuelCompare = {
    /** 有效对比区间（含电费/油费/节省），按日期升序 */
    intervals: function (vid) {
      var fc = FuelCar.get();
      var configured = fc.consumption > 0 && fc.price > 0;
      return Stats.kWhPer100km(Stats.sortedCharges(vid)).map(function (e) {
        var fuelCost = configured ? e.distance / 100 * fc.consumption * fc.price : 0;
        return {
          id: e.id, date: e.date, monthKey: e.monthKey, distance: e.distance, kWh: e.kWh,
          electricCost: e.cost, fuelCost: fuelCost, saving: fuelCost - (e.cost || 0)
        };
      });
    },
    summarize: function (rows) {
      var distance = 0, electric = 0, fuel = 0;
      rows.forEach(function (r) { distance += r.distance; electric += r.electricCost; fuel += r.fuelCost; });
      return { count: rows.length, distance: distance, electricCost: electric, fuelCost: fuel, saving: fuel - electric };
    },
    /** scope: 'all' | 'year' | 'month'（年/月按自然年、自然月） */
    scope: function (vid, scopeName) {
      var rows = this.intervals(vid);
      var now = new Date();
      var yKey = String(now.getFullYear());
      var mKey = yKey + '-' + String(now.getMonth() + 1).padStart(2, '0');
      if (scopeName === 'year') rows = rows.filter(function (r) { return (r.date || '').slice(0, 4) === yKey; });
      else if (scopeName === 'month') rows = rows.filter(function (r) { return r.monthKey === mKey; });
      return this.summarize(rows);
    },
    monthSummary: function (vid, monthKey) {
      return this.summarize(this.intervals(vid).filter(function (r) { return r.monthKey === monthKey; }));
    },
    /** 每百公里成本，便于跨里程比较 */
    perKm: function (sum) {
      if (!sum.distance) return { electric: 0, fuel: 0 };
      return { electric: sum.electricCost / sum.distance * 100, fuel: sum.fuelCost / sum.distance * 100 };
    }
  };

  /* ============================================================
   * 界面层
   * ============================================================ */
  var App = {
    currentTab: 'stats',
    statsYear: null,
    statsTrend: 'cost',
    recordsFilter: 'all',
    recordsYearFilter: '',
    recordsMonthFilter: '',
    filterDraft: null,
    editingChargeId: null,
    editingVehicleId: null,
    settingsReturn: 'stats',
    _stack: [],
    _ignorePop: 0,
    _reuseEntry: false,
    _sheetOpen: false,
    _confirmCallback: null,
    _scroll: { records: 0, stats: 0 },
    _heroAnim: false,
    _pendingStagger: false,

    /* ---------- 启动 ---------- */
    init: function () {
      Sync.init();
      Store.load();
      Theme.init();
      this.bindEvents();
      this._heroAnim = true;
      this.renderAll();
      this.syncTabs();
      var self = this;
      window.addEventListener('popstate', function () {
        if (self._ignorePop > 0) { self._ignorePop--; return; }
        if (self._stack.length) {
          var fn = self._stack.pop();
          fn();
        }
      });
      /* 云同步：启动后拉一次；回前台再拉；切后台立即上传 */
      if (Sync.isReady()) {
        setTimeout(function () { Sync.pull(true); }, 1200);
      }
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) Sync.flush();
        else if (Sync.isReady()) Sync.pull(true);
      });
    },

    bindEvents: function () {
      var self = this;

      document.querySelectorAll('.tabbar .tab-item').forEach(function (btn) {
        btn.addEventListener('click', function () { self.switchTab(btn.dataset.tab); });
      });

      var syncInd = function () { self.syncTabs(); };
      window.addEventListener('resize', syncInd);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncInd);

      var ticking = false;
      window.addEventListener('scroll', function () {
        if (ticking || self.currentTab !== 'stats') return;
        ticking = true;
        requestAnimationFrame(function () {
          ticking = false;
          var hero = document.querySelector('#panel-stats .hero');
          if (hero) hero.style.setProperty('--py', Math.min(10, window.scrollY * .12).toFixed(1) + 'px');
        });
      }, { passive: true });

      var chargeForm = document.getElementById('chargeFormPage-form');
      if (chargeForm) chargeForm.addEventListener('submit', function (e) { e.preventDefault(); self.saveCharge(); });

      var vehicleForm = document.getElementById('vehicleForm');
      if (vehicleForm) vehicleForm.addEventListener('submit', function (e) { e.preventDefault(); self.saveVehicle(); });

      document.querySelectorAll('#cf_chargeTypeSegment button').forEach(function (b) {
        b.addEventListener('click', function () { self.setChargeType(b.dataset.val); });
      });

      var ok = document.getElementById('confirmOkBtn');
      if (ok) ok.addEventListener('click', function () { self.confirmOk(); });

      var kWh = document.getElementById('cf_kWh');
      var cost = document.getElementById('cf_totalCost');
      if (kWh) kWh.addEventListener('input', function () { self.clearFieldError('cf_kWh'); self.onKwhInput(); });
      if (cost) cost.addEventListener('input', function () { self.clearFieldError('cf_totalCost'); self.onCostInput(); });
      var date = document.getElementById('cf_date');
      if (date) date.addEventListener('input', function () { self.clearFieldError('cf_date'); });

      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        if (document.getElementById('confirmModal').classList.contains('show')) { self.closeConfirm(); return; }
        if (self._sheetOpen) { self.closeSheet(); return; }
        if (document.getElementById('chargeFormPage').classList.contains('show')) { self.closeChargePage(); return; }
        if (document.getElementById('vehicleFormPage').classList.contains('show')) { self.closeVehiclePage(); return; }
        if (document.getElementById('settingsPage').classList.contains('show')) { self.closeSettings(); }
      });
    },

    currentVid: function () {
      var v = VehicleMgr.current();
      return v ? v.id : null;
    },

    syncTabs: function () {
      var tab = App.currentTab;
      var active = null;
      document.querySelectorAll('.tabbar .tab-item').forEach(function (b) {
        var on = b.dataset.tab === tab;
        b.classList.toggle('active', on);
        if (on) { b.setAttribute('aria-current', 'page'); active = b; }
        else b.removeAttribute('aria-current');
      });
      var bar = document.querySelector('.tabbar');
      var ind = bar ? bar.querySelector('.tab-indicator') : null;
      if (ind && active) {
        var w = 54;
        var x = active.offsetLeft + (active.offsetWidth - w) / 2;
        ind.style.width = w + 'px';
        ind.style.transform = 'translateX(' + x.toFixed(1) + 'px)';
      }
    },

    switchTab: function (tab) {
      if (tab !== 'records' && tab !== 'stats') return;
      if (tab === this.currentTab) return;
      this._scroll[this.currentTab] = window.scrollY || 0;
      this.currentTab = tab;
      this._scroll[tab] = this._scroll[tab] || 0;
      this._heroAnim = tab === 'stats';
      this._pendingStagger = tab === 'records';
      this.syncTabs();
      document.querySelectorAll('.tab-panel').forEach(function (p) {
        p.classList.toggle('active', p.id === 'panel-' + tab);
      });
      this.renderTab(tab);
      var y = this._scroll[tab] || 0;
      requestAnimationFrame(function () { window.scrollTo(0, y); });
    },

    renderTab: function (tab) {
      if (tab === 'records') this.renderRecords();
      else if (tab === 'stats') this.renderAnalysis();
    },

    renderAll: function () {
      this.renderTab(this.currentTab);
      var sp = document.getElementById('settingsPage');
      if (sp && sp.classList.contains('show')) this.renderSettings();
    },

    /* ---------- 覆盖层历史栈 ---------- */
    _prefersReducedMotion: function () {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    },

    _showPage: function (page) {
      if (!page) return;
      if (page._closeTimer) { clearTimeout(page._closeTimer); page._closeTimer = null; }
      page.classList.remove('is-closing');
      page.classList.add('show');
      page.scrollTop = 0;
    },

    _countUp: function (el) {
      if (!el || this._prefersReducedMotion()) return;
      var to = Number(el.getAttribute('data-to')) || 0;
      if (!to) { el.textContent = Utils.fmtMoney(0); return; }
      var start = 0, dur = 320;
      var tick = function (now) {
        if (!start) start = now;
        var p = Math.min(1, (now - start) / dur);
        var e = 1 - Math.pow(1 - p, 3);
        el.textContent = Utils.fmtMoney(to * e);
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = Utils.fmtMoney(to);
      };
      requestAnimationFrame(tick);
    },

    _hidePage: function (page, instant) {
      if (!page) return;
      var finish = function () {
        page.classList.remove('show');
        page.classList.remove('is-closing');
        page.scrollTop = 0;
      };
      if (instant || this._prefersReducedMotion()) { finish(); return; }
      page.classList.add('is-closing');
      if (page._closeTimer) clearTimeout(page._closeTimer);
      page._closeTimer = setTimeout(function () {
        page._closeTimer = null;
        finish();
      }, 220);
    },

    _openOverlay: function (closeFn) {
      this._stack.push(closeFn);
      /* 上一层是 silent 关闭时，复用它留下的历史条目，避免多出一条空记录 */
      if (this._reuseEntry) { this._reuseEntry = false; return; }
      try { history.pushState({ ccOverlay: this._stack.length }, ''); } catch (e) {}
    },

    _closeOverlay: function (silent) {
      if (!this._stack.length) return;
      var fn = this._stack.pop();
      fn(!!silent);
      if (silent) {
        /* 若紧接着打开了新层（弹层 → 表单页），新层会复用这条历史；否则下一拍回退掉 */
        this._reuseEntry = true;
        var self = this;
        setTimeout(function () {
          if (!self._reuseEntry) return;
          self._reuseEntry = false;
          self._ignorePop++;
          try { history.back(); } catch (e) { self._ignorePop = Math.max(0, self._ignorePop - 1); }
        }, 0);
        return;
      }
      this._ignorePop++;
      try { history.back(); } catch (e) { this._ignorePop = Math.max(0, this._ignorePop - 1); }
      setTimeout(function () { if (App._ignorePop > 0) App._ignorePop--; }, 600);
    },

    /* ============================================================
     * 记录页
     * ============================================================ */
    recordsNav: function (vehicle) {
      var n = this.filterCount();
      return '<div class="nav">'
        + '<span class="nav-fill"></span>'
        + '<button class="nav-title-btn" onclick="App.openVehicleSheet()" aria-label="切换车辆">'
        + '<span>' + esc(vehicle ? vehicle.name : '冲充电') + '</span>' + Icons.chevronDown + '</button>'
        + '<button class="nav-btn" onclick="App.openFilterSheet()" aria-label="筛选' + (n ? '，已选 ' + n + ' 项' : '') + '">'
        + Icons.filter + (n ? '<span class="dot"></span>' : '') + '</button>'
        + '<button class="nav-btn" onclick="App.openSettings()" aria-label="设置">' + Icons.gear + '</button>'
        + '</div>';
    },

    summaryHTML: function (vid) {
      var ov = Stats.overview(vid);
      var avg = ov.thisMonthKWh > 0 ? ov.thisMonthCost / ov.thisMonthKWh : 0;
      var meta = ov.thisMonthCount > 0
        ? (ov.thisMonthCount + ' 次 · ¥' + Utils.fmtMoney(avg) + '/度')
        : '本月还没有记录';
      return '<button class="summary" onclick="App.switchTab(\'stats\')" aria-label="查看统计">'
        + '<span class="summary-main">'
        + '<span class="summary-k">本月 · ' + Utils.monthShort(Utils.monthKey(Utils.today())) + '</span>'
        + '<span class="summary-v">¥' + Utils.fmtMoney(ov.thisMonthCost)
        + '<span class="summary-meta-inline">' + meta + '</span></span>'
        + '</span>' + Icons.chevronRight + '</button>';
    },

    renderRecords: function () {
      var panel = document.getElementById('panel-records');
      var stagger = this._pendingStagger;
      this._pendingStagger = false;
      var vehicle = VehicleMgr.current();
      var vid = vehicle ? vehicle.id : null;
      var html = this.recordsNav(vehicle);

      if (!vid) {
        panel.innerHTML = html + '<div class="body"><div class="empty">' + Illustrations.car
          + '<h3>还没有车辆</h3><p>先添加一辆车，再开始记录充电</p>'
          + '<button class="btn btn-primary" onclick="App.openSettings()">去添加车辆</button></div></div>';
        return;
      }

      var charges = ChargeMgr.list(vid);
      var filter = this.recordsFilter || 'all';
      var yrF = this.recordsYearFilter || '';
      var moF = this.recordsMonthFilter || '';
      var fCount = this.filterCount();

      if (filter !== 'all') charges = charges.filter(function (c) { return c.chargeType === filter; });
      if (yrF) charges = charges.filter(function (c) { return (c.date || '').slice(0, 4) === yrF; });
      if (moF) charges = charges.filter(function (c) { return (c.date || '').slice(0, 7) === moF; });

      html += '<div class="body">';
      html += this.summaryHTML(vid);

      if (!charges.length) {
        html += '<div class="empty">' + (fCount ? Illustrations.filter : Illustrations.records)
          + '<h3>' + (fCount ? '没有符合条件的记录' : '还没有充电记录') + '</h3>'
          + '<p>' + (fCount ? '试试调整筛选条件' : '记录第一笔后，这里会按月份分组') + '</p>'
          + (fCount
            ? '<button class="btn btn-secondary" onclick="App.clearFilters()">清除筛选</button>'
            : '<button class="btn btn-primary" onclick="App.openChargePage()">记一笔</button>')
          + '</div>';
      } else {
        var byYear = {};
        charges.forEach(function (c) {
          var y = (c.date || '').slice(0, 4) || '未知';
          (byYear[y] = byYear[y] || []).push(c);
        });
        var years = Object.keys(byYear).sort().reverse();
        var self = this;
        var rowIndex = 0;
        years.forEach(function (y) {
          var list = byYear[y];
          var yCost = 0;
          list.forEach(function (c) { yCost += Number(c.totalCost) || 0; });
          html += '<div class="year-head"><b>' + y + ' 年</b><span>¥' + Utils.fmtMoney(yCost) + ' · ' + list.length + ' 条</span></div>';
          html += '<div class="group">';
          var byMonth = {};
          list.forEach(function (c) {
            var m = (c.date || '').slice(0, 7);
            (byMonth[m] = byMonth[m] || []).push(c);
          });
          Object.keys(byMonth).sort().reverse().forEach(function (mk) {
            var ml = byMonth[mk];
            var cost = 0;
            ml.forEach(function (c) { cost += Number(c.totalCost) || 0; });
            html += '<div class="group-head"><b>' + Utils.monthShort(mk) + '</b>'
              + '<span>¥' + Utils.fmtMoney(cost) + ' · ' + ml.length + ' 次</span></div>';
            ml.forEach(function (c) { html += self.recordRow(c, rowIndex++); });
          });
          html += '</div>';
        });
      }

      html += '</div>';
      panel.innerHTML = html;
      if (stagger) {
        panel.classList.add('stagger');
        setTimeout(function () { panel.classList.remove('stagger'); }, 900);
      }
    },

    recordRow: function (c, idx) {
      var d = (c.date || '').split('-');
      var dateText = d.length === 3 ? (parseInt(d[1], 10) + '月' + parseInt(d[2], 10) + '日') : (c.date || '');
      var sub = dateText;
      if (Number(c.socBefore) > 0 && Number(c.socAfter) > 0) sub += ' · ' + c.socBefore + '→' + c.socAfter + '%';
      if (c.note) sub += ' · ' + c.note;
      var isFast = c.chargeType === 'fast';
      return '<button class="record-row" style="--i:' + Math.min(idx || 0, 14) + '" onclick="App.showChargeDetail(\'' + c.id + '\')">'
        + '<span class="rec-icon">' + (isFast ? Icons.bolt : Icons.plug) + '</span>'
        + '<span class="rec-main">'
        + '<span class="rec-top"><span class="rec-kwh">' + Utils.fmt(c.kWh, 1) + '</span>'
        + '<span class="rec-unit">度</span><span class="tag">' + (isFast ? '快充' : '慢充') + '</span></span>'
        + '<span class="rec-sub">' + esc(sub) + '</span></span>'
        + '<span class="rec-amount">¥' + Utils.fmtMoney(c.totalCost) + '</span></button>';
    },

    filterCount: function () {
      var n = 0;
      if (this.recordsFilter && this.recordsFilter !== 'all') n++;
      if (this.recordsYearFilter) n++;
      if (this.recordsMonthFilter) n++;
      return n;
    },

    clearFilters: function () {
      this.recordsFilter = 'all';
      this.recordsYearFilter = '';
      this.recordsMonthFilter = '';
      this.renderRecords();
    },

    /* ---------- 筛选弹层 ---------- */
    chipHTML: function (label, on, key, val) {
      return '<button class="chip" aria-pressed="' + (on ? 'true' : 'false') + '" '
        + 'onclick="App.setFilterDraft(\'' + key + '\',\'' + val + '\')">' + label + '</button>';
    },

    filterSheetData: function () {
      var d = this.filterDraft || { type: 'all', year: '', month: '' };
      var vid = this.currentVid();
      var years = Utils.availableYears(vid);
      var n = (d.type !== 'all' ? 1 : 0) + (d.year ? 1 : 0) + (d.month ? 1 : 0);
      var body = '';

      body += '<div class="chip-group"><div class="chip-label">充电类型</div><div class="chips">'
        + this.chipHTML('全部', d.type === 'all', 'type', 'all')
        + this.chipHTML('快充', d.type === 'fast', 'type', 'fast')
        + this.chipHTML('慢充', d.type === 'slow', 'type', 'slow')
        + '</div></div>';

      body += '<div class="chip-group"><div class="chip-label">年份</div><div class="chips">'
        + this.chipHTML('全部', !d.year, 'year', '')
        + years.map(function (y) { return App.chipHTML(y + ' 年', d.year === y, 'year', y); }).join('')
        + '</div></div>';

      if (d.year) {
        var ms = Utils.yearMonths(d.year);
        body += '<div class="chip-group"><div class="chip-label">月份</div><div class="chips">'
          + this.chipHTML('全部', !d.month, 'month', '')
          + ms.map(function (m) { return App.chipHTML(Utils.monthShort(m), d.month === m, 'month', m); }).join('')
          + '</div></div>';
      }

      body += '<div class="sheet-actions-row">'
        + '<button class="btn btn-secondary" onclick="App.resetFilterDraft()">重置</button>'
        + '<button class="btn btn-primary" onclick="App.applyFilterDraft()">应用</button></div>';

      return { title: '筛选', sub: n ? '已选 ' + n + ' 项' : '未设置条件', body: body };
    },

    openFilterSheet: function () {
      this.filterDraft = {
        type: this.recordsFilter || 'all',
        year: this.recordsYearFilter || '',
        month: this.recordsMonthFilter || ''
      };
      this.openSheet(this.filterSheetData());
    },

    setFilterDraft: function (key, val) {
      var d = this.filterDraft;
      if (!d) return;
      d[key] = val;
      if (key === 'year' && val && d.month && d.month.slice(0, 4) !== val) d.month = '';
      this.updateSheet(this.filterSheetData());
    },

    resetFilterDraft: function () {
      this.filterDraft = { type: 'all', year: '', month: '' };
      this.updateSheet(this.filterSheetData());
    },

    applyFilterDraft: function () {
      var d = this.filterDraft || { type: 'all', year: '', month: '' };
      this.recordsFilter = d.type;
      this.recordsYearFilter = d.year;
      this.recordsMonthFilter = d.month;
      this.closeSheet();
      this.renderRecords();
    },

    /* ============================================================
     * 统计页
     * ============================================================ */
    statsNav: function () {
      var vehicle = VehicleMgr.current();
      return '<div class="nav"><span class="nav-fill"></span>'
        + '<button class="nav-title-btn" onclick="App.openVehicleSheet()" aria-label="切换车辆">'
        + '<span>' + esc(vehicle ? vehicle.name : '冲充电') + '</span>' + Icons.chevronDown + '</button>'
        + '<button class="nav-btn" onclick="App.openSettings()" aria-label="设置">' + Icons.gear + '</button></div>';
    },

    analysisScopeByYear: function (yearFilter) {
      var vid = this.currentVid();
      var charges = vid ? ChargeMgr.list(vid) : [];
      var sc = charges.filter(function (c) {
        if (!c.date) return false;
        if (!yearFilter) return true;
        return c.date.slice(0, 4) === String(yearFilter);
      });
      var cost = 0, kWh = 0;
      sc.forEach(function (c) { cost += Number(c.totalCost) || 0; kWh += Number(c.kWh) || 0; });
      var fast = sc.filter(function (c) { return c.chargeType === 'fast'; }).length;
      return { cost: cost, kWh: kWh, count: sc.length, fastCount: fast, slowCount: sc.length - fast, avgPrice: kWh > 0 ? cost / kWh : 0 };
    },

    renderAnalysis: function () {
      var panel = document.getElementById('panel-stats');
      var vehicle = VehicleMgr.current();
      var vid = vehicle ? vehicle.id : null;

      if (!vid) {
        panel.innerHTML = this.statsNav() + '<div class="body"><div class="empty">' + Illustrations.stats
          + '<h3>还没有车辆</h3><p>添加车辆后才能查看统计</p>'
          + '<button class="btn btn-primary" onclick="App.openSettings()">去添加车辆</button></div></div>';
        return;
      }

      var yearFilter = this.statsYear;
      var scope = this.analysisScopeByYear(yearFilter);
      var months = yearFilter ? Utils.yearMonths(parseInt(yearFilter, 10)) : Utils.chartRange(vid, 12);
      var metric = this.statsTrend || 'cost';
      var heroLabel = yearFilter ? (yearFilter + ' 年') : '累计';
      var html = this.statsNav() + '<div class="body">';

      html += '<div class="toolbar">'
        + '<button class="menu-btn" onclick="App.openYearSheet()">' + (yearFilter ? yearFilter + ' 年' : '全部年份') + Icons.chevronDown + '</button>'
        + '<span class="toolbar-meta">' + scope.count + ' 条记录</span></div>';

      html += '<div class="hero">'
        + '<div class="hero-label"><span>' + heroLabel + '充电总费用</span>' + this.periodDeltaHTML(yearFilter, scope) + '</div>'
        + '<div class="hero-value">¥<span class="hero-num" data-to="' + scope.cost + '">' + Utils.fmtMoney(scope.cost) + '</span></div>'
        + '<div class="hero-meta">' + (scope.count > 0
          ? (scope.count + ' 次 · 均价 ¥' + Utils.fmtMoney(scope.avgPrice) + '/度 · 充入 ' + Utils.fmt(scope.kWh, 1) + ' 度')
          : '还没有充电记录') + '</div>'
        + '</div>';

      /* 趋势 */
      var md = this.statsMetricData(metric, vid, months);
      var seg = [['cost', '费用'], ['kwh', '度数'], ['price', '电价'], ['eff', '电耗']].map(function (o) {
        return '<button aria-pressed="' + (metric === o[0] ? 'true' : 'false') + '" onclick="App.setStatsTrend(\'' + o[0] + '\')">' + o[1] + '</button>';
      }).join('');
      html += '<div class="card">'
        + '<div class="card-head"><span class="card-title">' + md.name + '</span></div>'
        + '<div class="segmented tabular">' + seg + '</div>'
        + this.buildChart(md.monthly, md.fmt)
        + '</div>';

      /* 快慢充 */
      var total = scope.fastCount + scope.slowCount;
      var fPct = total > 0 ? Math.round(scope.fastCount / total * 100) : 0;
      if (!total) {
        html += '<div class="card"><div class="card-head"><span class="card-title">快慢充比例</span></div>'
          + '<div class="note-line" style="margin:0">还没有记录，记账后显示快慢充比例。</div></div>';
      } else {
        html += '<div class="card">'
          + '<div class="card-head"><span class="card-title">快慢充比例</span>'
          + '<button class="card-link" onclick="App.openDonutSheet()">明细' + Icons.chevronRight + '</button></div>'
          + '<div class="donut-wrap">' + this.buildDonut(scope.fastCount, scope.slowCount)
          + '<div class="legend">'
          + '<div><i class="a"></i>快充<b>' + fPct + '%</b></div>'
          + '<div><i class="b"></i>慢充<b>' + (100 - fPct) + '%</b></div>'
          + '</div></div>';

        var fa = 0, sa = 0, fc = 0, sc = 0;
        ChargeMgr.list(vid).forEach(function (c) {
          if (yearFilter && !(c.date && c.date.slice(0, 4) === String(yearFilter))) return;
          if (c.chargeType === 'fast') { fa += Number(c.totalCost) || 0; fc += Number(c.kWh) || 0; }
          else { sa += Number(c.totalCost) || 0; sc += Number(c.kWh) || 0; }
        });
        var fAvg = fc > 0 ? fa / fc : 0, sAvg = sc > 0 ? sa / sc : 0;
        if (fAvg > 0 && sAvg > 0) {
          var pd = fAvg - sAvg;
          if (pd >= 0.05) {
            html += '<div class="price-hint">' + Icons.bolt + '<span>快充均价 <b>¥' + Utils.fmtMoney(fAvg) + '</b>/度 · 慢充 <b>¥' + Utils.fmtMoney(sAvg) + '</b>/度，改慢充可省钱</span></div>';
          } else if (pd > -0.01) {
            html += '<div class="price-hint ok">' + Icons.check + '<span>快慢充价差不大（¥' + Utils.fmtMoney(pd) + '/度），成本已较优</span></div>';
          }
        }
        html += '</div>';
      }

      /* 电耗 */
      var eff = Stats.avgEfficiency(vid, yearFilter);
      var pkm = Stats.pricePerKm(vid, yearFilter);
      html += '<div class="card">'
        + '<div class="card-head"><span class="card-title">电耗</span></div>'
        + '<div class="metrics">'
        + '<div class="metric"><b>' + (eff.enough ? Utils.fmt(eff.avg, 1) + '<em class="long">度/100km</em>' : '—') + '</b><span>百公里电耗</span></div>'
        + '<div class="metric"><b>' + (pkm.hasData ? '¥' + Utils.fmt(pkm.value, 2) : '—') + '</b><span>每公里成本</span></div>'
        + '<div class="metric"><b>' + eff.count + '<em>组</em></b><span>有效样本</span></div>'
        + '</div>'
        + '<div class="note-line">' + this.effNote(eff) + '</div>'
        + '</div>';

      /* 油车对比 */
      html += this.fuelCardHTML(vid);

      /* 电池 */
      var cap = BatteryHealth.capacityHealth(vid);
      var habit = BatteryHealth.habitScore(vid);
      var hasHabit = habit.factors && habit.factors.length > 0;
      html += '<div class="card">'
        + '<div class="card-head"><span class="card-title">电池</span>'
        + '<button class="card-link" onclick="App.openBatterySheet()">明细' + Icons.chevronRight + '</button></div>'
        + '<div class="metrics">'
        + '<div class="metric"><b>' + (cap.index === null ? '—' : cap.index + '<em>%</em>') + '</b><span>容量保持率</span></div>'
        + '<div class="metric"><b>' + (hasHabit ? habit.score : '—') + '</b><span>充电习惯</span></div>'
        + '<div class="metric"><b>' + (habit.socBeforeCount ? Math.round(habit.deepRatio * 100) + '<em>%</em>' : '—') + '</b><span>深放频率</span></div>'
        + '</div>'
        + '<div class="note-line">' + this.capNote(cap) + '</div>'
        + '</div>';

      /* 建议 */
      var rec = Recommender.generate(vid);
      var tips = rec.tips || [];
      html += '<div class="card">'
        + '<div class="card-head"><span class="card-title">建议</span>'
        + (tips.length > 3 ? '<button class="card-link" onclick="App.openAdviceSheet()">全部 ' + tips.length + ' 条' + Icons.chevronRight + '</button>' : '')
        + '</div>'
        + '<div class="advice-list">' + tips.slice(0, 3).map(adviceHTML).join('') + '</div>'
        + '</div>';

      html += '<div style="height:24px"></div></div>';
      panel.innerHTML = html;
      if (this._heroAnim) {
        this._heroAnim = false;
        this._countUp(panel.querySelector('.hero-num'));
      }
    },

    setStatsTrend: function (mode) {
      this.statsTrend = mode;
      this.renderAnalysis();
    },

    setStatsYear: function (year) {
      this.statsYear = year ? String(year) : null;
      this.closeSheet();
      this.renderAnalysis();
    },

    /* 只有「年份 vs 上年」才做同比；累计口径没有可比基期，不显示涨跌 */
    periodDeltaHTML: function (yearFilter, scope) {
      if (!yearFilter) return '';
      var vid = this.currentVid();
      var charges = vid ? ChargeMgr.list(vid) : [];
      var py = String(parseInt(yearFilter, 10) - 1);
      var refC = 0;
      charges.forEach(function (c) {
        if (c.date && c.date.slice(0, 4) === py) refC += Number(c.totalCost) || 0;
      });
      if (!(refC > 0)) return '';
      var label = '较 ' + py + ' 年';
      var pc = Math.round((scope.cost - refC) / refC * 1000) / 10;
      if (Math.abs(pc) < 0.1) return '<span class="delta flat">— ' + label + '</span>';
      var up = pc >= 0;
      return '<span class="delta ' + (up ? 'up' : 'down') + '">' + (up ? '▲' : '▼') + ' ' + Math.abs(pc) + '% ' + label + '</span>';
    },

    statsMetricData: function (mode, vid, months) {
      var mc = Stats.monthlyCost(vid, months);
      var out = [], i;
      if (mode === 'kwh') {
        for (i = 0; i < mc.length; i++) out.push({ label: mc[i].label, value: mc[i].totalKWh || 0, has: (mc[i].totalKWh || 0) > 0, monthKey: mc[i].monthKey });
        return { monthly: out, name: '月度充入度数', unit: ' 度', fmt: function (v) { return Utils.fmt(v, 1); } };
      }
      if (mode === 'price') {
        for (i = 0; i < mc.length; i++) {
          var k = mc[i].totalKWh || 0;
          out.push({ label: mc[i].label, value: k > 0 ? (mc[i].value / k) : 0, has: k > 0, monthKey: mc[i].monthKey });
        }
        return { monthly: out, name: '月度平均电价', unit: ' 元/度', fmt: function (v) { return '¥' + Utils.fmt(v, 2); } };
      }
      if (mode === 'eff') {
        var me = Stats.monthlyEfficiency(vid, months);
        for (i = 0; i < me.length; i++) out.push({ label: me[i].label, value: me[i].value, has: me[i].value != null, monthKey: me[i].monthKey });
        return { monthly: out, name: '月度百公里电耗', unit: ' kWh/100km', fmt: function (v) { return Utils.fmt(v, 1); } };
      }
      for (i = 0; i < mc.length; i++) out.push({ label: mc[i].label, value: mc[i].value || 0, has: (mc[i].totalKWh || 0) > 0 || (mc[i].value || 0) > 0, monthKey: mc[i].monthKey });
      return { monthly: out, name: '月度充电费用', unit: '', fmt: function (v) { return '¥' + Utils.fmt(v, 2); } };
    },

    buildChart: function (rows, fmt) {
      var valid = rows.filter(function (r) { return r.has; });
      if (!valid.length) return '<div class="chart-empty">还没有可用的月度数据<br>记账后这里会出现趋势</div>';
      if (valid.length === 1) return '<div class="chart-empty">只有一个月的有效样本<br>再记一笔即可看到趋势</div>';

      var W = 300, H = 140, pL = 4, pR = 4, pT = 12, pB = 18;
      var vals = valid.map(function (r) { return r.value; });
      var max = Math.max.apply(null, vals), min = Math.min.apply(null, vals);
      if (max === min) { max = max === 0 ? 1 : max * 1.1; min = 0; }
      else { var pad = (max - min) * 0.12; max += pad; min = Math.max(0, min - pad); }
      var n = rows.length;
      function X(i) { return n === 1 ? W / 2 : pL + i * (W - pL - pR) / (n - 1); }
      function Y(v) { return H - pB - ((v - min) / (max - min || 1)) * (H - pT - pB); }

      var segs = [], cur = [];
      rows.forEach(function (r, i) {
        if (r.has) cur.push([X(i), Y(r.value)]);
        else if (cur.length) { segs.push(cur); cur = []; }
      });
      if (cur.length) segs.push(cur);

      var paths = '', areas = '';
      segs.forEach(function (seg) {
        if (seg.length < 2) return;
        var d = 'M' + seg.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L');
        paths += '<path class="chart-line" pathLength="1" d="' + d + '"/>';
        areas += '<path class="chart-area" d="' + d + ' L' + seg[seg.length - 1][0].toFixed(1) + ' ' + H + ' L' + seg[0][0].toFixed(1) + ' ' + H + ' Z"/>';
      });

      var pts = '';
      rows.forEach(function (r, i) {
        if (!r.has) return;
        var x = X(i).toFixed(1), y = Y(r.value).toFixed(1);
        pts += '<circle class="chart-pt' + (i === n - 1 ? ' last' : '') + '" cx="' + x + '" cy="' + y + '" r="3"/>';
        pts += '<circle class="chart-hit" cx="' + x + '" cy="' + y + '" r="12" onclick="App.openMonthSheet(\'' + (r.monthKey || '') + '\')"><title>' + r.label + ' · ' + fmt(r.value) + '</title></circle>';
      });

      var idx = [];
      if (n <= 6) { for (var a = 0; a < n; a++) idx.push(a); }
      else { for (var s = 0; s <= 5; s++) idx.push(Math.round(s * (n - 1) / 5)); }
      var labels = idx.map(function (i) {
        var pct = n === 1 ? 50 : (i / (n - 1)) * 100;
        return '<span style="left:' + pct.toFixed(2) + '%">' + rows[i].label + '</span>';
      }).join('');

      return '<div class="chart"><svg class="chart-svg" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">'
        + areas + paths + pts + '</svg><div class="x-labels">' + labels + '</div></div>';
    },

    buildDonut: function (fast, slow) {
      var total = fast + slow;
      var C = 2 * Math.PI * 40;
      var a = total > 0 ? fast / total * C : 0;
      var html = '<svg class="donut" viewBox="0 0 100 100" aria-hidden="true">'
        + '<circle class="track" cx="50" cy="50" r="40" fill="none" stroke-width="12"/>';
      if (total > 0 && fast > 0) {
        html += '<circle class="seg-a" cx="50" cy="50" r="40" fill="none" stroke-width="12" stroke-dasharray="' + a.toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 50 50)"/>';
      }
      if (total > 0 && slow > 0) {
        html += '<circle class="seg-b" cx="50" cy="50" r="40" fill="none" stroke-width="12" stroke-dasharray="' + (C - a).toFixed(1) + ' ' + C.toFixed(1) + '" stroke-dashoffset="' + (-a).toFixed(1) + '" transform="rotate(-90 50 50)"/>';
      }
      html += '</svg>';
      return html;
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

    /* 油车对比卡：未配置 → 只给入口；已配置无区间 → 提示补里程；有区间 → 三档节省 */
    fuelCardHTML: function (vid) {
      var fc = FuelCar.get();
      var head = '<div class="card-head"><span class="card-title">油车对比</span>'
        + '<button class="card-link" onclick="App.openSettings()">设置' + Icons.chevronRight + '</button></div>';
      if (!FuelCar.isConfigured()) {
        return '<div class="card">' + head
          + '<div class="note-line" style="margin:0">填一组油车参数，就能看到每充一次电比油车省多少钱。</div></div>';
      }
      var all = FuelCompare.scope(vid, 'all');
      if (!all.count) {
        return '<div class="card">' + head
          + '<div class="note-line" style="margin:0">补录两次不同里程后，这里会给出与油车的成本对比。</div></div>';
      }
      var year = FuelCompare.scope(vid, 'year');
      var month = FuelCompare.scope(vid, 'month');
      var pk = FuelCompare.perKm(all);
      var money = function (n) { return Math.abs(n) >= 1000 ? Utils.fmt(n, 0) : Utils.fmtMoney(n); };
      var cfg = (fc.model ? fc.model + ' · ' : '') + '油耗 ' + Utils.fmt(fc.consumption, 1) + ' L/100km · 油价 ¥' + Utils.fmt(fc.price, 2) + '/L';
      return '<div class="card">' + head
        + '<div class="metrics">'
        + '<div class="metric"><b>¥' + money(all.saving) + '</b><span>累计节省</span></div>'
        + '<div class="metric"><b>¥' + money(year.saving) + '</b><span>本年节省</span></div>'
        + '<div class="metric"><b>¥' + money(month.saving) + '</b><span>本月节省</span></div>'
        + '</div>'
        + '<div class="note-line">每百公里 电 ¥' + Utils.fmt(pk.electric, 2) + ' · 油 ¥' + Utils.fmt(pk.fuel, 2)
        + ' · 按 ' + all.count + ' 个充电区间估算' + (all.count < 3 ? '，样本较少仅供参考' : '') + '</div>'
        + '<div class="note-line">参照：' + esc(cfg) + '</div>'
        + '</div>';
    },

    /* ============================================================
     * 设置页
     * ============================================================ */
    openSettings: function () {
      var page = document.getElementById('settingsPage');
      if (page.classList.contains('show') && !page.classList.contains('is-closing')) return;
      this.settingsReturn = this.currentTab;
      this.renderSettings();
      this._showPage(page);
      var self = this;
      this._openOverlay(function (instant) { self._hidePage(page, instant); });
    },

    closeSettings: function () {
      var page = document.getElementById('settingsPage');
      if (!page.classList.contains('show')) return;
      this._closeOverlay();
    },

    renderSettings: function () {
      var vehicles = VehicleMgr.list();
      var cur = VehicleMgr.current();
      var pref = Theme.pref();
      var html = '';

      html += '<div class="group-title">外观</div>';
      html += '<div class="group"><div class="appearance"><div class="segmented" role="group" aria-label="外观">';
      [['auto', '跟随系统'], ['light', '浅色'], ['dark', '深色']].forEach(function (o) {
        html += '<button data-theme-pref="' + o[0] + '" aria-pressed="' + (pref === o[0] ? 'true' : 'false') + '" onclick="App.setTheme(\'' + o[0] + '\')">' + o[1] + '</button>';
      });
      html += '</div></div></div>';

      html += '<div class="group-title">车辆</div><div class="group">';
      if (!vehicles.length) {
        html += '<div class="row"><span class="row-label" style="color:var(--c-text-3)">还没有车辆</span></div>';
      }
      vehicles.forEach(function (v) {
        html += '<button class="row" onclick="App.openVehicleDetail(\'' + v.id + '\')">'
          + '<span class="row-label">' + esc(v.name) + '</span>'
          + (v.batteryCapacity ? '<span class="row-value">' + v.batteryCapacity + ' kWh</span>' : '')
          + (cur && cur.id === v.id ? '<span class="badge-current">当前</span>' : '')
          + Icons.chevronRight + '</button>';
      });
      html += '<button class="row" onclick="App.openVehicleModal()"><span class="row-label">添加车辆</span>' + Icons.plus + '</button>';
      html += '</div>';

      html += '<div class="group-title">对比油车</div><div class="group">';
      var fc = FuelCar.get();
      html += '<div class="field"><label>车型</label><input id="fc_model" type="text" maxlength="40" placeholder="如 迈腾 330TSI" value="' + esc(fc.model) + '"><span class="suffix"></span></div>';
      html += '<div class="field"><label>油耗</label><input id="fc_consumption" type="number" step="0.1" min="0" placeholder="8.0" value="' + (fc.consumption > 0 ? Utils.fmt(fc.consumption, 1) : '') + '"><span class="suffix">L/100km</span></div>';
      html += '<div class="field"><label>油价</label><input id="fc_price" type="number" step="0.01" min="0" placeholder="7.80" value="' + (fc.price > 0 ? Utils.fmt(fc.price, 2) : '') + '"><span class="suffix">元/L</span></div>';
      html += '</div><p class="note-line">用于统计页与记录详情的「油车对比」。油费 = 区间里程 × 油耗 × 油价，电费按充电金额。</p>';

      html += '<div class="group-title">数据</div><div class="group">';
      html += '<button class="row" onclick="App.exportData()"><span class="row-label">导出数据</span><span class="row-value">JSON</span>' + Icons.chevronRight + '</button>';
      html += '<label class="row"><span class="row-label">导入数据</span><span class="row-value">JSON</span>' + Icons.chevronRight
        + '<input type="file" id="importInput" accept=".json" style="display:none"></label>';
      if (Seed.hasData()) {
        html += '<button class="row" onclick="App.loadBaseData()"><span class="row-label">载入基础数据</span>'
          + '<span class="row-value">' + Seed.base().charges.length + ' 条</span>' + Icons.download + '</button>';
      }
      var snap = Store.peekImportSnapshot();
      if (snap) {
        html += '<button class="row" onclick="App.restoreImportSnapshot()"><span class="row-label">恢复导入前的数据</span><span class="row-value">' + snap.label + '</span>' + Icons.chevronRight + '</button>';
      }
      html += '</div><p class="note-line">换手机或清缓存前先导出；导入会整库替换，载入基础数据只追加不覆盖。</p>';

      var sc = Sync.cfg || Sync.load();
      html += '<div class="group-title">云同步</div><div class="group">';
      html += '<label class="row"><span class="row-label">自动同步</span><input type="checkbox" class="switch" id="syncEnabled"' + (sc.enabled ? ' checked' : '') + '></label>';
      html += '<div class="field"><label for="syncToken">令牌</label><input id="syncToken" type="text" placeholder="GitHub Token" value="' + esc(sc.token) + '" autocomplete="off" spellcheck="false" style="text-align:left"><span class="suffix"></span></div>';
      html += '<button class="row" onclick="App.syncNow()"><span class="row-label">立即同步</span>' + Icons.chevronRight + '</button>';
      html += '</div>';
      html += '<p class="note-line" id="syncStatusLine">' + esc(this.syncStatusText()) + '</p>';
      html += '<p class="note-line">把整库快照通过 HTTPS 存到你的私有 GitHub Gist，仅自己可见。换设备时填同一令牌即可拉取；多设备同时使用按「最后写入」合并。</p>';

      html += '<div class="group-title">高级</div><div class="group">';
      html += '<button class="row" onclick="App.toggleMigrationNote()" id="migrationToggle" aria-expanded="false"><span class="row-label">技术说明</span>' + Icons.chevronDown + '</button>';
      html += '<button class="row danger" onclick="App.clearAllData()"><span class="row-label">清空所有数据</span>' + Icons.chevronRight + '</button>';
      html += '</div>';
      html += '<div class="collapse" id="migrationCollapse"><p class="note-line" style="margin-top:10px">纯前端单页应用，数据主要存在本机 localStorage；开启云同步后，整库快照会额外存到你的私有 GitHub Gist。导出的 JSON 就是整库快照，可直接改名存档。</p></div>';
      html += '<p class="note-line" style="margin-top:32px;text-align:center">冲充电 v2.6 · 本地存储' + (sc.enabled ? ' · 云同步已开启' : '') + '</p>';

      document.getElementById('settingsBody').innerHTML = html;
      this.bindSettingsEvents();
    },

    bindSettingsEvents: function () {
      var self = this;
      var input = document.getElementById('importInput');
      if (input) {
        input.onchange = function () {
          var file = this.files && this.files[0];
          this.value = '';
          if (!file) return;
          Store.readImportFile(file, function (err, data) {
            if (err) { self.toast(err, 'error'); return; }
            self.showConfirm('导入数据',
              '将用该文件替换现有全部数据（' + data.vehicles.length + ' 辆车 · ' + data.charges.length + ' 条记录）。当前数据会先存为快照，可在「数据」里恢复。',
              function () {
                Store.applyImport(data);
                self.toast('导入成功', 'success');
                setTimeout(function () { location.reload(); }, 500);
              });
          });
        };
      }
      /* 对比油车参数：失焦保存，避免切页签时丢失输入 */
      var fcIds = ['fc_model', 'fc_consumption', 'fc_price'];
      var fcEls = fcIds.map(function (id) { return document.getElementById(id); });
      if (fcEls.every(function (el) { return !!el; })) {
        fcEls.forEach(function (el) {
          el.addEventListener('change', function () {
            FuelCar.set({
              model: document.getElementById('fc_model').value,
              consumption: document.getElementById('fc_consumption').value,
              price: document.getElementById('fc_price').value
            });
            /* 设置页是浮层，保存后同步刷新底下的统计/记录页，
               否则关闭设置回到统计页时「油车对比」仍是旧状态 */
            self.renderTab(self.currentTab);
            self.toast('已保存对比油车', 'success');
          });
        });
      }
      /* 云同步：开关与令牌都失焦/切换时保存 */
      var syncSw = document.getElementById('syncEnabled');
      if (syncSw) syncSw.addEventListener('change', function () { self.syncToggle(syncSw.checked); });
      var syncToken = document.getElementById('syncToken');
      if (syncToken) syncToken.addEventListener('change', function () { self.syncSaveToken(); });
    },

    setTheme: function (pref) {
      var apply = function () {
        Theme.set(pref);
        document.querySelectorAll('[data-theme-pref]').forEach(function (b) {
          b.setAttribute('aria-pressed', b.dataset.themePref === pref ? 'true' : 'false');
        });
      };
      if (document.startViewTransition && !this._prefersReducedMotion()) {
        try { document.startViewTransition(apply); return; } catch (e) {}
      }
      apply();
    },

    toggleMigrationNote: function () {
      var toggle = document.getElementById('migrationToggle');
      var collapse = document.getElementById('migrationCollapse');
      if (!toggle || !collapse) return;
      var open = collapse.classList.toggle('open');
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    },

    exportData: function () {
      Store.exportJSON();
      this.toast('已导出备份文件', 'success');
    },

    loadBaseData: function () {
      if (!Seed.hasData()) { this.toast('基础数据未加载', 'error'); return; }
      var b = Seed.base();
      var list = b.charges;
      this.showConfirm('载入基础数据',
        '将写入 ' + list.length + ' 条历史记录（' + list[0][0] + ' 至 ' + list[list.length - 1][0] + '）。已有记录按日期、度数、金额去重，不会重复。',
        function () {
          var n = Seed.apply();
          App.renderAll();
          App.toast(n ? '已载入 ' + n + ' 条' : '基础数据已存在', 'success');
        });
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
      this.showConfirm('恢复导入前的数据', '将用 ' + snap.label + ' 的导入前快照替换当前全部数据。', function () {
        Store.restoreImportSnapshot();
        App.toast('已恢复', 'success');
        setTimeout(function () { location.reload(); }, 500);
      });
    },

    /* ============================================================
     * 云同步
     * ============================================================ */
    syncStatusText: function () {
      var c = Sync.cfg || Sync.load();
      if (Sync._statusText) return Sync._statusText;
      if (!c.enabled) return c.token ? '已保存令牌，未开启同步' : '未开启';
      if (c.lastError === 'auth') return '令牌无效，已暂停';
      if (c.lastSyncAt) return '上次同步：' + Sync.fmtTime(c.lastSyncAt);
      return '已开启，等待首次同步';
    },

    syncToggle: function (on) {
      if (on) Sync.enable();
      else Sync.disable();
      this.renderSettings();
    },

    syncSaveToken: function () {
      var el = document.getElementById('syncToken');
      if (!el) return;
      Sync.cfg.token = el.value.trim();
      Sync.save();
      if (Sync.cfg.token && !Sync.cfg.enabled) {
        this.toast('令牌已保存，打开「自动同步」后生效', 'success');
      } else if (!Sync.cfg.token && Sync.cfg.enabled) {
        Sync.disable();
        this.toast('已停止同步', 'warn');
      }
      this.renderSettings();
    },

    syncNow: function () {
      if (!Sync.isReady()) { this.toast('请先填写令牌并开启自动同步', 'error'); return; }
      Sync.pull(false);
    },

    /* ============================================================
     * 车辆
     * ============================================================ */
    openVehicleSheet: function () {
      var list = VehicleMgr.list();
      var cur = VehicleMgr.current();
      var body = '';
      if (!list.length) {
        body = '<div class="empty" style="padding:24px 8px">' + Illustrations.car
          + '<h3>还没有车辆</h3><p>添加一辆车后即可开始记录</p></div>';
      } else {
        body += '<div class="sheet-list">';
        list.forEach(function (v) {
          body += '<button class="row" onclick="App.selectVehicle(\'' + v.id + '\')">'
            + '<span class="row-label">' + esc(v.name) + '</span>'
            + (v.batteryCapacity ? '<span class="row-value">' + v.batteryCapacity + ' kWh</span>' : '')
            + (cur && cur.id === v.id ? Icons.checkMark : '')
            + '</button>';
        });
        body += '</div>';
      }
      body += '<div class="sheet-actions-row">'
        + '<button class="btn btn-secondary" onclick="App.manageVehicles()">管理车辆</button>'
        + '<button class="btn btn-primary" onclick="App.addVehicleFromSheet()">添加车辆</button></div>';
      this.openSheet({ title: '车辆', sub: list.length + ' 辆', body: body });
    },

    selectVehicle: function (id) {
      var cur = VehicleMgr.current();
      if (cur && cur.id === id) { this.closeSheet(); return; }
      VehicleMgr.setCurrent(id);
      this.closeSheet();
      this.renderAll();
      this.toast('已切换车辆', 'success');
    },

    manageVehicles: function () {
      if (document.getElementById('settingsPage').classList.contains('show')) {
        this.closeSheet();
        return;
      }
      this.closeSheet(true);
      this.openSettings();
    },

    addVehicleFromSheet: function () {
      this.closeSheet(true);
      this.openVehicleModal();
    },

    openVehicleDetail: function (id) {
      var v = VehicleMgr.get(id);
      if (!v) return;
      var cur = VehicleMgr.current();
      var meta = ((v.brand || '') + ' ' + (v.model || '')).trim();
      if (meta === v.name) meta = '车辆';
      var body = '<div class="ds-hero"><div class="k">' + esc(meta || '车辆') + '</div>'
        + '<div class="v">' + esc(v.name) + '</div>'
        + '<div class="s">' + (v.batteryCapacity ? v.batteryCapacity + ' kWh' : '未填标称容量')
        + (v.supportsFastCharge ? ' · 支持快充' : ' · 不支持快充') + '</div></div>';
      body += '<div class="ds-grid">'
        + '<div class="ds-cell"><div class="k">最大充电功率</div><div class="v">' + (v.maxChargePower ? v.maxChargePower + '<em>kW</em>' : '—') + '</div></div>'
        + '<div class="ds-cell"><div class="k">累计记录</div><div class="v">' + ChargeMgr.list(id).length + '<em>条</em></div></div>'
        + '</div>';
      if (v.note) body += '<div class="ds-note">' + esc(v.note) + '</div>';
      if (!cur || cur.id !== id) {
        body += '<button class="btn btn-secondary btn-block" style="margin-top:14px" onclick="App.selectVehicle(\'' + id + '\')">设为当前车辆</button>';
      }
      var actions = '<button class="icon-btn" onclick="App.editVehicleFromSheet(\'' + id + '\')" aria-label="编辑">' + Icons.edit + '</button>'
        + '<button class="icon-btn danger" onclick="App.deleteVehicle(\'' + id + '\')" aria-label="删除">' + Icons.trash + '</button>';
      this.openSheet({ title: '车辆详情', sub: '', body: body, actions: actions });
    },

    editVehicleFromSheet: function (id) {
      this.closeSheet(true);
      this.openVehicleModal(id);
    },

    deleteVehicle: function (id) {
      var v = VehicleMgr.get(id);
      this.showConfirm('删除车辆', '确定删除「' + (v ? v.name : '') + '」及其所有充电记录？此操作不可恢复。', function () {
        VehicleMgr.remove(id);
        App.closeSheet(true);
        App.renderAll();
        App.renderSettings();
        App.toast('已删除', 'success');
      });
    },

    /* ============================================================
     * 弹层
     * ============================================================ */
    openSheet: function (o) {
      var layer = document.getElementById('sheetLayer');
      var sheet = layer.querySelector('.sheet');
      if (layer._closeTimer) { clearTimeout(layer._closeTimer); layer._closeTimer = null; }
      if (layer._endHandler && sheet) { sheet.removeEventListener('transitionend', layer._endHandler); layer._endHandler = null; }
      layer.classList.remove('is-closing');
      if (this._sheetOpen) { this._fillSheet(o, true); return; }
      this._sheetOpen = true;
      this._fillSheet(o, false);
      layer.classList.add('show');
      layer.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      document.body.classList.add('sheet-open');
      var self = this;
      this._openOverlay(function (instant) { self._hideSheet(instant); });
    },

    updateSheet: function (o) { this._fillSheet(o, true); },

    _fillSheet: function (o, keepScroll) {
      document.getElementById('sheetTitle').textContent = o.title || '';
      var sub = document.getElementById('sheetSub');
      sub.textContent = o.sub || '';
      sub.style.display = o.sub ? '' : 'none';
      document.getElementById('sheetActions').innerHTML = o.actions || '';
      var body = document.getElementById('sheetBody');
      body.innerHTML = o.body || '';
      if (!keepScroll) body.scrollTop = 0;
    },

    _hideSheet: function (instant) {
      var layer = document.getElementById('sheetLayer');
      var sheet = layer.querySelector('.sheet');
      var self = this;
      var finish = function () {
        if (layer._closeTimer) { clearTimeout(layer._closeTimer); layer._closeTimer = null; }
        if (layer._endHandler && sheet) { sheet.removeEventListener('transitionend', layer._endHandler); layer._endHandler = null; }
        layer.classList.remove('show');
        layer.classList.remove('is-closing');
        layer.setAttribute('aria-hidden', 'true');
        if (!self._sheetOpen) {
          document.body.style.overflow = '';
          document.body.classList.remove('sheet-open');
        }
      };
      this._sheetOpen = false;
      if (instant || this._prefersReducedMotion()) { finish(); return; }
      layer.classList.remove('show');
      layer.classList.add('is-closing');
      layer.setAttribute('aria-hidden', 'true');
      var done = false;
      var onEnd = function (e) {
        if (e && (e.target !== sheet || e.propertyName !== 'transform')) return;
        if (done) return;
        done = true;
        finish();
      };
      layer._endHandler = onEnd;
      if (sheet) sheet.addEventListener('transitionend', onEnd);
      layer._closeTimer = setTimeout(onEnd, 320);
    },

    closeSheet: function (silent) {
      if (!this._sheetOpen) return;
      this._closeOverlay(!!silent);
    },

    openYearSheet: function () {
      var vid = this.currentVid();
      var years = Utils.availableYears(vid);
      var cur = this.statsYear;
      var body = '<div class="sheet-list">'
        + '<button class="row" onclick="App.setStatsYear(\'\')"><span class="row-label">全部年份</span>' + (!cur ? Icons.checkMark : '') + '</button>';
      years.forEach(function (y) {
        body += '<button class="row" onclick="App.setStatsYear(\'' + y + '\')"><span class="row-label">' + y + ' 年</span>' + (String(cur) === y ? Icons.checkMark : '') + '</button>';
      });
      body += '</div>';
      this.openSheet({ title: '统计范围', sub: '按年份筛选', body: body });
    },

    openMonthSheet: function (key) {
      if (!key) return;
      var vid = this.currentVid();
      var charges = vid ? ChargeMgr.list(vid) : [];
      var sc = charges.filter(function (c) { return Utils.monthKey(c.date || '') === key; });
      var label = Utils.monthLabel(key);
      if (!sc.length) {
        this.openSheet({ title: label + ' 明细', sub: key, body: '<div class="ds-empty">该月暂无充电记录</div>' });
        return;
      }
      var cost = 0, kwh = 0, fast = 0, slow = 0;
      sc.forEach(function (c) {
        cost += Number(c.totalCost) || 0; kwh += Number(c.kWh) || 0;
        if (c.chargeType === 'fast') fast++; else slow++;
      });
      var effInfo = this._monthEff(vid, key);
      var avgPrice = kwh > 0 ? cost / kwh : 0;
      var fastPct = Math.round(fast / sc.length * 100);
      var cmp = FuelCar.isConfigured() ? FuelCompare.monthSummary(vid, key) : { count: 0, saving: 0 };
      var body = '<div class="ds-hero"><div class="k">' + label + ' · 充电费用</div>'
        + '<div class="v">¥' + Utils.fmtMoney(cost) + '</div>'
        + '<div class="s">' + sc.length + ' 次充电 · 快充 ' + fastPct + '%</div></div>'
        + '<div class="ds-grid">'
        + '<div class="ds-cell"><div class="k">充电度数</div><div class="v">' + Utils.fmt(kwh, 1) + '<em>度</em></div></div>'
        + '<div class="ds-cell"><div class="k">充电次数</div><div class="v">' + sc.length + '<em>次</em></div></div>'
        + '<div class="ds-cell"><div class="k">平均电价</div><div class="v">¥' + Utils.fmtMoney(avgPrice) + '<em>/度</em></div></div>'
        + '<div class="ds-cell"><div class="k">平均电耗</div><div class="v">' + (effInfo.enough ? Utils.fmt(effInfo.avg, 1) : '—')
        + '<em>' + (effInfo.enough ? 'kWh/100km' : (effInfo.count > 0 ? '样本不足' : '无里程数据')) + '</em></div></div>'
        + (cmp.count ? '<div class="ds-cell"><div class="k">对比油车</div><div class="v">省 ¥' + Utils.fmtMoney(cmp.saving) + '</div></div>' : '')
        + '</div>';
      this.openSheet({ title: label + ' 明细', sub: sc.length + ' 条记录', body: body });
    },

    /* 月度电耗：与统计页趋势共用同一口径（区间记在后一条记录所属月），避免同月出现两个数 */
    _monthEff: function (vid, monthKey) {
      var me = Stats.monthlyEfficiency(vid, [monthKey]);
      var row = me && me[0];
      var count = row ? row.count : 0;
      var avg = row ? row.value : null;
      return { count: count, enough: count >= 3, avg: avg == null ? 0 : avg };
    },

    openDonutSheet: function () {
      var vid = this.currentVid();
      var year = this.statsYear;
      var charges = vid ? ChargeMgr.list(vid) : [];
      /* 与环形图本体口径一致：按当前年份筛选，避免「环按筛选画、明细却统计全部」 */
      if (year) charges = charges.filter(function (c) { return c.date && c.date.slice(0, 4) === String(year); });
      var fast = 0, slow = 0, fastK = 0, slowK = 0;
      charges.forEach(function (c) {
        if (c.chargeType === 'fast') { fast++; fastK += Number(c.kWh) || 0; }
        else { slow++; slowK += Number(c.kWh) || 0; }
      });
      var total = fast + slow;
      var scopeLabel = year ? (year + ' 年') : '全部记录';
      if (!total) {
        this.openSheet({ title: '快慢充比例', sub: scopeLabel, body: '<div class="ds-empty">该范围内暂无充电记录</div>' });
        return;
      }
      var fPct = Math.round(fast / total * 100);
      var body = '<div class="ds-hero"><div class="k">快慢充比例 · ' + scopeLabel + '</div>'
        + '<div class="v">' + fPct + ' : ' + (100 - fPct) + '</div>'
        + '<div class="s">共 ' + total + ' 次充电</div></div>'
        + '<div class="ds-grid">'
        + '<div class="ds-cell"><div class="k">快充次数</div><div class="v">' + fast + '<em>次</em></div></div>'
        + '<div class="ds-cell"><div class="k">慢充次数</div><div class="v">' + slow + '<em>次</em></div></div>'
        + '<div class="ds-cell"><div class="k">快充度数</div><div class="v">' + Utils.fmt(fastK, 1) + '<em>度</em></div></div>'
        + '<div class="ds-cell"><div class="k">慢充度数</div><div class="v">' + Utils.fmt(slowK, 1) + '<em>度</em></div></div>'
        + '</div>';
      this.openSheet({ title: '快慢充比例', sub: scopeLabel, body: body });
    },

    openBatterySheet: function () {
      var vid = this.currentVid();
      var cap = BatteryHealth.capacityHealth(vid);
      var habit = BatteryHealth.habitScore(vid);
      var nominal = cap.nominal || 0;
      var body = '<div class="ds-hero"><div class="k">容量保持率</div>'
        + '<div class="v">' + (cap.index === null ? '—' : cap.index + '<em>%</em>') + '</div>'
        + '<div class="s">' + (cap.index === null
          ? '记录充电前后 SOC 后可估算'
          : (nominal > 0 ? '实测 ' + Utils.fmt(cap.currentEstimate, 1) + ' / 标称 ' + nominal + ' kWh' : '车辆未填写标称容量'))
        + '</div></div>';
      body += '<div class="ds-grid">'
        + '<div class="ds-cell"><div class="k">充电习惯</div><div class="v">' + ((habit.factors && habit.factors.length) ? habit.score : '—') + '</div></div>'
        + '<div class="ds-cell"><div class="k">深放频率</div><div class="v">' + (habit.socBeforeCount ? Math.round(habit.deepRatio * 100) + '<em>%</em>' : '—') + '</div></div>'
        + '<div class="ds-cell"><div class="k">过充频率</div><div class="v">' + (habit.socAfterCount ? Math.round(habit.overRatio * 100) + '<em>%</em>' : '—') + '</div></div>'
        + '</div>';

      var lo = nominal > 0 ? nominal * 0.7 : 0;
      var hi = nominal > 0 ? nominal * 1.08 : Infinity;
      var raw = [];
      ChargeMgr.listByVehicle(vid).forEach(function (c) {
        var sd = (c.socAfter || 0) - (c.socBefore || 0);
        if (sd >= 30 && (c.kWh || 0) > 0) {
          var v = c.kWh / (sd / 100);
          raw.push({ date: c.date, sd: sd, cap: v, ok: !(nominal > 0 && (v < lo || v > hi)) });
        }
      });
      raw.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });

      body += '<div class="ds-title">容量估算明细</div>';
      if (raw.length) {
        body += '<div class="ds-grid">';
        raw.slice(0, 8).forEach(function (r) {
          body += '<div class="ds-cell"><div class="k">' + r.date + ' · SOC ' + r.sd + '%</div>'
            + '<div class="v">' + Utils.fmt(r.cap, 1) + '<em>kWh</em>' + (r.ok ? '' : ' · 已剔除') + '</div></div>';
        });
        body += '</div>';
      } else {
        body += '<div class="ds-note">暂无有效样本：需记录充电前后 SOC（跨度 ≥30%）与充入度数。</div>';
      }
      body += '<div class="ds-note"><b>说明：</b>单次容量 = 充入度数 ÷ SOC 跨度；仅取跨度 ≥30% 的记录，超出标称 0.7~1.08 倍的视为读数偏差剔除。容量保持率取最近 5 次估算的中位数。</div>';
      this.openSheet({ title: '电池', sub: '容量与充电习惯', body: body });
    },

    openAdviceSheet: function () {
      var vid = this.currentVid();
      var rec = Recommender.generate(vid);
      var body = '<div class="advice-list">' + (rec.tips || []).map(adviceHTML).join('') + '</div>';
      this.openSheet({ title: '充电建议', sub: rec.summary || '', body: body });
    },

    showChartSheet: function (type, key) {
      if (type === 'month') this.openMonthSheet(key);
      else if (type === 'donut') this.openDonutSheet();
      else if (type === 'battery') this.openBatterySheet();
      else if (type === 'advice') this.openAdviceSheet();
    },

    /* ============================================================
     * 充电记录详情与表单
     * ============================================================ */
    showChargeDetail: function (id) {
      var c = ChargeMgr.get(id);
      if (!c) return;
      var isFast = c.chargeType === 'fast';
      var typeLabel = isFast ? '快充' : '慢充';
      var unitPrice = c.kWh > 0 ? (Number(c.totalCost) || 0) / Number(c.kWh) : 0;
      var d = (c.date || '').split('-');
      var dateStr = d.length === 3 ? (d[0] + '年' + parseInt(d[1], 10) + '月' + parseInt(d[2], 10) + '日') : (c.date || '');

      var body = '<div class="ds-hero"><div class="k">充电费用</div>'
        + '<div class="v">¥' + Utils.fmtMoney(c.totalCost) + '</div>'
        + '<div class="s">' + typeLabel + ' · ' + Utils.fmt(c.kWh, 1) + ' 度</div></div>'
        + '<div class="ds-grid">'
        + '<div class="ds-cell"><div class="k">充电度数</div><div class="v">' + Utils.fmt(c.kWh, 1) + '<em>度</em></div></div>'
        + '<div class="ds-cell"><div class="k">充电单价</div><div class="v">¥' + Utils.fmtMoney(unitPrice) + '<em>/度</em></div></div>'
        + '<div class="ds-cell"><div class="k">充电类型</div><div class="v">' + typeLabel + '</div></div>'
        + '<div class="ds-cell"><div class="k">日期</div><div class="v" style="font-size:13px">' + dateStr + '</div></div>';
      if (Number(c.odometer) > 0) body += '<div class="ds-cell"><div class="k">里程读数</div><div class="v">' + c.odometer + '<em>km</em></div></div>';
      if (Number(c.socBefore) > 0 && Number(c.socAfter) > 0) body += '<div class="ds-cell"><div class="k">SOC 变化</div><div class="v">' + c.socBefore + '% → ' + c.socAfter + '%</div></div>';
      body += '</div>';
      var cmp = this.chargeComparison(c.id);
      if (cmp) body += '<div class="ds-hero"><div class="k">对比油车 · 本次节省</div>'
        + '<div class="v">¥' + Utils.fmtMoney(cmp.saving) + '</div>'
        + '<div class="s">' + Utils.fmt(cmp.distance, 0) + ' km · 油 ¥' + Utils.fmtMoney(cmp.fuelCost) + ' / 电 ¥' + Utils.fmtMoney(cmp.electricCost) + '</div></div>';
      if (c.note) body += '<div class="ds-note">' + esc(c.note) + '</div>';

      var actions = '<button class="icon-btn" onclick="App.editChargeFromSheet(\'' + id + '\')" aria-label="编辑">' + Icons.edit + '</button>'
        + '<button class="icon-btn danger" onclick="App.deleteChargeFromDetail(\'' + id + '\')" aria-label="删除">' + Icons.trash + '</button>';

      this.openSheet({ title: '充电详情', sub: dateStr + ' · ' + typeLabel, body: body, actions: actions });
    },

    /** 单条记录的油车对比：仅当该记录能构成有效区间（有上条里程、里程递增）时返回 */
    chargeComparison: function (id) {
      if (!FuelCar.isConfigured()) return null;
      var rows = FuelCompare.intervals(this.currentVid());
      for (var i = 0; i < rows.length; i++) if (rows[i].id === id) return rows[i];
      return null;
    },

    editChargeFromSheet: function (id) {
      this.closeSheet(true);
      this.openChargePage(id);
    },

    deleteChargeFromDetail: function (id) {
      this.showConfirm('删除充电记录', '确定删除这条充电记录？此操作不可恢复。', function () {
        ChargeMgr.remove(id);
        App.closeSheet(true);
        App.renderAll();
        App.toast('已删除', 'success');
      });
    },

    openChargePage: function (id) {
      var vehicle = VehicleMgr.current();
      if (!vehicle) { this.toast('请先添加车辆', 'warn'); this.openSettings(); return; }
      this.editingChargeId = id || null;
      this.previousTab = this.currentTab;

      var form = document.getElementById('chargeFormPage-form');
      form.reset();
      form.dataset.priceMode = '';
      document.getElementById('cf_vehicleId').value = vehicle.id;
      document.getElementById('cf_date').value = Utils.today();
      document.getElementById('cf_unitPrice').value = '';
      document.getElementById('cfFormMsg').textContent = '';
      this.clearChargeErrors();
      this.setChargeType('fast');
      this.setChargeExtra(false);

      if (id) {
        var c = ChargeMgr.get(id);
        if (c) {
          /* 编辑时保留记录原本的车辆，避免把别的车的记录改挂到当前车 */
          document.getElementById('cf_vehicleId').value = c.vehicleId || vehicle.id;
          document.getElementById('cf_date').value = c.date;
          var put = function (elId, val) {
            document.getElementById(elId).value = (Number(val) > 0) ? val : '';
          };
          put('cf_odometer', c.odometer);
          put('cf_kWh', c.kWh);
          put('cf_unitPrice', c.unitPrice);
          put('cf_totalCost', c.totalCost);
          put('cf_socBefore', c.socBefore);
          put('cf_socAfter', c.socAfter);
          document.getElementById('cf_note').value = c.note || '';
          this.setChargeType(c.chargeType === 'slow' ? 'slow' : 'fast');
          var hasExtra = Number(c.odometer) > 0 || Number(c.socBefore) > 0 || Number(c.socAfter) > 0 || !!c.note;
          this.setChargeExtra(hasExtra);
        }
        document.getElementById('chargeFormPageTitle').textContent = '编辑记录';
      } else {
        document.getElementById('chargeFormPageTitle').textContent = '记一笔';
      }

      this.renderLastHint();
      this.updatePriceHint();

      var page = document.getElementById('chargeFormPage');
      this._showPage(page);
      var self = this;
      this._openOverlay(function (instant) {
        self._hidePage(page, instant);
        self.editingChargeId = null;
      });
    },

    closeChargePage: function (silent) {
      var page = document.getElementById('chargeFormPage');
      if (!page.classList.contains('show')) return;
      this._closeOverlay(!!silent);
    },

    setChargeType: function (val) {
      document.getElementById('cf_chargeType').value = val;
      document.querySelectorAll('#cf_chargeTypeSegment button').forEach(function (b) {
        b.setAttribute('aria-pressed', b.dataset.val === val ? 'true' : 'false');
      });
    },

    renderLastHint: function () {
      var el = document.getElementById('cfLastHint');
      if (!el) return;
      var v = VehicleMgr.current();
      var last = v ? ChargeMgr.list(v.id)[0] : null;
      if (!last) { el.style.display = 'none'; el.innerHTML = ''; el.dataset.price = ''; return; }
      el.style.display = 'flex';
      var price = last.kWh > 0 ? last.totalCost / last.kWh : 0;
      var d = last.date.split('-');
      var text = '上次 ' + parseInt(d[1], 10) + '/' + parseInt(d[2], 10) + ' · ' + Utils.fmt(last.kWh, 1) + ' 度 · ¥' + Utils.fmtMoney(last.totalCost);
      el.dataset.price = price > 0 ? price.toFixed(2) : '';
      el.innerHTML = '<span class="txt">' + text + '</span>'
        + (price > 0 ? '<button type="button" class="apply" onclick="App.fillLastCharge()">套用 ¥' + Utils.fmtMoney(price) + '/度</button>' : '');
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
        this.toast('已套用 ¥' + p + '/度', 'success');
      }
      this.updatePriceHint();
    },

    setChargeExtra: function (open) {
      var box = document.getElementById('cfExtra');
      var btn = document.getElementById('cfMoreBtn');
      if (box) box.classList.toggle('open', !!open);
      if (btn) {
        btn.classList.toggle('open', !!open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
    },

    toggleChargeExtra: function () {
      var box = document.getElementById('cfExtra');
      this.setChargeExtra(box ? !box.classList.contains('open') : true);
    },

    onKwhInput: function () {
      var k = parseFloat(document.getElementById('cf_kWh').value) || 0;
      var p = parseFloat(document.getElementById('cf_unitPrice').value) || 0;
      var c = parseFloat(document.getElementById('cf_totalCost').value) || 0;
      var formEl = document.getElementById('chargeFormPage-form');
      if (k > 0 && p > 0 && formEl && formEl.dataset.priceMode === 'last') {
        document.getElementById('cf_totalCost').value = (k * p).toFixed(2);
      } else if (k > 0 && c > 0) {
        document.getElementById('cf_unitPrice').value = (c / k).toFixed(2);
      }
      this.updatePriceHint();
    },

    onCostInput: function () {
      var formEl = document.getElementById('chargeFormPage-form');
      if (formEl) formEl.dataset.priceMode = '';
      var k = parseFloat(document.getElementById('cf_kWh').value) || 0;
      var c = parseFloat(document.getElementById('cf_totalCost').value) || 0;
      if (k > 0 && c > 0) document.getElementById('cf_unitPrice').value = (c / k).toFixed(2);
      this.updatePriceHint();
    },

    updatePriceHint: function () {
      var el = document.getElementById('cfPriceHint');
      if (!el) return;
      var k = parseFloat(document.getElementById('cf_kWh').value) || 0;
      var c = parseFloat(document.getElementById('cf_totalCost').value) || 0;
      var p = parseFloat(document.getElementById('cf_unitPrice').value) || 0;
      if (k > 0 && c > 0) el.textContent = '≈ ¥' + (c / k).toFixed(2) + '/度';
      else if (k > 0 && p > 0) el.textContent = '≈ ¥' + p.toFixed(2) + '/度 · 填写金额后自动核算';
      else el.textContent = '';
    },

    markInvalid: function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var field = el.closest('.field');
      if (field) field.classList.add('invalid');
    },

    clearFieldError: function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var field = el.closest('.field');
      if (field) field.classList.remove('invalid');
      var msg = document.getElementById('cfFormMsg') || document.getElementById('vfFormMsg');
      if (msg) msg.textContent = '';
    },

    clearChargeErrors: function () {
      document.querySelectorAll('#chargeFormPage .field.invalid').forEach(function (f) { f.classList.remove('invalid'); });
      var msg = document.getElementById('cfFormMsg');
      if (msg) msg.textContent = '';
    },

    saveCharge: function () {
      var kWhEl = document.getElementById('cf_kWh');
      var costEl = document.getElementById('cf_totalCost');
      var priceEl = document.getElementById('cf_unitPrice');
      var dateEl = document.getElementById('cf_date');
      var msg = document.getElementById('cfFormMsg');
      this.clearChargeErrors();

      var kWh = parseFloat(kWhEl.value);
      var cost = parseFloat(costEl.value);
      var firstError = '';

      if (!dateEl.value) { this.markInvalid('cf_date'); firstError = firstError || '请选择日期'; }
      if (!(kWh > 0)) { this.markInvalid('cf_kWh'); firstError = firstError || '请输入充电度数'; }
      if (firstError) { msg.textContent = firstError; return; }

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

      kWhEl.value = '';
      costEl.value = '';
      priceEl.value = '';
      document.getElementById('cf_socBefore').value = '';
      document.getElementById('cf_socAfter').value = '';
      document.getElementById('cf_odometer').value = '';
      document.getElementById('cf_note').value = '';
      document.getElementById('chargeFormPage-form').dataset.priceMode = '';
      this.setChargeExtra(false);
      this.renderLastHint();
      this.updatePriceHint();
      this.toast('已记一笔', 'success');
    },

    /* ============================================================
     * 车辆表单
     * ============================================================ */
    openVehicleModal: function (id) {
      this.editingVehicleId = id || null;
      var form = document.getElementById('vehicleForm');
      var page = document.getElementById('vehicleFormPage');
      if (!form || !page) { this.toast('车辆表单未加载', 'error'); return; }
      form.reset();
      document.getElementById('vf_supportsFastCharge').checked = true;
      document.getElementById('vfFormMsg').textContent = '';
      document.querySelectorAll('#vehicleFormPage .field.invalid').forEach(function (f) { f.classList.remove('invalid'); });

      if (id) {
        var v = VehicleMgr.get(id);
        if (v) {
          document.getElementById('vf_name').value = v.name || '';
          document.getElementById('vf_brand').value = v.brand || '';
          document.getElementById('vf_model').value = v.model || '';
          document.getElementById('vf_batteryCapacity').value = Number(v.batteryCapacity) > 0 ? v.batteryCapacity : '';
          document.getElementById('vf_maxChargePower').value = Number(v.maxChargePower) > 0 ? v.maxChargePower : '';
          document.getElementById('vf_supportsFastCharge').checked = v.supportsFastCharge !== false;
          document.getElementById('vf_note').value = v.note || '';
        }
        document.getElementById('vehicleModalTitle').textContent = '编辑车辆';
      } else {
        document.getElementById('vehicleModalTitle').textContent = '添加车辆';
      }

      this._showPage(page);
      var self = this;
      this._openOverlay(function (instant) {
        self._hidePage(page, instant);
        self.editingVehicleId = null;
      });
    },

    closeVehiclePage: function (silent) {
      var page = document.getElementById('vehicleFormPage');
      if (!page.classList.contains('show')) return;
      this._closeOverlay(!!silent);
    },

    saveVehicle: function () {
      var name = document.getElementById('vf_name').value.trim();
      var cap = parseFloat(document.getElementById('vf_batteryCapacity').value);
      var msg = document.getElementById('vfFormMsg');
      document.querySelectorAll('#vehicleFormPage .field.invalid').forEach(function (f) { f.classList.remove('invalid'); });
      msg.textContent = '';

      var firstError = '';
      if (!name) { this.markInvalid('vf_name'); firstError = '请输入车辆名称'; }
      if (!(cap > 0)) { this.markInvalid('vf_batteryCapacity'); firstError = firstError || '请输入电池容量'; }
      if (firstError) { msg.textContent = firstError; return; }

      var data = {
        name: name,
        brand: document.getElementById('vf_brand').value.trim(),
        model: document.getElementById('vf_model').value.trim(),
        batteryCapacity: cap,
        maxChargePower: document.getElementById('vf_maxChargePower').value,
        supportsFastCharge: document.getElementById('vf_supportsFastCharge').checked,
        note: document.getElementById('vf_note').value.trim()
      };

      if (this.editingVehicleId) VehicleMgr.update(this.editingVehicleId, data);
      else VehicleMgr.add(data);

      this.closeVehiclePage();
      this.renderAll();
      this.toast('保存成功', 'success');
    },

    /* ============================================================
     * 确认框与 Toast
     * ============================================================ */
    showConfirm: function (title, text, callback) {
      var layer = document.getElementById('confirmModal');
      if (layer._closeTimer) { clearTimeout(layer._closeTimer); layer._closeTimer = null; }
      layer.classList.remove('is-closing');
      document.getElementById('confirmTitle').textContent = title;
      document.getElementById('confirmText').textContent = text;
      this._confirmCallback = callback;
      layer.classList.add('show');
      var dlg = layer.querySelector('.dialog');
      if (dlg) { dlg.style.animation = 'none'; void dlg.offsetWidth; dlg.style.animation = ''; }
    },

    closeConfirm: function () {
      var layer = document.getElementById('confirmModal');
      var finish = function () {
        if (layer._closeTimer) { clearTimeout(layer._closeTimer); layer._closeTimer = null; }
        layer.classList.remove('show');
        layer.classList.remove('is-closing');
      };
      this._confirmCallback = null;
      if (this._prefersReducedMotion()) { finish(); return; }
      layer.classList.remove('show');
      layer.classList.add('is-closing');
      if (layer._closeTimer) clearTimeout(layer._closeTimer);
      layer._closeTimer = setTimeout(finish, 200);
    },

    confirmOk: function () {
      var cb = this._confirmCallback;
      this.closeConfirm();
      if (cb) cb();
    },

    toast: function (msg, type) {
      var t = document.createElement('div');
      t.className = 'toast' + (type ? ' ' + type : '');
      var ic = type === 'error' ? Icons.alert : (type === 'warn' ? Icons.info : Icons.check);
      t.innerHTML = ic + '<span>' + esc(msg) + '</span>';
      document.body.appendChild(t);
      setTimeout(function () { t.classList.add('show'); }, 10);
      setTimeout(function () {
        t.classList.remove('show');
        setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 220);
      }, 2200);
    }
  };

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, function (ch) {
      return ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&quot;';
    });
  }

  function adviceHTML(t) {
    var kind = t.icon === 'alert' ? 'warn' : (t.icon === 'check' ? 'ok' : 'info');
    var ic = t.icon === 'alert' ? Icons.alert : (t.icon === 'check' ? Icons.check : Icons.info);
    return '<div class="advice-item ' + kind + '">'
      + '<span class="advice-icon">' + ic + '</span>'
      + '<div><div class="advice-title">' + esc(t.title) + '</div>'
      + '<div class="advice-text">' + esc(t.text) + '</div></div></div>';
  }

  window.App = App;
  document.addEventListener('DOMContentLoaded', function () { App.init(); });
})();
