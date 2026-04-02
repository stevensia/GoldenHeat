/* Dashboard v2 — 全新设计
 *
 * 设计语言:
 * - 参考 heatmap.html: #0a0a14 背景 · 渐变强调 · 紧凑数据密度 · 统计卡片
 * - 参考 clock-web: 圆盘 · 毛玻璃 · 渐变标题 · 紧凑间距
 * - 去掉冗余包裹层，section 用简洁分隔
 * - 统计卡片顶栏 (overview stats)
 * - 一致的 max-w-[1200px] 和 px
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchDashboard } from '../api/client'
import Navbar, { type MarketTab } from '../components/Navbar'
import MerillClock from '../components/MerillClock'
import TemperatureGauge from '../components/TemperatureGauge'
import DeviationBar from '../components/DeviationBar'
import SignalTable from '../components/SignalTable'
import BullBearChart from '../components/BullBearChart'

const MARKET_MAP: Record<string, MarketTab> = {
  '000001.SS': 'cn', '^GSPC': 'us', '^HSI': 'hk',
  'NVDA': 'us', 'TSLA': 'us', 'MSFT': 'us',
  '0700.HK': 'hk', '9988.HK': 'hk', 'BTC-USD': 'crypto',
}

function getMarket(sym: string): MarketTab {
  if (MARKET_MAP[sym]) return MARKET_MAP[sym]
  if (sym.endsWith('.SS') || sym.endsWith('.SZ')) return 'cn'
  if (sym.endsWith('.HK')) return 'hk'
  if (sym.includes('USD') || sym.includes('BTC') || sym.includes('ETH')) return 'crypto'
  return 'us'
}

const W = 'max-w-[1200px] mx-auto px-5 sm:px-8'

export default function Dashboard() {
  const [tab, setTab] = useState<MarketTab>('all')
  const { data, isLoading, error, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  })

  if (isLoading) return <><Navbar activeTab={tab} onTabChange={setTab} /><Loading /></>
  if (error) return <><Navbar activeTab={tab} onTabChange={setTab} /><Err error={error} onRetry={() => refetch()} /></>
  if (!data) return null

  const updated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleString('zh-CN') : '-'
  const sigs = tab === 'all' ? data.signals : data.signals.filter(s => getMarket(s.symbol) === tab)
  const bb = tab === 'all' ? data.bull_bear : data.bull_bear.filter(s => getMarket(s.symbol) === tab)
  const temps = tab === 'all' ? data.market_temperature.details : data.market_temperature.details.filter(s => getMarket(s.symbol) === tab)

  // 统计
  const bullCount = bb.filter(b => b.phase === 'bull' || b.phase === 'bull_early').length
  const bearCount = bb.filter(b => b.phase === 'bear' || b.phase === 'bear_early').length
  const avgTemp = temps.length > 0 ? temps.reduce((a, t) => a + t.temperature, 0) / temps.length : 0

  return (
    <div className="min-h-screen" style={{ background: '#0a0a14' }}>
      <Navbar activeTab={tab} onTabChange={setTab} />

      <main className={`${W} py-6`}>

        {/* ── 页面头 ── */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#e0e0e0] tracking-tight">
              {tab === 'all' ? '市场总览' : tab === 'us' ? '美股' : tab === 'cn' ? 'A股' : tab === 'hk' ? '港股' : '加密'}
            </h1>
            <p className="text-[11px] text-[#444] mt-1">AI 中长周期投资决策 · 月线级别</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-[#444] hidden sm:block">{updated}</span>
            <button onClick={() => refetch()} disabled={isFetching}
              className="px-3 py-1.5 text-[11px] font-medium rounded-md transition-all disabled:opacity-40"
              style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)', color: '#00d4ff' }}>
              {isFetching ? '⟳' : '刷新'}
            </button>
          </div>
        </div>

        {/* ── 统计概览卡片 (参考 heatmap stats grid) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard label="经济周期" value={data.merill_clock.phase_label} sub={`置信 ${Math.round(data.merill_clock.confidence * 100)}%`} color={
            data.merill_clock.phase === 'recovery' ? '#22c55e' : data.merill_clock.phase === 'overheat' ? '#ef4444' :
            data.merill_clock.phase === 'stagflation' ? '#eab308' : '#3b82f6'
          } />
          <StatCard label="市场温度" value={`${avgTemp.toFixed(0)}°`} sub={data.market_temperature.average?.level ?? ''} color={
            avgTemp < 30 ? '#3b82f6' : avgTemp < 60 ? '#eab308' : '#ef4444'
          } />
          <StatCard label="牛市标的" value={`${bullCount}`} sub={`/ ${bb.length} 个标的`} color="#22c55e" />
          <StatCard label="熊市标的" value={`${bearCount}`} sub={`/ ${bb.length} 个标的`} color="#ef4444" />
        </div>

        {/* ── Section: 宏观研判 ── */}
        <Section title="宏观研判" sub="美林时钟 · 市场温度 · 资产配置" color="#00d4ff" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-10">
          <MerillClock data={data.merill_clock} />
          {data.market_temperature.average && <TemperatureGauge data={data.market_temperature.average} />}
          <DeviationBar data={data.merill_clock} />
        </div>

        {/* ── Section: 标的温度 ── */}
        {temps.length > 0 && (
          <>
            <Section title="标的温度" sub="多维温度评估" color="#eab308" />
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 mb-10">
              {temps.map(t => <TempChip key={t.symbol} d={t} />)}
            </div>
          </>
        )}

        {/* ── Section: 月线信号 ── */}
        {sigs.length > 0 && (
          <>
            <Section title="月线信号" sub="均线 · 回调 · 量能 · 评分" color="#22c55e" />
            <div className="mb-10">
              <SignalTable data={sigs} />
            </div>
          </>
        )}

        {/* ── Section: 牛熊分割线 ── */}
        {bb.length > 0 && (
          <>
            <Section title="牛熊分割线" sub="年线 · 两年线 · 仓位" color="#7c3aed" />
            <div className="mb-10">
              <BullBearChart data={bb} />
            </div>
          </>
        )}

        {/* 空 */}
        {sigs.length === 0 && bb.length === 0 && tab !== 'all' && (
          <div className="text-center py-20 text-[#555]">
            <div className="text-3xl mb-2">📭</div>
            <div className="text-sm">该市场暂无关注标的</div>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center py-8 mt-4">
          <div className="h-px mx-auto w-24 mb-4" style={{ background: 'linear-gradient(90deg, transparent, #222, transparent)' }} />
          <div className="text-[10px] text-[#333]">
            <span className="gradient-text font-semibold">GoldenHeat</span>
            <span className="mx-2">·</span>
            {updated}
            <span className="mx-2">·</span>
            仅供参考
          </div>
        </footer>
      </main>
    </div>
  )
}

/* ── 统计卡片 (参考 heatmap .stat) ── */
function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-2xl sm:text-3xl font-extrabold tabular-nums" style={{ color }}>{value}</div>
      <div className="text-[10px] text-[#555] mt-1">{label}</div>
      <div className="text-[9px] text-[#444] mt-0.5">{sub}</div>
    </div>
  )
}

/* ── Section 分隔 ── */
function Section({ title, sub, color }: { title: string; sub: string; color: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4 mt-2">
      <div className="w-0.5 h-5 rounded-full" style={{ background: color }} />
      <div>
        <span className="text-[13px] font-bold text-[#e0e0e0]">{title}</span>
        <span className="text-[10px] text-[#444] ml-2">{sub}</span>
      </div>
    </div>
  )
}

/* ── 温度小格子 (参考 heatmap zone) ── */
function TempChip({ d }: { d: import('../api/types').TemperatureData }) {
  const t = Math.max(0, Math.min(100, d.temperature))
  const c = t < 20 ? '#3b82f6' : t < 40 ? '#60a5fa' : t < 60 ? '#eab308' : t < 80 ? '#f97316' : '#ef4444'
  return (
    <div className="rounded-lg p-3 text-center transition-all hover:-translate-y-0.5"
      style={{ background: `${c}08`, border: `1px solid ${c}20` }}>
      <div className="text-xl font-extrabold tabular-nums" style={{ color: c }}>{t.toFixed(0)}°</div>
      <div className="text-[9px] text-[#777] mt-1 truncate">{d.name}</div>
    </div>
  )
}

function Loading() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function Err({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="text-center">
        <div className="text-3xl mb-2">⚠️</div>
        <div className="text-sm text-[#888] mb-3">{error.message}</div>
        <button onClick={onRetry} className="px-4 py-2 text-xs rounded-lg"
          style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', color: '#00d4ff' }}>
          重试
        </button>
      </div>
    </div>
  )
}
