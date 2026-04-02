/* 百分位刻度尺 — 10 年 PE 百分位水平横条
 *
 * 替代旧温度计，5 段渐变色，当前位置实心圆点
 * 可展开 10 年趋势图
 */

import { useState } from 'react'
import type { TemperatureData, ValuationHistoryPoint } from '../api/types'
import HistoryChart from './HistoryChart'

interface Props {
  /** 当前综合百分位（0-100） */
  percentile: number
  /** 标的温度明细列表 */
  details: TemperatureData[]
  /** 10 年 PE 百分位趋势数据（可能为 null，API 还没就绪时） */
  historyData?: ValuationHistoryPoint[] | null
}

/** 根据百分位获取颜色 */
function getPercentileColor(p: number): string {
  if (p < 20) return '#3b82f6'
  if (p < 40) return '#06b6d4'
  if (p < 60) return '#22c55e'
  if (p < 80) return '#f97316'
  return '#ef4444'
}

/** 获取百分位描述 */
function getPercentileLabel(p: number): string {
  if (p < 10) return '极度低估'
  if (p < 25) return '偏低估'
  if (p < 40) return '合理偏低'
  if (p < 60) return '合理区间'
  if (p < 75) return '合理偏高'
  if (p < 90) return '偏高估'
  return '极度高估'
}

export default function PercentileBar({ percentile, details, historyData }: Props) {
  const [expanded, setExpanded] = useState(false)
  const color = getPercentileColor(percentile)
  const label = getPercentileLabel(percentile)

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-[11px] text-[#555] font-medium uppercase tracking-widest">市场温度 · 10年百分位</div>
        <div className="text-xs font-medium" style={{ color }}>{label}</div>
      </div>

      {/* 主刻度尺 */}
      <div className="relative mb-2">
        {/* 5 段渐变背景条 */}
        <div className="h-3 rounded-full overflow-hidden flex">
          <div className="flex-1" style={{ background: '#3b82f6' }} />
          <div className="flex-1" style={{ background: '#06b6d4' }} />
          <div className="flex-1" style={{ background: '#22c55e' }} />
          <div className="flex-1" style={{ background: '#f97316' }} />
          <div className="flex-1" style={{ background: '#ef4444' }} />
        </div>
        {/* 当前位置圆点 */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-[#0a0a14] shadow-lg transition-all"
          style={{
            left: `${Math.max(2, Math.min(98, percentile))}%`,
            transform: 'translate(-50%, -50%)',
            background: color,
            boxShadow: `0 0 8px ${color}88`,
          }}
        />
      </div>

      {/* 刻度标签 */}
      <div className="flex justify-between text-[9px] text-[#555] mb-4 px-1">
        <span>0% 极寒❄️</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>100% 极热🌋</span>
      </div>

      {/* 当前数值 */}
      <div className="text-center mb-4">
        <span className="text-3xl font-extrabold tabular-nums" style={{ color }}>
          {percentile.toFixed(0)}
        </span>
        <span className="text-lg ml-1" style={{ color }}>%</span>
        <div className="text-[11px] text-[#555] mt-1">
          当前估值处于10年 {percentile.toFixed(0)}% 分位
        </div>
      </div>

      {/* 各标的小温度条列表 */}
      {details.length > 0 && (
        <div className="space-y-2 mb-3">
          {details.slice(0, 6).map((item) => {
            const itemColor = getPercentileColor(item.pe_percentile ?? item.temperature)
            const pct = item.pe_percentile ?? item.temperature
            return (
              <div key={item.symbol} className="flex items-center gap-3">
                <span className="text-[11px] text-[#999] w-16 truncate shrink-0">{item.name}</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.max(3, pct)}%`, background: itemColor }}
                  />
                </div>
                <span className="text-[11px] font-mono tabular-nums w-8 text-right" style={{ color: itemColor }}>
                  {pct.toFixed(0)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* 展开按钮 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-center text-[11px] py-2 rounded-lg transition-colors cursor-pointer"
        style={{ color: '#777', background: expanded ? 'rgba(255,255,255,0.04)' : 'transparent' }}
      >
        {expanded ? '收起趋势图 ▲' : '展开10年百分位趋势 ▼'}
      </button>

      {/* 展开区域 — 10 年 PE 百分位趋势 */}
      {expanded && (
        <div className="mt-3">
          {historyData && historyData.length > 0 ? (
            <HistoryChart data={historyData} dataKey="percentile" />
          ) : (
            <div className="text-center text-[11px] text-[#555] py-8 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
              估值历史数据加载中或暂不可用
            </div>
          )}
        </div>
      )}
    </div>
  )
}
