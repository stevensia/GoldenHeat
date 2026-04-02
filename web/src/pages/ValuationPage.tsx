/** ValuationPage — 估值百分位仪表盘
 *
 * 功能:
 * 1. 指数 PE 百分位卡片
 * 2. 每个卡片: 当前 PE、5年百分位、10年百分位、估值区间色块
 * 3. PE 历史趋势图 (Recharts AreaChart)
 *
 * 真实数据来源: /api/v1/valuation/overview, /api/v1/valuation/pe-history
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { IndexValuation, PEHistoryPoint } from '../api/types'
import { fetchV1ValuationOverview, fetchV1PEHistory } from '../api/client'

// === 估值区间颜色 ===
function getValuationColor(percentile: number): string {
  if (percentile < 20) return '#16a34a'
  if (percentile < 40) return '#4ade80'
  if (percentile < 60) return '#6b7280'
  if (percentile < 80) return '#f59e0b'
  return '#ef4444'
}

function getValuationLabel(percentile: number): string {
  if (percentile < 20) return '极度低估'
  if (percentile < 40) return '低估'
  if (percentile < 60) return '正常'
  if (percentile < 80) return '高估'
  return '极度高估'
}

// === 组件 ===

function ValuationCard({ data }: { data: IndexValuation }) {
  const pct = data.pe_pct_10y ?? data.pe_pct_5y ?? 50
  const color10y = getValuationColor(pct)
  const label10y = getValuationLabel(pct)

  return (
    <div
      className="rounded-2xl p-5 transition-all hover:border-[#333]"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-[10px] text-[#555] uppercase tracking-widest font-medium">
            {data.symbol}
          </div>
          <div className="text-base font-bold text-[#e0e0e0] mt-0.5">{data.name}</div>
        </div>
        <div
          className="rounded-lg px-2.5 py-1 text-xs font-bold"
          style={{
            color: color10y,
            background: `${color10y}15`,
            border: `1px solid ${color10y}30`,
          }}
        >
          {label10y}
        </div>
      </div>

      {/* Current PE */}
      <div className="mb-4">
        <div className="text-3xl font-extrabold tracking-tight" style={{ color: color10y }}>
          {data.pe_ttm.toFixed(1)}
        </div>
        <div className="text-[10px] text-[#555] mt-0.5">当前 PE (TTM)</div>
      </div>

      {/* Percentile bars */}
      <div className="space-y-3">
        {data.pe_pct_5y != null && (
          <PercentileRow label="5年百分位" value={data.pe_pct_5y} />
        )}
        {data.pe_pct_10y != null && (
          <PercentileRow label="10年百分位" value={data.pe_pct_10y} />
        )}
      </div>

      {/* Range info */}
      <div className="mt-4 pt-3 grid grid-cols-3 gap-2 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <div className="text-[10px] text-[#555]">5y 均值</div>
          <div className="text-sm font-bold text-[#ccc]">{data.pe_5y_avg?.toFixed(1) ?? '-'}</div>
        </div>
        <div>
          <div className="text-[10px] text-[#555]">5y 最低</div>
          <div className="text-sm font-bold text-[#4ade80]">{data.pe_5y_min?.toFixed(1) ?? '-'}</div>
        </div>
        <div>
          <div className="text-[10px] text-[#555]">5y 最高</div>
          <div className="text-sm font-bold text-[#ef4444]">{data.pe_5y_max?.toFixed(1) ?? '-'}</div>
        </div>
      </div>
    </div>
  )
}

function PercentileRow({ label, value }: { label: string; value: number }) {
  const color = getValuationColor(value)
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-[#777]">{label}</span>
        <span className="text-[11px] font-bold" style={{ color }}>
          {value.toFixed(1)}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${value}%`,
            background: `linear-gradient(90deg, ${color}80, ${color})`,
          }}
        />
      </div>
    </div>
  )
}

/** 估值区间色带图例 */
function ValuationLegend() {
  const zones = [
    { label: '极度低估', range: '<20%', color: '#16a34a' },
    { label: '低估', range: '20-40%', color: '#4ade80' },
    { label: '正常', range: '40-60%', color: '#6b7280' },
    { label: '高估', range: '60-80%', color: '#f59e0b' },
    { label: '极度高估', range: '>80%', color: '#ef4444' },
  ]

  return (
    <div className="flex flex-wrap items-center gap-3">
      {zones.map((z) => (
        <div key={z.label} className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full" style={{ background: z.color }} />
          <span className="text-[10px] text-[#777]">
            {z.label} ({z.range})
          </span>
        </div>
      ))}
    </div>
  )
}

/** PE 历史趋势图 */
function PEHistoryChart({ symbol, indexName }: { symbol: string; indexName: string }) {
  const { data: result, isLoading, error } = useQuery({
    queryKey: ['pe-history', symbol],
    queryFn: () => fetchV1PEHistory(symbol, 120),
    staleTime: 5 * 60 * 1000,
  })

  const historyData = result?.data ?? []

  if (isLoading) {
    return (
      <div className="rounded-2xl p-5 animate-pulse" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="h-6 w-48 bg-white/[0.06] rounded mb-4" />
        <div className="h-[260px] bg-white/[0.03] rounded" />
      </div>
    )
  }

  if (error || historyData.length === 0) {
    return (
      <div className="rounded-2xl p-5 text-center text-sm text-[#555]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {error ? `加载失败: ${error.message}` : `${indexName} 暂无 PE 历史数据`}
      </div>
    )
  }

  // 每 5 天取一个点（减少密度）
  const sampledData = historyData.filter((_: PEHistoryPoint, i: number) => i % 5 === 0 || i === historyData.length - 1)
  const peValues = sampledData.map((p: PEHistoryPoint) => p.pe_ttm).filter((v: number | null): v is number => v != null)
  const avgPE = peValues.reduce((s: number, v: number) => s + v, 0) / peValues.length

  return (
    <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="mb-4">
        <h3 className="text-sm font-bold text-[#e0e0e0]">{indexName} PE 历史趋势</h3>
        <p className="text-[10px] text-[#555] mt-0.5">近 10 年日度 PE 数据 · {historyData.length} 条</p>
      </div>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sampledData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`peGrad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#eab308" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#eab308" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#555' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              interval={Math.floor(sampledData.length / 6)}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#555' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: '#1a1a2e',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: '#888' }}
              formatter={(value) => [Number(value)?.toFixed(2), 'PE']}
            />
            <ReferenceLine
              y={avgPE}
              stroke="#eab30850"
              strokeDasharray="4 4"
              label={{ value: `avg ${avgPE.toFixed(1)}`, fill: '#555', fontSize: 10, position: 'right' }}
            />
            <Area
              type="monotone"
              dataKey="pe_ttm"
              stroke="#eab308"
              strokeWidth={1.5}
              fill={`url(#peGrad-${symbol})`}
              dot={false}
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** Loading skeleton for cards */
function CardSkeleton() {
  return (
    <div className="rounded-2xl p-5 animate-pulse" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex justify-between mb-4">
        <div>
          <div className="h-3 w-16 bg-white/[0.06] rounded mb-2" />
          <div className="h-5 w-20 bg-white/[0.06] rounded" />
        </div>
        <div className="h-6 w-16 bg-white/[0.06] rounded" />
      </div>
      <div className="h-9 w-16 bg-white/[0.06] rounded mb-4" />
      <div className="space-y-3">
        <div className="h-4 bg-white/[0.04] rounded" />
        <div className="h-4 bg-white/[0.04] rounded" />
      </div>
    </div>
  )
}

// === 主页面 ===

export default function ValuationPage() {
  const { data: overviewResult, isLoading, error } = useQuery({
    queryKey: ['valuation-overview'],
    queryFn: fetchV1ValuationOverview,
    staleTime: 5 * 60 * 1000,
  })

  const indices = overviewResult?.data ?? []
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)

  // 选中第一个（数据加载后）
  const selected = selectedSymbol ?? indices[0]?.symbol ?? null
  const selectedData = indices.find((i: IndexValuation) => i.symbol === selected)

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#e0e0e0]">📈 估值百分位</h1>
          <p className="mt-1 text-sm text-[#555]">
            主要指数 PE 百分位 — 你在 10 年周期中的位置
          </p>
        </div>
        <ValuationLegend />
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 rounded-xl px-4 py-3 text-center text-sm text-[#ef4444]" style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
          数据加载失败: {error.message}
        </div>
      )}

      {/* 指数卡片网格 */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          indices.map((idx: IndexValuation) => (
            <button
              key={idx.symbol}
              onClick={() => setSelectedSymbol(idx.symbol)}
              className={`text-left transition-all cursor-pointer rounded-2xl ${
                selected === idx.symbol
                  ? 'ring-1 ring-[#eab308]/40 shadow-[0_0_20px_rgba(234,179,8,0.08)]'
                  : ''
              }`}
            >
              <ValuationCard data={idx} />
            </button>
          ))
        )}
      </div>

      {/* PE 历史趋势图 */}
      {selected && selectedData && (
        <div className="mt-6">
          {/* Index selector tabs */}
          <div className="mb-4 flex items-center gap-1 overflow-x-auto">
            {indices.map((idx: IndexValuation) => (
              <button
                key={idx.symbol}
                onClick={() => setSelectedSymbol(idx.symbol)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                  selected === idx.symbol
                    ? 'bg-[#eab308]/10 text-[#eab308] border border-[#eab308]/20'
                    : 'text-[#777] hover:text-[#ccc] hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                {idx.name}
              </button>
            ))}
          </div>

          <PEHistoryChart symbol={selected} indexName={selectedData.name} />
        </div>
      )}
    </div>
  )
}
