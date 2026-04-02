# GoldenHeat V2.1 执行计划 (Heat2)

> 目标：首页从"数字面板"升级为"宏观位置感面板"
> 预估：3-4 天（AI 节奏）
> 基于：Steven 需求 + Lisa 产品建议（2026-04-02）

---

## 当前状态

| 模块 | 状态 | 问题 |
|------|------|------|
| 美林时钟 | ✅ 可用 | 缺数据溯源展示 |
| 市场温度 | ⚠️ 有数字无历史 | 需要估值百分位+10年趋势 |
| 牛熊分界 | ⚠️ 只有当前状态 | 需要10年月线趋势图 |
| 月线信号 | ✅ 基本可用 | 缺"上月变化"对比 |
| 估值数据 | ❌ valuation表为空 | 需要回填10年PE/PB |
| 投资哲学 | ❌ 不存在 | 需要新增 |
| 数据溯源 | ❌ 不存在 | 需要新增 |

---

## Phase 分解（5 步，严格顺序）

### Step 1: 数据层 — 估值百分位回填 🔴 最高优先

**目标**：valuation 表灌入 10 年 PE/PB 数据，计算百分位

**后端任务**：
1. 新建 `backend/collectors/valuation.py`
   - 用 akshare 拉取 A股/港股指数 PE/PB（`stock_zh_index_value_csindex` 等）
   - 用 yfinance + 手算拉取美股指数/个股 PE（market cap / earnings）
   - BTC 无 PE，用 MVRV 或跳过
2. 新建 `backend/scripts/backfill_valuation.py`
   - 回填 2016-01 ~ 2026-04 月度 PE/PB（与 monthly_kline 同起点）
   - 计算滚动 10 年百分位写入 `pe_percentile` / `pb_percentile`
3. 更新 `backend/engines/temperature.py`
   - pe_score 改为使用真实 PE 百分位（目前用价格历史分位数近似）

**数据源映射**：
| 标的 | PE 来源 | 备注 |
|------|---------|------|
| 000001.SS | akshare `stock_zh_index_value_csindex` | 上证综指 |
| ^GSPC | yfinance / FRED CAPE | 标普500 |
| ^HSI | akshare 港股通估值 | 恒生指数 |
| NVDA/TSLA/MSFT | yfinance `.info["trailingPE"]` + 历史 | 个股 |
| 0700.HK/9988.HK | yfinance | 个股 |
| BTC-USD | 跳过 PE，只用 MA 百分位 | 无盈利概念 |

**验收**：`SELECT count(*), min(date), max(date) FROM valuation` → 1000+ 条，覆盖 10 年

---

### Step 2: 后端 API 扩展

**目标**：新增 API 接口支持前端历史图表

**新增接口**：
```
GET /api/valuation/history?symbol=000001.SS&months=120
→ [{date, pe_ttm, pb, pe_percentile, pb_percentile}, ...]

GET /api/kline/history?symbol=000001.SS&months=120
→ [{date, close, ma12, ma24}, ...]

GET /api/macro/details
→ {indicators: [{name, value, date, source, trend}, ...]}
```

**修改接口**：
```
GET /api/dashboard
→ 增加字段：
  - merill_clock.data_sources: [{indicator, value, date, source}]
  - market_temperature.details[].pe_percentile: number
  - signals[].prev_score: number (上月得分，用于显示变化)
```

**新建文件**：
- `backend/api/valuation.py` — 估值历史 API
- `backend/api/kline_history.py` — K线历史 API（复用 monthly_kline 表）
- `backend/api/macro.py` — 宏观数据明细 API

---

### Step 3: 前端 — 首页重构

**目标**：首页三屏结构落地

**第一屏（30秒宏观定位）**：

1. **投资哲学 Banner** — 新组件 `PhilosophyBanner.tsx`
   - 一行大字："月线趋势 × 美林时钟 × 估值百分位"
   - 下方小字："不做日线赌博，只做有据可循的中长周期判断"
   - 视觉：深色背景，金色强调，占首屏顶部

2. **美林时钟** — 改造 `MerillClock.tsx`
   - 保留当前版本（已回退到好的版本）
   - 下方增加折叠面板：展示 GDP/CPI/PMI/M2 各项数值 + 来源 + 日期
   - 转换预警更突出显示

3. **市场温度条** — 重写 `TemperatureGauge.tsx`
   - 从纯数字改为 **10 年刻度尺**
   - 横条设计：左端"极寒"右端"极热"
   - 标注当前位置（实心点）+ 历史最高/最低标记
   - 下方一行字：`"当前估值处于10年 82% 分位，接近历史高位"`
   - 可点击展开：10 年 PE 百分位趋势折线图

4. **牛熊状态卡片** — 改造 `BullBearChart.tsx`
   - 每个市场一个紧凑卡片：🟢牛/🟡震荡/🔴熊 + 偏离度
   - 卡片内嵌 sparkline（10 年月线 close + MA12 + MA24）
   - 让用户看到牛市从哪年开始、顶在哪

**第二屏（标的信号）**：

5. **月线信号表** — 改造 `SignalTable.tsx`
   - 增加"上月变化"列（↑12 / ↓5 / →）
   - 颜色强调：涨绿降红（或按偏好）

**第三屏（数据溯源）**：

6. **数据溯源面板** — 新组件 `DataSourcePanel.tsx`
   - 折叠式，默认收起
   - 展开后列表展示每个宏观指标：名称 / 值 / 趋势 / 来源 / 更新时间
   - 例如：`GDP 增速 | 5.2% | ↑ | 国家统计局 | 2026-Q1`

---

### Step 4: 前端 API 对接 & 图表实现

**新增前端文件**：
- `web/src/api/types.ts` — 扩展类型定义
- `web/src/api/client.ts` — 新增 API 调用
- `web/src/components/PhilosophyBanner.tsx`
- `web/src/components/PercentileBar.tsx` — 百分位刻度尺
- `web/src/components/HistoryChart.tsx` — 10 年趋势图（Recharts）
- `web/src/components/DataSourcePanel.tsx`
- `web/src/components/BullBearSparkline.tsx` — 牛熊 sparkline

**Recharts 图表**：
- PE 百分位趋势：AreaChart，10 年月度，标注当前位置
- 牛熊趋势：LineChart（sparkline 模式），close + MA12 + MA24
- 均使用 ResponsiveContainer，移动端友好

---

### Step 5: 构建 & 部署 & 验证

1. `cd /opt/GoldenHeat/web && npm run build`
2. `rsync -a --delete dist/ /var/www/lishengms/heat/`
3. PM2 重启后端（如有改动）：`pm2 delete goldenheat-api && pm2 start ...`
4. 访问 https://lishengms.com/heat/ 验证
5. `git add -A && git commit -m "feat: Heat2 首页升级 — 百分位+趋势图+数据溯源"`

---

## 文件变更清单

### 新建文件
```
backend/collectors/valuation.py          # 估值数据采集
backend/scripts/backfill_valuation.py    # 10年回填脚本
backend/api/valuation.py                 # 估值历史 API
backend/api/kline_history.py             # K线历史 API
backend/api/macro.py                     # 宏观数据明细 API
web/src/components/PhilosophyBanner.tsx   # 投资哲学 banner
web/src/components/PercentileBar.tsx      # 百分位刻度尺
web/src/components/HistoryChart.tsx       # 10年趋势图
web/src/components/DataSourcePanel.tsx    # 数据溯源面板
web/src/components/BullBearSparkline.tsx  # 牛熊sparkline
```

### 修改文件
```
backend/engines/temperature.py    # PE评分改用真实百分位
backend/api/dashboard.py          # 增加数据溯源字段+上月信号
backend/main.py                   # 注册新路由
web/src/api/types.ts              # 扩展类型
web/src/api/client.ts             # 新增API调用
web/src/pages/Dashboard.tsx       # 首页三屏重构
web/src/components/MerillClock.tsx       # 增加数据溯源折叠
web/src/components/TemperatureGauge.tsx  # 重写为百分位条
web/src/components/BullBearChart.tsx     # 增加sparkline
web/src/components/SignalTable.tsx       # 增加上月变化列
```

---

## 依赖 & 风险

| 风险 | 影响 | 应对 |
|------|------|------|
| akshare PE 接口不稳定 | 估值数据拉不到 | 降级用 yfinance 价格历史做分位 |
| 10 年数据量大 | 回填耗时 | 分批采集，月线级别数据量不大（~120条/标的） |
| 前端 Dashboard.tsx 已 851 行 | 改动容易冲突 | 拆分组件，Dashboard 只做编排 |
| 个股 PE 历史难获取 | 百分位不准 | 先做指数百分位，个股用价格分位近似 |

---

## 不在本次范围

- ❌ 个股详情页（V2.3）
- ❌ 持仓记录管理（V2.3）
- ❌ 情绪面板 VIX/利差（V2.2）
- ❌ Polymarket 集成（V2.4）
- ❌ AI 周报（V2.4）

---

## 执行顺序

```
Step 1 (数据) → Step 2 (API) → Step 3+4 (前端) → Step 5 (部署)
     ↓               ↓                ↓                ↓
   半天            半天             1-1.5天           半天
```

**总计预估：3 天（AI 节奏）**
