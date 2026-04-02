/* 美林时钟 v5 — 高级视觉设计
 *
 * 设计理念:
 * - 深空背景 + 高对比象限色彩
 * - 指针用亮金色 #D4A438，与象限颜色区分
 * - 激活象限用渐变 + 微光晕，非激活象限半透明
 * - 轴标签和辅助文字用 #999 确保可读
 * - 方向箭头用 #555 柔和但可辨识
 */

import type { MerillClockData, MacroDetail } from '../api/types'
import DataSourcePanel from './DataSourcePanel'

interface Props {
  data: MerillClockData
  macroDetails?: MacroDetail[] | null
  marketLabel?: string
  hideDataSource?: boolean
}

const PHASES = [
  { phase: 'recovery',    label: '复苏', asset: '股票', icon: '📈', sa: 270, ea: 360, lx: 55,  ly: 78,  ax: 55,  ay: 95 },
  { phase: 'overheat',    label: '过热', asset: '商品', icon: '🔥', sa: 0,   ea: 90,  lx: 155, ly: 78,  ax: 155, ay: 95 },
  { phase: 'stagflation', label: '滞胀', asset: '现金', icon: '💵', sa: 90,  ea: 180, lx: 155, ly: 152, ax: 155, ay: 169 },
  { phase: 'recession',   label: '衰退', asset: '债券', icon: '🛡️', sa: 180, ea: 270, lx: 55,  ly: 152, ax: 55,  ay: 169 },
] as const

// 象限色彩 — 饱和但不刺眼
const COLORS: Record<string, string> = {
  recovery: '#34d399',     // 翠绿
  overheat: '#f87171',     // 珊瑚红
  stagflation: '#fbbf24',  // 琥珀金
  recession: '#60a5fa',    // 天蓝
}

// 象限暗色 (非激活态)
const COLORS_DIM: Record<string, string> = {
  recovery: '#064e3b',
  overheat: '#450a0a',
  stagflation: '#451a03',
  recession: '#172554',
}

// 指针专用金色
const POINTER_COLOR = '#D4A438'

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg - 90) * Math.PI / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arc(cx: number, cy: number, r: number, s: number, e: number) {
  const start = polar(cx, cy, r, e), end = polar(cx, cy, r, s)
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 0 0 ${end.x} ${end.y} Z`
}

function positionToDeg(position: number): number {
  return (315 + position * 30) % 360
}

export default function MerillClock({ data, macroDetails, marketLabel, hideDataSource }: Props) {
  const cx = 105, cy = 115, r = 82
  const phaseColor = COLORS[data.phase]
  const conf = Math.round(data.confidence * 100)

  const hasPointer = data.position != null && data.position >= 0 && data.position <= 12
  const pointerLen = r - 10
  const pointerDeg = hasPointer ? positionToDeg(data.position!) : 0
  const pointerEnd = hasPointer ? polar(cx, cy, pointerLen, pointerDeg) : null
  const pointerTailLen = 10
  const pointerTail = hasPointer ? polar(cx, cy, pointerTailLen, pointerDeg + 180) : null

  return (
    <div>
      <div className="rounded-2xl p-5" style={{ background: '#0c0c1a', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="text-[12px] text-[#888] font-medium mb-3 tracking-wide">
          {marketLabel ? <span>{marketLabel}</span> : '美林时钟'}
        </div>

        <div className="flex justify-center">
          <svg width="210" height="230" viewBox="0 0 210 230">
            <defs>
              {/* 激活象限发光 */}
              <filter id="phase-glow">
                <feGaussianBlur stdDeviation="4" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              {/* 指针金光 */}
              <filter id="ptr-glow">
                <feGaussianBlur stdDeviation="2.5" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              {/* 各象限渐变 */}
              {PHASES.map(q => (
                <radialGradient key={`grad-${q.phase}`} id={`grad-${q.phase}`} cx="50%" cy="50%" r="60%">
                  <stop offset="0%" stopColor={COLORS[q.phase]} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={COLORS[q.phase]} stopOpacity="0.15" />
                </radialGradient>
              ))}
              {/* 箭头 */}
              <marker id="arrow" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                <path d="M 0 0 L 6 2 L 0 4" fill="none" stroke="#666" strokeWidth="0.8" />
              </marker>
            </defs>

            {/* 外圈装饰环 */}
            <circle cx={cx} cy={cy} r={r + 3} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />

            {/* 象限 */}
            {PHASES.map(q => {
              const active = data.phase === q.phase
              const c = COLORS[q.phase]
              return (
                <g key={q.phase}>
                  {/* 象限扇形 */}
                  <path d={arc(cx, cy, r, q.sa, q.ea)}
                    fill={active ? `url(#grad-${q.phase})` : COLORS_DIM[q.phase]}
                    stroke={active ? c : 'rgba(255,255,255,0.06)'}
                    strokeWidth={active ? 1.5 : 0.5}
                    opacity={active ? 1 : 0.3}
                    filter={active ? 'url(#phase-glow)' : undefined}
                  />
                  {/* 象限标签 */}
                  <text x={q.lx} y={q.ly} textAnchor="middle"
                    fill={active ? '#fff' : '#777'}
                    fontSize={active ? '14' : '11'}
                    fontWeight={active ? 'bold' : 'normal'}>
                    {q.label}
                  </text>
                  {/* 资产标签 */}
                  <text x={q.ax} y={q.ay} textAnchor="middle"
                    fill={active ? 'rgba(255,255,255,0.8)' : '#555'}
                    fontSize="9">
                    {q.icon} {q.asset}
                  </text>
                </g>
              )
            })}

            {/* 十字分割线 */}
            <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
            <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />

            {/* 指针 — 金色，与象限色区分 */}
            {hasPointer && pointerEnd && pointerTail && (
              <g filter="url(#ptr-glow)">
                {/* 指针主体 — 渐细线 */}
                <line
                  x1={pointerTail.x} y1={pointerTail.y}
                  x2={pointerEnd.x} y2={pointerEnd.y}
                  stroke={POINTER_COLOR} strokeWidth="2.5"
                  strokeLinecap="round" opacity="0.95"
                />
                {/* 指针尖端 — 亮金圆点 */}
                <circle cx={pointerEnd.x} cy={pointerEnd.y} r="4"
                  fill={POINTER_COLOR} opacity="0.95" />
                {/* 中心轴 — 金色实心 */}
                <circle cx={cx} cy={cy} r="6" fill={POINTER_COLOR} opacity="0.85" />
                <circle cx={cx} cy={cy} r="3" fill="#0c0c1a" opacity="0.6" />
              </g>
            )}

            {/* 中心信息面板 */}
            <circle cx={cx} cy={cy} r="28" fill="#0c0c1a" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
            <text x={cx} y={cy - 3} textAnchor="middle" fill="#fff" fontSize="18" fontWeight="bold">{conf}%</text>
            <text x={cx} y={cy + 11} textAnchor="middle" fill="#999" fontSize="8">置信度</text>

            {/* 轴标签 — 确保可读 */}
            <text x={cx} y={14} textAnchor="middle" fill="#aaa" fontSize="9" fontWeight="500">GDP ↑</text>
            <text x={cx} y={224} textAnchor="middle" fill="#aaa" fontSize="9" fontWeight="500">GDP ↓</text>
            <text x={6} y={cy + 3} textAnchor="start" fill="#aaa" fontSize="9" fontWeight="500">CPI ↓</text>
            <text x={204} y={cy + 3} textAnchor="end" fill="#aaa" fontSize="9" fontWeight="500">CPI ↑</text>

            {/* 顺时针方向箭头 — 柔和可辨 */}
            <path d="M 145 30 A 60 60 0 0 1 175 70" fill="none" stroke="#555" strokeWidth="0.8" markerEnd="url(#arrow)" />
            <path d="M 178 155 A 60 60 0 0 1 148 195" fill="none" stroke="#555" strokeWidth="0.8" markerEnd="url(#arrow)" />
            <path d="M 62 195 A 60 60 0 0 1 32 155" fill="none" stroke="#555" strokeWidth="0.8" markerEnd="url(#arrow)" />
            <path d="M 30 70 A 60 60 0 0 1 62 30" fill="none" stroke="#555" strokeWidth="0.8" markerEnd="url(#arrow)" />
          </svg>
        </div>

        {/* 阶段 + 资产 */}
        <div className="text-center mt-1">
          <span className="text-2xl font-bold" style={{ color: phaseColor }}>{data.phase_label}</span>
          <span className="text-[12px] text-[#999] ml-2">→ 超配 <span className="text-[#eee] font-medium">{data.best_asset}</span></span>
        </div>

        {/* 点位 */}
        {hasPointer && (
          <div className="text-center mt-1.5">
            <span className="text-[11px] text-[#888]">点位 </span>
            <span className="text-[14px] font-mono font-bold" style={{ color: POINTER_COLOR }}>{data.position!.toFixed(1)}</span>
            <span className="text-[11px] text-[#666]"> / 12</span>
            {data.source && (
              <span className="text-[10px] text-[#666] ml-2">
                ({data.source === 'weighted' ? '三方加权' : '算法'})
              </span>
            )}
          </div>
        )}

        {/* 转换预警 */}
        {data.transition_warning && (
          <div className="mt-3 px-3 py-2 rounded-lg text-[11px] text-[#fbbf24] border border-[#fbbf2433]"
            style={{ background: 'rgba(251,191,36,0.06)' }}>
            ⚠️ {data.transition_warning}
          </div>
        )}

        {/* GDP / CPI 指标 */}
        <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-[#888]">GDP</span>
            <span className="ml-2 font-semibold" style={{ color: data.gdp_trend === 'up' ? '#34d399' : '#f87171' }}>
              {data.gdp_trend === 'up' ? '↑ 扩张' : '↓ 收缩'}
            </span>
          </div>
          <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-[#888]">CPI</span>
            <span className="ml-2 font-semibold" style={{ color: data.cpi_trend === 'up' ? '#f87171' : '#34d399' }}>
              {data.cpi_trend === 'up' ? '↑ 通胀' : '↓ 通缩'}
            </span>
          </div>
        </div>
      </div>

      {!hideDataSource && (
        <div className="mt-3">
          <DataSourcePanel data={macroDetails ?? null} />
        </div>
      )}
    </div>
  )
}
