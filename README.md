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
