/* API 类型定义 — 与后端 to_dict() 返回格式严格对应 */

// === 美林时钟 ===
export interface MerillClockData {
  phase: 'recovery' | 'overheat' | 'stagflation' | 'recession'
  phase_label: string
  confidence: number
  gdp_trend: 'up' | 'down'
  cpi_trend: 'up' | 'down'
  gdp_slope: number
  cpi_slope: number
  pmi_value: number | null
  pmi_confirm: boolean | null
  m2_growth: number | null
  gdp_growth: number | null
  credit_signal: string | null
  transition_warning: string | null
  best_asset: string
  allocation: Record<string, number>
  description: string
  /** 0-12 时钟点位（三方加权或算法） */
  position?: number
  /** 数据来源: 'algo' | 'weighted' */
  source?: string
}

// === 月线信号 ===
export interface SignalData {
  symbol: string
  name: string
  score: number
  prev_score?: number | null
  level: 'strong_buy' | 'watch' | 'hold' | 'caution' | 'strong_sell'
  level_label: string
  level_emoji: string
  trend: 'bullish' | 'bearish' | 'sideways'
  trend_label: string
  pullback: string
  pullback_label: string
  current_price: number | null
  ma5: number | null
  ma10: number | null
  ma20: number | null
  volume_signal: string | null
  volume_ratio: number | null
  breakdown: {
    trend_score: number
    pullback_score: number
    volume_score: number
    valuation_score: number | null
  }
}

// === 牛熊分割线 ===
export interface BullBearData {
  symbol: string
  name: string
  phase: 'bull' | 'bull_early' | 'bear_early' | 'bear'
  phase_label: string
  phase_emoji: string
  current_price: number
  ma12: number
  ma24: number
  price_vs_ma12_pct: number
  ma12_vs_ma24_pct: number
  position_range: string
  position_min: number
  position_max: number
  strategy: string
  description: string
}

// === 市场温度 ===
export interface TemperatureData {
  symbol: string
  name: string
  temperature: number
  pe_percentile?: number | null
  level: string
  emoji: string
  description: string
  breakdown: {
    pe_score: number
    ma_score: number
    volume_score: number
  }
}

// === 估值历史（Track A 新增） ===
export interface ValuationHistoryPoint {
  date: string
  pe: number
  percentile: number
}

// === K线历史（Track A 新增） ===
export interface KlineHistoryPoint {
  date: string
  close: number
  ma12?: number
  ma24?: number
}

// === 宏观数据明细（Track A 新增） ===
export interface MacroDetail {
  name: string
  value: number | string
  trend: 'up' | 'down' | 'flat'
  source: string
  updated_at: string
}

// === Dashboard 聚合 ===
export interface DashboardData {
  merill_clock: MerillClockData
  market_temperature: {
    average: TemperatureData | null
    details: TemperatureData[]
  }
  signals: SignalData[]
  bull_bear: BullBearData[]
}

// === 时钟摘要（双市场） ===
export interface ClockSummary {
  cn: MerillClockData | null
  us: MerillClockData | null
}

// === Admin 时钟评估记录 ===
export interface ClockAssessment {
  id: number
  market: string
  final_phase: string
  final_position: number
  final_confidence: number
  algo_phase: string | null
  algo_position: number | null
  algo_confidence: number | null
  ai_phase: string | null
  ai_position: number | null
  ai_confidence: number | null
  human_phase: string | null
  human_position: number | null
  human_confidence: number | null
  human_notes: string | null
  weights: string | null
  algo_details: string | null
  trigger_type: string | null
  assessed_at: string
}

// === Admin 指标 ===
export interface ClockIndicator {
  indicator: string
  name: string
  value: number
  date: string
  source: string
}
