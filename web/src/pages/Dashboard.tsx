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
    deck: '当前处于中周期配置视角：首页优先呈现宏观周期、市场热度、资产配置、牛熊分界和趋势结构，减少冗余说明，把判断直接放进图表里。',
  },
  us: {
    title: '美股市场总览',
    deck: '当前聚焦美股风险偏好、热度和趋势结构，首页以图表优先，把关键结论合并进交互信息中。',
  },
  cn: {
    title: 'A股市场总览',
    deck: '当前聚焦 A 股所处阶段、热度水平和牛熊边界，减少说明块，强调图表直读。',
  },
  hk: {
    title: '港股市场总览',
    deck: '当前聚焦港股估值修复与趋势变化，用更紧凑的图表布局呈现判断。',
  },
  crypto: {
    title: '加密市场总览',
    deck: '当前聚焦加密市场热度、趋势强弱和配置节奏，把说明收进 tooltip，首页更利落。',
  },
}

const PHASE_ORDER = [
  { key: 'recovery', label: '复苏', asset: '股票', note: '增长回升，优先股票', color: '#1f7a69' },
  { key: 'overheat', label: '过热', asset: '商品', note: '通胀抬头，商品占优', color: '#b45a3c' },
  { key: 'stagflation', label: '滞胀', asset: '现金/防御', note: '增长承压，降低风险', color: '#d4a24c' },
  { key: 'recession', label: '衰退', asset: '债券', note: '防御阶段，债券受益', color: '#64748b' },
] as const

const ALLOCATION_COLORS = ['#b45a3c', '#1f7a69', '#d4a24c', '#6b7280', '#d9795f', '#6ea699']

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

  const phaseProgress = Math.round(data.merill_clock.confidence * 100)
  const currentPhaseMeta = PHASE_ORDER.find((phase) => phase.key === data.merill_clock.phase) || PHASE_ORDER[0]
  const transitionText = getTransitionText(data.merill_clock.phase, phaseProgress)

  const allocationChartData = Object.entries(data.merill_clock.allocation)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], index) => ({
      name,
      value: Math.round(value * 100),
      fill: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length],
      desc: `${name} 当前建议配置 ${Math.round(value * 100)}%`,
    }))

  const temperatureChartData = [...filteredTemps]
    .sort((a, b) => b.temperature - a.temperature)
    .slice(0, 8)
    .map((item) => ({
      name: item.name,
      temperature: Number(item.temperature.toFixed(0)),
      desc: `${item.name} 当前热度 ${Math.round(item.temperature)}°，${item.description}`,
    }))

  const bullBearMetricData = [...filteredBullBear]
    .slice()
    .sort((a, b) => a.price_vs_ma12_pct - b.price_vs_ma12_pct)
    .map((item) => ({
      name: item.name,
      priceVsMa12: Number(item.price_vs_ma12_pct.toFixed(1)),
      ma12VsMa24: Number(item.ma12_vs_ma24_pct.toFixed(1)),
      phase: item.phase_label,
      desc: `${item.name} · ${item.phase_label} · 现价相对年线 ${item.price_vs_ma12_pct.toFixed(1)}%，年线相对两年线 ${item.ma12_vs_ma24_pct.toFixed(1)}%，建议仓位 ${item.position_range}`,
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
        desc: `${item.name} · ${item.level_label} · 趋势 ${item.trend_label} · 回调 ${item.pullback_label} · 评分 ${item.score.toFixed(0)}`,
      }
    })

  const summaryText = buildSummary({
    phaseLabel: data.merill_clock.phase_label,
    bestAsset: data.merill_clock.best_asset,
    averageTemp,
    hottestAsset: hottestAsset?.name,
    strongestSignal: strongestSignal?.name,
    strongestSignalLevel: strongestSignal?.level_label,
    bearCount,
    bullCount,
    totalCount: filteredBullBear.length,
    transitionWarning: data.merill_clock.transition_warning,
    description: data.merill_clock.description,
  })

  return (
    <div className="page-shell">
      <Navbar activeTab={tab} onTabChange={setTab} />

      <main className="mx-auto max-w-[1320px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <section>
          <SectionHeader title="顶部核心图表" subtitle="把最关键的三块图表直接放到顶部；美林时钟恢复成更接近原始表达，阶段逻辑挪到下方总览。" />
          <div className="mt-5 grid gap-5 xl:grid-cols-3">
            <div className="paper-card compact-card">
              <SectionEyebrow title="美林时钟" note={data.merill_clock.phase_label} />
              <div className="mt-4 chart-wrap h-[360px]">
                <MerrillClockSvg phase={data.merill_clock.phase} progress={phaseProgress} transitionText={transitionText} />
              </div>
            </div>

            <div className="paper-card compact-card">
              <SectionEyebrow title="市场热度" note={`${averageTemp.toFixed(0)}°`} />
              <div className="mt-4 chart-wrap h-[290px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={temperatureChartData} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(17,24,39,0.08)" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: '#7d7468', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={72} tick={{ fill: '#5f584d', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<TextTooltip title="市场热度说明" valueKey="temperature" unit="°" dataKey="desc" />} />
                    <Bar dataKey="temperature" radius={[0, 10, 10, 0]}>
                      {temperatureChartData.map((entry) => (
                        <Cell key={entry.name} fill={temperatureBarColor(entry.temperature)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="paper-card compact-card">
              <SectionEyebrow title="资产分配" note={data.merill_clock.best_asset} />
              <div className="mt-4 chart-wrap h-[290px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={allocationChartData} dataKey="value" nameKey="name" innerRadius={64} outerRadius={102} paddingAngle={3} stroke="rgba(255,255,255,0.8)" strokeWidth={2}>
                      {allocationChartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<TextTooltip title="资产分配说明" valueKey="value" unit="%" dataKey="desc" />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="paper-card summary-card">
            <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
              <span>{titlePack.title}</span>
              <span className="h-1 w-1 rounded-full bg-[var(--accent)]" />
              <span>{updated}</span>
            </div>
            <p className="mt-4 text-[15px] leading-7 text-[var(--muted-strong)]">{summaryText}</p>

            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              <div className="rounded-[22px] border border-[rgba(17,24,39,0.08)] bg-[rgba(255,255,255,0.42)] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">美林时钟</div>
                <div className="mt-2 text-lg font-semibold text-[var(--ink)]">{data.merill_clock.phase_label} · 置信度 {phaseProgress}%</div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">代表资产 {currentPhaseMeta.asset}，当前模型判断为：{data.merill_clock.description}{data.merill_clock.transition_warning ? `；预警：${data.merill_clock.transition_warning}` : ''}</p>
              </div>

              <div className="rounded-[22px] border border-[rgba(17,24,39,0.08)] bg-[rgba(255,255,255,0.42)] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">资产配置</div>
                <div className="mt-2 text-lg font-semibold text-[var(--ink)]">当前建议超配 {data.merill_clock.best_asset}</div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">{allocationChartData.map((item) => `${item.name}${item.value}%`).join(' · ')}</p>
              </div>

              <div className="rounded-[22px] border border-[rgba(17,24,39,0.08)] bg-[rgba(255,255,255,0.42)] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">市场热度</div>
                <div className="mt-2 text-lg font-semibold text-[var(--ink)]">综合热度 {averageTemp.toFixed(0)}°</div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">A股 {marketTempByTab(filteredTemps, 'cn')}° · 美股 {marketTempByTab(filteredTemps, 'us')}° · 港股 {marketTempByTab(filteredTemps, 'hk')}° · 加密 {marketTempByTab(filteredTemps, 'crypto')}°</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <OverviewCard label="宏观阶段" value={data.merill_clock.phase_label} detail={`GDP ${data.merill_clock.gdp_trend === 'up' ? '↑' : '↓'} · CPI ${data.merill_clock.cpi_trend === 'up' ? '↑' : '↓'}`} />
          <OverviewCard label="市场热度" value={`${averageTemp.toFixed(0)}°`} detail={describeTemperature(averageTemp)} />
          <OverviewCard label="月线信号" value={`${filteredSignals.length}`} detail={strongestSignal ? `${strongestSignal.name} ${strongestSignal.level_label}` : '暂无信号'} />
          <OverviewCard label="牛熊占比" value={`${bullCount}/${filteredBullBear.length || 0}`} detail="牛市阶段标的 / 总标的" />
        </section>

        <section className="mt-10 grid gap-5 xl:grid-cols-[1.12fr_0.88fr]">
          <div className="paper-card">
            <SectionHeader title="牛熊分界指标" subtitle="看价格相对年线、年线相对两年线两个关键指标，tooltip 里合并解释依据。" />
            {bullBearMetricData.length > 0 ? (
              <div className="mt-6 chart-wrap h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bullBearMetricData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(17,24,39,0.08)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#5f584d', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#7d7468', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<BullBearTooltip />} />
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
            <SectionHeader title="趋势结构图" subtitle="当前接口没有完整 K 线序列，先用现价与 MA5 / MA10 / MA20 的相对结构展示趋势。" />
            {trendChartData.length > 0 ? (
              <div className="mt-6 chart-wrap h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendChartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(17,24,39,0.08)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#5f584d', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#7d7468', fontSize: 11 }} axisLine={false} tickLine={false} domain={['dataMin - 8', 'dataMax + 8']} />
                    <Tooltip content={<TrendTooltip />} />
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
        </section>

        <section className="mt-10 grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
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
                    <Tooltip content={<TextTooltip title="趋势评分说明" valueKey="score" unit="分" dataKey="desc" />} />
                    <Area type="monotone" dataKey="score" stroke="var(--accent)" fill="url(#scoreFill)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState text="当前市场暂无评分趋势图。" />
            )}
          </div>

          <div className="paper-card">
            <SectionHeader title="市场温度卡片" subtitle="详细温度明细仍保留在下方，方便继续展开看每个标的。" />
            {filteredTemps.length > 0 ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
                {filteredTemps.slice(0, 4).map((item) => (
                  <TemperatureCard key={item.symbol} item={item} />
                ))}
              </div>
            ) : (
              <EmptyState text="当前市场暂无温度数据。" />
            )}
          </div>
        </section>

        <section className="mt-10">
          <SectionHeader title="月线信号清单" subtitle="继续保留月线信号明细，方便往下看每个标的结构。" />
          {filteredSignals.length > 0 ? <SignalRoster data={filteredSignals} /> : <EmptyState text="当前市场暂无月线信号。" />}
        </section>

        <section className="mt-10">
          <SectionHeader title="牛熊仓位建议" subtitle="继续保留卡片式仓位建议，和上面的分界图形成呼应。" />
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

function OverviewCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="paper-card-sm">
      <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--ink)]">{value}</div>
      <div className="mt-2 text-sm leading-6 text-[var(--muted)]">{detail}</div>
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

function MerrillClockSvg({ phase, progress, transitionText }: { phase: string; progress: number; transitionText: string }) {
  const cx = 200
  const cy = 180
  const outer = 108
  const inner = 64
  const phaseIndex = PHASE_ORDER.findIndex((item) => item.key === phase)
  const angleOffset = ((progress - 50) / 50) * 18
  const pointerAngle = -90 + phaseIndex * 90 + angleOffset
  const currentColor = getPhaseColor(phase)

  return (
    <svg viewBox="0 0 400 360" className="h-full w-full overflow-visible">
      <defs>
        <filter id="clockGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {PHASE_ORDER.map((item, index) => {
        const start = -135 + index * 90
        const end = start + 90
        const active = item.key === phase
        return (
          <g key={item.key}>
            <path
              d={describeDonutSegment(cx, cy, inner, outer, start, end)}
              fill={active ? item.color : 'rgba(23,24,28,0.08)'}
              opacity={active ? 0.95 : 1}
              stroke="rgba(255,255,255,0.9)"
              strokeWidth="2"
            />
            {active ? (
              <path
                d={describeDonutSegment(cx, cy, outer + 4, outer + 16, start + 4, start + Math.max(12, (progress / 100) * 82))}
                fill={item.color}
                opacity="0.22"
                filter="url(#clockGlow)"
              />
            ) : null}
          </g>
        )
      })}

      <circle cx={cx} cy={cy} r="52" fill="rgba(255,255,255,0.78)" stroke="rgba(17,24,39,0.08)" />
      <text x={cx} y={cy - 8} textAnchor="middle" className="fill-[var(--ink)] text-[12px]" style={{ fontSize: 12, letterSpacing: '0.18em' }}>当前阶段</text>
      <text x={cx} y={cy + 16} textAnchor="middle" className="fill-[var(--ink)]" style={{ fontSize: 24, fontWeight: 700 }}>{PHASE_ORDER[phaseIndex]?.label || '阶段'}</text>
      <text x={cx} y={cy + 36} textAnchor="middle" className="fill-[var(--muted-strong)]" style={{ fontSize: 11 }}>{transitionText}</text>

      {PHASE_ORDER.map((item, index) => {
        const labelAngle = -90 + index * 90
        const pos = polarToCartesian(cx, cy, 144, labelAngle)
        return (
          <g key={`${item.key}-label`} transform={`translate(${pos.x}, ${pos.y})`}>
            <rect x={-34} y={-20} width={68} height={40} rx={12} fill={item.key === phase ? 'rgba(255,255,255,0.86)' : 'rgba(255,255,255,0.55)'} stroke="rgba(17,24,39,0.06)" />
            <text x="0" y="-2" textAnchor="middle" className="fill-[var(--ink)]" style={{ fontSize: 12, fontWeight: 700 }}>{item.label}</text>
            <text x="0" y="13" textAnchor="middle" className="fill-[var(--muted-strong)]" style={{ fontSize: 10 }}>{item.asset}</text>
          </g>
        )
      })}

      <g transform={`translate(${polarToCartesian(cx, cy, 136, pointerAngle).x}, ${polarToCartesian(cx, cy, 136, pointerAngle).y}) rotate(${pointerAngle + 90})`}>
        <path d="M0 -10 L12 0 L0 10" fill="none" stroke={currentColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

function Tag({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-[rgba(17,24,39,0.08)] bg-[rgba(255,255,255,0.5)] px-3 py-1 text-xs text-[var(--muted-strong)]">{children}</span>
}

function BaseTooltip({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="max-w-[280px] rounded-2xl border border-[rgba(17,24,39,0.08)] bg-[rgba(255,255,255,0.96)] px-4 py-3 shadow-[0_16px_40px_rgba(17,24,39,0.10)]">
      <div className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">{title}</div>
      <div className="mt-2 text-sm leading-6 text-[var(--ink)]">{children}</div>
    </div>
  )
}

function TextTooltip({ active, payload, label, title, valueKey, unit = '', dataKey = 'desc' }: any) {
  if (!active || !payload?.length) return null
  const datum = payload[0]?.payload || {}
  const value = datum[valueKey]
  return (
    <BaseTooltip title={title}>
      <div className="font-semibold">{label || datum.name}</div>
      {value !== undefined ? <div className="mt-1">当前值：{value}{unit}</div> : null}
      {datum[dataKey] ? <div className="mt-1 text-[var(--muted-strong)]">{datum[dataKey]}</div> : null}
    </BaseTooltip>
  )
}

function BullBearTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const datum = payload[0]?.payload || {}
  return (
    <BaseTooltip title="牛熊分界说明">
      <div className="font-semibold">{label || datum.name}</div>
      <div className="mt-1">现价 vs 年线：{datum.priceVsMa12}%</div>
      <div className="mt-1">年线 vs 两年线：{datum.ma12VsMa24}%</div>
      <div className="mt-1">阶段：{datum.phase}</div>
      {datum.desc ? <div className="mt-1 text-[var(--muted-strong)]">{datum.desc}</div> : null}
    </BaseTooltip>
  )
}

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const datum = payload[0]?.payload || {}
  return (
    <BaseTooltip title="趋势结构说明">
      <div className="font-semibold">{label || datum.name}</div>
      <div className="mt-1">现价：{datum['现价']}%</div>
      <div className="mt-1">MA5：{datum.MA5}% · MA10：{datum.MA10}% · MA20：{datum.MA20}%</div>
      {datum.desc ? <div className="mt-1 text-[var(--muted-strong)]">{datum.desc}</div> : null}
    </BaseTooltip>
  )
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

function marketTempByTab(items: TemperatureData[], tab: MarketTab) {
  const subset = items.filter((item) => getMarket(item.symbol) === tab)
  if (!subset.length) return '-'
  const avg = subset.reduce((sum, item) => sum + item.temperature, 0) / subset.length
  return avg.toFixed(0)
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  }
}

function describeDonutSegment(cx: number, cy: number, innerR: number, outerR: number, startAngle: number, endAngle: number) {
  const startOuter = polarToCartesian(cx, cy, outerR, endAngle)
  const endOuter = polarToCartesian(cx, cy, outerR, startAngle)
  const startInner = polarToCartesian(cx, cy, innerR, startAngle)
  const endInner = polarToCartesian(cx, cy, innerR, endAngle)
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 1 ${endInner.x} ${endInner.y}`,
    'Z',
  ].join(' ')
}

function getTransitionText(phase: string, progress: number) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)))
  const toward = phase === 'recovery' ? '向过热推进' : phase === 'overheat' ? '向滞胀推进' : phase === 'stagflation' ? '向衰退推进' : '等待复苏确认'
  if (pct >= 75) return `周期后段 · ${toward}`
  if (pct >= 45) return `周期中段 · ${toward}`
  return `周期前段 · 刚进入${phase === 'recovery' ? '复苏' : phase === 'overheat' ? '过热' : phase === 'stagflation' ? '滞胀' : '衰退'}`
}

function buildSummary({ phaseLabel, bestAsset, averageTemp, hottestAsset, strongestSignal, strongestSignalLevel, bearCount, bullCount, totalCount, transitionWarning, description }: any) {
  const parts = [
    `当前市场处于${phaseLabel}，模型倾向超配${bestAsset}`,
    `整体热度约 ${averageTemp.toFixed(0)}°`,
    hottestAsset ? `最热资产是${hottestAsset}` : '',
    strongestSignal ? `最强月线信号来自${strongestSignal}（${strongestSignalLevel}）` : '',
    totalCount ? `牛市阶段 ${bullCount} 个、熊市阶段 ${bearCount} 个` : '',
    transitionWarning || description,
  ].filter(Boolean)
  return parts.join('；') + '。'
}
