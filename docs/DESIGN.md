# GoldenHeat — 产品设计文档 v1.0

## 一、产品定位

**一句话**：用 AI 做月线级别投资决策的"投资温度计"。

**核心哲学**：
- 周线日线等于赌博，不碰
- 只做月线级别操作（持仓周期：1-6个月）
- 牛熊分割线操作（持仓周期：6个月-数年）
- AI 判断趋势 + 美林时钟矫正方向 + 偏离度量化

**目标用户**：个人自用 → 未来可分享给投资社群

---

## 二、三大核心模块

### 模块 1: 🌡️ 美林时钟引擎（宏观方向）

**目标**：判断当前经济处于美林时钟的哪个阶段，推荐超配/低配资产类别。

**美林时钟四阶段**：

| 阶段 | 经济 | 通胀 | 最优资产 | 次优资产 |
|------|------|------|---------|---------|
| 复苏 (Recovery) | ↑ GDP | ↓ CPI | 股票 | 商品 |
| 过热 (Overheat) | ↑ GDP | ↑ CPI | 商品 | 股票 |
| 滞胀 (Stagflation) | ↓ GDP | ↑ CPI | 现金 | 商品 |
| 衰退 (Recession) | ↓ GDP | ↓ CPI | 债券 | 现金 |

**输入数据**：
- GDP 增速（季度，国家统计局 / FRED）
- CPI / PPI 同比（月度）
- PMI 制造业/服务业（月度）
- 利率（联邦基金利率 / LPR）
- 信贷增速（社融 / M2）
- 就业数据（非农 / 城镇调查失业率）

**判断逻辑**：
```python
class MerillClock:
    """美林时钟判断引擎"""
    
    def judge_phase(self, macro_data: MacroData) -> Phase:
        # 核心指标
        gdp_trend = self.calc_trend(macro_data.gdp_growth, window=4)  # 4季度趋势
        cpi_trend = self.calc_trend(macro_data.cpi_yoy, window=6)     # 6月趋势
        
        # 辅助指标矫正
        pmi_confirm = macro_data.pmi > 50  # PMI 确认经济方向
        credit_signal = macro_data.m2_growth > macro_data.gdp_growth  # 信贷领先
        
        # 基础判断
        if gdp_trend == 'up' and cpi_trend == 'down':
            phase = Phase.RECOVERY
        elif gdp_trend == 'up' and cpi_trend == 'up':
            phase = Phase.OVERHEAT
        elif gdp_trend == 'down' and cpi_trend == 'up':
            phase = Phase.STAGFLATION
        else:  # gdp down, cpi down
            phase = Phase.RECESSION
        
        # PMI 矫正（PMI 领先 GDP 3-6 个月）
        if pmi_confirm != (gdp_trend == 'up'):
            phase.confidence *= 0.7  # 降低置信度，可能正在转换
        
        return phase
```

**偏离度计算**：
- 当前资产配置 vs 美林时钟推荐配置的偏差
- 例：美林时钟说"复苏期→超配股票"，但 80% 持仓是债券 → 偏离度高

**输出**：
- 当前阶段判断 + 置信度
- 推荐资产配置比例
- 与实际持仓的偏离度
- 阶段转换预警信号

---

### 模块 2: 📊 月线信号系统（标的时机）

**目标**：对每个关注标的，判断月线级别的买卖时机。

**信号维度**（每个标的独立计算）：

#### 2.1 月线趋势判断
```
- MA5/MA10/MA20 月线均线系统
- 多头排列 → 主升段（持有）
- 空头排列 → 主跌段（空仓）
- 均线纠缠 → 震荡区间（轻仓/观望）
```

#### 2.2 月线回调信号
```
主升趋势中的回调买入区：
- 回踩月线 MA5 → 强势回调（小仓买入）
- 回踩月线 MA10 → 标准回调（标准买入）
- 回踩月线 MA20 → 深度回调（重仓买入）
- 跌破月线 MA20 → 趋势可能反转（止损/观望）
```

#### 2.3 估值锚定
```
- PE/PB 分位数（历史 10 年）
- PE < 30% 分位 → 低估（加分）
- PE > 70% 分位 → 高估（减分）
- 结合行业特征（科技股看 PS，银行看 PB）
```

#### 2.4 成交量确认
```
- 月线缩量回调 → 健康回调（加分）
- 月线放量下跌 → 恐慌出逃（减分）
- 月线放量突破 → 趋势确认（加分）
```

**信号强度评级**：
```
🔴 强买入 (≥80分): 月线深度回调 + 低估 + 缩量 + 美林时钟利好
🟡 关注   (60-79): 部分条件满足，等待进一步确认
⚪ 持有   (40-59): 趋势正常，无需操作
🟡 警惕   (20-39): 出现见顶信号，考虑减仓
🔴 强卖出 (<20):  月线跌破关键支撑 + 高估 + 放量
```

**标的覆盖**：
```python
# 用户可自定义 watchlist，以下为示例配置
WATCHLIST = {
    # 港股示例
    'example_hk':  { 'code': '00700.HK', 'type': 'stock', 'market': 'hk' },
    # 美股示例
    'example_us':  { 'code': 'AAPL', 'type': 'stock', 'market': 'us' },
    # 加密货币示例
    'btc':         { 'code': 'BTC-USD', 'type': 'crypto', 'market': 'crypto' },
    # 指数（牛熊参考）
    'sp500':       { 'code': '^GSPC', 'type': 'index', 'market': 'us' },
    'sse':         { 'code': '000001.SS', 'type': 'index', 'market': 'cn' },
    'hsi':         { 'code': '^HSI', 'type': 'index', 'market': 'hk' },
}
```

---

### 模块 3: 📈 牛熊分割线（大级别仓位）

**目标**：判断各市场处于牛市还是熊市，决定整体仓位水平。

**判断规则**：

```python
class BullBearJudge:
    """牛熊分割线判断"""
    
    def judge(self, index_data: MonthlyKline) -> MarketPhase:
        # 核心指标：年线（月线 MA12）
        ma12 = index_data.close.rolling(12).mean()
        ma24 = index_data.close.rolling(24).mean()  # 两年线
        
        current = index_data.close.iloc[-1]
        
        # 牛熊判断
        if current > ma12 and ma12 > ma24:
            return MarketPhase.BULL          # 牛市格局 → 满仓/重仓
        elif current > ma12 and ma12 < ma24:
            return MarketPhase.BULL_EARLY    # 牛市初期 → 逐步加仓
        elif current < ma12 and ma12 > ma24:
            return MarketPhase.BEAR_EARLY    # 熊市初期 → 逐步减仓
        elif current < ma12 and ma12 < ma24:
            return MarketPhase.BEAR          # 熊市格局 → 空仓/轻仓
```

**仓位映射**：

| 市场状态 | 建议仓位 | 操作策略 |
|---------|---------|---------|
| 🟢 牛市格局 | 80-100% | 月线回调加仓 |
| 🟡 牛市初期 | 50-80% | 逐步建仓 |
| 🟡 熊市初期 | 20-50% | 逐步减仓 |
| 🔴 熊市格局 | 0-20% | 空仓等待 |

**市场温度计**：
- 综合 PE 分位、均线位置、成交量、市场情绪
- 输出 0-100 的"温度"值
- 0-20 = 极寒（熊市底部区域）
- 80-100 = 极热（牛市顶部区域）

---

## 三、AI 辅助层

### LLM 辅助宏观研判

不用 AI 做买卖决策，而是用 AI 做**信息摘要 + 逻辑校验**：

```python
class AIAdvisor:
    """LLM 辅助分析"""
    
    async def weekly_digest(self, macro_data, signals) -> str:
        """每周宏观摘要 + 信号解读"""
        prompt = f"""
        你是一个宏观经济分析师。基于以下数据，给出本周的投资环境摘要：
        
        美林时钟当前阶段: {macro_data.phase}
        关键指标变化: {macro_data.changes}
        月线信号: {signals}
        
        请分析：
        1. 当前宏观环境对各资产类别的影响
        2. 关注的标的是否出现月线级别机会
        3. 与上周相比有哪些关键变化
        4. 需要警惕的风险
        
        注意：只分析月线级别以上的趋势，忽略短期波动。
        """
        return await self.llm.analyze(prompt)
    
    async def challenge_signal(self, signal) -> str:
        """对信号进行对抗式审视"""
        prompt = f"""
        系统生成了以下买入信号: {signal}
        
        请从反面分析：
        1. 这个信号可能是错误的原因
        2. 当前环境中最大的风险是什么
        3. 如果这个判断是错的，最坏情况是什么
        4. 需要什么条件才能确认这个信号有效
        """
        return await self.llm.analyze(prompt)
```

---

## 四、数据源规划

### 免费数据源

| 数据 | 来源 | 频率 | API |
|------|------|------|-----|
| 月线K线(A/港/美) | Yahoo Finance | 日更 | yfinance |
| 月线K线(A股) | Tushare / AKShare | 日更 | akshare |
| BTC | CoinGecko / Binance | 实时 | REST API |
| CPI/PPI/GDP(中国) | 国家统计局 | 月/季 | akshare |
| CPI/GDP/非农(美国) | FRED | 月/季 | fredapi |
| PMI | 财新/统计局 | 月 | 爬虫/akshare |
| 利率(LPR/FFR) | 央行/FRED | 月/8次/年 | API |
| 估值(PE/PB) | 乐古/理杏仁 | 日更 | 爬虫/API |

### 数据存储

```sql
-- 宏观经济数据
CREATE TABLE macro_data (
    id INTEGER PRIMARY KEY,
    indicator TEXT NOT NULL,      -- 'cn_cpi', 'us_gdp', 'cn_pmi' ...
    date TEXT NOT NULL,           -- '2026-03'
    value REAL NOT NULL,
    source TEXT,
    fetched_at TEXT DEFAULT (datetime('now')),
    UNIQUE(indicator, date)
);

-- 月线K线
CREATE TABLE monthly_kline (
    id INTEGER PRIMARY KEY,
    symbol TEXT NOT NULL,         -- '00700.HK', 'NVDA', 'BTC-USD'
    date TEXT NOT NULL,           -- '2026-03'
    open REAL, high REAL, low REAL, close REAL,
    volume REAL,
    adj_close REAL,
    UNIQUE(symbol, date)
);

-- 估值数据
CREATE TABLE valuation (
    id INTEGER PRIMARY KEY,
    symbol TEXT NOT NULL,
    date TEXT NOT NULL,
    pe_ttm REAL, pb REAL, ps REAL,
    pe_percentile REAL,          -- 10年PE分位
    pb_percentile REAL,
    UNIQUE(symbol, date)
);

-- 信号记录
CREATE TABLE signals (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL,
    symbol TEXT,                  -- NULL = 宏观信号
    signal_type TEXT NOT NULL,    -- 'merill_phase', 'monthly_buy', 'bull_bear'
    signal_value TEXT NOT NULL,   -- JSON
    confidence REAL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- AI 分析记录
CREATE TABLE ai_analyses (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL,
    analysis_type TEXT,           -- 'weekly_digest', 'signal_challenge'
    input_data TEXT,              -- JSON
    output TEXT,
    model TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
```

---

## 五、展示形态

### 形态 1: Web Dashboard（主力）

React SPA，一页看清全局：

**Header**: 日期 + 上次更新时间 + 手动刷新
**Row 1**: 三大核心指标卡片（美林时钟/市场温度/偏离度）
**Row 2**: 标的月线信号表（热力图色彩）
**Row 3**: 牛熊分割线图（各市场年线位置）
**Row 4**: AI 周报摘要

### 形态 2: Telegram Bot（通知）

- 每周日推送周报摘要
- 信号变化时即时通知（如某标的进入买入区）
- 支持查询命令：`/heat` 查温度、`/signal <标的>` 查信号

### 形态 3: 邮件周报（存档）

- 每周生成 HTML 邮件
- 包含图表截图 + 文字摘要
- 自动发送到指定邮箱

---

## 六、与现有系统集成

| 系统 | 集成方式 | 用途 |
|------|---------|------|
| LLM API | HTTP 调用 | 使用可配置的 LLM 服务进行辅助分析 |
| Telegram Bot | Bot API | 通过 Telegram 渠道推送信号通知 |
| 邮件服务 | SMTP | 自动发送周报到指定邮箱 |
| 持仓数据 | 可配置导入 | 用于计算偏离度 |
