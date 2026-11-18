/* ============================================================
 * 冲充电 · 截图识别（OCR）模块
 *
 * 独立脚本，全局对象 OCR。职责：
 *   1. 按需懒加载本地 Tesseract.js 引擎（app/vendor/tesseract/）
 *   2. 在 Web Worker 内识别截图，主线程不阻塞
 *   3. 把识别文本抽成字段候选（宁可留空，不可填错）
 *   4. 预填现有表单，低置信字段描红并聚焦
 *
 * 隐私：截图不上传、不写 localStorage / IndexedDB；
 *       识别结束终止 Worker 并释放原图引用。
 * 降级：环境不支持 Worker / WebAssembly 时 supported() 返回 false，
 *       由 App 隐藏入口，保留手动填写。
 * ============================================================ */
(function (global) {
  'use strict';

  var VENDOR = 'vendor/tesseract/';
  var LANG = 'chi_sim';
  var MAX_EDGE = 2048;

  function clamp01(n) {
    n = Number(n) || 0;
    return n < 0 ? 0 : (n > 1 ? 1 : n);
  }

  function levelOf(c) {
    return c >= 0.85 ? 'high' : (c >= 0.65 ? 'medium' : 'low');
  }

  function toNum(s) {
    var n = parseFloat(String(s == null ? '' : s).replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
  }

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /* ---------- 抽取规则（与 docs/ocr-方案.html 对齐） ---------- */
  var RE = {
    /* 充入电量：数字 + 单位，单位可有可无地紧跟 */
    kwh: /(\d+(?:[.,]\d+)?)\s*(度|kwh|千瓦时|kw\.?\s?h)/i,
    /* 金额：优先「实付」等标签；兼容 OCR 把 ¥ 读成 Y、标签被拆出空格的情况 */
    cost: /(?:¥|￥|Y|实付|金额|费用|合计|应付|实收|价格)\s*[:：]?\s*(?:¥|￥|Y)?\s*(\d+(?:[.,]\d+)?)/,
    /* 完整日期 */
    date: /(\d{4})\s*[-/年.]\s*(\d{1,2})\s*[-/月.]\s*(\d{1,2})/,
    /* 仅时分 */
    time: /(\d{1,2})\s*[:：]\s*(\d{2})/,
    /* SOC 前后：默认不识别，命中只作候选 */
    soc: /(\d{1,3})\s*%\s*(?:→|至|-|~|—|－)\s*(\d{1,3})\s*%/,
    /* 可选：时长 / 站点 */
    duration: /(\d+(?:\.\d+)?)\s*(分钟|min|小时|h)/i,
    site: /(站点|充电桩|充电站|运营商)/
  };

  /* 汉字之间常被 OCR 插入空格（如「实 付」），先归一化再匹配 */
  function normalize(text) {
    return String(text || '')
      .replace(/([\u4e00-\u9fa5])\s+(?=[\u4e00-\u9fa5])/g, '$1')
      .replace(/\r\n?/g, '\n');
  }

  var LABELS = {
    kwh: /充电量|充电度数|充电电量|电量|度数|kwh/i,
    cost: /实付|金额|费用|合计|应付|实收|价格/
  };

  /* 命中标签后，先取本行数字，本行没有再取下一行（版式常换行） */
  function findLabeled(lines, labelRe, valueRe) {
    for (var i = 0; i < lines.length; i++) {
      if (!labelRe.test(lines[i])) continue;
      var m = lines[i].match(valueRe);
      if (m) return { match: m, sameLine: true };
      if (i + 1 < lines.length) {
        var n = lines[i + 1].match(valueRe);
        if (n) return { match: n, sameLine: false };
      }
    }
    return null;
  }

  var OCR = {
    _worker: null,
    _loading: null,
    /* 测试注入点：校验脚本用假识别替代真引擎，避免下载与耗时 */
    _recognizeImpl: null,
    _prepareImpl: null,
    _progressCb: null,

    /* 能力检测：不支持就直接隐藏入口 */
    supported: function () {
      return typeof global.Worker === 'function' && typeof global.WebAssembly === 'object';
    },

    setProgressHandler: function (fn) { this._progressCb = fn; },

    _progress: function (m) {
      if (typeof this._progressCb === 'function') {
        try { this._progressCb(m); } catch (e) { /* 回调异常不影响识别 */ }
      }
    },

    /* 懒加载主线程 API 层（约 200KB），Promise 去重 */
    load: function () {
      if (global.Tesseract) return Promise.resolve();
      if (this._loading) return this._loading;
      var self = this;
      this._loading = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = VENDOR + 'tesseract.min.js';
        s.onload = function () { resolve(); };
        s.onerror = function () { self._loading = null; reject(new Error('OCR 引擎下载失败')); };
        document.head.appendChild(s);
      });
      return this._loading;
    },

    /* 创建 / 复用 Worker；引擎与语言包都在 Worker 内按需加载 */
    worker: function () {
      var self = this;
      if (this._worker) return Promise.resolve(this._worker);
      return this.load().then(function () {
        /* cacheMethod 'none'：不写 IndexedDB，语言包由 Service Worker 缓存 */
        self._worker = global.Tesseract.createWorker(LANG, 1, {
          workerPath: VENDOR + 'worker.min.js',
          workerBlobURL: false,
          corePath: VENDOR,
          langPath: VENDOR,
          gzip: true,
          cacheMethod: 'none',
          logger: function (m) { self._progress(m); }
        });
        return self._worker;
      });
    },

    /* 大图先降采样，避免识别时内存爆炸 */
    prepare: function (blob) {
      var self = this;
      if (this._prepareImpl) return this._prepareImpl(blob);
      if (!blob) return Promise.resolve(blob);
      if (typeof global.createImageBitmap !== 'function') return Promise.resolve(blob);
      return global.createImageBitmap(blob).then(function (bmp) {
        var w = bmp.width, h = bmp.height;
        var max = Math.max(w, h);
        if (max <= MAX_EDGE) { if (bmp.close) bmp.close(); return blob; }
        var scale = MAX_EDGE / max;
        var cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(w * scale));
        cv.height = Math.max(1, Math.round(h * scale));
        cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
        if (bmp.close) bmp.close();
        return new Promise(function (resolve) {
          cv.toBlob(function (b) { resolve(b || blob); }, 'image/jpeg', 0.9);
        });
      }).catch(function () { return blob; });
    },

    /* 底层识别：返回 { text, confidence } */
    recognize: function (blob) {
      var self = this;
      if (this._recognizeImpl) return this._recognizeImpl(blob);
      return this.worker().then(function (w) {
        return w.recognize(blob);
      }).then(function (r) {
        return {
          text: (r && r.data && r.data.text) || '',
          confidence: (r && r.data && r.data.confidence) || 0
        };
      });
    },

    /* 打开系统选图 → 降采样 → 识别 */
    pickAndRecognize: function () {
      var self = this;
      return new Promise(function (resolve, reject) {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none';
        input.onchange = function () {
          var file = input.files && input.files[0];
          if (input.parentNode) input.parentNode.removeChild(input);
          if (!file) { reject(new Error('已取消选择')); return; }
          resolve(file);
        };
        document.body.appendChild(input);
        input.click();
      }).then(function (file) {
        return self.prepare(file);
      }).then(function (blob) {
        return self.recognize(blob).then(function (r) {
          return { blob: blob, text: r.text, confidence: r.confidence };
        });
      });
    },

    /* ============================================================
     * 文本 → 字段候选
     * 每个字段：{ value, confidence, level, source, warn }
     *   level: high >= .85 / medium >= .65 / low < .65
     * 原则：上下文优先于数字；抽不准就不填（返回空值）。
     * ============================================================ */
    extractFields: function (text, pageConfidence) {
      var base = clamp01((Number(pageConfidence) || 80) / 100);
      var raw = normalize(text);
      var lines = raw.split('\n');
      var out = {};

      function mk(value, conf, source, warn) {
        conf = Math.round(clamp01(conf) * 100) / 100;
        return { value: value, confidence: conf, level: levelOf(conf), source: source || '', warn: warn || '' };
      }

      /* --- 充入电量 --- */
      var kwh = null;
      var kf = findLabeled(lines, LABELS.kwh, RE.kwh);
      /* 次级判定：整行同时含「充电」与电量单位时，也当作带标签 */
      if (!kf) {
        for (var li = 0; li < lines.length; li++) {
          if (/充电/.test(lines[li]) && RE.kwh.test(lines[li])) {
            kf = { match: lines[li].match(RE.kwh), sameLine: true };
            break;
          }
        }
      }
      if (kf) {
        var kv = toNum(kf.match[1]);
        var kc = base + 0.15 + (kf.sameLine ? 0.10 : 0.05);
        if (kv >= 1 && kv <= 200) kc += 0.10;
        else kc -= 0.30;
        kwh = mk(kv, kc, '标签', (kv < 1 || kv > 200) ? '电量超出常见范围（1–200 度）' : '');
      } else {
        var km = raw.match(RE.kwh);
        if (km) {
          var kv2 = toNum(km[1]);
          kwh = mk(kv2, base - 0.20 + ((kv2 >= 1 && kv2 <= 200) ? 0.10 : -0.30),
            '', '未找到「充电量」标签，请核对');
        }
      }
      if (kwh) out.kWh = kwh;

      /* --- 金额 --- */
      var cost = null;
      var cf = findLabeled(lines, LABELS.cost, RE.cost);
      if (cf) {
        var cv = toNum(cf.match[1]);
        var cc = base + 0.15 + (cf.sameLine ? 0.10 : 0.05);
        if (cv >= 0.5 && cv <= 500) cc += 0.10;
        else cc -= 0.30;
        cost = mk(cv, cc, '标签', (cv < 0.5 || cv > 500) ? '金额超出常见范围（0.5–500 元）' : '');
      } else {
        var cm = raw.match(RE.cost);
        if (cm) {
          var cv2 = toNum(cm[1]);
          cost = mk(cv2, base - 0.20 + ((cv2 >= 0.5 && cv2 <= 500) ? 0.10 : -0.30),
            '', '未找到「实付 / 金额」标签，请核对');
        }
      }
      if (cost) out.totalCost = cost;

      /* --- 单价交叉校验：度数与金额互相印证 --- */
      if (kwh && cost && kwh.value > 0 && cost.value > 0) {
        var price = cost.value / kwh.value;
        if (price < 0.5 || price > 3.0) {
          [kwh, cost].forEach(function (f) {
            f.confidence = Math.round(clamp01(f.confidence - 0.30) * 100) / 100;
            f.level = levelOf(f.confidence);
            f.warn = '单价异常 ¥' + price.toFixed(2) + '/度，请核对';
          });
        } else {
          [kwh, cost].forEach(function (f) {
            f.confidence = Math.round(clamp01(f.confidence + 0.15) * 100) / 100;
            f.level = levelOf(f.confidence);
          });
        }
      }

      /* --- 日期：缺省不报错，只有时分则默认今天并明示 --- */
      var dm = raw.match(RE.date);
      if (dm) {
        var mo = parseInt(dm[2], 10), dd = parseInt(dm[3], 10);
        if (mo >= 1 && mo <= 12 && dd >= 1 && dd <= 31) {
          out.date = mk(dm[1] + '-' + pad2(mo) + '-' + pad2(dd), base + 0.15, '截图', '');
        }
      }
      if (!out.date && RE.time.test(raw)) {
        out.date = mk(todayStr(), base, '默认今天', '未识别到日期，已默认今天');
      }

      /* --- SOC 前后：默认不识别；命中也只作候选，最高 medium --- */
      var sm = raw.match(RE.soc);
      if (sm) {
        var cap = Math.min(base + 0.10, 0.8);
        out.socBefore = mk(parseInt(sm[1], 10), cap, '截图', 'SOC 建议以车辆 App 为准，请核对');
        out.socAfter = mk(parseInt(sm[2], 10), cap, '截图', 'SOC 建议以车辆 App 为准，请核对');
      }

      /* --- 可选：时长 / 站点（仅输出，不自动填入） --- */
      var dur = raw.match(RE.duration);
      if (dur) out.duration = { value: dur[1] + dur[2], confidence: base, level: levelOf(base), source: '截图', warn: '' };
      var st = raw.match(RE.site);
      if (st) out.site = { value: st[1], confidence: base, level: levelOf(base), source: '截图', warn: '' };

      return out;
    },

    /* ============================================================
     * 预填现有表单
     *   high / medium → 填入；带 warn 的字段同时描红，提示核对
     *   low            → 不填值，只描红
     * 返回 { warned: [...], firstCore: 'cf_xxx' | null }
     * ============================================================ */
    annotateDom: function (fields) {
      var App = global.App;
      if (!fields) return { warned: [], firstCore: null };
      var map = [
        ['kWh', 'cf_kWh'],
        ['totalCost', 'cf_totalCost'],
        ['date', 'cf_date'],
        ['socBefore', 'cf_socBefore'],
        ['socAfter', 'cf_socAfter']
      ];
      var core = { kWh: 1, totalCost: 1, date: 1 };
      var warned = [];
      var firstCore = null;

      map.forEach(function (pair) {
        var f = fields[pair[0]];
        var el = document.getElementById(pair[1]);
        if (!el) return;
        if (!f || f.value === null || f.value === undefined || f.value === '') return;

        var bad = (f.level === 'low') || !!f.warn;
        if (f.level === 'low') {
          /* 低置信：不填值，只描红 */
          if (App && App.markInvalid) App.markInvalid(pair[1]);
          warned.push(pair[0]);
          if (core[pair[0]] && !firstCore) firstCore = pair[1];
          return;
        }

        el.value = (pair[0] === 'date') ? f.value : String(f.value);
        if (bad) {
          if (App && App.markInvalid) App.markInvalid(pair[1]);
          warned.push(pair[0]);
          if (core[pair[0]] && !firstCore) firstCore = pair[1];
        }
      });

      if (firstCore) {
        var el = document.getElementById(firstCore);
        if (el && el.focus) el.focus();
      }
      return { warned: warned, firstCore: firstCore };
    },

    /* 释放 Worker（WASM 内存）；不写任何持久存储 */
    dispose: function () {
      if (this._worker && this._worker.terminate) {
        try { this._worker.terminate(); } catch (e) { /* 忽略 */ }
      }
      this._worker = null;
    }
  };

  global.OCR = OCR;
})(typeof window !== 'undefined' ? window : this);
