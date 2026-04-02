/* 偏离度指示条
 *
 * 显示美林时钟推荐配置的资产分配比例
 * 如果没有实际持仓数据，显示推荐配置
 */

import type { MerillClockData } from '../api/types'

interface Props {
  data: MerillClockData
}

const ASSET_COLORS: Record<string, string> = {
  '股票': '#22c55e',
  '商品': '#f97316',
  '债券': '#3b82f6',
  '现金': '#888888',
}

export default function DeviationBar({ data }: Props) {
  const entries = Object.entries(data.allocation).sort((a, b) => b[1] - a[1])

  return (
    <div className="bg-[#111122] border border-[#1e1e3a] rounded-2xl p-6 shadow-lg shadow-black/30">
      <h3 className="text-sm font-medium text-[#888] mb-3 tracking-wide">推荐配置</h3>

      {/* 核心数据突出 — 最大配比资产 */}
      {entries.length > 0 && (
        <div className="text-center mb-4">
          <div className="text-3xl font-bold" style={{ color: ASSET_COLORS[entries[0][0]] || '#ccc' }}>
            {Math.round(entries[0][1] * 100)}%
          </div>
          <div className="text-sm text-gray-500">{entries[0][0]}为主</div>
        </div>
      )}

      {/* 堆叠条 */}
      <div className="flex h-7 rounded-full overflow-hidden mb-3">
        {entries.map(([asset, ratio]) => (
          <div
            key={asset}
            className="flex items-center justify-center text-[10px] font-bold text-white transition-all duration-500"
            style={{
              width: `${ratio * 100}%`,
              background: ASSET_COLORS[asset] || '#555',
              minWidth: ratio > 0 ? '24px' : 0,
            }}
          >
            {ratio >= 0.15 ? `${Math.round(ratio * 100)}%` : ''}
          </div>
        ))}
      </div>

      {/* 图例 */}
      <div className="flex flex-wrap justify-center gap-3 mt-3">
        {entries.map(([asset, ratio]) => (
          <div key={asset} className="flex items-center gap-1.5 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: ASSET_COLORS[asset] || '#555' }} />
            <span className="text-[#ccc]">{asset}</span>
            <span className="text-[#888]">{Math.round(ratio * 100)}%</span>
          </div>
        ))}
      </div>

      {/* 阶段说明 */}
      <div className="text-xs text-[#888] text-center mt-3 leading-relaxed">
        {data.description}
      </div>
    </div>
  )
}
