/* 温度计 — 横向渐变温度条
 *
 * 0(极寒蓝) → 50(温和黄) → 100(极热红)
 * 指针标注当前温度，下方显示数值+等级
 */

import type { TemperatureData } from '../api/types'

interface Props {
  data: TemperatureData
}

export default function TemperatureGauge({ data }: Props) {
  const temp = Math.max(0, Math.min(100, data.temperature))
  const pct = temp // 0-100 maps to 0-100%

  // 温度对应颜色
  const getColor = (t: number) => {
    if (t < 20) return '#3b82f6'
    if (t < 40) return '#60a5fa'
    if (t < 60) return '#eab308'
    if (t < 80) return '#f97316'
    return '#ef4444'
  }

  const color = getColor(temp)

  return (
    <div className="bg-[#111122] border border-[#1e1e3a] rounded-2xl p-5">
      <h3 className="text-sm font-medium text-[#888] mb-3 tracking-wide">市场温度</h3>

      {/* 温度条 */}
      <div className="relative mt-6 mb-4">
        {/* 渐变条背景 */}
        <div className="h-3 rounded-full overflow-hidden"
          style={{ background: 'linear-gradient(to right, #3b82f6, #60a5fa, #eab308, #f97316, #ef4444)' }}>
        </div>

        {/* 指针 */}
        <div className="absolute top-[-8px] transition-all duration-700"
          style={{ left: `calc(${pct}% - 8px)` }}>
          <div className="w-4 h-4 rounded-full border-2 border-white shadow-lg"
            style={{ background: color }} />
          <div className="absolute top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-bold"
            style={{ color }}>
            {temp.toFixed(0)}°
          </div>
        </div>

        {/* 刻度 */}
        <div className="flex justify-between mt-2 text-[10px] text-[#555]">
          <span>0 极寒</span>
          <span>20</span>
          <span>40</span>
          <span>60</span>
          <span>80</span>
          <span>100 极热</span>
        </div>
      </div>

      {/* 温度等级 */}
      <div className="text-center mt-6">
        <span className="text-3xl font-bold" style={{ color }}>{temp.toFixed(0)}</span>
        <span className="text-lg ml-1" style={{ color }}>°</span>
        <div className="text-sm mt-1">
          <span className="mr-1">{data.emoji}</span>
          <span style={{ color }}>{data.level}</span>
        </div>
        <div className="text-xs text-[#888] mt-1">{data.description}</div>
      </div>
    </div>
  )
}
