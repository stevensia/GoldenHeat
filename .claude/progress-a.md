# Progress — Track A (后端)
状态: ✅ 全部完成

## 子任务完成情况

### 1. 估值数据采集与回填 ✅
- [x] 创建 `backend/collectors/valuation.py` — 支持美股(yfinance PE/PB)、指数(yfinance)、加密(无PE仅价格)
- [x] 创建 `backend/scripts/backfill_valuation.py` — 可独立运行
- [x] 运行回填脚本 → valuation 表 **1034 条**，2016-05 ~ 2026-04
  - 有 PE 数据: 0700.HK(119), 9988.HK(77), NVDA(120), TSLA(120), MSFT(120)
  - 无 PE 数据(符合预期): 000001.SS, ^GSPC, ^HSI(指数无EPS), BTC-USD(加密)

### 2. 温度引擎升级 ✅
- [x] `_pe_score` 优先查 valuation 表真实 pe_percentile
- [x] 无数据时降级回价格历史分位数近似

### 3. Dashboard API 增强 ✅
- [x] `merill_clock.data_sources` — 列出 cn_gdp/cn_cpi/cn_pmi/cn_m2 的最新值、日期、数据源
- [x] `market_temperature.details[].pe_percentile` — 每个标的附带真实百分位
- [x] `signals[].prev_score` — 上月信号得分（当前 signals 表无历史则为 null）

### 4. 新增 API 端点 ✅
- [x] `GET /api/valuation/history?symbol=NVDA&months=120` — 返回估值百分位历史
- [x] `GET /api/kline/history?symbol=000001.SS&months=120` — 返回 OHLCV + ma12/ma24
- [x] `GET /api/macro/details` — 返回 10 个宏观指标明细(含 source/trend)
- [x] 路由已在 `main.py` 注册

## 验证结果
1. ✅ valuation 表: 1034 条, 2016-05 ~ 2026-04
2. ✅ /api/valuation/history — 有数据
3. ✅ /api/kline/history — 有 ma12/ma24
4. ✅ /api/macro/details — 有 source/date/trend
5. ✅ /api/dashboard — data_sources 非 MISSING
