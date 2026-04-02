import { useState, type ReactNode } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useQuery } from '@tanstack/react-query'
import { fetchDashboard } from '../api/client'
import type { BullBearData, SignalData, TemperatureData } from '../api/types'
import Navbar, { type MarketTab } from '../components/Navbar'

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

const MARKET_TITLES: Record<MarketTab, { title: string; deck: string }> = {
  all: {
    title: 'GoldenHeat 市场总览',
    deck: '把宏观周期、市场热度、资产配置、趋势结构和牛熊分界，压缩成一个适合中周期决策的首页。',
  },
  us: {
    title: '美股市场总览',
    deck: '聚焦美股风险偏好、结构强弱和配置节奏，优先呈现更适合做决策的图表而不是堆砌说明。',
  },
  cn: {
    title: 'A股市场总览',
    deck: '围绕 A 股周期位置、热度变化、趋势强弱和仓位建议，帮助快速判断当前处于什么阶段。',
  },
  hk: {
    title: '港股市场总览',
    deck: '把港股波动翻译成可读的热度、结构和配置语言，降低只凭直觉判断的噪声。',
  },
  crypto: {
    title: '加密市场总览',
    deck: '用图表方式呈现加密资产热度、趋势结构和仓位区间，避免情绪驱动决策。',
  },
}

const PHASE_ORDER = [
  { key: 'recovery', label: '复苏', note: '增长回升，优先股票', color: '#1f7a69' },
  { key: 'overheat', label: '过热', note: '通胀抬头，商品占优', color: '#b45a3c' },
  { key: 'stagflation', label: '滞胀', note: '增长承压，降低风险', color: '#d4a24c' },
  { key: 'recession', label: '衰退', note: '防御阶段，债券受益', color: '#64748b' },
] as const

const ALLOCATION_COLORS = ['#b45a3c', '#1f7a69', '#d4a24c', '#6b7280', '#d9795f', '#6ea699']

const tooltipStyle = {
  border: '1px solid rgba(17,24,39,0.08)',
  borderRadius: '16px',
  background: 'rgba(255,255,255,0.96)',
  color: '#17181c',
  boxShadow: '0 16px 40px rgba(17,24,39,0.10)',
}

function getMarket(sym: string): MarketTab {
  if (MARKET_MAP[sym]) return MARKET_MAP[sym]
  if (sym.endsWith('.SS') || sym.endsWith('.SZ')) return 'cn'
  if (sym.endsWith('.HK')) return 'hk'
  if (sym.includes('BTC') || sym.includes('ETH') || sym.includes('SOL') || sym.endsWith('-USD')) return 'crypto'
  return 'us'
}

export default function Dashboard() {
  const [tab, setTab] = useState<MarketTab>('all')
  const { data, isLoading, error, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="page-shell">
        <Navbar activeTab={tab} onTabChange={setTab} />
        <Loading />
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-shell">
        <Navbar activeTab={tab} onTabChange={setTab} />
        <ErrorState error={error as Error} onRetry={() => refetch()} />
      </div>
    )
  }

  if (!data) return null

  const filteredSignals = tab === 'all' ? data.signals : data.signals.filter((item) => getMarket(item.symbol) === tab)
  const filteredBullBear = tab === 'all' ? data.bull_bear : data.bull_bear.filter((item) => getMarket(item.symbol) === tab)
  const filteredTemps =
    tab === 'all'
      ? data.market_temperature.details
      : data.market_temperature.details.filter((item) => getMarket(item.symbol) === tab)

  const averageTemp = filteredTemps.length
    ? filteredTemps.reduce((sum, item) => sum + item.temperature, 0) / filteredTemps.length
    : 0
  const bullCount = filteredBullBear.filter((item) => item.phase === 'bull' || item.phase === 'bull_early').length
  const bearCount = filteredBullBear.filter((item) => item.phase === 'bear' || item.phase === 'bear_early').length
  const strongestSignal = [...filteredSignals].sort((a, b) => b.score - a.score)[0]
  const hottestAsset = [...filteredTemps].sort((a, b) => b.temperature - a.temperature)[0]
  const updated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleString('zh-CN') : '-'
  const titlePack = MARKET_TITLES[tab]

  const phaseChartData = PHASE_ORDER.map((phase) => ({
    name: phase.label,
    value: 25,
    fill: data.merill_clock.phase === phase.key ? phase.color : 'rgba(23,24,28,0.10)',
  }))

  const allocationChartData = Object.entries(data.merill_clock.allocation)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], index) => ({
      name,
      value: Math.round(value * 100),
      fill: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length],
    }))

  const temperatureChartData = [...filteredTemps]
    .sort((a, b) => b.temperature - a.temperature)
    .slice(0, 8)
    .map((item) => ({
      name: item.name,
      temperature: Number(item.temperature.toFixed(0)),
    }))

  const bullBearMetricData = [...filteredBullBear]
    .slice()
    .sort((a, b) => a.price_vs_ma12_pct - b.price_vs_ma12_pct)
    .map((item) => ({
      name: item.name,
      priceVsMa12: Number(item.price_vs_ma12_pct.toFixed(1)),
      ma12VsMa24: Number(item.ma12_vs_ma24_pct.toFixed(1)),
      phase: item.phase_label,
    }))

  const trendChartData = [...filteredSignals]
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((item) => {
      const current = item.current_price || 1
      return {
        name: item.name,
        现价: 100,
        MA5: Number((((item.ma5 ?? current) / current) * 100).toFixed(1)),
        MA10: Number((((item.ma10 ?? current) / current) * 100).toFixed(1)),
        MA20: Number((((item.ma20 ?? current) / current) * 100).toFixed(1)),
        score: Number(item.score.toFixed(0)),
      }
    })

  return (
    <div className="page-shell">
      <Navbar activeTab={tab} onTabChange={setTab} />

      <main className="mx-auto max-w-[1320px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="paper-card paper-hero overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(186,94,61,0.15),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(25,120,104,0.14),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.56),rgba(255,255,255,0.22))]" />
            <div className="relative">
              <div className="mb-5 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
                <span>GoldenHeat</span>
                <span className="h-1 w-1 rounded-full bg-[var(--accent)]" />
                <span>{updated}</span>
              </div>

              <h1 className="max-w-3xl text-4xl font-semibold leading-none tracking-[-0.04em] text-[var(--ink)] sm:text-5xl lg:text-[4.4rem]">
                {titlePack.title}
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--muted-strong)] sm:text-[15px]">
                {titlePack.deck}
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <InsightStrip label="当前周期" value={data.merill_clock.phase_label} hint={`置信度 ${Math.round(data.merill_clock.confidence * 100)}%`} />
                <InsightStrip label="市场热度" value={`${averageTemp.toFixed(0)}°`} hint={describeTemperature(averageTemp)} />
                <InsightStrip label="最强信号" value={strongestSignal?.name || '暂无'} hint={strongestSignal ? `评分 ${strongestSignal.score.toFixed(0)} · ${strongestSignal.level_label}` : '等待数据'} />
              </div>
            </div>
          </div>

          <div className="grid gap-5">
            <div className="paper-card">
              <SectionEyebrow title="关键信息" note="一屏速览" />
              <div className="mt-4 space-y-4">
                <MetricRow label="覆盖标的" value={`${Math.max(filteredTemps.length, filteredSignals.length, filteredBullBear.length)} 个`} />
                <MetricRow label="最热资产" value={hottestAsset ? `${hottestAsset.name} ${Math.round(hottestAsset.temperature)}°` : '-'} />
                <MetricRow label="牛市阶段" value={`${bullCount} 个`} tone="positive" />
                <MetricRow label="熊市阶段" value={`${bearCount} 个`} tone="negative" />
                <MetricRow label="超配资产" value={data.merill_clock.best_asset} />
              </div>
            </div>

            <div className="paper-card bg-[linear-gradient(180deg,rgba(17,24,39,0.02),rgba(17,24,39,0.08))]">
              <SectionEyebrow title="模型说明" note="当前判断" />
              <p className="mt-4 text-[15px] leading-7 text-[var(--muted-strong)]">{data.merill_clock.description}</p>
              {data.merill_clock.transition_warning ? (
                <div className="mt-4 rounded-2xl border border-[rgba(186,94,61,0.22)] bg-[rgba(186,94,61,0.08)] px-4 py-3 text-sm leading-6 text-[var(--ink)]">
                  {data.merill_clock.transition_warning}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <OverviewCard label="宏观阶段" value={data.merill_clock.phase_label} detail={`GDP ${data.merill_clock.gdp_trend === 'up' ? '↑' : '↓'} · CPI ${data.merill_clock.cpi_trend === 'up' ? '↑' : '↓'}`} />
          <OverviewCard label="市场热度" value={`${averageTemp.toFixed(0)}°`} detail={describeTemperature(averageTemp)} />
          <OverviewCard label="月线信号" value={`${filteredSignals.length}`} detail={strongestSignal ? `${strongestSignal.name} ${strongestSignal.level_label}` : '暂无信号'} />
          <OverviewCard label="牛熊占比" value={`${bullCount}/${filteredBullBear.length || 0}`} detail="牛市阶段标的 / 总标的" />
        </section>

        <section className="mt-10">
          <SectionHeader title="顶部核心图表" subtitle="把美林时钟、市场热度、资产分配三块最关键的 chart 直接顶到首屏下方。" />
          <div className="mt-5 grid gap-5 xl:grid-cols-3">
            <div className="paper-card">
              <SectionEyebrow title="美林时钟圆形图" note="宏观周期" />
              <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.95fr] xl:grid-cols-1 2xl:grid-cols-[1fr_0.95fr]">
                <div className="chart-wrap h-[280px]">
                  <div className="relative h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={phaseChartData} dataKey="value" innerRadius={74} outerRadius={108} stroke="rgba(255,255,255,0.85)" strokeWidth={2}>
                          {phaseChartData.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Pie data={[{ name: '剩余', value: 100 }, { name: '置信度', value: Math.round(data.merill_clock.confidence * 100) }]} dataKey="value" innerRadius={52} outerRadius={64} startAngle={90} endAngle={-270} stroke="none">
                          <Cell fill="rgba(17,24,39,0.08)" />
                          <Cell fill={getPhaseColor(data.merill_clock.phase)} />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                      <div className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">当前阶段</div>
                      <div className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[var(--ink)]">{data.merill_clock.phase_label}</div>
                      <div className="mt-2 text-sm text-[var(--muted-strong)]">置信度 {Math.round(data.merill_clock.confidence * 100)}%</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {PHASE_ORDER.map((phase) => {
                    const active = data.merill_clock.phase === phase.key
                    return (
                      <div key={phase.key} className={`rounded-[20px] border px-4 py-3 ${active ? 'border-[rgba(17,24,39,0.18)] bg-[rgba(255,255,255,0.6)] shadow-[0_14px_30px_rgba(16,24,40,0.06)]' : 'border-[rgba(17,24,39,0.08)] bg-[rgba(255,255,255,0.34)]'}`}>
                        <div className="flex items-center gap-3">
                          <span className="h-3 w-3 rounded-full" style={{ background: phase.color }} />
                          <span className="font-semibold text-[var(--ink)]">{phase.label}</span>
                        </div>
                        <div className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">{phase.note}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="paper-card">
              <SectionEyebrow title="市场热度图" note="热度排名" />
              <div className="mt-5 chart-wrap h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={temperatureChartData} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(17,24,39,0.08)" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: '#7d7468', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={68} tick={{ fill: '#5f584d', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value) => [`${value ?? '-'}°`, '热度']} contentStyle={tooltipStyle} />
                    <Bar dataKey="temperature" radius={[0, 10, 10, 0]}>
                      {temperatureChartData.map((entry) => (
                        <Cell key={entry.name} fill={temperatureBarColor(entry.temperature)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs text-[var(--muted)]">
                <MiniTag title="0–30" text="偏冷" />
                <MiniTag title="30–60" text="中性" />
                <MiniTag title="60–100" text="偏热" />
              </div>
            </div>

            <div className="paper-card">
              <SectionEyebrow title="资产分配图" note="建议配置" />
              <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr] xl:grid-cols-1 2xl:grid-cols-[0.9fr_1.1fr]">
                <div className="chart-wrap h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={allocationChartData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={98} paddingAngle={3} stroke="rgba(255,255,255,0.8)" strokeWidth={2}>
                        {allocationChartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value ?? '-'}%`, '配置']} contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-4">
                  {allocationChartData.map((item) => (
                    <div key={item.name}>
                      <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.fill }} />
                          <span className="font-medium text-[var(--ink)]">{item.name}</span>
                        </div>
                        <span className="font-mono text-[var(--ink)]">{item.value}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-[rgba(17,24,39,0.08)]">
                        <div className="h-2 rounded-full" style={{ width: `${item.value}%`, background: item.fill }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-5 xl:grid-cols-[1.12fr_0.88fr]">
          <div className="paper-card">
            <SectionHeader title="牛熊分界指标" subtitle="用价格相对年线、年线相对两年线两个关键指标，展示当前处于牛熊哪个区间。" />
            {bullBearMetricData.length > 0 ? (
              <div className="mt-6 chart-wrap h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bullBearMetricData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(17,24,39,0.08)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#5f584d', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#7d7468', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value ?? '-'}%`, '指标']} />
                    <Bar dataKey="priceVsMa12" name="现价 vs 年线" fill="var(--accent)" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="ma12VsMa24" name="年线 vs 两年线" fill="#1f7a69" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState text="当前市场暂无牛熊分界图表数据。" />
            )}
          </div>

          <div className="paper-card">
            <SectionHeader title="判断依据" subtitle="牛熊分界不是一句话，而是要看结构依据。" />
            <div className="mt-6 space-y-4">
              <LegendRow color="var(--accent)" title="现价 vs 年线" desc="价格站上 MA12 往往代表趋势占优；跌破年线则进入更谨慎阶段。" />
              <LegendRow color="#1f7a69" title="年线 vs 两年线" desc="MA12 上穿 MA24 时，说明更长期结构开始转强。" />
              <LegendRow color="#d4a24c" title="仓位区间" desc="结合趋势强弱和阶段位置，给出 20–50%、50–80%、80–100% 等区间建议。" />
              <div className="rounded-[22px] border border-[rgba(17,24,39,0.08)] bg-[rgba(255,255,255,0.46)] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">当前结论</div>
                <div className="mt-2 text-xl font-semibold text-[var(--ink)]">{data.merill_clock.phase_label} · {data.merill_clock.best_asset}</div>
                <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">{data.merill_clock.description}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="paper-card">
            <SectionHeader title="趋势结构图" subtitle="当前接口没有完整 K 线序列，这里先用现价与 MA5 / MA10 / MA20 的相对结构做趋势图展示。" />
            {trendChartData.length > 0 ? (
              <div className="mt-6 chart-wrap h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendChartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(17,24,39,0.08)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#5f584d', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#7d7468', fontSize: 11 }} axisLine={false} tickLine={false} domain={['dataMin - 8', 'dataMax + 8']} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value ?? '-'}%`, '相对位置']} />
                    <Line type="monotone" dataKey="现价" stroke="var(--accent)" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="MA5" stroke="#1f7a69" strokeWidth={2} dot={{ r: 2.5 }} />
                    <Line type="monotone" dataKey="MA10" stroke="#d4a24c" strokeWidth={2} dot={{ r: 2.5 }} />
                    <Line type="monotone" dataKey="MA20" stroke="#64748b" strokeWidth={2} dot={{ r: 2.5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState text="当前市场暂无趋势图数据。" />
            )}
          </div>

          <div className="paper-card">
            <SectionHeader title="趋势评分面积图" subtitle="把最强信号前六名按总分排开，便于一眼看出强弱梯队。" />
            {trendChartData.length > 0 ? (
              <div className="mt-6 chart-wrap h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendChartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <defs>
                      <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#b45a3c" stopOpacity={0.42} />
                        <stop offset="100%" stopColor="#b45a3c" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(17,24,39,0.08)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#5f584d', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#7d7468', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value ?? '-'} 分`, '评分']} />
                    <Area type="monotone" dataKey="score" stroke="var(--accent)" fill="url(#scoreFill)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState text="当前市场暂无评分趋势图。" />
            )}
          </div>
        </section>

        <section className="mt-10">
          <SectionHeader title="市场温度卡片" subtitle="保留温度功能，但放到下方做详细浏览，不再挤占首屏。" />
          {filteredTemps.length > 0 ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {filteredTemps.map((item) => (
                <TemperatureCard key={item.symbol} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState text="当前市场暂无温度数据。" />
          )}
        </section>

        <section className="mt-10">
          <SectionHeader title="月线信号清单" subtitle="继续保留月线信号明细，方便你往下看每个标的结构。" />
          {filteredSignals.length > 0 ? <SignalRoster data={filteredSignals} /> : <EmptyState text="当前市场暂无月线信号。" />}
        </section>

        <section className="mt-10">
          <SectionHeader title="牛熊仓位建议" subtitle="继续保留卡片式仓位建议，和上面的分界图形成上下呼应。" />
          {filteredBullBear.length > 0 ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {filteredBullBear.map((item) => (
                <PositionCard key={item.symbol} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState text="当前市场暂无仓位建议数据。" />
          )}
        </section>
      </main>
    </div>
  )
}

function SectionEyebrow({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">{title}</div>
      <div className="text-xs text-[var(--muted)]">{note}</div>
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">图表区</div>
        <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[var(--ink)]">{title}</h2>
      </div>
      <p className="max-w-2xl text-sm leading-6 text-[var(--muted-strong)]">{subtitle}</p>
    </div>
  )
}

function InsightStrip({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[22px] border border-[rgba(17,24,39,0.08)] bg-[rgba(255,255,255,0.46)] px-4 py-4 backdrop-blur-sm">
      <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">{value}</div>
      <div className="mt-2 text-xs leading-5 text-[var(--muted)]">{hint}</div>
    </div>
  )
}

function MetricRow({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'positive' | 'negative' }) {
  const toneClass = tone === 'positive' ? 'text-emerald-700' : tone === 'negative' ? 'text-rose-700' : 'text-[var(--ink)]'
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[rgba(17,24,39,0.08)] pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-[var(--muted-strong)]">{label}</span>
      <span className={`text-sm font-semibold ${toneClass}`}>{value}</span>
    </div>
  )
}

function OverviewCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="paper-card-sm">
      <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--ink)]">{value}</div>
      <div className="mt-2 text-sm leading-6 text-[var(--muted)]">{detail}</div>
    </div>
  )
}

function MiniTag({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div className="font-semibold text-[var(--ink)]">{title}</div>
      <div className="mt-1">{text}</div>
    </div>
  )
}

function TemperatureCard({ item }: { item: TemperatureData }) {
  return (
    <article className="paper-card-sm group relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--accent),var(--accent-2))] opacity-80" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-[var(--ink)]">{item.name}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.22em] text-[var(--muted)]">{item.symbol}</div>
        </div>
        <span className="rounded-full border border-[rgba(17,24,39,0.08)] px-3 py-1 text-xs text-[var(--muted-strong)]">{marketName(getMarket(item.symbol))}</span>
      </div>

      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <div className="text-5xl font-semibold leading-none tracking-[-0.06em] text-[var(--ink)]">{Math.round(item.temperature)}°</div>
          <div className="mt-2 text-sm text-[var(--muted)]">{item.emoji} {item.level}</div>
        </div>
        <div className="text-right text-xs leading-5 text-[var(--muted)]">
          <div>PE {item.breakdown.pe_score.toFixed(0)}</div>
          <div>MA {item.breakdown.ma_score.toFixed(0)}</div>
          <div>Vol {item.breakdown.volume_score.toFixed(0)}</div>
        </div>
      </div>

      <div className="mt-5 h-2 rounded-full bg-[rgba(17,24,39,0.08)]">
        <div className="h-2 rounded-full bg-[linear-gradient(90deg,var(--accent),var(--accent-2))]" style={{ width: `${Math.max(6, Math.min(100, item.temperature))}%` }} />
      </div>

      <p className="mt-4 text-sm leading-6 text-[var(--muted-strong)]">{item.description}</p>
    </article>
  )
}

function SignalRoster({ data }: { data: SignalData[] }) {
  return (
    <div className="mt-5 overflow-hidden rounded-[28px] border border-[rgba(17,24,39,0.08)] bg-[rgba(255,255,255,0.48)] shadow-[0_25px_70px_rgba(15,23,42,0.06)]">
      <div className="hidden grid-cols-[1.2fr_0.9fr_0.7fr_0.8fr_0.9fr] gap-4 border-b border-[rgba(17,24,39,0.08)] px-6 py-4 text-[11px] uppercase tracking-[0.22em] text-[var(--muted)] md:grid">
        <div>标的</div>
        <div>结构</div>
        <div>价格</div>
        <div>评分</div>
        <div>信号</div>
      </div>

      <div className="divide-y divide-[rgba(17,24,39,0.08)]">
        {data.map((item) => (
          <div key={item.symbol} className="grid gap-5 px-5 py-5 md:grid-cols-[1.2fr_0.9fr_0.7fr_0.8fr_0.9fr] md:px-6">
            <div>
              <div className="text-xl font-semibold tracking-[-0.03em] text-[var(--ink)]">{item.name}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.22em] text-[var(--muted)]">{item.symbol}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Tag>{item.trend_label}</Tag>
                <Tag>{item.pullback_label}</Tag>
                <Tag>{item.level_emoji} {item.level_label}</Tag>
              </div>
            </div>

            <div className="space-y-2 text-sm text-[var(--muted-strong)]">
              <Breakdown label="趋势" value={item.breakdown.trend_score} />
              <Breakdown label="回调" value={item.breakdown.pullback_score} />
              <Breakdown label="量能" value={item.breakdown.volume_score} />
              <Breakdown label="估值" value={item.breakdown.valuation_score ?? 0} dim={item.breakdown.valuation_score === null} />
            </div>

            <div className="space-y-2 text-sm leading-6 text-[var(--muted-strong)]">
              <div>现价 <span className="font-mono text-[var(--ink)]">{fmtPrice(item.current_price)}</span></div>
              <div>MA5 <span className="font-mono text-[var(--ink)]">{fmtPrice(item.ma5)}</span></div>
              <div>MA10 <span className="font-mono text-[var(--ink)]">{fmtPrice(item.ma10)}</span></div>
              <div>MA20 <span className="font-mono text-[var(--ink)]">{fmtPrice(item.ma20)}</span></div>
            </div>

            <div className="flex items-center md:justify-center">
              <div className="score-block">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">评分</div>
                <div className="mt-2 text-5xl font-semibold leading-none tracking-[-0.07em] text-[var(--ink)]">{item.score.toFixed(0)}</div>
              </div>
            </div>

            <div className="flex flex-col justify-between gap-3">
              <div className="rounded-[22px] border border-[rgba(17,24,39,0.08)] bg-[rgba(255,255,255,0.58)] px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">信号</div>
                <div className="mt-2 text-lg font-semibold text-[var(--ink)]">{item.level_label}</div>
                <div className="mt-2 text-sm text-[var(--muted-strong)]">量比 {item.volume_ratio?.toFixed(2) ?? '-'} · {item.volume_signal || '无量能补充'}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Breakdown({ label, value, dim = false }: { label: string; value: number; dim?: boolean }) {
  const width = Math.max(0, Math.min(100, value))
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className={dim ? 'text-[var(--muted)]' : 'text-[var(--muted-strong)]'}>{label}</span>
        <span className="font-mono text-[var(--ink)]">{dim ? 'N/A' : value.toFixed(0)}</span>
      </div>
      <div className="h-2 rounded-full bg-[rgba(17,24,39,0.08)]">
        <div className="h-2 rounded-full bg-[linear-gradient(90deg,var(--accent),var(--accent-2))]" style={{ width: `${dim ? 22 : width}%`, opacity: dim ? 0.35 : 1 }} />
      </div>
    </div>
  )
}

function PositionCard({ item }: { item: BullBearData }) {
  const phaseTone = getPhaseTone(item.phase)
  const rangeMid = (item.position_min + item.position_max) / 2

  return (
    <article className="paper-card-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xl font-semibold tracking-[-0.03em] text-[var(--ink)]">{item.name}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.22em] text-[var(--muted)]">{item.symbol}</div>
        </div>
        <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: phaseTone.bg, color: phaseTone.color }}>
          {item.phase_emoji} {item.phase_label}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <PositionMetric label="现价" value={item.current_price.toLocaleString()} />
        <PositionMetric label="年线偏离" value={`${item.price_vs_ma12_pct >= 0 ? '+' : ''}${item.price_vs_ma12_pct.toFixed(1)}%`} />
        <PositionMetric label="仓位区间" value={item.position_range} />
      </div>

      <div className="mt-5 rounded-[22px] border border-[rgba(17,24,39,0.08)] bg-[rgba(255,255,255,0.52)] p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-[var(--muted-strong)]">建议仓位中枢</span>
          <span className="font-mono text-[var(--ink)]">{rangeMid.toFixed(0)}%</span>
        </div>
        <div className="relative h-3 rounded-full bg-[rgba(17,24,39,0.08)]">
          <div className="absolute top-0 h-3 rounded-full" style={{ left: `${item.position_min}%`, width: `${Math.max(6, item.position_max - item.position_min)}%`, background: `linear-gradient(90deg, ${phaseTone.color}, ${phaseTone.color}99)` }} />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-[var(--muted-strong)]">
        <div className="rounded-[18px] bg-[rgba(255,255,255,0.44)] px-4 py-3">
          <div className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">MA12 vs MA24</div>
          <div className="mt-2 font-mono text-[var(--ink)]">{item.ma12_vs_ma24_pct >= 0 ? '+' : ''}{item.ma12_vs_ma24_pct.toFixed(1)}%</div>
        </div>
        <div className="rounded-[18px] bg-[rgba(255,255,255,0.44)] px-4 py-3">
          <div className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">策略</div>
          <div className="mt-2 text-[var(--ink)]">{item.strategy}</div>
        </div>
      </div>

      <p className="mt-5 text-sm leading-7 text-[var(--muted-strong)]">{item.description}</p>
    </article>
  )
}

function PositionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] bg-[rgba(255,255,255,0.42)] px-4 py-3">
      <div className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-base font-semibold text-[var(--ink)]">{value}</div>
    </div>
  )
}

function LegendRow({ color, title, desc }: { color: string; title: string; desc: string }) {
  return (
    <div className="rounded-[20px] border border-[rgba(17,24,39,0.08)] bg-[rgba(255,255,255,0.44)] px-4 py-4">
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 rounded-full" style={{ background: color }} />
        <span className="font-semibold text-[var(--ink)]">{title}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">{desc}</p>
    </div>
  )
}

function Tag({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-[rgba(17,24,39,0.08)] bg-[rgba(255,255,255,0.5)] px-3 py-1 text-xs text-[var(--muted-strong)]">{children}</span>
}

function Loading() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[1320px] items-center justify-center px-4">
      <div className="paper-card flex items-center gap-4 px-6 py-5 text-sm text-[var(--muted-strong)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        正在加载市场首页…
      </div>
    </div>
  )
}

function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[1320px] items-center justify-center px-4">
      <div className="paper-card max-w-xl text-center">
        <div className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">加载失败</div>
        <div className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[var(--ink)]">首页数据加载失败</div>
        <p className="mt-4 text-sm leading-7 text-[var(--muted-strong)]">{error.message}</p>
        <button className="action-btn action-btn-primary mt-6" onClick={onRetry}>重新加载</button>
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mt-5 rounded-[28px] border border-dashed border-[rgba(17,24,39,0.14)] bg-[rgba(255,255,255,0.38)] px-6 py-10 text-center text-sm text-[var(--muted-strong)]">
      {text}
    </div>
  )
}

function fmtPrice(value: number | null): string {
  if (value === null) return '-'
  if (value >= 10000) return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (value >= 100) return value.toFixed(1)
  return value.toFixed(2)
}

function describeTemperature(value: number): string {
  if (value < 30) return '偏冷，更多是观察与筛选阶段'
  if (value < 60) return '中性，等待趋势与估值进一步确认'
  if (value < 80) return '偏热，适合更谨慎地管理仓位'
  return '高热，优先防守而不是追涨'
}

function marketName(tab: MarketTab): string {
  if (tab === 'cn') return 'A股'
  if (tab === 'hk') return '港股'
  if (tab === 'crypto') return '加密'
  if (tab === 'us') return '美股'
  return '总览'
}

function temperatureBarColor(value: number) {
  if (value < 30) return '#7fb3ff'
  if (value < 60) return '#d4a24c'
  if (value < 80) return '#d9795f'
  return '#b45a3c'
}

function getPhaseColor(phase: string) {
  return PHASE_ORDER.find((item) => item.key === phase)?.color || '#64748b'
}

function getPhaseTone(phase: BullBearData['phase']) {
  switch (phase) {
    case 'bull':
      return { color: '#0f766e', bg: 'rgba(20,184,166,0.16)' }
    case 'bull_early':
      return { color: '#3f6212', bg: 'rgba(163,230,53,0.18)' }
    case 'bear_early':
      return { color: '#9a3412', bg: 'rgba(251,191,36,0.18)' }
    case 'bear':
      return { color: '#9f1239', bg: 'rgba(244,63,94,0.16)' }
    default:
      return { color: '#334155', bg: 'rgba(148,163,184,0.2)' }
  }
}
