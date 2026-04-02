/* 美林时钟四象限圆盘 — SVG 实现
 *
 * 四象限: 复苏(右上) / 过热(左上) / 滞胀(左下) / 衰退(右下)
 * 当前阶段高亮，中心显示置信度
 */

import type { MerillClockData } from '../api/types'

interface Props {
  data: MerillClockData
}

interface QuadrantDef {
  phase: MerillClockData['phase']
  label: string
  asset: string
  // SVG path for each quadrant (pie slice)
  startAngle: number
  endAngle: number
  labelX: number
  labelY: number
  assetX: number
  assetY: number
}

const QUADRANTS: QuadrantDef[] = [
  { phase: 'recovery',    label: '复苏', asset: '股票',  startAngle: 270, endAngle: 360, labelX: 155, labelY: 75,  assetX: 155, assetY: 95 },
  { phase: 'overheat',    label: '过热', asset: '商品',  startAngle: 180, endAngle: 270, labelX: 55,  labelY: 75,  assetX: 55,  assetY: 95 },
  { phase: 'stagflation', label: '滞胀', asset: '现金',  startAngle: 90,  endAngle: 180, labelX: 55,  labelY: 155, assetX: 55,  assetY: 175 },
  { phase: 'recession',   label: '衰退', asset: '债券',  startAngle: 0,   endAngle: 90,  labelX: 155, labelY: 155, assetX: 155, assetY: 175 },
]

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * Math.PI / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const large = endAngle - startAngle > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y} Z`
}

const PHASE_COLORS: Record<string, string> = {
  recovery: '#22c55e',
  overheat: '#ef4444',
  stagflation: '#eab308',
  recession: '#3b82f6',
}

export default function MerillClock({ data }: Props) {
  const cx = 105, cy = 115, r = 85
  const activeColor = PHASE_COLORS[data.phase]

  return (
    <div className="bg-[#111122] border border-[#1e1e3a] rounded-2xl p-6 shadow-lg shadow-black/30">
      <h3 className="text-sm font-medium text-[#888] mb-3 tracking-wide">美林时钟</h3>

      <div className="flex justify-center">
        <svg width="210" height="230" viewBox="0 0 210 230">
          {/* 发光滤镜 */}
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* 四象限 */}
          {QUADRANTS.map(q => {
            const active = data.phase === q.phase
            const color = PHASE_COLORS[q.phase]
            return (
              <g key={q.phase}>
                <path
                  d={arcPath(cx, cy, r, q.startAngle, q.endAngle)}
                  fill={active ? color : '#1a1a2e'}
                  stroke={active ? color : '#2a2a4a'}
                  strokeWidth={active ? '2' : '1'}
                  opacity={active ? 1 : 0.3}
                  filter={active ? 'url(#glow)' : undefined}
                />
                <text x={q.labelX} y={q.labelY} textAnchor="middle"
                  fill={active ? '#fff' : '#555'} fontSize={active ? "15" : "12"} fontWeight={active ? "bold" : "normal"}>
                  {q.label}
                </text>
                <text x={q.assetX} y={q.assetY} textAnchor="middle"
                  fill={active ? 'rgba(255,255,255,0.85)' : '#444'} fontSize="10">
                  {q.asset}
                </text>
              </g>
            )
          })}

          {/* 中心圆 — 置信度 */}
          <circle cx={cx} cy={cy} r="32" fill="#0a0a14" stroke={activeColor} strokeWidth="1.5" opacity="0.8" />
          <text x={cx} y={cy - 4} textAnchor="middle" fill="#00d4ff" fontSize="20" fontWeight="bold">
            {Math.round(data.confidence * 100)}%
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" fill="#888" fontSize="9">
            置信度
          </text>

          {/* 坐标轴标签 */}
          <text x={cx} y={18} textAnchor="middle" fill="#666" fontSize="9">GDP ↑</text>
          <text x={cx} y={218} textAnchor="middle" fill="#666" fontSize="9">GDP ↓</text>
          <text x={6} y={cy + 3} textAnchor="start" fill="#666" fontSize="9">CPI ↑</text>
          <text x={204} y={cy + 3} textAnchor="end" fill="#666" fontSize="9">CPI ↓</text>
        </svg>
      </div>

      {/* 状态文字 */}
      <div className="text-center mt-2">
        <div className="text-3xl font-bold" style={{ color: PHASE_COLORS[data.phase] }}>
          {data.phase_label}
        </div>
        <div className="text-sm text-[#888] mt-1">
          推荐超配: <span className="text-[#e0e0e0] font-medium">{data.best_asset}</span>
        </div>
        {data.credit_signal && (
          <div className="text-xs text-[#888] mt-0.5">
            信贷环境: <span className="text-[#e0e0e0]">{data.credit_signal}</span>
          </div>
        )}
      </div>

      {/* 预警 */}
      {data.transition_warning && (
        <div className="mt-3 px-3 py-2 bg-[#1a1a0a] border border-[#3a3a1a] rounded-lg text-xs text-[#eab308]">
          <span className="mr-1">&#x26A0;&#xFE0F;</span>{data.transition_warning}
        </div>
      )}
    </div>
  )
}
