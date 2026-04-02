/** DCAPage — 定投管理页面
 *
 * 功能:
 * 1. 定投计划列表 (卡片式)
 * 2. 创建计划 modal: 选标的、金额、频率、策略(固定/PE加权)
 * 3. 定投历史记录表格
 * 4. 累计收益曲线 (Recharts)
 *
 * 暂用 mock 数据，预留 API: /api/v1/dca/plans, /api/v1/dca/history
 */

import { useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

// === Types ===
interface DCAPlan {
  id: string
  symbol: string
  name: string
  amount: number
  frequency: 'weekly' | 'biweekly' | 'monthly'
  strategy: 'fixed' | 'pe_weighted'
  status: 'active' | 'paused'
  totalInvested: number
  currentValue: number
  startDate: string
  nextDate: string
}

interface DCARecord {
  date: string
  symbol: string
  amount: number
  price: number
  shares: number
  pePercentile: number | null
}

interface ReturnPoint {
  date: string
  invested: number
  value: number
}

// === Mock 数据 ===

const FREQ_LABELS: Record<string, string> = {
  weekly: '每周',
  biweekly: '双周',
  monthly: '每月',
}

const STRATEGY_LABELS: Record<string, string> = {
  fixed: '固定金额',
  pe_weighted: 'PE 加权',
}

const MOCK_PLANS: DCAPlan[] = [
  {
    id: '1',
    symbol: '000300.SS',
    name: '沪深300 ETF',
    amount: 2000,
    frequency: 'monthly',
    strategy: 'pe_weighted',
    status: 'active',
    totalInvested: 48000,
    currentValue: 52300,
    startDate: '2024-04-01',
    nextDate: '2026-05-01',
  },
  {
    id: '2',
    symbol: 'NVDA',
    name: '英伟达',
    amount: 500,
    frequency: 'biweekly',
    strategy: 'fixed',
    status: 'active',
    totalInvested: 26000,
    currentValue: 34500,
    startDate: '2025-01-01',
    nextDate: '2026-04-15',
  },
  {
    id: '3',
    symbol: 'BTC-USD',
    name: '比特币',
    amount: 1000,
    frequency: 'weekly',
    strategy: 'fixed',
    status: 'paused',
    totalInvested: 52000,
    currentValue: 67800,
    startDate: '2025-06-01',
    nextDate: '-',
  },
]

const MOCK_RECORDS: DCARecord[] = [
  { date: '2026-04-01', symbol: '000300.SS', amount: 2400, price: 4150, shares: 0.578, pePercentile: 28 },
  { date: '2026-03-17', symbol: 'NVDA', amount: 500, price: 142.5, shares: 3.509, pePercentile: null },
  { date: '2026-03-03', symbol: 'NVDA', amount: 500, price: 138.2, shares: 3.618, pePercentile: null },
  { date: '2026-03-01', symbol: '000300.SS', amount: 2200, price: 4080, shares: 0.539, pePercentile: 32 },
  { date: '2026-02-17', symbol: 'NVDA', amount: 500, price: 145.8, shares: 3.429, pePercentile: null },
  { date: '2026-02-01', symbol: '000300.SS', amount: 1800, price: 4220, shares: 0.427, pePercentile: 35 },
]

function generateMockReturns(): ReturnPoint[] {
  const points: ReturnPoint[] = []
  let invested = 0
  let value = 0
  for (let i = 23; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    invested += 3500
    value = invested * (1 + (Math.random() - 0.35) * 0.02 + (24 - i) * 0.003)
    points.push({
      date: d.toISOString().slice(0, 7),
      invested: Math.round(invested),
      value: Math.round(value),
    })
  }
  return points
}

const MOCK_RETURNS = generateMockReturns()

// === 组件 ===

function PlanCard({ plan }: { plan: DCAPlan }) {
  const returnPct = ((plan.currentValue - plan.totalInvested) / plan.totalInvested * 100)
  const isProfit = returnPct >= 0

  return (
    <div
      className="rounded-2xl p-5 transition-all hover:border-[#333]"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-[#e0e0e0]">{plan.name}</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
              plan.status === 'active'
                ? 'bg-[#22c55e]/10 text-[#22c55e]'
                : 'bg-[#f59e0b]/10 text-[#f59e0b]'
            }`}>
              {plan.status === 'active' ? '运行中' : '已暂停'}
            </span>
          </div>
          <div className="text-[10px] text-[#555] mt-0.5">
            {STRATEGY_LABELS[plan.strategy]} · {FREQ_LABELS[plan.frequency]} · {plan.amount.toLocaleString()} 元/次
          </div>
        </div>
        <div className="text-right">
          <div className={`text-lg font-extrabold ${isProfit ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            {isProfit ? '+' : ''}{returnPct.toFixed(1)}%
          </div>
          <div className="text-[10px] text-[#555]">累计收益率</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <div className="text-[10px] text-[#555]">已投入</div>
          <div className="text-sm font-bold text-[#ccc]">{(plan.totalInvested / 10000).toFixed(1)}w</div>
        </div>
        <div>
          <div className="text-[10px] text-[#555]">当前市值</div>
          <div className="text-sm font-bold text-[#ccc]">{(plan.currentValue / 10000).toFixed(1)}w</div>
        </div>
        <div>
          <div className="text-[10px] text-[#555]">下次扣款</div>
          <div className="text-sm font-bold text-[#ccc]">
            {plan.nextDate === '-' ? '-' : plan.nextDate.slice(5)}
          </div>
        </div>
      </div>
    </div>
  )
}

function RecordTable({ records }: { records: DCARecord[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] text-[#555] uppercase tracking-widest">
            <th className="px-3 py-2 text-left font-medium">日期</th>
            <th className="px-3 py-2 text-left font-medium">标的</th>
            <th className="px-3 py-2 text-right font-medium">金额</th>
            <th className="px-3 py-2 text-right font-medium">价格</th>
            <th className="px-3 py-2 text-right font-medium">份额</th>
            <th className="px-3 py-2 text-right font-medium">PE%</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr
              key={i}
              className="transition-colors hover:bg-white/[0.02]"
              style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
            >
              <td className="px-3 py-2.5 text-[#999]">{r.date}</td>
              <td className="px-3 py-2.5 text-[#ccc] font-medium">{r.symbol}</td>
              <td className="px-3 py-2.5 text-right text-[#ccc]">{r.amount.toLocaleString()}</td>
              <td className="px-3 py-2.5 text-right text-[#999]">{r.price.toFixed(1)}</td>
              <td className="px-3 py-2.5 text-right text-[#999]">{r.shares.toFixed(3)}</td>
              <td className="px-3 py-2.5 text-right">
                {r.pePercentile !== null ? (
                  <span className="text-[#eab308]">{r.pePercentile}%</span>
                ) : (
                  <span className="text-[#555]">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReturnChart({ data }: { data: ReturnPoint[] }) {
  return (
    <div className="h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="investedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6b7280" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#6b7280" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="valueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#555' }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
            interval={5}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#555' }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
            width={50}
            tickFormatter={(v: number) => `${(v / 10000).toFixed(0)}w`}
          />
          <Tooltip
            contentStyle={{
              background: '#1a1a2e',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: '#888' }}
            formatter={(value, name) => [
              `${(Number(value) / 10000).toFixed(2)}w`,
              name === 'invested' ? '投入' : '市值',
            ]}
          />
          <Area
            type="monotone"
            dataKey="invested"
            stroke="#6b7280"
            strokeWidth={1.5}
            fill="url(#investedGrad)"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#22c55e"
            strokeWidth={1.5}
            fill="url(#valueGrad)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function CreatePlanModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="mx-4 w-full max-w-md rounded-2xl p-6"
        style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-[#e0e0e0]">创建定投计划</h3>
          <button
            onClick={onClose}
            className="text-[#555] hover:text-[#ccc] transition-colors text-xl cursor-pointer"
          >
            &times;
          </button>
        </div>

        <div className="space-y-4">
          <Field label="标的">
            <select className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2 text-sm text-[#ccc]">
              <option value="000300.SS">沪深300 ETF</option>
              <option value="NVDA">英伟达 NVDA</option>
              <option value="BTC-USD">比特币 BTC</option>
              <option value="MSFT">微软 MSFT</option>
            </select>
          </Field>

          <Field label="每次金额 (元)">
            <input
              type="number"
              defaultValue={1000}
              className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2 text-sm text-[#ccc]"
            />
          </Field>

          <Field label="定投频率">
            <div className="flex gap-2">
              {(['weekly', 'biweekly', 'monthly'] as const).map((f) => (
                <button
                  key={f}
                  className="flex-1 rounded-lg px-3 py-2 text-xs font-medium text-[#777] border border-white/[0.06] hover:text-[#ccc] hover:bg-white/[0.04] transition-colors cursor-pointer"
                >
                  {FREQ_LABELS[f]}
                </button>
              ))}
            </div>
          </Field>

          <Field label="策略">
            <div className="flex gap-2">
              <button className="flex-1 rounded-lg px-3 py-2 text-xs font-medium border border-[#eab308]/30 bg-[#eab308]/10 text-[#eab308] cursor-pointer">
                固定金额
              </button>
              <button className="flex-1 rounded-lg px-3 py-2 text-xs font-medium text-[#777] border border-white/[0.06] hover:text-[#ccc] cursor-pointer">
                PE 加权
              </button>
            </div>
          </Field>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-[#777] border border-white/[0.06] hover:text-[#ccc] transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg px-4 py-2.5 text-sm font-bold bg-[#eab308] text-[#0a0a14] hover:bg-[#facc15] transition-colors cursor-pointer"
          >
            创建计划
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-[#555] font-medium mb-1.5">{label}</label>
      {children}
    </div>
  )
}

// === 主页面 ===

export default function DCAPage() {
  const [showCreate, setShowCreate] = useState(false)

  const totalInvested = MOCK_PLANS.reduce((s, p) => s + p.totalInvested, 0)
  const totalValue = MOCK_PLANS.reduce((s, p) => s + p.currentValue, 0)
  const totalReturn = ((totalValue - totalInvested) / totalInvested * 100)

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#e0e0e0]">💰 定投管理</h1>
          <p className="mt-1 text-sm text-[#555]">
            定投计划 + 历史记录 + 收益曲线
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="shrink-0 rounded-lg px-4 py-2 text-sm font-bold bg-[#eab308] text-[#0a0a14] hover:bg-[#facc15] transition-colors cursor-pointer"
        >
          + 创建计划
        </button>
      </div>

      {/* 汇总统计 */}
      <div className="mb-6 grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatMini label="运行计划" value={`${MOCK_PLANS.filter(p => p.status === 'active').length}`} />
        <StatMini label="累计投入" value={`${(totalInvested / 10000).toFixed(1)}w`} />
        <StatMini label="当前市值" value={`${(totalValue / 10000).toFixed(1)}w`} />
        <StatMini
          label="总收益率"
          value={`${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(1)}%`}
          color={totalReturn >= 0 ? '#22c55e' : '#ef4444'}
        />
      </div>

      {/* 计划卡片 */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {MOCK_PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} />
        ))}
      </div>

      {/* 累计收益曲线 */}
      <div className="mt-8 rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="mb-4">
          <h3 className="text-sm font-bold text-[#e0e0e0]">累计收益曲线</h3>
          <p className="text-[10px] text-[#555] mt-0.5">
            <span className="inline-block w-3 h-[2px] bg-[#6b7280] mr-1 align-middle" /> 投入
            <span className="inline-block w-3 h-[2px] bg-[#22c55e] ml-3 mr-1 align-middle" /> 市值
          </p>
        </div>
        <ReturnChart data={MOCK_RETURNS} />
      </div>

      {/* 定投历史 */}
      <div className="mt-8 rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="mb-4">
          <h3 className="text-sm font-bold text-[#e0e0e0]">近期定投记录</h3>
          <p className="text-[10px] text-[#555] mt-0.5">最近 6 条扣款记录</p>
        </div>
        <RecordTable records={MOCK_RECORDS} />
      </div>

      {/* Mock 提示 */}
      <div className="mt-6 rounded-xl px-4 py-3 text-center text-[11px] text-[#555]" style={{ border: '1px dashed rgba(255,255,255,0.06)' }}>
        📌 当前显示 Mock 数据 — 等后端 <code className="text-[#eab308]/60">/api/v1/dca/plans</code> 和 <code className="text-[#eab308]/60">/api/v1/dca/history</code> 就绪后自动对接
      </div>

      {/* 创建计划 Modal */}
      {showCreate && <CreatePlanModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}

function StatMini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-[10px] text-[#555] uppercase tracking-widest font-medium">{label}</div>
      <div className="mt-1 text-xl font-extrabold tracking-tight" style={{ color: color ?? '#e0e0e0' }}>
        {value}
      </div>
    </div>
  )
}
