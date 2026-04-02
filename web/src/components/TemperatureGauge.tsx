/* 温度计 v2 — 参考 heatmap.html 风格
 *
 * 大温度数字 + 渐变弧形表盘 + 温度等级
 */

import type { TemperatureData } from '../api/types'

interface Props { data: TemperatureData }

export default function TemperatureGauge({ data }: Props) {
  const temp = Math.max(0, Math.min(100, data.temperature))

  const getColor = (t: number) => {
    if (t < 20) return '#3b82f6'
    if (t < 40) return '#60a5fa'
    if (t < 60) return '#eab308'
    if (t < 80) return '#f97316'
    return '#ef4444'
  }
  const color = getColor(temp)

  // SVG 半圆弧
  const arcAngle = (temp / 100) * 180
  const r = 70, cx = 90, cy = 90
  const startAngle = -180
  const endAngle = startAngle + arcAngle
  const startRad = (startAngle * Math.PI) / 180
  const endRad = (endAngle * Math.PI) / 180
  const x1 = cx + r * Math.cos(startRad)
  const y1 = cy + r * Math.sin(startRad)
  const x2 = cx + r * Math.cos(endRad)
  const y2 = cy + r * Math.sin(endRad)
  const largeArc = arcAngle > 180 ? 1 : 0

  return (
    <div className="rounded-2xl p-5 flex flex-col items-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-[11px] text-[#555] font-medium mb-3 uppercase tracking-widest self-start">市场温度</div>

      {/* 半圆弧形 */}
      <div className="relative">
        <svg width="180" height="100" viewBox="0 0 180 100">
          {/* 背景弧 */}
          <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none" stroke="#1a1a2e" strokeWidth="8" strokeLinecap="round" />
          {/* 前景弧 */}
          {temp > 0 && (
            <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
              fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 6px ${color}66)` }} />
          )}
          {/* 指针圆点 */}
          <circle cx={x2} cy={y2} r="5" fill={color} stroke="#0a0a14" strokeWidth="2"
            style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
        </svg>
        {/* 中心温度数字 */}
        <div className="absolute inset-0 flex items-end justify-center pb-1">
          <span className="text-4xl font-extrabold tabular-nums" style={{ color }}>{temp.toFixed(0)}</span>
          <span className="text-lg ml-0.5 mb-1" style={{ color }}>°</span>
        </div>
      </div>

      {/* 刻度 */}
      <div className="flex justify-between w-full px-4 mt-1 text-[9px] text-[#444]">
        <span>0 极寒</span>
        <span>50</span>
        <span>100 极热</span>
      </div>

      {/* 等级 */}
      <div className="mt-4 text-center">
        <span className="text-sm font-bold" style={{ color }}>
          {data.emoji} {data.level}
        </span>
        <div className="text-[10px] text-[#555] mt-1">{data.description}</div>
      </div>
    </div>
  )
}
