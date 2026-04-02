/* 数据溯源面板 — 折叠式宏观指标详情
 *
 * 默认折叠，点击展开
 * 表格：指标名 | 当前值 | 趋势(↑↓→) | 数据来源 | 更新时间
 */

import { useState } from 'react'
import type { MacroDetail } from '../api/types'

interface Props {
  /** 宏观数据明细（可能为 null，API 还没就绪时用 mock） */
  data: MacroDetail[] | null
}

/** Mock 数据 — 当 Track A API 还没就绪时用 */
const MOCK_DATA: MacroDetail[] = [
  { name: 'GDP 增速', value: '2.8%', trend: 'down', source: 'FRED / BEA', updated_at: '2026-03' },
  { name: 'CPI 同比', value: '3.2%', trend: 'up', source: 'FRED / BLS', updated_at: '2026-03' },
  { name: 'PMI 制造业', value: 51.3, trend: 'up', source: 'ISM', updated_at: '2026-03' },
  { name: 'M2 同比', value: '4.1%', trend: 'flat', source: 'FRED', updated_at: '2026-02' },
  { name: '联邦基金利率', value: '4.50%', trend: 'down', source: 'FRED / FOMC', updated_at: '2026-03' },
  { name: '非农就业', value: '+180K', trend: 'down', source: 'FRED / BLS', updated_at: '2026-03' },
]

const TREND_ICON: Record<string, { icon: string; color: string }> = {
  up: { icon: '↑', color: '#22c55e' },
  down: { icon: '↓', color: '#ef4444' },
  flat: { icon: '→', color: '#eab308' },
}

export default function DataSourcePanel({ data }: Props) {
  const [expanded, setExpanded] = useState(false)
  const items = data && data.length > 0 ? data : MOCK_DATA
  const isMock = !data || data.length === 0

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* 折叠头部 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 cursor-pointer transition-colors hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[#555] font-medium uppercase tracking-widest">数据溯源</span>
          {isMock && (
            <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ color: '#eab308', background: 'rgba(234,179,8,0.1)' }}>
              示例数据
            </span>
          )}
        </div>
        <span className="text-[#555] text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* 展开内容 */}
      {expanded && (
        <div className="px-5 pb-4">
          <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.04)' }}>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[10px] text-[#555] uppercase tracking-wider" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <th className="text-left py-2.5 px-4 font-medium">指标</th>
                  <th className="text-right py-2.5 px-4 font-medium">当前值</th>
                  <th className="text-center py-2.5 px-4 font-medium">趋势</th>
                  <th className="text-left py-2.5 px-4 font-medium hidden sm:table-cell">数据来源</th>
                  <th className="text-right py-2.5 px-4 font-medium hidden md:table-cell">更新时间</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const t = TREND_ICON[item.trend] || TREND_ICON.flat
                  return (
                    <tr
                      key={item.name}
                      className="transition-colors hover:bg-white/[0.02]"
                      style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.03)' : undefined }}
                    >
                      <td className="py-2.5 px-4 text-[#ccc] font-medium">{item.name}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-[#e0e0e0] tabular-nums">
                        {typeof item.value === 'number' ? item.value.toFixed(1) : item.value}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="text-base font-bold" style={{ color: t.color }}>{t.icon}</span>
                      </td>
                      <td className="py-2.5 px-4 text-[#555] hidden sm:table-cell">{item.source}</td>
                      <td className="py-2.5 px-4 text-right text-[#444] hidden md:table-cell">{item.updated_at}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-[10px] text-[#444] leading-relaxed">
            覆盖指标：GDP / CPI / PMI / M2 / 利率 / 就业。数据来源标注仅供参考，实际以后端接口返回为准。
          </div>
        </div>
      )}
    </div>
  )
}
