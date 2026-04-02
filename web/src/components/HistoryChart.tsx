/* 10 年趋势图（通用） — Recharts AreaChart
 *
 * 接收 data[] 和 dataKey 参数，响应式，带 tooltip
 */

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface Props {
  /** 数据数组，每个元素至少有 date 字段 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[]
  /** 要渲染的数据字段名 */
  dataKey: string
  /** 颜色，默认 #3b82f6 */
  color?: string
  /** 高度，默认 180 */
  height?: number
}

export default function HistoryChart({
  data,
  dataKey,
  color = '#3b82f6',
  height = 180,
}: Props) {
  if (!data || data.length === 0) {
    return (
      <div
        className="rounded-xl flex items-center justify-center text-[11px] text-[#555]"
        style={{ height, background: 'rgba(255,255,255,0.02)' }}
      >
        暂无历史数据
      </div>
    )
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fill: '#444', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#555', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(10,10,20,0.95)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              fontSize: '12px',
              color: '#ccc',
            }}
            cursor={{ stroke: 'rgba(255,255,255,0.08)' }}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            fill={`url(#grad-${dataKey})`}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
