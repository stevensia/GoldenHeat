/* 牛熊分割线卡片 v3
 *
 * 增强：卡片网格，每个卡片包含
 * - 标的名 + 🟢🟡🔴 状态 emoji
 * - 偏离年线百分比
 * - BullBearSparkline（10年趋势）
 * - 一句话策略
 */

import type { BullBearData, KlineHistoryPoint } from '../api/types'
import BullBearSparkline from './BullBearSparkline'

interface Props {
  data: BullBearData[]
  /** K 线历史数据 map：symbol → KlineHistoryPoint[] */
  klineMap?: Record<string, KlineHistoryPoint[]>
}

const PHASE_COLORS: Record<string, string> = {
  bull: '#22c55e',
  bull_early: '#84cc16',
  bear_early: '#eab308',
  bear: '#ef4444',
}

export default function BullBearChart({ data, klineMap }: Props) {
  if (data.length === 0) {
    return (
      <div className="text-center text-[11px] text-[#555] py-8 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
        暂无牛熊分界数据
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {data.map((item) => (
        <BullBearCard key={item.symbol} d={item} kline={klineMap?.[item.symbol]} />
      ))}
    </div>
  )
}

function BullBearCard({ d, kline }: { d: BullBearData; kline?: KlineHistoryPoint[] }) {
  const color = PHASE_COLORS[d.phase] || '#888'
  const bull = d.phase === 'bull' || d.phase === 'bull_early'

  const posMatch = d.position_range.match(/(\d+)/)
  const pct = posMatch ? parseInt(posMatch[1]) : 50

  // 如果没有真实 kline 数据，用当前价格和 MA 合成 mock sparkline
  const sparkData: { close: number; ma12?: number; ma24?: number }[] = kline && kline.length > 0
    ? kline
    : [
        { close: d.ma24 * 0.98, ma12: d.ma24 * 0.99, ma24: d.ma24 },
        { close: d.ma24, ma12: d.ma24, ma24: d.ma24 },
        { close: d.ma12 * 0.98, ma12: d.ma12 * 0.99, ma24: d.ma24 },
        { close: d.ma12, ma12: d.ma12, ma24: d.ma24 },
        { close: (d.ma12 + d.current_price) / 2, ma12: d.ma12, ma24: d.ma24 },
        { close: d.current_price, ma12: d.ma12, ma24: d.ma24 },
      ]

  return (
    <div
      className="rounded-xl p-4 transition-all hover:-translate-y-0.5"
      style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}22` }}
    >
      {/* 头部：标的名 + 状态 */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-[13px] font-medium text-[#e0e0e0]">{d.name}</span>
          <span className="text-[10px] text-[#444] ml-2">{d.symbol}</span>
        </div>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-bold"
          style={{ color, background: `${color}15` }}
        >
          {d.phase_emoji} {d.phase_label}
        </span>
      </div>

      {/* 偏离年线 */}
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-[10px] text-[#555]">偏离年线</span>
        <span
          className="text-lg font-extrabold font-mono tabular-nums"
          style={{ color: d.price_vs_ma12_pct >= 0 ? '#22c55e' : '#ef4444' }}
        >
          {d.price_vs_ma12_pct >= 0 ? '+' : ''}{d.price_vs_ma12_pct.toFixed(1)}%
        </span>
      </div>

      {/* Sparkline */}
      <div className="flex justify-center mb-3">
        <BullBearSparkline
          data={sparkData as { close: number; ma12?: number; ma24?: number; date: string }[]}
          color={color}
          width={180}
          height={56}
        />
      </div>

      {/* 数据行 */}
      <div className="grid grid-cols-3 gap-1 text-[10px] mb-2">
        <div>
          <div className="text-[#555]">现价</div>
          <div className="text-[#ccc] font-mono tabular-nums">{d.current_price.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[#555]">MA12 vs MA24</div>
          <div className="font-mono tabular-nums" style={{ color: d.ma12_vs_ma24_pct >= 0 ? '#22c55e' : '#ef4444' }}>
            {d.ma12_vs_ma24_pct >= 0 ? '+' : ''}{d.ma12_vs_ma24_pct.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-[#555]">建议仓位</div>
          <div className="text-[#ccc] font-medium">{d.position_range}</div>
        </div>
      </div>

      {/* 仓位进度条 */}
      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: bull
              ? 'linear-gradient(90deg, #22c55e, #4ade80)'
              : 'linear-gradient(90deg, #ef4444, #f87171)',
          }}
        />
      </div>

      {/* 一句话策略 */}
      <div className="text-[10px] text-[#555] mt-2 leading-relaxed">{d.strategy}</div>
    </div>
  )
}
