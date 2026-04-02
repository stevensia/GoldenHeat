/* 牛熊分割线卡片
 *
 * 每个市场一张卡片:
 * - 状态标签 (🟢牛市/🟡牛初/🟡熊初/🔴熊市)
 * - 迷你月线折线图 + MA12 + MA24
 * - 仓位建议
 */

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import type { BullBearData } from '../api/types'

interface Props {
  data: BullBearData[]
}

const PHASE_COLORS: Record<string, string> = {
  bull: '#22c55e',
  bull_early: '#84cc16',
  bear_early: '#eab308',
  bear: '#ef4444',
}

export default function BullBearChart({ data }: Props) {
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map(item => (
          <BullBearCard key={item.symbol} item={item} />
        ))}
      </div>
    </div>
  )
}

function BullBearCard({ item }: { item: BullBearData }) {
  const color = PHASE_COLORS[item.phase] || '#888'
  const isBullish = item.phase === 'bull' || item.phase === 'bull_early'
  const borderColor = isBullish ? '#22c55e' : '#ef4444'

  // 解析仓位范围取中间值作为进度条宽度
  const positionMatch = item.position_range.match(/(\d+)/)
  const positionPct = positionMatch ? parseInt(positionMatch[1]) : 50

  // 构造迷你图数据：用 current_price, ma12, ma24 展示相对位置
  const values = [item.ma24, item.ma12, item.current_price].filter(Boolean)
  const minVal = Math.min(...values) * 0.97
  const maxVal = Math.max(...values) * 1.03
  // 模拟最近几个月的趋势（简化：3个点表示方向）
  const chartData = [
    { name: '前', price: item.ma24, ma12: item.ma24 * 0.99, ma24: item.ma24 },
    { name: '中', price: item.ma12, ma12: item.ma12, ma24: item.ma24 },
    { name: '近', price: item.current_price, ma12: item.ma12, ma24: item.ma24 },
  ]

  return (
    <div
      className="bg-[#0d0d1a] rounded-xl p-4 hover:-translate-y-1 transition-all duration-300 shadow-lg shadow-black/20"
      style={{ border: `1px solid ${borderColor}40` }}
    >
      {/* 头部: 名称 + 状态 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-[#e0e0e0]">{item.name}</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ color, background: `${color}18` }}>
          {item.phase_emoji} {item.phase_label}
        </span>
      </div>

      {/* 迷你图 */}
      <div className="h-16 mt-1 mb-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <YAxis domain={[minVal, maxVal]} hide />
            <XAxis dataKey="name" hide />
            <Line type="monotone" dataKey="price" stroke={color} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="ma12" stroke="#00d4ff" strokeWidth={1} strokeDasharray="4 2" dot={false} />
            <Line type="monotone" dataKey="ma24" stroke="#7c3aed" strokeWidth={1} strokeDasharray="2 2" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 图例 */}
      <div className="flex gap-3 text-[10px] text-[#666] mb-2">
        <span><span className="inline-block w-2 h-0.5 mr-1" style={{ background: color }} />价格</span>
        <span><span className="inline-block w-2 h-0.5 mr-1 bg-[#00d4ff]" />年线</span>
        <span><span className="inline-block w-2 h-0.5 mr-1 bg-[#7c3aed]" />两年线</span>
      </div>

      {/* 数据 */}
      <div className="grid grid-cols-3 gap-1 text-[10px]">
        <div>
          <div className="text-[#666]">现价</div>
          <div className="text-[#ccc] font-mono">{item.current_price.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[#666]">偏离年线</div>
          <div className="font-mono" style={{ color: item.price_vs_ma12_pct >= 0 ? '#22c55e' : '#ef4444' }}>
            {item.price_vs_ma12_pct >= 0 ? '+' : ''}{item.price_vs_ma12_pct.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-[#666]">建议仓位</div>
          <div className="text-[#ccc] font-medium">{item.position_range}</div>
        </div>
      </div>

      {/* 仓位进度条 */}
      <div className="mt-2">
        <div className="h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${positionPct}%`,
              background: isBullish
                ? 'linear-gradient(to right, #22c55e, #4ade80)'
                : 'linear-gradient(to right, #ef4444, #f87171)',
            }}
          />
        </div>
      </div>

      {/* 策略 */}
      <div className="text-[10px] text-[#888] mt-2 pt-2 border-t border-[#1e1e3a]">
        {item.strategy}
      </div>
    </div>
  )
}
