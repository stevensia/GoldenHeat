/* 温度计 v3 — 综合市场温度 + 各标的温度条列表
 *
 * 重构：从单个标的温度改为综合 PercentileBar + 标的明细列表
 * 保持 dark theme 一致
 */

import type { TemperatureData } from '../api/types'
import PercentileBar from './PercentileBar'
import type { ValuationHistoryPoint } from '../api/types'

interface Props {
  /** 各标的温度明细 */
  details: TemperatureData[]
  /** 10 年 PE 百分位趋势（可选，来自新 API） */
  historyData?: ValuationHistoryPoint[] | null
}

export default function TemperatureGauge({ details, historyData }: Props) {
  // 计算综合百分位（用 pe_percentile 优先，回退到 temperature）
  const percentiles = details.map((d) => d.pe_percentile ?? d.temperature)
  const avgPercentile = percentiles.length
    ? percentiles.reduce((a, b) => a + b, 0) / percentiles.length
    : 50

  return (
    <PercentileBar
      percentile={avgPercentile}
      details={details}
      historyData={historyData}
    />
  )
}
