/** WarriorPage — 战士/个股分析页面
 *
 * 功能:
 * 1. 股票搜索/选择
 * 2. 9 指标仪表盘 (类似 stock-analysis-skill 输出)
 * 3. 综合评分 gauge (-8 到 +8)
 * 4. 关键价位: 支撑/阻力/VWAP
 * 5. 技术信号时间线
 *
 * 暂用 mock 数据，预留 API: /api/v1/signal/technical
 */

import { useState } from 'react'

// === Types ===
interface IndicatorResult {
  name: string
  score: number // -1, 0, +1
  label: string
  detail: string
}

interface KeyLevel {
  type: 'support' | 'resistance' | 'vwap'
  price: number
  label: string
}

interface SignalEvent {
  date: string
  signal: string
  direction: 'bullish' | 'bearish' | 'neutral'
}

interface StockAnalysis {
  symbol: string
  name: string
  price: number
  change: number
  changePct: number
  compositeScore: number // -8 to +8
  indicators: IndicatorResult[]
  keyLevels: KeyLevel[]
  signals: SignalEvent[]
}

// === Mock 数据 ===

const WATCHLIST = [
  { symbol: 'NVDA', name: '英伟达' },
  { symbol: 'TSLA', name: '特斯拉' },
  { symbol: 'MSFT', name: '微软' },
  { symbol: '0700.HK', name: '腾讯' },
  { symbol: '9988.HK', name: '阿里巴巴' },
  { symbol: 'BTC-USD', name: '比特币' },
]

function getMockAnalysis(symbol: string, name: string): StockAnalysis {
  const mockIndicators: IndicatorResult[] = [
    { name: '趋势方向', score: 1, label: '多头', detail: 'MA5 > MA10 > MA20，均线多头排列' },
    { name: '动量强度', score: 1, label: '强势', detail: 'RSI(14) = 62.5，上升趋势中' },
    { name: '成交量', score: 0, label: '中性', detail: '量能温和，未见明显放量' },
    { name: 'MACD', score: 1, label: '金叉', detail: 'DIF > DEA，柱状图翻红 3 日' },
    { name: '布林带', score: 0, label: '中轨附近', detail: '价格在中轨和上轨之间运行' },
    { name: 'KDJ', score: -1, label: '超买', detail: 'K=82, D=78, J=90，高位钝化' },
    { name: '均线支撑', score: 1, label: '有效', detail: '回踩 MA10 获支撑，未破位' },
    { name: '波动率', score: 0, label: '正常', detail: 'ATR(14) 在历史均值附近' },
    { name: '资金流向', score: 1, label: '流入', detail: '主力净流入，大单买入占比 58%' },
  ]

  return {
    symbol,
    name,
    price: 142.5 + Math.random() * 20,
    change: (Math.random() - 0.4) * 8,
    changePct: (Math.random() - 0.4) * 4,
    compositeScore: mockIndicators.reduce((s, i) => s + i.score, 0),
    indicators: mockIndicators,
    keyLevels: [
      { type: 'resistance', price: 165.0, label: '前高阻力' },
      { type: 'vwap', price: 148.2, label: 'VWAP' },
      { type: 'support', price: 135.5, label: 'MA20 支撑' },
      { type: 'support', price: 122.0, label: 'MA60 强支撑' },
    ],
    signals: [
      { date: '2026-04-01', signal: 'MACD 金叉确认', direction: 'bullish' },
      { date: '2026-03-25', signal: '放量突破前高', direction: 'bullish' },
      { date: '2026-03-18', signal: 'KDJ 高位钝化', direction: 'bearish' },
      { date: '2026-03-10', signal: '回踩 MA10 获支撑', direction: 'bullish' },
      { date: '2026-03-02', signal: '量价背离出现', direction: 'neutral' },
    ],
  }
}

// === 组件 ===

/** 综合评分仪表 */
function ScoreGauge({ score }: { score: number }) {
  // -8 to +8 → 0% to 100%
  const pct = ((score + 8) / 16) * 100
  const color =
    score >= 4 ? '#22c55e' :
    score >= 1 ? '#4ade80' :
    score >= -1 ? '#6b7280' :
    score >= -4 ? '#f59e0b' :
    '#ef4444'

  const label =
    score >= 4 ? '强烈看多' :
    score >= 1 ? '偏多' :
    score >= -1 ? '中性' :
    score >= -4 ? '偏空' :
    '强烈看空'

  return (
    <div className="rounded-2xl p-5 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-[10px] text-[#555] uppercase tracking-widest font-medium mb-3">综合评分</div>
      <div className="text-5xl font-extrabold tracking-tight" style={{ color }}>
        {score > 0 ? '+' : ''}{score}
      </div>
      <div className="text-sm font-medium mt-1" style={{ color }}>{label}</div>

      {/* Gauge bar */}
      <div className="mt-4 relative">
        <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, #ef4444, #f59e0b, #6b7280, #4ade80, #22c55e)`,
            }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[9px] text-[#444]">
          <span>-8</span>
          <span>0</span>
          <span>+8</span>
        </div>
      </div>
    </div>
  )
}

/** 9 指标网格 */
function IndicatorGrid({ indicators }: { indicators: IndicatorResult[] }) {
  return (
    <div className="grid gap-2 grid-cols-3">
      {indicators.map((ind) => {
        const color =
          ind.score > 0 ? '#22c55e' :
          ind.score < 0 ? '#ef4444' :
          '#6b7280'

        return (
          <div
            key={ind.name}
            className="rounded-xl p-3 text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="text-[10px] text-[#555] font-medium">{ind.name}</div>
            <div className="mt-1 text-lg font-extrabold" style={{ color }}>
              {ind.score > 0 ? '+1' : ind.score < 0 ? '-1' : '0'}
            </div>
            <div className="text-[10px] font-medium mt-0.5" style={{ color }}>{ind.label}</div>
          </div>
        )
      })}
    </div>
  )
}

/** 关键价位 */
function KeyLevels({ levels, currentPrice }: { levels: KeyLevel[]; currentPrice: number }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-[10px] text-[#555] uppercase tracking-widest font-medium mb-3">关键价位</div>
      <div className="space-y-2">
        {levels.map((level, i) => {
          const pctFromCurrent = ((level.price - currentPrice) / currentPrice) * 100
          const typeColor =
            level.type === 'resistance' ? '#ef4444' :
            level.type === 'support' ? '#22c55e' :
            '#eab308'

          return (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg px-3 py-2"
              style={{ background: `${typeColor}08`, border: `1px solid ${typeColor}15` }}
            >
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: typeColor }} />
                <span className="text-xs text-[#ccc]">{level.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-[#e0e0e0]">{level.price.toFixed(1)}</span>
                <span className="text-[10px] font-medium" style={{ color: typeColor }}>
                  {pctFromCurrent > 0 ? '+' : ''}{pctFromCurrent.toFixed(1)}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** 信号时间线 */
function SignalTimeline({ signals }: { signals: SignalEvent[] }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-[10px] text-[#555] uppercase tracking-widest font-medium mb-3">技术信号时间线</div>
      <div className="space-y-3">
        {signals.map((sig, i) => {
          const color =
            sig.direction === 'bullish' ? '#22c55e' :
            sig.direction === 'bearish' ? '#ef4444' :
            '#6b7280'

          return (
            <div key={i} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full mt-1.5" style={{ background: color }} />
                {i < signals.length - 1 && (
                  <div className="w-px h-6 bg-white/[0.06]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[#ccc]">{sig.signal}</span>
                </div>
                <div className="text-[10px] text-[#555]">{sig.date}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// === 主页面 ===

export default function WarriorPage() {
  const [selected, setSelected] = useState(WATCHLIST[0])
  const analysis = getMockAnalysis(selected.symbol, selected.name)

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#e0e0e0]">⚔️ 战士</h1>
        <p className="mt-1 text-sm text-[#555]">
          个股分析 — 9 指标仪表盘 + 综合评分
        </p>
      </div>

      {/* 股票选择 */}
      <div className="mb-6 flex items-center gap-2 overflow-x-auto">
        {WATCHLIST.map((stock) => (
          <button
            key={stock.symbol}
            onClick={() => setSelected(stock)}
            className={`shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium transition-all cursor-pointer ${
              selected.symbol === stock.symbol
                ? 'bg-[#eab308]/10 text-[#eab308] border border-[#eab308]/20'
                : 'text-[#777] hover:text-[#ccc] hover:bg-white/[0.04] border border-transparent'
            }`}
          >
            {stock.name}
          </button>
        ))}
      </div>

      {/* 股票 header 卡片 */}
      <div
        className="rounded-2xl p-5 mb-6"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[10px] text-[#555] font-medium">{analysis.symbol}</div>
            <div className="text-2xl font-extrabold text-[#e0e0e0]">{analysis.name}</div>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-[#e0e0e0]">
              {analysis.price.toFixed(2)}
            </span>
            <span
              className="text-lg font-bold"
              style={{ color: analysis.change >= 0 ? '#22c55e' : '#ef4444' }}
            >
              {analysis.change >= 0 ? '+' : ''}{analysis.change.toFixed(2)}
              ({analysis.changePct >= 0 ? '+' : ''}{analysis.changePct.toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>

      {/* 主内容: 左侧评分+指标, 右侧价位+信号 */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* 左侧: 评分 + 9 指标 */}
        <div className="lg:col-span-2 space-y-4">
          <ScoreGauge score={analysis.compositeScore} />

          <div>
            <div className="text-[10px] text-[#555] uppercase tracking-widest font-medium mb-3">
              9 维指标仪表盘
            </div>
            <IndicatorGrid indicators={analysis.indicators} />
          </div>

          {/* 指标明细 */}
          <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-[10px] text-[#555] uppercase tracking-widest font-medium mb-3">指标详情</div>
            <div className="space-y-2">
              {analysis.indicators.map((ind) => (
                <div
                  key={ind.name}
                  className="flex items-center justify-between py-1.5"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <span className="text-xs text-[#999]">{ind.name}</span>
                  <span className="text-xs text-[#777]">{ind.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧: 关键价位 + 信号 */}
        <div className="space-y-4">
          <KeyLevels levels={analysis.keyLevels} currentPrice={analysis.price} />
          <SignalTimeline signals={analysis.signals} />
        </div>
      </div>

      {/* Mock 提示 */}
      <div className="mt-6 rounded-xl px-4 py-3 text-center text-[11px] text-[#555]" style={{ border: '1px dashed rgba(255,255,255,0.06)' }}>
        📌 当前显示 Mock 数据 — 等后端 <code className="text-[#eab308]/60">/api/v1/signal/technical</code> 就绪后自动对接
      </div>
    </div>
  )
}
