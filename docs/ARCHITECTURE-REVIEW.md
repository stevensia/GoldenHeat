# GoldenHeat V2.1 架构评估与 V3 路线图

> 评估时间: 2026-04-02 | 评估人: 小马 (AI 首席工程师)

---

## 一、当前架构评估

### 1.1 整体评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 功能完整性 | ⭐⭐⭐⭐ | 时钟+估值+信号+K线+Admin，核心 MVP 齐全 |
| 代码质量 | ⭐⭐⭐ | 分层清晰但耦合点多，缺测试 |
| 数据层 | ⭐⭐⭐ | 表结构合理但缺规范化，字段命名不统一 |
| API 设计 | ⭐⭐⭐ | 路由分文件但缺版本控制和统一响应格式 |
| 可扩展性 | ⭐⭐ | 新模块接入需改 main.py，缺插件机制 |
| 运维 | ⭐⭐⭐ | PM2+cron 可用，缺监控告警 |

### 1.2 架构优点 ✅

1. **分层清晰**: `collectors/` → `db/` → `engines/` → `api/` 四层分明
2. **引擎独立**: MerillClock / BullBear / MonthlySignal 各自独立
3. **三方加权时钟**: 算法+AI+人工，有数据库历史追踪
4. **LLM 统一客户端**: local/azure 双后端 + 自动 fallback
5. **认证完整**: JWT + legacy token 兼容 + OAuth 预留

### 1.3 架构问题 ❌

#### 问题1: 数据库耦合 — 直接 SQL 散布各处
```
# 当前: 每个 engine/api 直接 import get_db() 写 SQL
from backend.db.connection import fetchall
rows = fetchall("SELECT * FROM macro_data WHERE indicator=? ...", (ind,))
```
**风险**: 表结构改动需要全局搜索替换 SQL，容易遗漏

#### 问题2: 缺少数据访问层 (Repository/DAO)
- `engines/merill_clock.py` 直接查 `macro_data` 表
- `api/dashboard.py` 直接查多个表
- `collectors/` 直接写入表
- 没有统一的数据模型定义

#### 问题3: 路由缺版本控制
```
/api/dashboard          ← 无版本号
/api/admin/clock/assess ← 混合 admin 和功能路径
/api/clock/summary      ← 公开路由和 admin 路由命名不一致
```

#### 问题4: 配置硬编码
- `WATCHLIST` 写死在 config.py，新增标的需改代码
- `MERILL_CLOCK` 参数固定，不能运行时调整
- 缺数据库级配置表

#### 问题5: 缺统一响应格式
```python
# 有的返回 {"data": ...}
# 有的直接返回对象
# 有的返回 {"status": "ok", ...}
```

#### 问题6: 前端路由原始
- 自己实现的 hash router，功能有限
- 只有 Dashboard 和 AdminClock 两个页面
- 没有通用布局/错误边界

---

## 二、重构方案 (V2.5 — 架构升级)

### 2.1 数据访问层 — Repository 模式

```
backend/
├── models/              ← 新增: 数据模型
│   ├── macro.py         # MacroData, MacroIndicator
│   ├── valuation.py     # Valuation, IndexPE
│   ├── clock.py         # ClockAssessment, IndicatorHistory
│   ├── kline.py         # MonthlyKline
│   ├── signal.py        # Signal
│   ├── dca.py           # 新: 定投记录
│   └── watchlist.py     # 新: 动态关注列表
├── repos/               ← 新增: 数据仓库
│   ├── base.py          # BaseRepository (CRUD 封装)
│   ├── macro_repo.py    # MacroRepository
│   ├── valuation_repo.py
│   ├── clock_repo.py
│   ├── kline_repo.py
│   ├── dca_repo.py
│   └── watchlist_repo.py
```

**收益**: Engine 和 API 只调 repo 方法，SQL 集中管理

### 2.2 API 路由重组 — 按功能域分组

```
/api/v1/
├── /macro/              # 宏观数据
│   ├── GET /indicators  # 指标列表+最新值
│   ├── GET /history     # 时间序列
│   └── GET /freshness   # 数据新鲜度
├── /clock/              # 美林时钟
│   ├── GET /summary     # 双市场摘要(公开)
│   ├── GET /history     # 历史评估
│   ├── POST /assess     # 触发评估(admin)
│   └── POST /confirm    # 人工确认(admin)
├── /valuation/          # 估值
│   ├── GET /overview    # 估值概览+百分位
│   ├── GET /pe-history  # PE历史
│   └── GET /percentile  # 百分位计算
├── /signal/             # 信号
│   ├── GET /dashboard   # 综合面板
│   ├── GET /monthly     # 月线信号
│   └── GET /technical   # 技术分析(新)
├── /dca/                # 定投(新)
│   ├── GET /plans       # 定投计划列表
│   ├── POST /plans      # 创建计划
│   ├── POST /execute    # 执行/记录
│   ├── GET /history     # 定投历史
│   └── GET /analysis    # 定投效果分析
├── /warrior/            # 战士模块(新)
│   ├── GET /screener    # 筛选器
│   ├── GET /backtest    # 回测
│   └── GET /alerts      # 预警
├── /admin/              # 管理
│   ├── /auth/           # 认证
│   ├── /config/         # 运行时配置
│   └── /watchlist/      # 动态管理关注列表
```

### 2.3 统一响应格式

```python
{
    "ok": true,
    "data": { ... },
    "meta": {
        "timestamp": "2026-04-02T23:00:00+08:00",
        "cached": false,
        "freshness": { "oldest_indicator": "2026-02", "stale_count": 1 }
    }
}

# 错误
{
    "ok": false,
    "error": { "code": "STALE_DATA", "message": "CN GDP 数据超过3个月未更新" }
}
```

### 2.4 数据库规范化

#### 新增表:

```sql
-- 动态关注列表 (替代 config.py WATCHLIST)
CREATE TABLE watchlist (
    symbol TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,       -- 'stock' | 'index' | 'crypto' | 'etf'
    market TEXT NOT NULL,     -- 'cn' | 'hk' | 'us' | 'crypto'
    sector TEXT,              -- 行业分类
    enabled INTEGER DEFAULT 1,
    added_at TEXT DEFAULT (datetime('now')),
    notes TEXT
);

-- 定投计划
CREATE TABLE dca_plans (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,           -- '沪深300定投'
    symbol TEXT NOT NULL,         -- '000300.SS'
    strategy TEXT NOT NULL,       -- 'fixed' | 'value_avg' | 'pe_weighted'
    amount REAL NOT NULL,         -- 每期金额
    frequency TEXT NOT NULL,      -- 'monthly' | 'biweekly'
    start_date TEXT NOT NULL,
    pe_low REAL,                  -- PE加权: 低估线
    pe_high REAL,                 -- PE加权: 高估线
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 定投执行记录
CREATE TABLE dca_records (
    id INTEGER PRIMARY KEY,
    plan_id INTEGER REFERENCES dca_plans(id),
    date TEXT NOT NULL,
    amount REAL NOT NULL,         -- 实际投入
    price REAL NOT NULL,          -- 买入价
    shares REAL NOT NULL,         -- 份额
    pe_at_buy REAL,               -- 买入时PE
    pe_percentile REAL,           -- 买入时PE百分位
    total_cost REAL,              -- 累计投入
    total_shares REAL,            -- 累计份额
    market_value REAL,            -- 当前市值
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 运行时配置
CREATE TABLE app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    type TEXT DEFAULT 'string',   -- 'string' | 'number' | 'json' | 'bool'
    description TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 技术分析结果缓存
CREATE TABLE technical_analysis (
    id INTEGER PRIMARY KEY,
    symbol TEXT NOT NULL,
    date TEXT NOT NULL,
    indicators TEXT NOT NULL,     -- JSON: RSI/MACD/KDJ/BB/...
    composite_score REAL,
    composite_signal TEXT,
    alerts TEXT,                  -- JSON array
    summary TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(symbol, date)
);
```

#### 现有表改进:

```sql
-- valuation 表: 增加估值百分位自动更新字段
ALTER TABLE valuation ADD COLUMN pe_percentile_10y REAL;  -- 10年PE百分位
ALTER TABLE valuation ADD COLUMN pe_percentile_5y REAL;   -- 5年PE百分位
ALTER TABLE valuation ADD COLUMN pb_percentile_10y REAL;
ALTER TABLE valuation ADD COLUMN updated_method TEXT;     -- 'auto' | 'manual'

-- index_pe 表: 已有, 增加百分位计算字段
ALTER TABLE index_pe ADD COLUMN pe_pct_5y REAL;   -- 5年PE百分位
ALTER TABLE index_pe ADD COLUMN pe_pct_10y REAL;  -- 10年PE百分位
```

---

## 三、新模块规划

### 3.1 📊 估值百分位自动分析模块

**Engine**: `backend/engines/percentile_analyzer.py`

```python
class PercentileAnalyzer:
    """估值百分位自动计算+分析"""
    
    def calc_pe_percentile(symbol, window_years=10) -> dict:
        """计算 PE 百分位 (基于 index_pe 表历史数据)"""
        # SELECT pe_ttm FROM index_pe WHERE symbol=? AND date >= ?
        # return percentile rank
    
    def calc_valuation_score(symbol) -> dict:
        """综合估值评分: PE百分位 + PB百分位 + 股息率"""
    
    def get_valuation_zone(symbol) -> str:
        """低估/正常/高估/极度高估 四区间判断"""
    
    def generate_valuation_report(symbols: list) -> dict:
        """批量估值分析报告"""
```

**数据支撑**:
- A股: 沪深300/上证50/中证500 等 — 5000+ 日历史 PE (legulegu)
- S&P 500 — 1864 条月度 PE (multpl.com)
- 个股 — yfinance PE (已有)

**已有数据量**: 28,000+ 条指数 PE，足够做 5年/10年 百分位

### 3.2 💰 定投记录与分析模块

**Engine**: `backend/engines/dca_engine.py`

```python
class DCAEngine:
    """定投策略引擎"""
    
    # 策略
    def fixed_amount(plan) -> float:         # 固定金额
    def value_averaging(plan) -> float:      # 价值平均
    def pe_weighted(plan, pe_pct) -> float:  # PE加权: 低估多买高估少买
    
    # 分析
    def calc_irr(plan_id) -> float:         # 年化收益率
    def calc_drawdown(plan_id) -> float:    # 最大回撤
    def compare_strategies(symbol, amount, start_date) -> dict:  # 策略对比
```

**PE 加权定投公式**:
```
PE百分位 < 20%  → 投入 1.5x 基准金额 (极度低估)
PE百分位 20-40% → 投入 1.2x
PE百分位 40-60% → 投入 1.0x (正常)
PE百分位 60-80% → 投入 0.6x
PE百分位 > 80%  → 暂停定投 (极度高估)
```

### 3.3 ⚔️ 战士模块 (Warrior)

**定位**: 个股级别的月度级技术+基本面分析

**Engine**: `backend/engines/warrior.py` (整合 stock-analysis-skill)

```python
class WarriorEngine:
    """战士模块 — 个股深度分析"""
    
    def full_analysis(symbol, name) -> dict:
        """9指标技术分析 + 估值 + 月线信号"""
        # 整合: indicators.py 9指标
        # + PE百分位
        # + 月线均线信号
        # + AI 综合判断
    
    def screener(criteria: dict) -> list:
        """筛选器: 按技术信号/估值/行业筛选"""
    
    def watchlist_scan() -> list:
        """全量扫描关注列表, 输出异常信号"""
```

**整合 stock-analysis-skill 方案**:
- 将 `indicators.py` / `analyzers.py` / `alerts.py` 搬入 `backend/engines/technical/`
- 改为从 `monthly_kline` 表读数据 (而非每次调 yfinance)
- 输出存入 `technical_analysis` 表
- 不依赖 matplotlib/plotly (图表由前端 Recharts 渲染)

### 3.4 🔔 通知模块 (完善)

```python
# backend/notify/
├── base.py          # NotificationChannel 基类
├── telegram.py      # Telegram Bot API
├── email.py         # SMTP
└── dispatcher.py    # 路由: 按事件类型分发
```

事件类型:
- `clock_phase_change`: 美林时钟阶段切换
- `pe_extreme`: PE 进入极端区间 (<10% or >90%)
- `dca_due`: 定投到期提醒
- `human_confirm_needed`: 人工确认超时
- `stale_data`: 数据超过 3 个月未更新

### 3.5 📈 其他可选模块

| 模块 | 描述 | 优先级 | 依赖 |
|------|------|--------|------|
| **VIX + 收益率曲线** | 恐慌指数+利差倒挂检测 | P1 (V2.2) | yfinance |
| **行业轮动** | 申万一级行业 PE 对比+资金流向 | P2 | akshare |
| **北向资金** | 沪深港通每日净流入 | P2 | akshare `stock_em_hsgt_north_net_flow_in` |
| **ETF 溢价监控** | ETF vs NAV 折溢价 | P3 | akshare |
| **Polymarket/预测市场** | 地缘政治事件概率 | P3 (V2.4) | API |
| **回测引擎** | 历史策略回测 | P3 | 内部数据 |
| **AI 周报** | LLM 生成市场周报 | P2 (V2.4) | llm.py |
| **多用户** | 每人独立的关注列表/定投计划 | P3 | auth 扩展 |

---

## 四、优先级路线图

```
V2.5 (架构升级) ← 当前建议
├── Repository 层 + 统一响应
├── watchlist 数据库化
├── app_config 运行时配置
├── react-router + 通用布局
└── 前端增加: 定投/估值/战士 页面骨架

V2.6 (估值百分位)
├── PercentileAnalyzer 引擎
├── index_pe 百分位自动计算 (每日 cron)
├── 估值仪表盘页面
└── PE 极端区间通知

V2.7 (定投记录)
├── DCA Engine + 3种策略
├── 定投管理页面 (CRUD)
├── 定投历史+收益图表
└── PE 加权定投自动提醒

V2.8 (战士模块)
├── stock-analysis-skill 整合
├── 技术分析结果缓存
├── 个股详情页
└── 筛选器 + 关注列表扫描

V3.0 (完整版)
├── VIX + 收益率曲线
├── Telegram 通知完善
├── AI 周报
├── 回测引擎
└── 多用户支持
```

---

## 五、立即可做的改进 (不改架构)

1. **估值百分位**: 基于已有的 28000 条 index_pe 数据，直接在 `daily_collect.py` 中计算并写入
2. **watchlist 表**: 创建表，从 config.py 迁移，API 支持动态增删
3. **统一响应中间件**: 在 main.py 加一个 middleware 包装所有响应
4. **stock-analysis-skill 脚本**: 复制到 `backend/engines/technical/`，改为从 DB 读数据
5. **数据新鲜度 API**: 新增 `/api/v1/health/data` 返回每个指标的最新日期和新鲜度状态
