/* 推荐配置 v2 — 堆叠 bar + 简洁图例 */

import type { MerillClockData } from '../api/types'

interface Props { data: MerillClockData }

const COLORS: Record<string, string> = {
  '股票': '#22c55e', '商品': '#f97316', '债券': '#3b82f6', '现金': '#666',
}

export default function DeviationBar({ data }: Props) {
  const entries = Object.entries(data.allocation).sort((a, b) => b[1] - a[1])

  return (
    <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-[11px] text-[#555] font-medium mb-3 uppercase tracking-widest">推荐配置</div>

      {/* 核心数据 */}
      {entries.length > 0 && (
        <div className="text-center mb-5">
          <div className="text-4xl font-extrabold" style={{ color: COLORS[entries[0][0]] || '#ccc' }}>
            {Math.round(entries[0][1] * 100)}%
          </div>
          <div className="text-[11px] text-[#555] mt-1">
            {entries[0][0]}为主
          </div>
        </div>
      )}

      {/* 堆叠条 */}
      <div className="flex h-5 rounded-full overflow-hidden mb-4"
        style={{ background: 'rgba(255,255,255,0.03)' }}>
        {entries.map(([asset, ratio]) => (
          <div key={asset}
            className="flex items-center justify-center text-[9px] font-bold text-white/90"
            style={{
              width: `${ratio * 100}%`,
              background: COLORS[asset] || '#555',
              minWidth: ratio > 0 ? '20px' : 0,
            }}>
            {ratio >= 0.15 ? `${Math.round(ratio * 100)}%` : ''}
          </div>
        ))}
      </div>

      {/* 图例 — 竖向 */}
      <div className="space-y-2">
        {entries.map(([asset, ratio]) => (
          <div key={asset} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-sm" style={{ background: COLORS[asset] || '#555' }} />
              <span className="text-xs text-[#999]">{asset}</span>
            </div>
            <span className="text-xs font-medium text-[#ccc] tabular-nums">{Math.round(ratio * 100)}%</span>
          </div>
        ))}
      </div>

      {/* 说明 */}
      <div className="text-[10px] text-[#444] mt-4 leading-relaxed border-t border-white/[0.04] pt-3">
        {data.description}
      </div>
    </div>
  )
}
