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
  var MAX_EDGE = 2048;   // 长边上限：超过则降采样
  var MIN_EDGE = 1350;   // 长边下限：低于则放大（实测 900→1350 完全恢复）
  var MAX_UPSCALE = 3;   // 单次最大放大倍数，避免极端小图撑爆内存
  var PSM_AUTO = '3';    // Tesseract AUTO 分栏，避免默认 SINGLE_BLOCK(6)

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
  /* 标签与数值之间的空白一律用 [^\S\r\n]（非换行空白），
     否则 \s 会跨行，把「充电费用」标题和下一行的度数粘在一起。 */
  var RE = {
    /* 充入电量：数字 + 单位，单位可有可无地紧跟 */
    kwh: /(\d+(?:[.,]\d+)?)[^\S\r\n]*(度|kwh|千瓦时|kw\.?[ \t]?h)/i,
    /* 金额：优先「实付」等标签；兼容 OCR 把 ¥ 读成 Y、标签被拆出空格的情况 */
    cost: /(?:¥|￥|Y|实付|金额|费用|合计|应付|实收|价格)[ \t]*[:：]?[ \t]*(?:¥|￥|Y)?[ \t]*(\d{1,3}(?:[,，]\d{3})+(?:\.\d{1,2})?|\d+[.,]\d{1,2}|\d+)/,
    /* 完整日期 */
    date: /(\d{4})[^\S\r\n]*[-/年.][^\S\r\n]*(\d{1,2})[^\S\r\n]*[-/月.][^\S\r\n]*(\d{1,2})/,
    /* 仅时分 */
    time: /(\d{1,2})[^\S\r\n]*[:：][^\S\r\n]*(\d{2})/,
    /* SOC 前后：默认不识别，命中只作候选 */
    soc: /(\d{1,3})[^\S\r\n]*%[^\S\r\n]*(?:→|至|-|~|—|－)[^\S\r\n]*(\d{1,3})[^\S\r\n]*%/,
    /* 可选：时长 / 站点 */
    duration: /(\d+(?:\.\d+)?)[^\S\r\n]*(分钟|min|小时|h)/i,
    site: /(站点|充电桩|充电站|运营商)/
  };

  /* 金额数字 token：千分位 > 小数 > 整数，避免截断 */
  var NUM_RE = /\d{1,3}(?:[,，]\d{3})+(?:\.\d{1,2})?|\d+[.,]\d{1,2}|\d+/;
  var MONEY_RE = NUM_RE;

  /* 标签优先级：总额类 > 金额/费用类 */
  var COST_TIERS = [
    /应付|实付|合计|总额|小计|总价|实收/,
    /金额|费用|价格|充电费/
  ];

  /* 金额数值清洗：兼容千分位逗号、OCR 把小数点读成逗号 */
  function parseMoney(s) {
    s = String(s == null ? '' : s).trim();
    if (!s) return 0;
    s = s.replace(/(\d)[.,](\d{3})(?!\d)/g, '$1$2');   // 千分位
    s = s.replace(/(\d)[.,](\d{1,2})(?!\d)/g, '$1.$2'); // 小数
    var n = parseFloat(s.replace(/[^\d.]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  /* 标签行内、标签之后的首个数字；本行没有则看下一行（版式常换行）。
     下一行含电量单位时跳过——「充电费用」标题的下一行常是「35.698 度」。 */
  function findLooseCost(lines) {
    for (var t = 0; t < COST_TIERS.length; t++) {
      var tier = COST_TIERS[t];
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (!tier.test(line)) continue;
        var idx = line.search(tier);
        var m = line.slice(idx).match(MONEY_RE);
        if (m) return { raw: m[0], sameLine: true };
        if (i + 1 < lines.length) {
          var nxt = lines[i + 1];
          if (/度|kwh|千瓦时/i.test(nxt)) continue;
          var n = nxt.match(MONEY_RE);
          if (n) return { raw: n[0], sameLine: false };
        }
      }
    }
    return null;
  }

  /* HEIC 文件头：ISO-BMFF 的 ftyp box + brand */
  function isHeicBuffer(buf) {
    var b = new Uint8Array(buf);
    if (b.length < 12) return false;
    if (String.fromCharCode(b[4], b[5], b[6], b[7]) !== 'ftyp') return false;
    var brand = String.fromCharCode(b[8], b[9], b[10], b[11]).toLowerCase();
    return /^(heic|heix|hevc|hevx|heif|heim|heis|hevm|hevs|mif1|msf1)$/.test(brand);
  }

  function readHead(blob, n) {
    return new Promise(function (resolve, reject) {
      if (typeof blob.arrayBuffer === 'function') {
        blob.slice(0, n).arrayBuffer().then(resolve, reject);
        return;
      }
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = reject;
      fr.readAsArrayBuffer(blob.slice(0, n));
    });
  }

  /* 汉字之间常被 OCR 插入空格（如「实 付」），先归一化再匹配。
     必须逐行处理：\s 会跨行，把「充电费用」标题和下一行的度数粘成一行。 */
  function normalize(text) {
    var lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    for (var i = 0; i < lines.length; i++) {
      lines[i] = lines[i].replace(/([\u4e00-\u9fa5])[ \t]+(?=[\u4e00-\u9fa5])/g, '$1');
    }
    return lines.join('\n');
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
    _workerPromise: null,
    _loading: null,
    /* 测试注入点：校验脚本用假识别替代真引擎，避免下载与耗时 */
    _recognizeImpl: null,
    _prepareImpl: null,
    _createWorkerImpl: null,
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
        s.onerror = function () {
          self._loading = null;
          var e = new Error('OCR 引擎下载失败');
          e.code = 'OCR_LOAD';
          reject(e);
        };
        document.head.appendChild(s);
      });
      return this._loading;
    },

    /* 创建 / 复用 Worker；引擎与语言包都在 Worker 内按需加载 */
    worker: function () {
      var self = this;
      if (this._worker) return Promise.resolve(this._worker);
      if (this._workerPromise) return this._workerPromise;

      var p = this.load().then(function () {
        var factory = self._createWorkerImpl || function () {
          /* cacheMethod 'none'：不写 IndexedDB，语言包由 Service Worker 缓存 */
          return global.Tesseract.createWorker(LANG, 1, {
            workerPath: VENDOR + 'worker.min.js',
            workerBlobURL: false,
            corePath: VENDOR,
            langPath: VENDOR,
            gzip: true,
            cacheMethod: 'none',
            logger: function (m) { self._progress(m); }
          });
        };
        return factory();
      }).then(function (w) {
        /* 创建期间被 dispose 取消：不要写回 _worker */
        if (self._workerPromise !== p) return w;
        /* 显式 AUTO(3)。Tesseract.js 默认 SINGLE_BLOCK(6) 会把整页当单块，
           导致标签与数值粘连（¥ 被读成 x）、金额正则失效。 */
        var sp = (w && typeof w.setParameters === 'function')
          ? w.setParameters({ tessedit_pageseg_mode: PSM_AUTO })
          : Promise.resolve();
        return Promise.resolve(sp).catch(function () { /* 参数设置失败不阻断识别 */ })
          .then(function () {
            self._worker = w;   /* 存真实 Worker，不再是 Promise */
            return w;
          });
      }).catch(function (e) {
        if (self._workerPromise === p) self._workerPromise = null;
        if (!e || !e.message) {
          /* Tesseract.js 加载语言包失败时 reject undefined，转成可分类错误 */
          var err = new Error('识别引擎或语言包加载失败');
          err.code = 'OCR_LOAD';
          throw err;
        }
        if (!e.code) e.code = 'OCR_LOAD';
        throw e;
      });

      this._workerPromise = p;
      return p;
    },

    /* 长边 < MIN_EDGE 放大；> MAX_EDGE 降采样；区间内原样返回，避免无谓重编码 */
    prepare: function (blob) {
      if (this._prepareImpl) return this._prepareImpl(blob);
      if (!blob) return Promise.resolve(blob);
      if (typeof global.createImageBitmap !== 'function') return Promise.resolve(blob);
      return global.createImageBitmap(blob).then(function (bmp) {
        var w = bmp.width, h = bmp.height;
        var long = Math.max(w, h);
        var scale = 1;
        if (long < MIN_EDGE) scale = Math.min(MIN_EDGE / long, MAX_UPSCALE);
        else if (long > MAX_EDGE) scale = MAX_EDGE / long;
        if (scale === 1) { if (bmp.close) bmp.close(); return blob; }

        var nw = Math.max(1, Math.round(w * scale));
        var nh = Math.max(1, Math.round(h * scale));
        var cv = document.createElement('canvas');
        cv.width = nw;
        cv.height = nh;
        cv.getContext('2d').drawImage(bmp, 0, 0, nw, nh);
        if (bmp.close) bmp.close();
        return new Promise(function (resolve) {
          cv.toBlob(function (b) { resolve(b || blob); }, 'image/jpeg', 0.9);
        });
      }).catch(function () { return blob; });
    },

    /* HEIC 检测：Tesseract 无法解码 HEIC，提前拦下给出可操作提示 */
    isHeic: function (blob) {
      if (!blob) return Promise.resolve(false);
      if (/^image\/(heic|heif)$/i.test(blob.type || '')) return Promise.resolve(true);
      if (typeof blob.slice !== 'function') return Promise.resolve(false);
      return readHead(blob, 32).then(isHeicBuffer).catch(function () { return false; });
    },

    checkImage: function (blob) {
      return this.isHeic(blob).then(function (heic) {
        if (heic) {
          var e = new Error('截图是 HEIC 格式，请改用 PNG 或 JPG 截图');
          e.code = 'OCR_HEIC';
          throw e;
        }
        return blob;
      });
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

    /* 只打开系统选图，拿到原图后立即 resolve；取消则 reject */
    pickImage: function () {
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
      });
    },

    /* 选图 → 降采样 → 识别 */
    pickAndRecognize: function () {
      var self = this;
      return this.pickImage().then(function (file) {
        return self.checkImage(file);
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
        var cv = parseMoney(cf.match[1]);
        var cc = base + 0.15 + (cf.sameLine ? 0.10 : 0.05);
        if (cv >= 0.5 && cv <= 500) cc += 0.10;
        else cc -= 0.30;
        cost = mk(cv, cc, '标签', (cv < 0.5 || cv > 500) ? '金额超出常见范围（0.5–500 元）' : '');
      } else {
        /* 宽松兜底：标签被 OCR 插入空格 / ¥ 被读成 x 时，取标签后的数字 */
        var loose = findLooseCost(lines);
        if (loose) {
          var lv = parseMoney(loose.raw);
          var lc = base + 0.05 + (loose.sameLine ? 0.10 : 0.05);
          if (lv >= 0.5 && lv <= 500) lc += 0.10;
          else lc -= 0.30;
          cost = mk(lv, lc, '标签', '金额由标签附近数字推断，请核对');
        } else {
          var cm = raw.match(RE.cost);
          if (cm) {
            var cv2 = parseMoney(cm[1]);
            cost = mk(cv2, base - 0.20 + ((cv2 >= 0.5 && cv2 <= 500) ? 0.10 : -0.30),
              '', '未找到「实付 / 金额」标签，请核对');
          }
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
      this._workerPromise = null;
      var w = this._worker;
      this._worker = null;
      if (w && typeof w.terminate === 'function') {
        try { w.terminate(); } catch (e) { /* 忽略 */ }
      }
    }
  };

  global.OCR = OCR;
})(typeof window !== 'undefined' ? window : this);
