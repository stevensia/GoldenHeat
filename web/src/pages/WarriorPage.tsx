/** WarriorPage — 战士/个股分析页面
 *
 * 功能:
 * 1. 股票搜索/选择
 * 2. 9 指标仪表盘
 * 3. 综合评分 gauge (-8 到 +8)
 * 4. 关键价位: 支撑/阻力
 * 5. 技术信号时间线
 *
 * 真实数据来源: /api/v1/signal/technical
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { TechnicalAnalysis, TechnicalIndicator, KeyLevel, SignalAlert } from '../api/types'
import { fetchV1TechnicalSignal } from '../api/client'

// === 常量 ===
const WATCHLIST = [
  { symbol: 'NVDA', name: '英伟达' },
  { symbol: 'TSLA', name: '特斯拉' },
  { symbol: 'MSFT', name: '微软' },
  { symbol: '0700.HK', name: '腾讯' },
  { symbol: '9988.HK', name: '阿里巴巴' },
  { symbol: 'BTC-USD', name: '比特币' },
  { symbol: '000001.SS', name: '上证指数' },
  { symbol: '^GSPC', name: '标普500' },
  { symbol: '^HSI', name: '恒生指数' },
]

// === 子组件 ===

/** 综合评分仪表 */
function ScoreGauge({ score }: { score: number }) {
  const pct = ((score + 8) / 16) * 100
  const color =
    score >= 4
      ? '#22c55e'
      : score >= 1
        ? '#4ade80'
        : score >= -1
          ? '#6b7280'
          : score >= -4
            ? '#f59e0b'
            : '#ef4444'

  const label =
    score >= 4
      ? '强烈看多'
      : score >= 1
        ? '偏多'
        : score >= -1
          ? '中性'
          : score >= -4
            ? '偏空'
            : '强烈看空'

  return (
    <div
      className="rounded-2xl p-5 text-center"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="text-[10px] text-[#555] uppercase tracking-widest font-medium mb-3">综合评分</div>
      <div className="text-5xl font-extrabold tracking-tight" style={{ color }}>
        {score > 0 ? '+' : ''}
        {score}
      </div>
      <div className="text-sm font-medium mt-1" style={{ color }}>
        {label}
      </div>

      {/* Gauge bar */}
      <div className="mt-4 relative">
        <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, #ef4444, #f59e0b, #6b7280, #4ade80, #22c55e)',
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

/** 指标网格 */
function IndicatorGrid({ indicators }: { indicators: TechnicalIndicator[] }) {
  return (
    <div className="grid gap-2 grid-cols-3">
      {indicators.map((ind) => {
        const color = ind.score > 0 ? '#22c55e' : ind.score < 0 ? '#ef4444' : '#6b7280'
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
            <div className="text-[10px] font-medium mt-0.5" style={{ color }}>
              {ind.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** 关键价位 */
function KeyLevels({ levels, currentPrice }: { levels: KeyLevel[]; currentPrice: number }) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="text-[10px] text-[#555] uppercase tracking-widest font-medium mb-3">关键价位</div>
      {levels.length === 0 ? (
        <div className="text-sm text-[#555] text-center py-4">暂无关键价位</div>
      ) : (
        <div className="space-y-2">
          {levels.map((level, i) => {
            const pctFromCurrent = ((level.price - currentPrice) / currentPrice) * 100
            const typeColor = level.type === 'resistance' ? '#ef4444' : '#22c55e'

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
                  <span className="text-sm font-bold text-[#e0e0e0]">{level.price.toFixed(2)}</span>
                  <span className="text-[10px] font-medium" style={{ color: typeColor }}>
                    {pctFromCurrent > 0 ? '+' : ''}
                    {pctFromCurrent.toFixed(1)}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** 信号时间线 */
function SignalTimeline({ signals }: { signals: SignalAlert[] }) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="text-[10px] text-[#555] uppercase tracking-widest font-medium mb-3">技术信号</div>
      {signals.length === 0 ? (
        <div className="text-sm text-[#555] text-center py-4">暂无技术信号</div>
      ) : (
        <div className="space-y-3">
          {signals.map((sig, i) => {
            const color =
              sig.direction === 'bullish' ? '#22c55e' : sig.direction === 'bearish' ? '#ef4444' : '#6b7280'

            return (
              <div key={i} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full mt-1.5" style={{ background: color }} />
                  {i < signals.length - 1 && <div className="w-px h-6 bg-white/[0.06]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-[#ccc]">{sig.signal}</span>
                  {sig.date && <div className="text-[10px] text-[#555]">{sig.date}</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Loading skeleton */
function AnalysisSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="h-8 w-48 bg-white/[0.06] rounded mb-2" />
        <div className="h-4 w-32 bg-white/[0.04] rounded" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl p-5 h-40" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} />
          <div className="grid gap-2 grid-cols-3">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="rounded-xl p-3 h-20" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl p-5 h-48" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} />
          <div className="rounded-2xl p-5 h-48" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} />
        </div>
      </div>
    </div>
  )
}

// === 主页面 ===

export default function WarriorPage() {
  const [selected, setSelected] = useState(WATCHLIST[0])

  const {
    data: result,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['technical-signal', selected.symbol],
    queryFn: () => fetchV1TechnicalSignal(selected.symbol),
    staleTime: 5 * 60 * 1000,
  })

  const analysis: TechnicalAnalysis | null = result?.data ?? null

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#e0e0e0]">⚔️ 战士</h1>
        <p className="mt-1 text-sm text-[#555]">个股分析 — 9 指标仪表盘 + 综合评分</p>
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

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl px-4 py-3 text-center text-sm text-[#ef4444]" style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
          加载失败: {error.message}
        </div>
      )}

      {/* Loading */}
      {isLoading && <AnalysisSkeleton />}

      {/* 数据展示 */}
      {analysis && !isLoading && (
        <>
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
                  {analysis.change >= 0 ? '+' : ''}
                  {analysis.change.toFixed(2)} ({analysis.change_pct >= 0 ? '+' : ''}
                  {analysis.change_pct.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>

          {/* 主内容 */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* 左侧: 评分 + 9 指标 */}
            <div className="lg:col-span-2 space-y-4">
              <ScoreGauge score={analysis.composite_score} />

              <div>
                <div className="text-[10px] text-[#555] uppercase tracking-widest font-medium mb-3">
                  {analysis.indicators.length} 维指标仪表盘
                </div>
                <IndicatorGrid indicators={analysis.indicators} />
              </div>

              {/* 指标明细 */}
              <div
                className="rounded-2xl p-5"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="text-[10px] text-[#555] uppercase tracking-widest font-medium mb-3">
                  指标详情
                </div>
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
              <KeyLevels levels={analysis.key_levels} currentPrice={analysis.price} />
              <SignalTimeline signals={analysis.alerts} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
