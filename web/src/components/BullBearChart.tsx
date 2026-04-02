/* 牛熊分割线卡片 v2
 *
 * 参考 heatmap 的 zone 格子 + clock 的紧凑数据
 * 每张卡片: 状态色 + 迷你图 + 数据行
 */

import { LineChart, Line, YAxis, ResponsiveContainer } from 'recharts'
import type { BullBearData } from '../api/types'

interface Props { data: BullBearData[] }

const COLORS: Record<string, string> = {
  bull: '#22c55e', bull_early: '#84cc16',
  bear_early: '#eab308', bear: '#ef4444',
}

export default function BullBearChart({ data }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {data.map(item => <Card key={item.symbol} d={item} />)}
    </div>
  )
}

function Card({ d }: { d: BullBearData }) {
  const color = COLORS[d.phase] || '#888'
  const bull = d.phase === 'bull' || d.phase === 'bull_early'

  const vals = [d.ma24, d.ma12, d.current_price].filter(Boolean)
  const mn = Math.min(...vals) * 0.97, mx = Math.max(...vals) * 1.03
  const chart = [
    { p: d.ma24, a: d.ma24 * 0.99, b: d.ma24 },
    { p: d.ma12, a: d.ma12, b: d.ma24 },
    { p: d.current_price, a: d.ma12, b: d.ma24 },
  ]

  const posMatch = d.position_range.match(/(\d+)/)
  const pct = posMatch ? parseInt(posMatch[1]) : 50

  return (
    <div className="rounded-xl p-4 transition-all hover:-translate-y-0.5"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${color}22`,
      }}>
      {/* 头部 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-medium text-[#e0e0e0]">{d.name}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
          style={{ color, background: `${color}15` }}>
          {d.phase_emoji} {d.phase_label}
        </span>
      </div>

      {/* 迷你图 */}
      <div className="h-12 mb-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chart}>
            <YAxis domain={[mn, mx]} hide />
            <Line type="monotone" dataKey="p" stroke={color} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="a" stroke="#00d4ff" strokeWidth={1} strokeDasharray="3 2" dot={false} />
            <Line type="monotone" dataKey="b" stroke="#7c3aed" strokeWidth={1} strokeDasharray="2 2" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 数据行 */}
      <div className="grid grid-cols-3 gap-1 text-[10px] mb-2">
        <div>
          <div className="text-[#555]">现价</div>
          <div className="text-[#ccc] font-mono tabular-nums">{d.current_price.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[#555]">偏离年线</div>
          <div className="font-mono tabular-nums" style={{ color: d.price_vs_ma12_pct >= 0 ? '#22c55e' : '#ef4444' }}>
            {d.price_vs_ma12_pct >= 0 ? '+' : ''}{d.price_vs_ma12_pct.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-[#555]">建议仓位</div>
          <div className="text-[#ccc] font-medium">{d.position_range}</div>
        </div>
      </div>

      {/* 仓位进度条 */}
      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <div className="h-full rounded-full" style={{
          width: `${pct}%`,
          background: bull
            ? 'linear-gradient(90deg, #22c55e, #4ade80)'
            : 'linear-gradient(90deg, #ef4444, #f87171)',
        }} />
      </div>

      {/* 策略 */}
      <div className="text-[10px] text-[#555] mt-2">{d.strategy}</div>
    </div>
  )
}
