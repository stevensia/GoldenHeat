/** ValuationPage — 估值百分位仪表盘
 *
 * 功能:
 * 1. 指数 PE 百分位卡片 (沪深300/上证50/中证500/S&P500)
 * 2. 每个卡片: 当前 PE、5年百分位、10年百分位、估值区间色块
 * 3. PE 历史趋势图 (Recharts AreaChart)
 *
 * 暂用 mock 数据，预留 API 接口: /api/v1/valuation/overview, /api/v1/valuation/pe-history
 */

import { useState } from 'react'
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

// === 估值区间颜色 ===
function getValuationColor(percentile: number): string {
  if (percentile < 20) return '#16a34a' // 极度低估 深绿
  if (percentile < 40) return '#4ade80' // 低估 浅绿
  if (percentile < 60) return '#6b7280' // 正常 灰色
  if (percentile < 80) return '#f59e0b' // 高估 橙色
  return '#ef4444' // 极度高估 红色
}

function getValuationLabel(percentile: number): string {
  if (percentile < 20) return '极度低估'
  if (percentile < 40) return '低估'
  if (percentile < 60) return '正常'
  if (percentile < 80) return '高估'
  return '极度高估'
}

// === Mock 数据 ===
interface IndexValuation {
  symbol: string
  name: string
  currentPE: number
  pe5yPercentile: number
  pe10yPercentile: number
  pe5yAvg: number
  pe10yAvg: number
  pe5yMin: number
  pe5yMax: number
}

interface PEHistoryPoint {
  date: string
  pe: number
  percentile: number
}

const MOCK_INDICES: IndexValuation[] = [
  {
    symbol: '000300.SS',
    name: '沪深300',
    currentPE: 12.3,
    pe5yPercentile: 35,
    pe10yPercentile: 28,
    pe5yAvg: 13.1,
    pe10yAvg: 12.8,
    pe5yMin: 9.8,
    pe5yMax: 18.2,
  },
  {
    symbol: '000016.SS',
    name: '上证50',
    currentPE: 10.5,
    pe5yPercentile: 42,
    pe10yPercentile: 38,
    pe5yAvg: 10.8,
    pe10yAvg: 10.2,
    pe5yMin: 7.9,
    pe5yMax: 15.6,
  },
  {
    symbol: '000905.SS',
    name: '中证500',
    currentPE: 22.7,
    pe5yPercentile: 55,
    pe10yPercentile: 45,
    pe5yAvg: 23.5,
    pe10yAvg: 28.1,
    pe5yMin: 18.4,
    pe5yMax: 42.3,
  },
  {
    symbol: '^GSPC',
    name: 'S&P 500',
    currentPE: 24.8,
    pe5yPercentile: 72,
    pe10yPercentile: 68,
    pe5yAvg: 22.1,
    pe10yAvg: 21.5,
    pe5yMin: 16.3,
    pe5yMax: 30.2,
  },
]

// 生成 mock PE 历史 (120 个月)
function generateMockHistory(base: number, volatility: number): PEHistoryPoint[] {
  const points: PEHistoryPoint[] = []
  let pe = base
  for (let i = 119; i >= 0; i--) {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    pe = Math.max(5, pe + (Math.random() - 0.48) * volatility)
    const percentile = Math.min(100, Math.max(0, ((pe - base * 0.7) / (base * 0.6)) * 100))
    points.push({
      date: date.toISOString().slice(0, 7),
      pe: Math.round(pe * 100) / 100,
      percentile: Math.round(percentile),
    })
  }
  return points
}

const MOCK_HISTORIES: Record<string, PEHistoryPoint[]> = {
  '000300.SS': generateMockHistory(12.5, 0.8),
  '000016.SS': generateMockHistory(10.5, 0.6),
  '000905.SS': generateMockHistory(25, 1.5),
  '^GSPC': generateMockHistory(22, 1.2),
}

// === 组件 ===

function ValuationCard({ data }: { data: IndexValuation }) {
  const color10y = getValuationColor(data.pe10yPercentile)
  const label10y = getValuationLabel(data.pe10yPercentile)

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
          {data.currentPE.toFixed(1)}
        </div>
        <div className="text-[10px] text-[#555] mt-0.5">当前 PE (TTM)</div>
      </div>

      {/* Percentile bars */}
      <div className="space-y-3">
        <PercentileRow label="5年百分位" value={data.pe5yPercentile} />
        <PercentileRow label="10年百分位" value={data.pe10yPercentile} />
      </div>

      {/* Range info */}
      <div className="mt-4 pt-3 grid grid-cols-3 gap-2 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <div className="text-[10px] text-[#555]">5y 均值</div>
          <div className="text-sm font-bold text-[#ccc]">{data.pe5yAvg.toFixed(1)}</div>
        </div>
        <div>
          <div className="text-[10px] text-[#555]">5y 最低</div>
          <div className="text-sm font-bold text-[#4ade80]">{data.pe5yMin.toFixed(1)}</div>
        </div>
        <div>
          <div className="text-[10px] text-[#555]">5y 最高</div>
          <div className="text-sm font-bold text-[#ef4444]">{data.pe5yMax.toFixed(1)}</div>
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
          {value}%
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
function PEHistoryChart({ data, indexName }: { data: PEHistoryPoint[]; indexName: string }) {
  const avgPE = data.reduce((s, p) => s + p.pe, 0) / data.length

  return (
    <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="mb-4">
        <h3 className="text-sm font-bold text-[#e0e0e0]">{indexName} PE 历史趋势</h3>
        <p className="text-[10px] text-[#555] mt-0.5">近 10 年月度 PE 数据 (Mock)</p>
      </div>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`peGrad-${indexName}`} x1="0" y1="0" x2="0" y2="1">
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
              interval={23}
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
              formatter={(value) => [Number(value).toFixed(2), 'PE']}
            />
            <ReferenceLine
              y={avgPE}
              stroke="#eab30850"
              strokeDasharray="4 4"
              label={{ value: `avg ${avgPE.toFixed(1)}`, fill: '#555', fontSize: 10, position: 'right' }}
            />
            <Area
              type="monotone"
              dataKey="pe"
              stroke="#eab308"
              strokeWidth={1.5}
              fill={`url(#peGrad-${indexName})`}
              dot={false}
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// === 主页面 ===

export default function ValuationPage() {
  const [selectedIndex, setSelectedIndex] = useState(MOCK_INDICES[0].symbol)
  const selectedData = MOCK_INDICES.find((i) => i.symbol === selectedIndex) ?? MOCK_INDICES[0]
  const historyData = MOCK_HISTORIES[selectedIndex] ?? []

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

      {/* 指数卡片网格 */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {MOCK_INDICES.map((idx) => (
          <button
            key={idx.symbol}
            onClick={() => setSelectedIndex(idx.symbol)}
            className={`text-left transition-all cursor-pointer rounded-2xl ${
              selectedIndex === idx.symbol
                ? 'ring-1 ring-[#eab308]/40 shadow-[0_0_20px_rgba(234,179,8,0.08)]'
                : ''
            }`}
          >
            <ValuationCard data={idx} />
          </button>
        ))}
      </div>

      {/* PE 历史趋势图 */}
      <div className="mt-6">
        {/* Index selector tabs */}
        <div className="mb-4 flex items-center gap-1 overflow-x-auto">
          {MOCK_INDICES.map((idx) => (
            <button
              key={idx.symbol}
              onClick={() => setSelectedIndex(idx.symbol)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                selectedIndex === idx.symbol
                  ? 'bg-[#eab308]/10 text-[#eab308] border border-[#eab308]/20'
                  : 'text-[#777] hover:text-[#ccc] hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              {idx.name}
            </button>
          ))}
        </div>

        <PEHistoryChart data={historyData} indexName={selectedData.name} />
      </div>

      {/* Mock 数据提示 */}
      <div className="mt-6 rounded-xl px-4 py-3 text-center text-[11px] text-[#555]" style={{ border: '1px dashed rgba(255,255,255,0.06)' }}>
        📌 当前显示 Mock 数据 — 等后端 <code className="text-[#eab308]/60">/api/v1/valuation/overview</code> 和 <code className="text-[#eab308]/60">/api/v1/valuation/pe-history</code> 就绪后自动对接
      </div>
    </div>
  )
}
