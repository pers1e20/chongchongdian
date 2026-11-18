# OCR 引擎（本地内置）

截图识别功能使用的端侧 OCR 引擎与语言包，全部本地化，**不访问任何外部服务**。

## 来源与版本

| 文件 | 来源 | 版本 |
| :-- | :-- | :-- |
| `tesseract.min.js` | https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js | 5.1.1 |
| `worker.min.js` | https://unpkg.com/tesseract.js@5.1.1/dist/worker.min.js | 5.1.1 |
| `tesseract-core*.wasm.js` | https://unpkg.com/tesseract.js-core@5.1.1/ | 5.1.1 |
| `chi_sim.traineddata.gz` | https://tessdata.projectnaptha.com/4.0.0_fast/chi_sim.traineddata.gz | tessdata_fast 4.0.0 |

## 重新获取

```bash
cd app/vendor/tesseract
V=5.1.1
curl -sSL -o tesseract.min.js        https://unpkg.com/tesseract.js@$V/dist/tesseract.min.js
curl -sSL -o worker.min.js           https://unpkg.com/tesseract.js@$V/dist/worker.min.js
curl -sSL -o tesseract-core.wasm.js  https://unpkg.com/tesseract.js-core@$V/tesseract-core.wasm.js
curl -sSL -o tesseract-core-simd.wasm.js       https://unpkg.com/tesseract.js-core@$V/tesseract-core-simd.wasm.js
curl -sSL -o tesseract-core-lstm.wasm.js       https://unpkg.com/tesseract.js-core@$V/tesseract-core-lstm.wasm.js
curl -sSL -o tesseract-core-simd-lstm.wasm.js  https://unpkg.com/tesseract.js-core@$V/tesseract-core-simd-lstm.wasm.js
curl -sSL -o chi_sim.traineddata.gz  https://tessdata.projectnaptha.com/4.0.0_fast/chi_sim.traineddata.gz
gzip -t chi_sim.traineddata.gz   # 校验完整性
```

四个 core 都要保留：Worker 会按设备 SIMD 支持情况自动选择其中一个。

## 为什么用 fast 语言包

`chi_sim` 有三个版本：`4.0.0_best`（约 12MB）、`4.0.0`（约 20MB）、`4.0.0_fast`（约 1.7MB）。这里选 **fast**：

- **体积**：1.7MB vs best 12MB，移动端首次下载门槛低得多（12MB 在移动网下容易超时）。
- **实测更快更准**：同一张充电账单截图、同 PSM 3，fast 整页置信度 76 / 670ms，best 75 / 970ms，且 fast 的文本没有大量汉字间插空格。
- **内存**：解压后占用更小，移动端 WASM 内存压力更低。

若将来发现某些截图在 fast 下精度不足，回退方式：把 URL 换回 `4.0.0_best` 并重新下载，同时把 `app/sw.js` 的 `CACHE_NAME` 递增一位（否则 cache-first 仍返回 fast 包）。

## 加载方式

- 引擎与语言包**不进入** Service Worker 的 `CORE_ASSETS` 预缓存清单，避免首屏强制下载。
- 首次点击「截图识别」时由 `app/ocr.js` 懒加载；`app/sw.js` 对 `/vendor/tesseract/` 走 cache-first，下载后离线也可用。
- 合计约 6MB（语言包 1.7MB + 设备对应 core 3.9–4.7MB + 两个 js 约 0.2MB）。
- 主线程只加载 `tesseract.min.js`（约 200KB），识别计算在 Web Worker 内完成。

## 隐私

截图仅在浏览器本地识别，**不上传、不写 localStorage / IndexedDB**；识别结束终止 Worker 并释放原图引用。

## 许可

见 `LICENSE.txt`。
