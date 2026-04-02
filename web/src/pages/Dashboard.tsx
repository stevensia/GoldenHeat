/* Dashboard 主页面 — 组装所有组件 */

import { useQuery } from '@tanstack/react-query'
import { fetchDashboard } from '../api/client'
import MerillClock from '../components/MerillClock'
import TemperatureGauge from '../components/TemperatureGauge'
import DeviationBar from '../components/DeviationBar'
import SignalTable from '../components/SignalTable'
import BullBearChart from '../components/BullBearChart'

export default function Dashboard() {
  const { data, isLoading, error, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    refetchInterval: 5 * 60 * 1000, // 5 分钟自动刷新
    staleTime: 2 * 60 * 1000,
  })

  if (isLoading) return <LoadingScreen />
  if (error) return <ErrorScreen error={error} onRetry={() => refetch()} />
  if (!data) return null

  const updatedAt = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleString('zh-CN') : '-'

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#e0e0e0] tracking-tight">
            <span className="text-[#00d4ff]">Golden</span>Heat
          </h1>
          <p className="text-xs text-[#888] mt-0.5">AI 中长周期投资决策系统</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#666]">更新于 {updatedAt}</span>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-3 py-1.5 text-xs rounded-lg bg-[#1e1e3a] text-[#00d4ff] border border-[#2a2a4a] hover:bg-[#2a2a4a] transition-colors disabled:opacity-50"
          >
            {isFetching ? '刷新中...' : '刷新数据'}
          </button>
        </div>
      </header>

      <div className="space-y-10">
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

        {/* Row 2: 月线信号热力表 */}
        <section>
          <SignalTable data={data.signals} />
        </section>

        {/* Row 3: 牛熊分割线 — 带分隔线和大标题 */}
        <section className="border-t border-[#1e1e3a] pt-8">
          <h2 className="text-xl font-bold text-[#e0e0e0] mb-6 tracking-tight">
            牛熊分割线
          </h2>
          <BullBearChart data={data.bull_bear} />
        </section>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-[#555] py-6 mt-10 border-t border-[#1e1e3a]">
        <div>数据更新时间: {updatedAt}</div>
        <div className="text-[#444] mt-1">仅供参考，不构成投资建议</div>
      </footer>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-[#888] mt-3">加载中...</p>
      </div>
    </div>
  )
}

function ErrorScreen({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-3">&#x26A0;&#xFE0F;</div>
        <h2 className="text-lg font-medium text-[#e0e0e0] mb-2">数据加载失败</h2>
        <p className="text-sm text-[#888] mb-4">{error.message}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 text-sm rounded-lg bg-[#1e1e3a] text-[#00d4ff] border border-[#2a2a4a] hover:bg-[#2a2a4a] transition-colors"
        >
          重试
        </button>
      </div>
    </div>
  )
}
