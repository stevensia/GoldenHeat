/* 月线信号热力表 v3
 *
 * 增强：新增"变化"列，显示与上月分数差值（↑12 / ↓5 / →）
 * 使用 prev_score 字段计算
 */

import { useState } from 'react'
import type { SignalData } from '../api/types'

interface Props { data: SignalData[] }

function scoreColor(s: number): string {
  if (s >= 80) return '#34d399'
  if (s >= 60) return '#facc15'
  if (s >= 40) return '#9ca3af'
  if (s >= 20) return '#fb923c'
  return '#f87171'
}

function scoreBg(s: number): string {
  if (s >= 80) return 'rgba(34,197,94,0.1)'
  if (s >= 60) return 'rgba(250,204,21,0.08)'
  if (s >= 40) return 'rgba(156,163,175,0.06)'
  if (s >= 20) return 'rgba(251,146,60,0.08)'
  return 'rgba(248,113,113,0.1)'
}

function fmtPrice(p: number | null): string {
  if (p === null) return '-'
  if (p >= 10000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (p >= 100) return p.toFixed(1)
  return p.toFixed(2)
}

/** 计算变化文字和颜色 */
function getChangeDisplay(current: number, prev?: number | null): { text: string; color: string } {
  if (prev === null || prev === undefined) return { text: '—', color: '#555' }
  const diff = Math.round(current - prev)
  if (diff > 0) return { text: `↑${diff}`, color: '#22c55e' }
  if (diff < 0) return { text: `↓${Math.abs(diff)}`, color: '#ef4444' }
  return { text: '→', color: '#eab308' }
}

export default function SignalTable({ data }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.04)' }}>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-[10px] text-[#555] uppercase tracking-wider" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <th className="text-left py-2.5 px-4 font-medium">标的</th>
            <th className="text-right py-2.5 px-4 font-medium">现价</th>
            <th className="text-center py-2.5 px-4 font-medium">趋势</th>
            <th className="text-center py-2.5 px-4 font-medium hidden md:table-cell">回调</th>
            <th className="text-center py-2.5 px-4 font-medium w-20">评分</th>
            <th className="text-center py-2.5 px-4 font-medium w-16">变化</th>
            <th className="text-center py-2.5 px-4 font-medium">信号</th>
          </tr>
        </thead>
        <tbody>
          {data.map((s, i) => {
            const change = getChangeDisplay(s.score, s.prev_score)
            return (
              <Fragment key={s.symbol}>
                <tr
                  className="cursor-pointer transition-colors hover:bg-white/[0.03]"
                  style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.03)' : undefined }}
                  onClick={() => setExpanded(expanded === s.symbol ? null : s.symbol)}
                >
                  <td className="py-3 px-4">
                    <div className="font-medium text-[#e0e0e0]">{s.name}</div>
                    <div className="text-[10px] text-[#444] mt-0.5">{s.symbol}</div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[#bbb] tabular-nums">{fmtPrice(s.current_price)}</td>
                  <td className="py-3 px-4 text-center">
                    <TrendPill trend={s.trend} label={s.trend_label} />
                  </td>
                  <td className="py-3 px-4 text-center text-[11px] text-[#777] hidden md:table-cell">{s.pullback_label}</td>
                  <td className="py-3 px-4 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-8 rounded-lg text-base font-extrabold"
                      style={{ color: scoreColor(s.score), background: scoreBg(s.score) }}>
                      {s.score.toFixed(0)}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-[12px] font-bold font-mono tabular-nums" style={{ color: change.color }}>
                      {change.text}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ color: scoreColor(s.score), background: scoreBg(s.score) }}>
                      {s.level_label}
                    </span>
                  </td>
                </tr>

                {expanded === s.symbol && (
                  <tr>
                    <td colSpan={7} className="px-4 py-3" style={{ background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-2 text-[11px]">
                        <KV k="MA5" v={s.ma5?.toFixed(2)} />
                        <KV k="MA10" v={s.ma10?.toFixed(2)} />
                        <KV k="MA20" v={s.ma20?.toFixed(2)} />
                        <KV k="成交量" v={s.volume_signal} />
                        <KV k="量比" v={s.volume_ratio?.toFixed(2)} />
                        <KV k="趋势分" v={s.breakdown.trend_score.toFixed(0)} />
                        <KV k="回调分" v={s.breakdown.pullback_score.toFixed(0)} />
                        <KV k="量能分" v={s.breakdown.volume_score.toFixed(0)} />
                        <KV k="估值分" v={s.breakdown.valuation_score?.toFixed(1) ?? 'N/A'} />
                        {s.prev_score != null && (
                          <KV k="上月评分" v={s.prev_score.toFixed(0)} />
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// 需要 Fragment import
import { Fragment } from 'react'

function TrendPill({ trend, label }: { trend: string; label: string }) {
  const m: Record<string, { c: string; bg: string }> = {
    bullish:  { c: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
    bearish:  { c: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    sideways: { c: '#eab308', bg: 'rgba(234,179,8,0.06)' },
  }
  const s = m[trend] || m.sideways
  return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ color: s.c, background: s.bg }}>{label}</span>
}

function KV({ k, v }: { k: string; v?: string | null }) {
  return <div><span className="text-[#555]">{k}</span> <span className="text-[#bbb] font-mono">{v ?? '-'}</span></div>
}
