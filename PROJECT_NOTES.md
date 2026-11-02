# 冲充电 —— 项目说明（本地协作指引）

> 本文档用于在本地环境中引导对项目的理解与继续开发。它基于当前代码（`main` 分支 HEAD，未含尚未推送的「数据口径修正」提交，见 [§7 待办](#7-当前状态与待办)）。
> 后续在 Trae / TraeWork 本地对话中，可直接引用本文档章节理解结构与规则。

---

## 1. 项目是什么

一款**纯前端 PWA** 的新能源电车充电记录与统计分析工具，名为「冲充电」。

- **核心目标**：记录每次充电的度数、花费、充电方式（慢充/快充），并自动统计分析充电成本、百公里电耗、电池健康度，给出省钱的充电习惯建议。
- **形态**：无后端、无构建步骤。数据全部存在浏览器 `localStorage`，可选择同步到 GitHub 私有 Gist 做备份/换机恢复。
- **运行环境**：手机优先的单页应用，支持加到主屏离线使用。

主要能力：多车辆管理、充电记录增删改、成本统计、月度/年度趋势、百公里电耗、电池容量与健康度分析、充电习惯评分（深充/过充/快充比例）、云同步备份。

---

## 2. 部署形态与访问

项目是一个 GitHub Pages 静态站点，实际线上地址：

```
https://pers1e20.github.io/chongchongdian/index.html
```

- 部署目标仓库：`pers1e20/chongchongdian`（`app/` 目录内容即站点的根目录文件）。
- 所有文件为静态 HTML/JS/CSS/PNG，推送 `app/` 内文件到仓库即完成部署，无需构建。
- 注意：作为 PWA，**线上用户可能命中 Service Worker 缓存**。每次改动必须**同步 bumped `sw.js` 中的 `CACHE_NAME` 版本号**（当前 `ev-charging-v38`），否则用户看不到更新。

---

## 3. 目录结构与职责

项目文件全部位于 `app/` 目录下：

| 文件 | 职责 |
|---|---|
| `index.html` | 入口页，仅做 302 跳转到 `charging-tracker.html`（保留 search/hash） |
| `charging-tracker.html` | 主页面骨架 + 全部 CSS（内联 `<style>`，深色科幻风格） |
| `charging-tracker.js` | **数据与逻辑主文件**（约 1700+ 行，单文件应用核心） |
| `sw.js` | Service Worker：缓存核心资源实现离线、控制版本更新 |
| `manifest.json` | PWA 清单（名称、主题色、图标） |
| `charging-tracker.js` 不引外部库 | 全部原生 JS，无依赖 |

静态资源：
| 路径 | 用途 |
|---|---|
| `icon-*.png` / `icon-maskable-*.png` | PWA 图标 |
| `assets/logo.png` | Logo |
| `assets/hero-empty.png` | 首页空状态 |
| `assets/stats-empty.png` | 分析页空状态 |
| `assets/ambient-bg.png` | 环境背景 |
| `assets/battery-icons.png` | 电池图标 |

---

## 4. 代码结构（`charging-tracker.js`）

单文件 IIFE，按节组织，主要模块：

| 区域（近似行号） | 模块 / 变量 | 职责 |
|---|---|---|
| 1-19 | 常量 | `STORAGE_KEY`（`ev_charging_data_v1`）、`CHARGE_TYPE`、`HEALTH_CONFIG` |
| 21-58 | `Icons` | 内存 SVG 图标库 |
| 60-117 | `Store` | 数据层：load/save/导出/导入/清空（localStorage） |
| 119-260 | `Sync` | 云同步：私有 Gist 备份、自动推拉、比对合并 |
| ~260-360 | `VehicleMgr` | 车辆管理（增删改、当前车辆、标称容量） |
| ~360-520 | `ChargeMgr` | 充电记录管理 + `Stats` 系列计算函数（见 §5） |
| ~520-610 | `BatteryHealth` | 电池健康度 / 容量估算 |
| ~610-1000 | `App` | UI 渲染、标签导航、事件绑定、表单、图表 |
| ~1000+ | `Habit` / 引导 | 习惯评分、初始化种子数据 |
| 末尾 | 启动 | 加载数据、渲染、注册 SW、恢复习惯 |

**数据结构**（`Store.data`）：
```js
{
  vehicles: [
    { id, name, batteryCapacity } // batteryCapacity: 标称容量(度)，如 智己 L6 = 75
  ],
  charges: [
    { id, vehicleId, date,
      type: 'slow'|'fast',   // 充电方式
      kWh, cost,             // 充入度数、花费
      odometer,              // 表显里程（公里）
      socBefore, socAfter }  // 充电前 / 后电量百分比
  ],
  settings: { currentVehicleId }
}
```

---

## 5. 关键计算口径（重要，判断数据是否正确前必读）

这些公式是此前一次"数据口径校正"的核心，本地继续开发时务必遵守：

### 5.1 平均电耗（百公里电耗，度/100km）

- **规则 A（两点区间）**：必须**相邻两次都记录有效里程**且递增（`odometer` 后一次 > 前一次）才构成电耗区间。单点读取永远不算。
- **规则 B（完整性）**：两次里程点之间若夹有缺里程 / 缺记录的条目，该区间**不可靠，自动剔除**（不假设"0 → 新里程"这种假距离）。
- **规则 D（样本门槛）**：有效电耗样本 **≥ 3 组**才给出均值，否则界面显示「数据不足」，不得用 1–2 条数据冒充结论。
- 公式：`电耗 = (本次区间充入度数 ÷ 里程差) × 100`。

> 经验参照（类似小熊油耗）：只有记录了两笔带里程的数据、且区间内充电记录完整，才估算区间耗电；漏记中间充电会被主动识别。

### 5.2 电池容量分析

- 单次估算：`实测容量 = 充入度数 ÷ (SOC后 − SOC前) × 100`；仅当 SOC 差 ≥ 30% 才纳入。
- **规则 C（物理护栏）**：估算容量必须落在 `[标称 × 0.7, 标称 × 1.08]` 内才算有效，超上限（如 75 度车算到 78+）和异常偏低的样本都**剔除**，不污染中位数。
- 入选样本取**近 5 次中位数**作为"当前容量"，用于监控真实老化趋势。
- **规则 D**：有效样本 ≥ 3 组才给结论，否则显示「数据不足请继续补录」。
- 物理约束：电池只会衰减、不会越过标称增长。此刻 75 度车若出现 78 度 → 判定为读数偏差，不应直接展示。

### 5.3 电池健康度（综合）

`HEALTH_CONFIG`：
```js
{
  deepDischargeThreshold: 20,  // <20% 视为深放
  overChargeThreshold: 90,     // >90% 视为过充
  fastChargeHabitRatio: 0.5,   // 快充占比阈值
  capacityWarningRatio: 0.85   // 容量保持率低于 85% 提示
}
```
健康指数 = 容量保持率（实测容量 / 标称）× 权重 + 充电习惯得分，逐维度给出 优秀 / 良好 / 需关注。

### 5.4 习惯评分

分别对深放电频率、过充频率、快充占比打分，合计为充电习惯评分，附建议文案。

### 5.5 云同步口径

见 `Sync` 与「我的→数据同步」：写私有 Gist 单文件 `ev-charging-backup.json`；比较本地与云端修改时间，**谁新用谁**（后写者胜，不做逐字段合并）。配置与令牌存于 `localStorage`（`ev_sync_cfg_v1`），请求头带 `Authorization: Bearer <token>`。

---

## 6. 本地如何运行 / 调试

项目无构建步骤，任选其一：

```bash
# 方式一：直接静态服务器
cd app
python3 -m http.server 8000
# 打开 http://localhost:8000/index.html

# 方式二：任意静态托管（GitHub Pages / nginx 都行），文件原样上传即可
```

- 本地调试注意：同步功能需要真正的网络与有效令牌，本地可用开发者工具模拟移动端。
- 清空数据重测：浏览器控制台执行后将 `localStorage.removeItem('ev_charging_data_v1')` 后刷新可回到种子示例数据（方便验证计算口径，例如制造"两条带里程记录"来触发电耗区间）。

---

## 7. 当前状态与待办

> 本节状态更新于 2026-09-13（本地会话，已在本地验证口径代码）。

- ✅ 已完成的近期改动（本地已 commit，提交信息见 `git log`）：统一首页光影效果、压缩卡片高度、删冗余文案、系统返回支持、图表居中、玻璃质感等，SW 已 bump。
- ✅ **「数据口径修正」代码已本地核验**（commit `a346894`，SW `v38`）：与 §5 口径逐条对照 + 14 项 Node 断言全部通过——缺里程打断区间（规则 B）、样本 <3 显示「数据不足」（规则 D）、容量护栏 `[0.7,1.08]×标称` 剔除超限（规则 C）、SOC 差 <30% 不计入、无标称不启护栏等。
- ⏳ **仍未推送**：commit `a346894` 在本地 `main` 上尚未 push 到 `origin/main`。原因：本机 git 无 GitHub 凭据（无 PAT、无 `gh` CLI、keychain 无条目），且 GitHub 插件连接器的 MCP server 需在**新开的会话**中才会加载（授权时提示「Start a new conversation before retrying this service」）。
- 🔑 部署路径任选其一：(1) 新开一个会话，用已授权的 GitHub 插件推送；(2) 提供一枚带 `repo`/Contents:Write 权限的 GitHub PAT，配置 git 凭据后立即推送。
- 💣 安全提醒：过往令牌已明文出现在对话中，建议去 GitHub 后台撤销并轮换；同步用令牌应只给 `gist` 最小权限并定期更换；部署令牌与同步令牌分开管理。

---

## 8. 给本地 AI 协作者的操作约定

- 改动周期性、UI/表现类内容集中在 `charging-tracker.html` 的 `<style>`；逻辑与数据在 `charging-tracker.js`。
- **任何改动若涉及用户可见结果，必须同步 bump `sw.js` 的 `CACHE_NAME`**，否则线上灰屏/旧版。
- 修改计算规则前，先对照 §5 的正确口径，避免再出现"单条数据出电耗 / 容量超物理上限"类问题。
- 部署 = 推送 `app/` 内容到 `pers1e20/chongchongdian` 的 `main`。