/* Dashboard v3 — 三屏"宏观位置感"面板
 *
 * 第一屏：宏观定位（PhilosophyBanner + MerillClock + PercentileBar + BullBear 卡片网格）
 * 第二屏：标的信号（SignalTable）
 * 第三屏：数据深度（DataSourcePanel）
 *
 * 组件编排，不在 Dashboard 里写业务逻辑
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchDashboard,
  fetchValuationHistory,
  fetchKlineHistory,
  fetchMacroDetails,
  fetchClockSummary,
} from '../api/client'
import type { KlineHistoryPoint, MacroDetail, ValuationHistoryPoint } from '../api/types'
import type { MarketTab } from '../components/Navbar'
import PhilosophyBanner from '../components/PhilosophyBanner'
import MerillClock from '../components/MerillClock'
import TemperatureGauge from '../components/TemperatureGauge'
import BullBearChart from '../components/BullBearChart'
import SignalTable from '../components/SignalTable'
import DataSourcePanel from '../components/DataSourcePanel'
import DeviationBar from '../components/DeviationBar'

// === 市场归类 ===
const MARKET_MAP: Record<string, MarketTab> = {
  '000001.SS': 'cn',
  '^GSPC': 'us',
  '^HSI': 'hk',
  NVDA: 'us',
  TSLA: 'us',
  MSFT: 'us',
  '0700.HK': 'hk',
  '9988.HK': 'hk',
  'BTC-USD': 'crypto',
  'ETH-USD': 'crypto',
  'SOL-USD': 'crypto',
  PDD: 'us',
  GOOGL: 'us',
}

function getMarket(sym: string): MarketTab {
  if (MARKET_MAP[sym]) return MARKET_MAP[sym]
  if (sym.endsWith('.SS') || sym.endsWith('.SZ')) return 'cn'
  if (sym.endsWith('.HK')) return 'hk'
  if (sym.includes('BTC') || sym.includes('ETH') || sym.includes('SOL') || sym.endsWith('-USD'))
    return 'crypto'
  return 'us'
}

export default function Dashboard() {
  const [tab, setTab] = useState<MarketTab>('all')

  // 主仪表盘数据
  const {
    data,
    isLoading,
    error,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  })

  // 新 API：宏观数据明细（Track A）
  const { data: macroDetails } = useQuery({
    queryKey: ['macro-details'],
    queryFn: fetchMacroDetails,
    staleTime: 10 * 60 * 1000,
  })

  // 双市场时钟摘要（cn + us）
  const { data: clockSummary } = useQuery({
    queryKey: ['clock-summary'],
    queryFn: fetchClockSummary,
    staleTime: 5 * 60 * 1000,
  })

  // 新 API：估值历史（Track A，取第一个标的作为综合参考）
  const firstSymbol = data?.market_temperature?.details?.[0]?.symbol
  const { data: valuationHistory } = useQuery({
    queryKey: ['valuation-history', firstSymbol],
    queryFn: () => fetchValuationHistory(firstSymbol!, 120),
    enabled: !!firstSymbol,
    staleTime: 30 * 60 * 1000,
  })

  // 新 API：K 线历史 — 为每个牛熊标的批量拉取
  const bullBearSymbols = data?.bull_bear?.map((b) => b.symbol) ?? []
  const { data: klineDataArray } = useQuery({
    queryKey: ['kline-history', bullBearSymbols.join(',')],
    queryFn: async () => {
      const results: Record<string, KlineHistoryPoint[]> = {}
      await Promise.all(
        bullBearSymbols.map(async (sym) => {
          const kline = await fetchKlineHistory(sym, 120)
          if (kline) results[sym] = kline
        }),
      )
      return results
    },
    enabled: bullBearSymbols.length > 0,
    staleTime: 30 * 60 * 1000,
  })

  // === 加载 / 错误状态 ===
  if (isLoading) {
    return <Loading />
  }

  if (error) {
    return <ErrorState error={error as Error} onRetry={() => refetch()} />
  }

  if (!data) return null

  // === 市场筛选 ===
  const filteredSignals =
    tab === 'all' ? data.signals : data.signals.filter((s) => getMarket(s.symbol) === tab)
  const filteredBullBear =
    tab === 'all' ? data.bull_bear : data.bull_bear.filter((b) => getMarket(b.symbol) === tab)
  const filteredTemps =
    tab === 'all'
      ? data.market_temperature.details
      : data.market_temperature.details.filter((t) => getMarket(t.symbol) === tab)

  const updated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleString('zh-CN') : '-'

  return (
    <div>
      <div className="mx-auto max-w-[1320px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">

        {/* 市场筛选 tabs (内联) */}
        <MarketTabs activeTab={tab} onTabChange={setTab} />
        {/* ═══════════════════════════════════════════
         * 第一屏：宏观定位（30 秒建立位置感）
         * ═══════════════════════════════════════════ */}

        {/* 投资哲学 Banner */}
        <PhilosophyBanner />

        {/* 三栏：美林时钟（双） + 市场温度 + 资产配置 */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* 美林时钟 — 双市场（中国 + 美国） */}
          <div>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-1">
              <MerillClock
                data={clockSummary?.cn ?? data.merill_clock}
                macroDetails={macroDetails as MacroDetail[] | null | undefined}
                marketLabel="🇨🇳 中国美林时钟"
              />
              {clockSummary?.us ? (
                <MerillClock
                  data={clockSummary.us}
                  marketLabel="🌍 美国美林时钟"
                  hideDataSource
                />
              ) : (
                <div className="rounded-2xl p-5 flex items-center justify-center text-[12px] text-[#555]"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', minHeight: 200 }}>
                  🌍 美国时钟数据加载中…
                </div>
              )}
            </div>
          </div>

          {/* 市场温度 — 百分位刻度尺 */}
          <TemperatureGauge
            details={filteredTemps}
            historyData={valuationHistory as ValuationHistoryPoint[] | null | undefined}
          />

          {/* 资产配置 */}
          <DeviationBar data={data.merill_clock} />
        </div>

        {/* 概览统计卡片 */}
        <div className="mt-6 grid gap-3 grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="宏观阶段"
            value={data.merill_clock.phase_label}
            detail={`GDP ${data.merill_clock.gdp_trend === 'up' ? '↑' : '↓'} · CPI ${data.merill_clock.cpi_trend === 'up' ? '↑' : '↓'}`}
          />
          <StatCard
            label="综合热度"
            value={`${filteredTemps.length ? (filteredTemps.reduce((s, t) => s + t.temperature, 0) / filteredTemps.length).toFixed(0) : '-'}°`}
            detail={describeTemperature(
              filteredTemps.length
                ? filteredTemps.reduce((s, t) => s + t.temperature, 0) / filteredTemps.length
                : 0,
            )}
          />
          <StatCard
            label="月线信号"
            value={`${filteredSignals.length}`}
            detail={
              filteredSignals.length
                ? `最强 ${[...filteredSignals].sort((a, b) => b.score - a.score)[0]?.name}`
                : '暂无'
            }
          />
          <StatCard
            label="牛熊占比"
            value={`${filteredBullBear.filter((b) => b.phase === 'bull' || b.phase === 'bull_early').length}/${filteredBullBear.length}`}
            detail="牛市标的 / 总标的"
          />
        </div>

        {/* 牛熊状态 — 卡片网格 + sparkline */}
        <div className="mt-6">
          <SectionTitle title="牛熊状态" sub="每个市场带 sparkline（月线 + MA12 + MA24）" updated={updated} />
          <div className="mt-4">
            <BullBearChart
              data={filteredBullBear}
              klineMap={klineDataArray as Record<string, KlineHistoryPoint[]> | undefined}
            />
          </div>
        </div>

        {/* ═══════════════════════════════════════════
         * 第二屏：标的信号
         * ═══════════════════════════════════════════ */}
        <div className="mt-12">
          <SectionTitle title="月线信号表" sub={'增加"上月变化"列，点击行可展开明细'} />
          <div className="mt-4">
            {filteredSignals.length > 0 ? (
              <SignalTable data={filteredSignals} />
            ) : (
              <EmptyState text="当前市场暂无月线信号数据。" />
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════
         * 第三屏：数据深度
         * ═══════════════════════════════════════════ */}
        <div className="mt-12">
          <SectionTitle title="数据深度" sub="折叠式宏观指标详情，含数据来源与更新时间" />
          <div className="mt-4">
            <DataSourcePanel data={macroDetails as MacroDetail[] | null} />
          </div>
        </div>
      </div>
    </div>
  )
}

// === 局部小组件 ===

function SectionTitle({ title, sub, updated }: { title: string; sub: string; updated?: string }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-lg font-bold text-[#e0e0e0] tracking-tight">{title}</h2>
        <p className="text-[11px] text-[#555] mt-0.5">{sub}</p>
      </div>
      {updated && <span className="text-[10px] text-[#444]">更新 {updated}</span>}
    </div>
  )
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="text-[10px] text-[#555] uppercase tracking-widest font-medium">{label}</div>
      <div className="mt-2 text-2xl font-extrabold text-[#e0e0e0] tracking-tight">{value}</div>
      <div className="mt-1 text-[11px] text-[#555] leading-relaxed">{detail}</div>
    </div>
  )
}

function Loading() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[1320px] items-center justify-center px-4">
      <div className="flex items-center gap-4 px-6 py-5 text-sm text-[#777] rounded-xl"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#eab308] border-t-transparent" />
        正在加载市场数据…
      </div>
    </div>
  )
}

function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[1320px] items-center justify-center px-4">
      <div className="max-w-md text-center rounded-xl px-8 py-8"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(239,68,68,0.15)' }}>
        <div className="text-[11px] text-[#555] uppercase tracking-widest">加载失败</div>
        <div className="mt-3 text-xl font-bold text-[#e0e0e0]">首页数据加载失败</div>
        <p className="mt-3 text-sm text-[#777]">{error.message}</p>
        <button
          className="mt-5 px-5 py-2.5 rounded-lg text-sm font-bold bg-[#eab308] text-[#0a0a14] hover:bg-[#facc15] transition-colors cursor-pointer"
          onClick={onRetry}
        >
          重新加载
        </button>
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      className="rounded-xl px-6 py-10 text-center text-[12px] text-[#555]"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.06)' }}
    >
      {text}
    </div>
  )
}

function describeTemperature(value: number): string {
  if (value < 30) return '偏冷，观察筛选阶段'
  if (value < 60) return '中性，等待确认'
  if (value < 80) return '偏热，谨慎管理仓位'
  return '高热，优先防守'
}

const MARKET_TABS: { key: MarketTab; label: string }[] = [
  { key: 'all', label: '总览' },
  { key: 'us', label: '美股' },
  { key: 'cn', label: 'A股' },
  { key: 'hk', label: '港股' },
  { key: 'crypto', label: '加密' },
]

function MarketTabs({ activeTab, onTabChange }: { activeTab: MarketTab; onTabChange: (t: MarketTab) => void }) {
  return (
    <div className="mb-6 flex items-center gap-1 overflow-x-auto">
      {MARKET_TABS.map((t) => {
        const active = t.key === activeTab
        return (
          <button
            key={t.key}
            onClick={() => onTabChange(t.key)}
            className={`shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all cursor-pointer ${
              active
                ? 'bg-[#eab308] text-[#0a0a14] shadow-[0_0_12px_rgba(234,179,8,0.3)]'
                : 'text-[#777] hover:text-[#ccc] hover:bg-white/[0.04]'
            }`}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
