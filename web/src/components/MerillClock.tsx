/* 美林时钟 v3 — 紧凑圆盘 + 可折叠数据溯源面板
 *
 * 保留当前圆形时钟设计
 * 下方新增可折叠 DataSourcePanel
 */

import type { MerillClockData, MacroDetail } from '../api/types'
import DataSourcePanel from './DataSourcePanel'

interface Props {
  data: MerillClockData
  /** 宏观数据明细（来自新 API，可能为 null） */
  macroDetails?: MacroDetail[] | null
}

/*
 * 标准美林时钟象限（顺时针）:
 *
 *            GDP ↑
 *     复苏(股票) │ 过热(商品)
 *  CPI ↓ ───────┼─────── CPI ↑
 *     衰退(债券) │ 滞胀(现金)
 *            GDP ↓
 *
 * 顺时针方向: 复苏 → 过热 → 滞胀 → 衰退 → 复苏 ...
 */
const PHASES = [
  { phase: 'recovery',    label: '复苏', asset: '⭐ 股票', sa: 270, ea: 360, lx: 55,  ly: 78,  ax: 55,  ay: 95 },
  { phase: 'overheat',    label: '过热', asset: '⭐ 商品', sa: 0,   ea: 90,  lx: 155, ly: 78,  ax: 155, ay: 95 },
  { phase: 'stagflation', label: '滞胀', asset: '⭐ 现金', sa: 90,  ea: 180, lx: 155, ly: 152, ax: 155, ay: 169 },
  { phase: 'recession',   label: '衰退', asset: '⭐ 债券', sa: 180, ea: 270, lx: 55,  ly: 152, ax: 55,  ay: 169 },
] as const

const COLORS: Record<string, string> = {
  recovery: '#22c55e', overheat: '#ef4444',
  stagflation: '#eab308', recession: '#3b82f6',
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg - 90) * Math.PI / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arc(cx: number, cy: number, r: number, s: number, e: number) {
  const start = polar(cx, cy, r, e), end = polar(cx, cy, r, s)
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 0 0 ${end.x} ${end.y} Z`
}

export default function MerillClock({ data, macroDetails }: Props) {
  const cx = 105, cy = 115, r = 82
  const color = COLORS[data.phase]
  const conf = Math.round(data.confidence * 100)

  return (
    <div>
      <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="text-[11px] text-[#555] font-medium mb-3 uppercase tracking-widest">美林时钟</div>

        <div className="flex justify-center">
          <svg width="210" height="230" viewBox="0 0 210 230">
            <defs>
              <filter id="glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            {PHASES.map(q => {
              const active = data.phase === q.phase
              const c = COLORS[q.phase]
              return (
                <g key={q.phase}>
                  <path d={arc(cx, cy, r, q.sa, q.ea)}
                    fill={active ? c : '#12122a'} stroke={active ? c : '#1e1e3a'}
                    strokeWidth={active ? 1.5 : 0.5} opacity={active ? 0.9 : 0.25}
                    filter={active ? 'url(#glow)' : undefined} />
                  <text x={q.lx} y={q.ly} textAnchor="middle" fill={active ? '#fff' : '#444'}
                    fontSize={active ? '14' : '11'} fontWeight={active ? 'bold' : 'normal'}>{q.label}</text>
                  <text x={q.ax} y={q.ay} textAnchor="middle" fill={active ? 'rgba(255,255,255,0.7)' : '#333'}
                    fontSize="9">{q.asset}</text>
                </g>
              )
            })}
            <circle cx={cx} cy={cy} r="30" fill="#0a0a14" stroke={color} strokeWidth="1" opacity="0.9" />
            <text x={cx} y={cy - 2} textAnchor="middle" fill={color} fontSize="18" fontWeight="bold">{conf}%</text>
            <text x={cx} y={cy + 12} textAnchor="middle" fill="#555" fontSize="8">置信度</text>
            <text x={cx} y={16} textAnchor="middle" fill="#444" fontSize="8">GDP ↑</text>
            <text x={cx} y={222} textAnchor="middle" fill="#444" fontSize="8">GDP ↓</text>
            <text x={8} y={cy + 3} textAnchor="start" fill="#444" fontSize="8">CPI ↓</text>
            <text x={202} y={cy + 3} textAnchor="end" fill="#444" fontSize="8">CPI ↑</text>

            {/* 顺时针方向箭头 */}
            <path d="M 145 30 A 60 60 0 0 1 175 70" fill="none" stroke="#333" strokeWidth="0.8" markerEnd="url(#arrow)" />
            <path d="M 178 155 A 60 60 0 0 1 148 195" fill="none" stroke="#333" strokeWidth="0.8" markerEnd="url(#arrow)" />
            <path d="M 62 195 A 60 60 0 0 1 32 155" fill="none" stroke="#333" strokeWidth="0.8" markerEnd="url(#arrow)" />
            <path d="M 30 70 A 60 60 0 0 1 62 30" fill="none" stroke="#333" strokeWidth="0.8" markerEnd="url(#arrow)" />
            <defs>
              <marker id="arrow" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                <path d="M 0 0 L 6 2 L 0 4" fill="none" stroke="#555" strokeWidth="0.8" />
              </marker>
            </defs>
          </svg>
        </div>

        <div className="text-center mt-1">
          <span className="text-2xl font-bold" style={{ color }}>{data.phase_label}</span>
          <span className="text-[11px] text-[#555] ml-2">→ 超配 <span className="text-[#ccc] font-medium">{data.best_asset}</span></span>
        </div>

        {data.transition_warning && (
          <div className="mt-3 px-3 py-1.5 rounded-lg text-[11px] text-[#eab308] border border-[#eab30822]"
            style={{ background: 'rgba(234,179,8,0.06)' }}>
            ⚠️ {data.transition_warning}
          </div>
        )}

        {/* 简要指标行 */}
        <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <span className="text-[#555]">GDP</span>
            <span className="ml-2 font-medium" style={{ color: data.gdp_trend === 'up' ? '#22c55e' : '#ef4444' }}>
              {data.gdp_trend === 'up' ? '↑ 扩张' : '↓ 收缩'}
            </span>
          </div>
          <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <span className="text-[#555]">CPI</span>
            <span className="ml-2 font-medium" style={{ color: data.cpi_trend === 'up' ? '#ef4444' : '#22c55e' }}>
              {data.cpi_trend === 'up' ? '↑ 通胀' : '↓ 通缩'}
            </span>
          </div>
        </div>
      </div>

      {/* 数据溯源折叠面板 */}
      <div className="mt-3">
        <DataSourcePanel data={macroDetails ?? null} />
      </div>
    </div>
  )
}
