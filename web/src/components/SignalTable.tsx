/* 月线信号热力表
 *
 * 表格: 标的名称 | 代码 | 当前价 | 趋势 | 回调位置 | 评分 | 信号
 * 评分列热力色彩，可点击展开详情
 */

import { useState } from 'react'
import type { SignalData } from '../api/types'

interface Props {
  data: SignalData[]
}

// 评分 → 热力颜色
function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e'  // 强买入 — 绿
  if (score >= 60) return '#84cc16'  // 关注 — 黄绿
  if (score >= 40) return '#eab308'  // 持有 — 黄
  if (score >= 20) return '#f97316'  // 警惕 — 橙
  return '#ef4444'                    // 强卖出 — 红
}

// 评分 → 背景色 (低透明度)
function scoreBg(score: number): string {
  if (score >= 80) return 'rgba(34,197,94,0.12)'
  if (score >= 60) return 'rgba(132,204,22,0.10)'
  if (score >= 40) return 'rgba(234,179,8,0.08)'
  if (score >= 20) return 'rgba(249,115,22,0.10)'
  return 'rgba(239,68,68,0.12)'
}

function formatPrice(p: number | null): string {
  if (p === null) return '-'
  if (p >= 10000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (p >= 100) return p.toFixed(1)
  return p.toFixed(2)
}

export default function SignalTable({ data }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="bg-[#111122] border border-[#1e1e3a] rounded-2xl p-5">
      <h3 className="text-sm font-medium text-[#888] mb-4 tracking-wide">月线信号热力表</h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[#888] text-xs border-b border-[#1e1e3a]">
              <th className="text-left py-2 px-2 font-medium">标的</th>
              <th className="text-left py-2 px-2 font-medium hidden sm:table-cell">代码</th>
              <th className="text-right py-2 px-2 font-medium">现价</th>
              <th className="text-center py-2 px-2 font-medium">趋势</th>
              <th className="text-center py-2 px-2 font-medium hidden md:table-cell">回调位置</th>
              <th className="text-center py-2 px-2 font-medium">评分</th>
              <th className="text-center py-2 px-2 font-medium">信号</th>
            </tr>
          </thead>
          <tbody>
            {data.map(s => (
              <>
                <tr
                  key={s.symbol}
                  className="border-b border-[#1e1e3a]/50 cursor-pointer hover:bg-[#1a1a2e] transition-colors"
                  onClick={() => setExpanded(expanded === s.symbol ? null : s.symbol)}
                >
                  <td className="py-2.5 px-2 font-medium text-[#e0e0e0]">{s.name}</td>
                  <td className="py-2.5 px-2 text-[#888] text-xs hidden sm:table-cell">{s.symbol}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-[#ccc]">{formatPrice(s.current_price)}</td>
                  <td className="py-2.5 px-2 text-center">
                    <TrendBadge trend={s.trend} label={s.trend_label} />
                  </td>
                  <td className="py-2.5 px-2 text-center text-xs text-[#aaa] hidden md:table-cell">{s.pullback_label}</td>
                  <td className="py-2.5 px-2 text-center">
                    <span className="inline-block w-12 py-0.5 rounded-md text-xs font-bold"
                      style={{ color: scoreColor(s.score), background: scoreBg(s.score) }}>
                      {s.score.toFixed(0)}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ color: scoreColor(s.score), background: scoreBg(s.score) }}>
                      {s.level_label}
                    </span>
                  </td>
                </tr>

                {/* 展开详情 */}
                {expanded === s.symbol && (
                  <tr key={`${s.symbol}-detail`}>
                    <td colSpan={7} className="py-3 px-4 bg-[#0d0d1a]">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <DetailItem label="MA5" value={s.ma5?.toFixed(2)} />
                        <DetailItem label="MA10" value={s.ma10?.toFixed(2)} />
                        <DetailItem label="MA20" value={s.ma20?.toFixed(2)} />
                        <DetailItem label="回调" value={s.pullback_label} />
                        <DetailItem label="成交量" value={s.volume_signal} />
                        <DetailItem label="量比" value={s.volume_ratio?.toFixed(2)} />
                        <DetailItem label="趋势分" value={s.breakdown.trend_score.toFixed(0)} />
                        <DetailItem label="回调分" value={s.breakdown.pullback_score.toFixed(0)} />
                        <DetailItem label="量能分" value={s.breakdown.volume_score.toFixed(0)} />
                        <DetailItem label="估值分" value={s.breakdown.valuation_score?.toFixed(1) ?? 'N/A'} />
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TrendBadge({ trend, label }: { trend: string; label: string }) {
  const colors: Record<string, { text: string; bg: string }> = {
    bullish:  { text: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
    bearish:  { text: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    sideways: { text: '#eab308', bg: 'rgba(234,179,8,0.08)' },
  }
  const c = colors[trend] || colors.sideways
  return (
    <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: c.text, background: c.bg }}>
      {label}
    </span>
  )
}

function DetailItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="text-[#666]">{label}: </span>
      <span className="text-[#ccc]">{value ?? '-'}</span>
    </div>
  )
}
