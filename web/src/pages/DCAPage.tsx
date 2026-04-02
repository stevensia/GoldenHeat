/** DCAPage — 定投管理页面
 *
 * 功能:
 * 1. 定投计划列表 (卡片式)
 * 2. 创建计划 modal
 * 3. 定投历史记录表格
 * 4. 累计收益曲线 (Recharts)
 *
 * 真实数据来源: /api/v1/dca/plans, /api/v1/dca/history, /api/v1/dca/analysis
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { DCAPlan, DCARecord, DCAAnalysis } from '../api/types'
import {
  fetchV1DCAPlans,
  fetchV1DCAHistory,
  fetchV1DCAAnalysis,
  createV1DCAPlan,
  updateV1DCAPlan,
  deleteV1DCAPlan,
} from '../api/client'

// === 常量 ===
const FREQ_LABELS: Record<string, string> = {
  weekly: '每周',
  biweekly: '双周',
  monthly: '每月',
}

const STRATEGY_LABELS: Record<string, string> = {
  fixed: '固定金额',
  pe_weighted: 'PE 加权',
}

const SYMBOL_OPTIONS = [
  { value: '000300.SS', label: '沪深300' },
  { value: '000001.SS', label: '上证指数' },
  { value: 'NVDA', label: '英伟达 NVDA' },
  { value: 'MSFT', label: '微软 MSFT' },
  { value: 'TSLA', label: '特斯拉 TSLA' },
  { value: 'BTC-USD', label: '比特币 BTC' },
  { value: '0700.HK', label: '腾讯 0700.HK' },
  { value: '9988.HK', label: '阿里巴巴 9988.HK' },
]

// === 子组件 ===

function PlanCard({
  plan,
  onToggle,
  onDelete,
}: {
  plan: DCAPlan
  onToggle: (id: number, enabled: number) => void
  onDelete: (id: number) => void
}) {
  const returnPct =
    plan.current_value != null && plan.total_invested > 0
      ? ((plan.current_value - plan.total_invested) / plan.total_invested) * 100
      : null
  const isProfit = returnPct != null && returnPct >= 0

  return (
    <div
      className="rounded-2xl p-5 transition-all hover:border-[#333]"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-[#e0e0e0]">{plan.name}</span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                plan.status === 'active'
                  ? 'bg-[#22c55e]/10 text-[#22c55e]'
                  : 'bg-[#f59e0b]/10 text-[#f59e0b]'
              }`}
            >
              {plan.status === 'active' ? '运行中' : '已暂停'}
            </span>
          </div>
          <div className="text-[10px] text-[#555] mt-0.5">
            {plan.symbol} · {STRATEGY_LABELS[plan.strategy] ?? plan.strategy} ·{' '}
            {FREQ_LABELS[plan.frequency] ?? plan.frequency} · {plan.amount.toLocaleString()} 元/次
          </div>
        </div>
        <div className="text-right">
          {returnPct != null ? (
            <>
              <div className={`text-lg font-extrabold ${isProfit ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                {isProfit ? '+' : ''}
                {returnPct.toFixed(1)}%
              </div>
              <div className="text-[10px] text-[#555]">累计收益率</div>
            </>
          ) : (
            <div className="text-sm text-[#555]">暂无收益</div>
          )}
        </div>
      </div>

      <div
        className="grid grid-cols-3 gap-3 mt-4 pt-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div>
          <div className="text-[10px] text-[#555]">已投入</div>
          <div className="text-sm font-bold text-[#ccc]">
            {plan.total_invested > 0 ? `${(plan.total_invested / 10000).toFixed(1)}w` : '-'}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[#555]">当前市值</div>
          <div className="text-sm font-bold text-[#ccc]">
            {plan.current_value != null ? `${(plan.current_value / 10000).toFixed(1)}w` : '-'}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[#555]">记录数</div>
          <div className="text-sm font-bold text-[#ccc]">{plan.record_count}</div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="mt-3 pt-3 flex gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(plan.id, plan.enabled ? 0 : 1) }}
          className="flex-1 rounded-lg px-3 py-1.5 text-[11px] font-medium text-[#777] border border-white/[0.06] hover:text-[#ccc] transition-colors cursor-pointer"
        >
          {plan.enabled ? '暂停' : '恢复'}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(plan.id) }}
          className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-[#ef4444]/60 border border-[#ef4444]/10 hover:text-[#ef4444] transition-colors cursor-pointer"
        >
          删除
        </button>
      </div>
    </div>
  )
}

function RecordTable({ records }: { records: DCARecord[] }) {
  if (records.length === 0) {
    return <div className="text-center text-sm text-[#555] py-8">暂无定投记录</div>
  }
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
          {records.map((r) => (
            <tr
              key={r.id}
              className="transition-colors hover:bg-white/[0.02]"
              style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
            >
              <td className="px-3 py-2.5 text-[#999]">{r.date}</td>
              <td className="px-3 py-2.5 text-[#ccc] font-medium">{r.symbol}</td>
              <td className="px-3 py-2.5 text-right text-[#ccc]">{r.amount.toLocaleString()}</td>
              <td className="px-3 py-2.5 text-right text-[#999]">{r.price.toFixed(2)}</td>
              <td className="px-3 py-2.5 text-right text-[#999]">{r.shares.toFixed(3)}</td>
              <td className="px-3 py-2.5 text-right">
                {r.pe_percentile != null ? (
                  <span className="text-[#eab308]">{r.pe_percentile.toFixed(0)}%</span>
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

function ReturnChart({ data }: { data: DCAAnalysis['return_curve'] }) {
  if (!data || data.length === 0) {
    return <div className="text-center text-sm text-[#555] py-8">暂无收益数据</div>
  }
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
            interval={Math.max(1, Math.floor(data.length / 8))}
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
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: '',
    symbol: SYMBOL_OPTIONS[0].value,
    amount: 1000,
    frequency: 'monthly' as string,
    strategy: 'fixed' as string,
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: createV1DCAPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dca-plans'] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  const handleSubmit = () => {
    if (!form.name.trim()) {
      setError('请输入计划名称')
      return
    }
    mutation.mutate({
      name: form.name.trim(),
      symbol: form.symbol,
      amount: form.amount,
      frequency: form.frequency,
      strategy: form.strategy,
    })
  }

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

        {error && (
          <div className="mb-4 rounded-lg px-3 py-2 text-xs text-[#ef4444] bg-[#ef4444]/10">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <Field label="计划名称">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="如: 沪深300定投"
              className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2 text-sm text-[#ccc]"
            />
          </Field>

          <Field label="标的">
            <select
              value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.target.value })}
              className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2 text-sm text-[#ccc]"
            >
              {SYMBOL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="每次金额 (元)">
            <input
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2 text-sm text-[#ccc]"
            />
          </Field>

          <Field label="定投频率">
            <div className="flex gap-2">
              {(['weekly', 'biweekly', 'monthly'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setForm({ ...form, frequency: f })}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                    form.frequency === f
                      ? 'border border-[#eab308]/30 bg-[#eab308]/10 text-[#eab308]'
                      : 'text-[#777] border border-white/[0.06] hover:text-[#ccc] hover:bg-white/[0.04]'
                  }`}
                >
                  {FREQ_LABELS[f]}
                </button>
              ))}
            </div>
          </Field>

          <Field label="策略">
            <div className="flex gap-2">
              {(['fixed', 'pe_weighted'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setForm({ ...form, strategy: s })}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                    form.strategy === s
                      ? 'border border-[#eab308]/30 bg-[#eab308]/10 text-[#eab308]'
                      : 'text-[#777] border border-white/[0.06] hover:text-[#ccc]'
                  }`}
                >
                  {STRATEGY_LABELS[s]}
                </button>
              ))}
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
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="flex-1 rounded-lg px-4 py-2.5 text-sm font-bold bg-[#eab308] text-[#0a0a14] hover:bg-[#facc15] transition-colors cursor-pointer disabled:opacity-50"
          >
            {mutation.isPending ? '创建中...' : '创建计划'}
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

function StatMini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="text-[10px] text-[#555] uppercase tracking-widest font-medium">{label}</div>
      <div className="mt-1 text-xl font-extrabold tracking-tight" style={{ color: color ?? '#e0e0e0' }}>
        {value}
      </div>
    </div>
  )
}

/** Loading skeleton */
function PlansSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-2xl p-5 animate-pulse"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="h-5 w-32 bg-white/[0.06] rounded mb-3" />
          <div className="h-3 w-48 bg-white/[0.04] rounded mb-4" />
          <div className="grid grid-cols-3 gap-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="h-8 bg-white/[0.04] rounded" />
            <div className="h-8 bg-white/[0.04] rounded" />
            <div className="h-8 bg-white/[0.04] rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

// === 主页面 ===

export default function DCAPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const queryClient = useQueryClient()

  // 查询
  const { data: plansResult, isLoading: plansLoading } = useQuery({
    queryKey: ['dca-plans'],
    queryFn: fetchV1DCAPlans,
    staleTime: 30 * 1000,
  })

  const { data: historyResult } = useQuery({
    queryKey: ['dca-history', selectedPlanId],
    queryFn: () => fetchV1DCAHistory(selectedPlanId ?? undefined),
    staleTime: 30 * 1000,
  })

  const { data: analysisResult } = useQuery({
    queryKey: ['dca-analysis', selectedPlanId],
    queryFn: () => fetchV1DCAAnalysis(selectedPlanId!),
    enabled: selectedPlanId != null,
    staleTime: 30 * 1000,
  })

  // Mutations
  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: number }) =>
      updateV1DCAPlan(id, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dca-plans'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteV1DCAPlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dca-plans'] })
      queryClient.invalidateQueries({ queryKey: ['dca-history'] })
    },
  })

  const plans: DCAPlan[] = plansResult?.data ?? []
  const records: DCARecord[] = historyResult?.data ?? []
  const analysis: DCAAnalysis | null = analysisResult?.data ?? null

  const totalInvested = plans.reduce((s, p) => s + p.total_invested, 0)
  const totalValue = plans.reduce((s, p) => s + (p.current_value ?? 0), 0)
  const hasValue = plans.some((p) => p.current_value != null)
  const totalReturn = hasValue && totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : null

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#e0e0e0]">💰 定投管理</h1>
          <p className="mt-1 text-sm text-[#555]">定投计划 + 历史记录 + 收益曲线</p>
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
        <StatMini label="运行计划" value={`${plans.filter((p) => p.status === 'active').length}`} />
        <StatMini label="累计投入" value={totalInvested > 0 ? `${(totalInvested / 10000).toFixed(1)}w` : '-'} />
        <StatMini label="当前市值" value={hasValue ? `${(totalValue / 10000).toFixed(1)}w` : '-'} />
        <StatMini
          label="总收益率"
          value={totalReturn != null ? `${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(1)}%` : '-'}
          color={totalReturn != null ? (totalReturn >= 0 ? '#22c55e' : '#ef4444') : undefined}
        />
      </div>

      {/* 计划卡片 */}
      {plansLoading ? (
        <PlansSkeleton />
      ) : plans.length === 0 ? (
        <div className="text-center text-sm text-[#555] py-12">
          暂无定投计划 — 点击右上角创建第一个计划
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              onClick={() => setSelectedPlanId(plan.id)}
              className={`cursor-pointer rounded-2xl transition-all ${
                selectedPlanId === plan.id ? 'ring-1 ring-[#eab308]/40' : ''
              }`}
            >
              <PlanCard
                plan={plan}
                onToggle={(id, enabled) => toggleMutation.mutate({ id, enabled })}
                onDelete={(id) => {
                  if (confirm('确定删除此定投计划？所有记录也将被删除。')) {
                    deleteMutation.mutate(id)
                  }
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* 累计收益曲线 */}
      {analysis && analysis.return_curve.length > 0 && (
        <div
          className="mt-8 rounded-2xl p-5"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="mb-4">
            <h3 className="text-sm font-bold text-[#e0e0e0]">
              {analysis.name} 累计收益曲线
            </h3>
            <p className="text-[10px] text-[#555] mt-0.5">
              <span className="inline-block w-3 h-[2px] bg-[#6b7280] mr-1 align-middle" /> 投入
              <span className="inline-block w-3 h-[2px] bg-[#22c55e] ml-3 mr-1 align-middle" /> 市值
              {analysis.lump_sum_return_pct != null && (
                <span className="ml-3">
                  · 一次性买入收益率: {analysis.lump_sum_return_pct >= 0 ? '+' : ''}
                  {analysis.lump_sum_return_pct.toFixed(1)}%
                </span>
              )}
            </p>
          </div>
          <ReturnChart data={analysis.return_curve} />
        </div>
      )}

      {/* 定投历史 */}
      <div
        className="mt-8 rounded-2xl p-5"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#e0e0e0]">定投记录</h3>
            <p className="text-[10px] text-[#555] mt-0.5">
              {selectedPlanId ? `计划 #${selectedPlanId} 的记录` : '全部记录'}
            </p>
          </div>
          {selectedPlanId && (
            <button
              onClick={() => setSelectedPlanId(null)}
              className="text-[11px] text-[#777] hover:text-[#ccc] cursor-pointer"
            >
              查看全部
            </button>
          )}
        </div>
        <RecordTable records={records} />
      </div>

      {/* 创建计划 Modal */}
      {showCreate && <CreatePlanModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
