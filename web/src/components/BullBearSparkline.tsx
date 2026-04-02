/* 牛熊 Sparkline — 紧凑的 10 年月线迷你图
 *
 * 三条线: close（主色）+ MA12（虚线）+ MA24（点线）
 * 150×60px，无坐标轴标签
 */

import { LineChart, Line, YAxis, ResponsiveContainer } from 'recharts'
import type { KlineHistoryPoint } from '../api/types'

interface Props {
  /** K 线历史数据 */
  data: KlineHistoryPoint[]
  /** 主色（close 线颜色） */
  color?: string
  /** 宽度，默认 150 */
  width?: number
  /** 高度，默认 60 */
  height?: number
}

export default function BullBearSparkline({
  data,
  color = '#22c55e',
  width = 150,
  height = 60,
}: Props) {
  if (!data || data.length === 0) {
    // 无数据时显示占位
    return (
      <div
        className="rounded-lg flex items-center justify-center text-[9px] text-[#444]"
        style={{ width, height, background: 'rgba(255,255,255,0.02)' }}
      >
        暂无数据
      </div>
    )
  }

  // 计算 Y 轴范围
  const closes = data.map((d) => d.close).filter(Boolean)
  const mn = Math.min(...closes) * 0.95
  const mx = Math.max(...closes) * 1.05

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis domain={[mn, mx]} hide />
          {/* 月线 close — 主色实线 */}
          <Line
            type="monotone"
            dataKey="close"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          {/* MA12 — 虚线 */}
          <Line
            type="monotone"
            dataKey="ma12"
            stroke="#00d4ff"
            strokeWidth={1}
            strokeDasharray="4 2"
            dot={false}
            isAnimationActive={false}
          />
          {/* MA24 — 点线 */}
          <Line
            type="monotone"
            dataKey="ma24"
            stroke="#7c3aed"
            strokeWidth={1}
            strokeDasharray="2 2"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
