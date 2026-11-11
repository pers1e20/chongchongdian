# 冲充电

新能源电车充电记账与电池健康分析工具，纯前端 PWA（零构建、无后端，数据存在浏览器本地）。

## 线上使用

**https://pers1e20.github.io/chongchongdian/**（GitHub Pages，推送 `main` 即发布）

手机打开后「分享 → 添加到主屏幕」，之后像 App 一样全屏打开，断网也能用（Service Worker 已做 network-first + 离线回落）。

> 数据按域名隔离。从 `localhost` 换到线上地址时历史记录**不会自动跟过来**：先在旧页面「设置 → 导出数据」，再到新地址「导入」。

## 目录

- `app/`：完整源码，可直接运行，无构建步骤。
- `HANDOFF.md`：产品需求、功能地图、数据模型、计算口径、代码地图与已知坑（改代码前先读）。
- `docs/design-system.html`：设计规范可视化版（可切浅/深）——令牌、字阶、材质、组件、页面线框。
- `docs/design-system.md`：设计规范摘要，改界面前先看这份。
- `docs/style-audit.py`：样式自检（颜色字面量 / 未走令牌的光影与模糊 / 类名覆盖 / 对比度）。
- `docs/screenshots/v2.4/`：当前设计在浅/深两套主题下的关键界面截图。
- `docs/changes-and-todo.html`：上一轮改造记录（数据修正、结构重排、P2 视觉）。
- `docs/click-audit.py`、`docs/mobile-check.mjs`、`docs/flow-check.mjs`：改完必跑的三个校验脚本（点击目标存在性、375/414/768 视口检查、真实点击流程）。
- `docs/*-proposal.html`、`docs/smartisan-*`、`docs/设计规范.md`、`docs/部署规则.md`：历史设计提案与规范，仅作参考，**不代表当前界面**。

## 本地运行

```bash
cd app
python3 -m http.server 8000
# 打开 http://localhost:8000

```

推荐直接打开 `http://localhost:8000/charging-tracker.html`（`/` 会跳转过去）。

## 部署到 GitHub Pages

纯静态站点，零构建，`app/` 即站点目录。仓库 `pers1e20/chongchongdian` 推送 `main` 即发布，GitHub Pages 自动构建；根 `index.html` 会自动跳转到 `app/charging-tracker.html`。

```bash
git push origin main
```

**注意**

- 站点无内容哈希，Service Worker 已做 network-first（2 秒超时回落缓存），发版即可见新版。
- GitHub Pages 国内访问速度一般；若面向国内且要稳定访问，可绑自定义域名 + 国内 CDN，或改用国内静态托管（如腾讯云 EdgeOne Pages / CloudBase）。
- 换域名后 localStorage 数据不跟随，需要「旧页面导出 → 新地址导入」。

## 数据

- 单一存储键：`localStorage['ev_charging_data_v1']`，结构不得随意更改，否则已有记录会读不出来。
- **首次启动自动写入基础数据**：智己 L6（75 kWh / 最大 153 kW）+ 33 条 2026-05-30 ~ 2026-10-18 的历史记录，数据在 `app/seed-data.js`。3 条 ¥0 慢充按免费计入。
- 已有数据时不会自动写入；用「设置 → 数据 → 载入基础数据」按 日期+度数+金额 去重追加，不覆盖现有记录。
- 导入会先自动快照到 `ev_backup_preimport_v1`，设置页可一键恢复。
- 想彻底重来：设置 → 清空所有数据；或同时删除 `ev_charging_data_v1` 与 `ev_seed_v1` 再刷新（只删前者会按首次安装重新种入基础数据）。

## 约束

- 保持零构建：单个 HTML + 单个 JS + 原生 JS，不引入框架/打包器/CDN 依赖。
- **§5 计算口径不要动**（HANDOFF.md 有完整定义），改了历史数据的统计结果会前后不一致。
- 视觉按 `docs/design-system.md` 执行：浅/深双主题、中性光玻璃、控制层强 / 内容层弱；光影与模糊必须走令牌。
- 改完样式跑 `python3 docs/style-audit.py`；改完交互跑 `python3 docs/click-audit.py` 与 `node docs/flow-check.mjs`；改完布局跑 `node docs/mobile-check.mjs`。
- 数据结构与计算口径优先保留。
# 冲充电

新能源电车充电记账与电池健康分析工具，纯前端 PWA（零构建、无后端，数据存在浏览器本地）。

## 线上使用

**https://pers1e20.github.io/chongchongdian/**

手机打开后「分享 → 添加到主屏幕」，之后像 App 一样全屏打开，断网也能用（Service Worker 已做 network-first + 离线回落）。

> 数据按域名隔离。从 `localhost` 换到线上地址时历史记录**不会自动跟过来**：先在旧页面「设置 → 导出数据」，再到新地址「导入」。

## 目录

- `app/`：完整源码，可直接运行，无构建步骤。
- `HANDOFF.md`：产品需求、功能地图、数据模型、计算口径、代码地图与已知坑（改代码前先读）。
- `docs/changes-and-todo.html`：最近一轮改造记录（改了什么 / 怎么用 / 任务体系 / 真机待验清单）。
- `docs/click-audit.py`、`docs/mobile-check.mjs`：改完必跑的两个校验脚本（点击目标存在性、375/414/768 视口检查）。
- `docs/*-proposal.html`、`docs/smartisan-*`、`docs/设计规范.md`、`docs/部署规则.md`：历史设计提案与规范，仅作参考，**不代表当前界面**。

## 本地运行

```bash
cd app
python3 -m http.server 8000
# 打开 http://localhost:8000
```

推荐直接打开 `http://localhost:8000/charging-tracker.html`（`/` 会跳转过去）。

## 数据

- 单一存储键：`localStorage['ev_charging_data_v1']`，结构不得随意更改，否则已有记录会读不出来。
- **首次启动是空态**，不再写入示例车与示例记录；按页面引导添加车辆即可。
- 导入会先自动快照到 `ev_backup_preimport_v1`，设置页可一键恢复。
- 想彻底重来：`localStorage.removeItem('ev_charging_data_v1')` 后刷新。

## 约束

- 保持零构建：单个 HTML + 单个 JS + 原生 JS，不引入框架/打包器/CDN 依赖。
- **§5 计算口径不要动**（HANDOFF.md 有完整定义），改了历史数据的统计结果会前后不一致。
- 部署与视觉规范属于“现状参考”，可直接迭代；数据结构与计算口径优先保留。
