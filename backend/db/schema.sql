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

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_macro_indicator_date ON macro_data(indicator, date);
CREATE INDEX IF NOT EXISTS idx_kline_symbol_date ON monthly_kline(symbol, date);
CREATE INDEX IF NOT EXISTS idx_valuation_symbol_date ON valuation(symbol, date);
CREATE INDEX IF NOT EXISTS idx_signals_date ON signals(date);
CREATE INDEX IF NOT EXISTS idx_signals_symbol ON signals(symbol);
