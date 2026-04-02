-- GoldenHeat 数据库 Schema
-- 按 DESIGN.md 第四章设计

-- 宏观经济数据
CREATE TABLE IF NOT EXISTS macro_data (
    id INTEGER PRIMARY KEY,
    indicator TEXT NOT NULL,      -- 'cn_cpi', 'us_gdp', 'cn_pmi' ...
    date TEXT NOT NULL,           -- '2026-03'
    value REAL NOT NULL,
    source TEXT,
    fetched_at TEXT DEFAULT (datetime('now')),
    UNIQUE(indicator, date)
);

-- 月线K线
CREATE TABLE IF NOT EXISTS monthly_kline (
    id INTEGER PRIMARY KEY,
    symbol TEXT NOT NULL,         -- '0700.HK', 'NVDA', 'BTC-USD'
    date TEXT NOT NULL,           -- '2026-03'
    open REAL, high REAL, low REAL, close REAL,
    volume REAL,
    adj_close REAL,
    UNIQUE(symbol, date)
);

-- 估值数据
CREATE TABLE IF NOT EXISTS valuation (
    id INTEGER PRIMARY KEY,
    symbol TEXT NOT NULL,
    date TEXT NOT NULL,
    pe_ttm REAL, pb REAL, ps REAL,
    pe_percentile REAL,          -- 10年PE分位
    pb_percentile REAL,
    UNIQUE(symbol, date)
);

-- 信号记录
CREATE TABLE IF NOT EXISTS signals (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL,
    symbol TEXT,                  -- NULL = 宏观信号
    signal_type TEXT NOT NULL,    -- 'merill_phase', 'monthly_buy', 'bull_bear'
    signal_value TEXT NOT NULL,   -- JSON
    confidence REAL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- AI 分析记录
CREATE TABLE IF NOT EXISTS ai_analyses (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL,
    analysis_type TEXT,           -- 'weekly_digest', 'signal_challenge'
    input_data TEXT,              -- JSON
    output TEXT,
    model TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 时钟评估历史（每次评估一条记录）
CREATE TABLE IF NOT EXISTS clock_assessments (
    id INTEGER PRIMARY KEY,
    assessed_at TEXT NOT NULL DEFAULT (datetime('now')),
    market TEXT NOT NULL DEFAULT 'cn',          -- cn / us / global

    -- 算法判断
    algo_phase TEXT NOT NULL,                    -- recovery/overheat/stagflation/recession
    algo_position REAL NOT NULL,                 -- 0-12 点位
    algo_confidence REAL NOT NULL,               -- 0-1
    algo_details TEXT,                           -- JSON: 各指标值和斜率

    -- AI 判断（LLM 分析）
    ai_phase TEXT,
    ai_position REAL,
    ai_confidence REAL,
    ai_reasoning TEXT,                           -- AI 给出的推理过程

    -- 人工判断
    human_phase TEXT,
    human_position REAL,
    human_confidence REAL,
    human_notes TEXT,                            -- 人工备注
    human_confirmed_at TEXT,                     -- 人工确认时间（NULL=未确认）
    human_confirmed_by TEXT,                     -- 确认者

    -- 最终结果（加权）
    final_phase TEXT NOT NULL,
    final_position REAL NOT NULL,
    final_confidence REAL NOT NULL,
    weights TEXT NOT NULL,                        -- JSON: {algo: 0.4, ai: 0.3, human: 0.3}

    -- 元数据
    trigger_type TEXT NOT NULL DEFAULT 'manual', -- manual / quarterly_auto / data_update
    notification_sent INTEGER DEFAULT 0,

    UNIQUE(market, assessed_at)
);

-- 指标变更历史（每个指标每次更新记录）
CREATE TABLE IF NOT EXISTS indicator_history (
    id INTEGER PRIMARY KEY,
    assessment_id INTEGER REFERENCES clock_assessments(id),
    indicator TEXT NOT NULL,                      -- cn_gdp / cn_cpi / cn_pmi 等
    value REAL NOT NULL,
    previous_value REAL,
    date TEXT NOT NULL,                           -- 数据日期
    source TEXT NOT NULL,                         -- 数据来源
    recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_indicator_history_assessment ON indicator_history(assessment_id);
CREATE INDEX IF NOT EXISTS idx_indicator_history_indicator ON indicator_history(indicator, date);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_macro_indicator_date ON macro_data(indicator, date);
CREATE INDEX IF NOT EXISTS idx_kline_symbol_date ON monthly_kline(symbol, date);
CREATE INDEX IF NOT EXISTS idx_valuation_symbol_date ON valuation(symbol, date);
CREATE INDEX IF NOT EXISTS idx_signals_date ON signals(date);
CREATE INDEX IF NOT EXISTS idx_signals_symbol ON signals(symbol);
