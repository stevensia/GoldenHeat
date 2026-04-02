/* Dashboard 主页面 — 组装所有组件 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchDashboard } from '../api/client'
import Navbar, { type MarketTab } from '../components/Navbar'
import MerillClock from '../components/MerillClock'
import TemperatureGauge from '../components/TemperatureGauge'
import DeviationBar from '../components/DeviationBar'
import SignalTable from '../components/SignalTable'
import BullBearChart from '../components/BullBearChart'

// 标的 → 市场映射
const MARKET_MAP: Record<string, MarketTab> = {
  '000001.SS': 'cn',
  '^GSPC': 'us',
  '^HSI': 'hk',
  'NVDA': 'us',
  'TSLA': 'us',
  'MSFT': 'us',
  '0700.HK': 'hk',
  '9988.HK': 'hk',
  'BTC-USD': 'crypto',
}

function getMarket(symbol: string): MarketTab {
  if (MARKET_MAP[symbol]) return MARKET_MAP[symbol]
  if (symbol.endsWith('.SS') || symbol.endsWith('.SZ')) return 'cn'
  if (symbol.endsWith('.HK')) return 'hk'
  if (symbol.includes('USD') || symbol.includes('BTC') || symbol.includes('ETH')) return 'crypto'
  return 'us'
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<MarketTab>('all')
  const { data, isLoading, error, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  })

  if (isLoading) return (
    <>
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />
      <LoadingScreen />
    </>
  )
  if (error) return (
    <>
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />
      <ErrorScreen error={error} onRetry={() => refetch()} />
    </>
  )
  if (!data) return null

  const updatedAt = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleString('zh-CN') : '-'

  // 市场过滤
  const filteredSignals = activeTab === 'all'
    ? data.signals
    : data.signals.filter(s => getMarket(s.symbol) === activeTab)

  const filteredBullBear = activeTab === 'all'
    ? data.bull_bear
    : data.bull_bear.filter(s => getMarket(s.symbol) === activeTab)

  const filteredTemp = activeTab === 'all'
    ? data.market_temperature.details
    : data.market_temperature.details.filter(s => getMarket(s.symbol) === activeTab)

  return (
    <div className="min-h-screen bg-[#0a0a14]">
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* 子标题栏: 更新时间 + 刷新 */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#e0e0e0] tracking-tight">
              {activeTab === 'all' ? '市场总览' :
                activeTab === 'us' ? '🇺🇸 美股市场' :
                activeTab === 'cn' ? '🇨🇳 A股市场' :
                activeTab === 'hk' ? '🇭🇰 港股市场' :
                '₿ 加密市场'}
            </h2>
            <p className="text-xs text-[#555] mt-1">
              AI 中长周期投资决策系统 · 月线级别操作
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#555] hidden sm:block">更新于 {updatedAt}</span>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="group px-4 py-2 text-xs font-medium rounded-lg transition-all duration-200 disabled:opacity-50"
              style={{
                background: 'rgba(0,212,255,0.08)',
                border: '1px solid rgba(0,212,255,0.2)',
                color: '#00d4ff',
              }}
            >
              {isFetching ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 border border-[#00d4ff] border-t-transparent rounded-full animate-spin" />
                  刷新中
                </span>
              ) : (
                <span className="flex items-center gap-1.5 group-hover:gap-2 transition-all">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  刷新数据
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="space-y-8 sm:space-y-10">
          {/* Row 1: 三大核心卡片 */}
          <section>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MerillClock data={data.merill_clock} />
              {data.market_temperature.average && (
                <TemperatureGauge data={data.market_temperature.average} />
              )}
              <DeviationBar data={data.merill_clock} />
            </div>
          </section>

          {/* Row 1.5: 市场温度详情（按市场过滤时显示） */}
          {filteredTemp.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-[#888] mb-4 flex items-center gap-2">
                <span className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(to bottom, #3b82f6, #ef4444)' }} />
                各标的温度
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {filteredTemp.map(t => (
                  <TemperatureCard key={t.symbol} data={t} />
                ))}
              </div>
            </section>
          )}

          {/* Row 2: 月线信号热力表 */}
          {filteredSignals.length > 0 && (
            <section>
              <SignalTable data={filteredSignals} />
            </section>
          )}

          {/* Row 3: 牛熊分割线 */}
          {filteredBullBear.length > 0 && (
            <section className="border-t border-[#1e1e3a] pt-8">
              <h2 className="text-xl font-bold text-[#e0e0e0] mb-6 tracking-tight flex items-center gap-2">
                <span className="w-1.5 h-6 rounded-full" style={{ background: 'linear-gradient(to bottom, #22c55e, #ef4444)' }} />
                牛熊分割线
              </h2>
              <BullBearChart data={filteredBullBear} />
            </section>
          )}

          {/* 空状态 */}
          {filteredSignals.length === 0 && filteredBullBear.length === 0 && activeTab !== 'all' && (
            <div className="text-center py-20">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-[#888]">该市场暂无关注标的</p>
              <p className="text-xs text-[#555] mt-1">可在后台配置 watchlist 添加</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="text-center text-xs text-[#444] py-8 mt-12 border-t border-[#1e1e3a]/50">
          <div className="flex items-center justify-center gap-2 text-[#555]">
            <span>GoldenHeat</span>
            <span>·</span>
            <span>数据更新: {updatedAt}</span>
          </div>
          <div className="text-[#333] mt-2">仅供参考，不构成投资建议</div>
        </footer>
      </main>
    </div>
  )
}

/* 温度小卡片 — 详情展示 */
function TemperatureCard({ data }: { data: import('../api/types').TemperatureData }) {
  const temp = Math.max(0, Math.min(100, data.temperature))
  const getColor = (t: number) => {
    if (t < 20) return '#3b82f6'
    if (t < 40) return '#60a5fa'
    if (t < 60) return '#eab308'
    if (t < 80) return '#f97316'
    return '#ef4444'
  }
  const color = getColor(temp)

  return (
    <div className="bg-[#111122] border border-[#1e1e3a] rounded-xl p-4 hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[#888]">{data.name}</span>
        <span className="text-xs">{data.emoji}</span>
      </div>
      <div className="text-2xl font-bold" style={{ color }}>{temp.toFixed(0)}°</div>
      {/* 迷你温度条 */}
      <div className="h-1 rounded-full mt-2 overflow-hidden"
        style={{ background: 'linear-gradient(to right, #3b82f6, #eab308, #ef4444)' }}>
        <div className="h-full bg-transparent" style={{ width: `${temp}%` }} />
      </div>
      <div className="relative h-1 -mt-1">
        <div className="absolute top-[-3px] w-2 h-2 rounded-full border border-white/50"
          style={{ left: `calc(${temp}% - 4px)`, background: color }} />
      </div>
      <div className="text-[10px] text-[#666] mt-2">{data.level}</div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="text-center">
        <div className="relative">
          <div className="w-12 h-12 border-2 border-[#1e1e3a] rounded-full" />
          <div className="w-12 h-12 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin absolute top-0" />
        </div>
        <p className="text-sm text-[#888] mt-4">加载中...</p>
      </div>
    </div>
  )
}

function ErrorScreen({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-3">⚠️</div>
        <h2 className="text-lg font-medium text-[#e0e0e0] mb-2">数据加载失败</h2>
        <p className="text-sm text-[#888] mb-4">{error.message}</p>
        <button
          onClick={onRetry}
          className="px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-200"
          style={{
            background: 'rgba(0,212,255,0.1)',
            border: '1px solid rgba(0,212,255,0.3)',
            color: '#00d4ff',
          }}
        >
          重试
        </button>
      </div>
    </div>
  )
}
