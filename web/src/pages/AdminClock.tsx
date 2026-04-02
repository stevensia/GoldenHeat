/* AdminClock — 美林时钟管理页
 *
 * 功能：
 * 1. Token 登录（localStorage 缓存）
 * 2. 最新评估详情（三方对比 + 加权结果）
 * 3. 指标表格
 * 4. 评估历史
 * 5. 人工确认表单
 * 6. 触发重新评估
 */

import { useState, useEffect, useCallback } from 'react'
import {
  fetchAdminClockLatest,
  fetchAdminClockHistory,
  fetchAdminClockIndicators,
  postAdminClockAssess,
  postAdminClockConfirm,
} from '../api/client'
import type { ClockAssessment, ClockIndicator } from '../api/types'

const STORAGE_KEY = 'goldenheat_admin_token'
const PHASES = ['recovery', 'overheat', 'stagflation', 'recession'] as const
const PHASE_LABELS: Record<string, string> = {
  recovery: '复苏',
  overheat: '过热',
  stagflation: '滞胀',
  recession: '衰退',
}
const PHASE_COLORS: Record<string, string> = {
  recovery: '#22c55e',
  overheat: '#ef4444',
  stagflation: '#eab308',
  recession: '#3b82f6',
}

export default function AdminClock() {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY) || '')
  const [tokenInput, setTokenInput] = useState('')
  const [authed, setAuthed] = useState(false)
  const [market, setMarket] = useState<'cn' | 'us'>('cn')

  // 数据状态
  const [latest, setLatest] = useState<ClockAssessment | null>(null)
  const [history, setHistory] = useState<ClockAssessment[]>([])
  const [indicators, setIndicators] = useState<ClockIndicator[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 人工确认表单
  const [formPhase, setFormPhase] = useState<string>('recovery')
  const [formPosition, setFormPosition] = useState(0)
  const [formConfidence, setFormConfidence] = useState(0.7)
  const [formNotes, setFormNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState('')

  // 加载数据
  const loadData = useCallback(async (t: string, m: string) => {
    setLoading(true)
    setError('')
    try {
      const [lat, hist, ind] = await Promise.all([
        fetchAdminClockLatest(t, m).catch(() => null),
        fetchAdminClockHistory(t, m).catch(() => []),
        fetchAdminClockIndicators(t, m).catch(() => []),
      ])
      setLatest(lat)
      setHistory(Array.isArray(hist) ? hist : [])
      setIndicators(Array.isArray(ind) ? ind : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  // 登录
  const handleLogin = async () => {
    if (!tokenInput.trim()) return
    const t = tokenInput.trim()
    try {
      await fetchAdminClockLatest(t, 'cn')
      localStorage.setItem(STORAGE_KEY, t)
      setToken(t)
      setAuthed(true)
    } catch {
      setError('Token 验证失败，请检查后重试')
    }
  }

  // 自动登录
  useEffect(() => {
    if (token) {
      fetchAdminClockLatest(token, 'cn')
        .then(() => setAuthed(true))
        .catch(() => {
          localStorage.removeItem(STORAGE_KEY)
          setToken('')
        })
    }
  }, [token])

  // 加载数据
  useEffect(() => {
    if (authed && token) {
      loadData(token, market)
    }
  }, [authed, token, market, loadData])

  // 触发评估
  const handleAssess = async () => {
    setSubmitting(true)
    setSubmitMsg('')
    try {
      await postAdminClockAssess(token, market)
      setSubmitMsg('✅ 评估完成')
      loadData(token, market)
    } catch (e) {
      setSubmitMsg(`❌ ${e instanceof Error ? e.message : '评估失败'}`)
    } finally {
      setSubmitting(false)
    }
  }

  // 人工确认
  const handleConfirm = async () => {
    setSubmitting(true)
    setSubmitMsg('')
    try {
      await postAdminClockConfirm(token, {
        market,
        phase: formPhase,
        position: formPosition,
        confidence: formConfidence,
        notes: formNotes,
      })
      setSubmitMsg('✅ 已提交人工确认')
      setFormNotes('')
      loadData(token, market)
    } catch (e) {
      setSubmitMsg(`❌ ${e instanceof Error ? e.message : '提交失败'}`)
    } finally {
      setSubmitting(false)
    }
  }

  // 登出
  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setToken('')
    setAuthed(false)
    setLatest(null)
    setHistory([])
    setIndicators([])
  }

  // === 未登录：显示 Token 输入 ===
  if (!authed) {
    return (
      <div className="page-shell min-h-screen">
        <div className="mx-auto max-w-md px-4 pt-24">
          <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-center mb-6">
              <div className="text-[10px] text-[#555] uppercase tracking-widest mb-2">GoldenHeat</div>
              <h1 className="text-xl font-bold text-[#e0e0e0]">美林时钟管理</h1>
            </div>
            <div className="space-y-4">
              <input
                type="password"
                placeholder="输入 Admin Token"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full rounded-lg px-4 py-3 text-sm text-[#e0e0e0] placeholder-[#555] outline-none focus:ring-1 focus:ring-[#eab308]"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
              <button
                onClick={handleLogin}
                className="w-full rounded-lg py-3 text-sm font-bold bg-[#eab308] text-[#0a0a14] hover:bg-[#facc15] transition-colors cursor-pointer"
              >
                登录
              </button>
              {error && <div className="text-[12px] text-red-400 text-center">{error}</div>}
              <div className="text-center">
                <a href="#/" className="text-[11px] text-[#555] hover:text-[#888] transition-colors">← 返回首页</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // === 已登录：管理面板 ===
  return (
    <div className="page-shell min-h-screen">
      <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-6 sm:px-6">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-[10px] text-[#555] uppercase tracking-widest">Admin</div>
            <h1 className="text-lg font-bold text-[#e0e0e0] tracking-tight">美林时钟管理</h1>
          </div>
          <div className="flex items-center gap-3">
            <a href="#/" className="text-[11px] text-[#555] hover:text-[#888] transition-colors">← 首页</a>
            <button onClick={handleLogout} className="text-[11px] text-[#555] hover:text-red-400 transition-colors cursor-pointer">登出</button>
          </div>
        </div>

        {/* 市场切换 */}
        <div className="flex gap-2 mb-6">
          {(['cn', 'us'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMarket(m)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
                market === m
                  ? 'bg-[#eab308] text-[#0a0a14]'
                  : 'text-[#777] hover:text-[#ccc]'
              }`}
              style={market !== m ? { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' } : undefined}
            >
              {m === 'cn' ? '🇨🇳 中国' : '🌍 美国'}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={handleAssess}
            disabled={submitting}
            className="rounded-lg px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {submitting ? '评估中…' : '🔄 触发评估'}
          </button>
        </div>

        {loading && <div className="text-[#777] text-sm mb-4">加载中…</div>}
        {error && <div className="text-red-400 text-sm mb-4">{error}</div>}
        {submitMsg && <div className="text-sm mb-4 text-[#aaa]">{submitMsg}</div>}

        {/* === 最新评估结果 === */}
        {latest && !('error' in latest) && (
          <div className="rounded-2xl p-5 mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 className="text-sm font-bold text-[#e0e0e0] mb-4">最新评估</h2>

            {/* 最终结果 */}
            <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="text-[10px] text-[#555] uppercase tracking-widest mb-2">最终加权结果</div>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-xl font-bold" style={{ color: PHASE_COLORS[latest.final_phase] || '#eab308' }}>
                  {PHASE_LABELS[latest.final_phase] || latest.final_phase}
                </span>
                <span className="text-sm text-[#aaa]">
                  点位 <span className="font-mono font-medium text-[#e0e0e0]">{latest.final_position?.toFixed(1)}</span> / 12
                </span>
                <span className="text-sm text-[#aaa]">
                  置信度 <span className="font-mono font-medium text-[#e0e0e0]">{(latest.final_confidence * 100).toFixed(0)}%</span>
                </span>
                <span className="text-[10px] text-[#555]">
                  {latest.assessed_at}
                </span>
              </div>
            </div>

            {/* 三方对比 */}
            <div className="grid gap-3 sm:grid-cols-3">
              <SourceCard
                label="算法"
                phase={latest.algo_phase}
                position={latest.algo_position}
                confidence={latest.algo_confidence}
              />
              <SourceCard
                label="AI"
                phase={latest.ai_phase}
                position={latest.ai_position}
                confidence={latest.ai_confidence}
              />
              <SourceCard
                label="人工"
                phase={latest.human_phase}
                position={latest.human_position}
                confidence={latest.human_confidence}
                notes={latest.human_notes}
              />
            </div>

            {/* 权重分配 */}
            {latest.weights && (
              <div className="mt-4">
                <WeightsBar weights={latest.weights} />
              </div>
            )}
          </div>
        )}

        {/* === 指标表格 === */}
        {indicators.length > 0 && (
          <div className="rounded-2xl p-5 mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 className="text-sm font-bold text-[#e0e0e0] mb-4">当前指标</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] text-[#555] uppercase tracking-wider">
                    <th className="text-left py-2 pr-4">指标</th>
                    <th className="text-right py-2 pr-4">当前值</th>
                    <th className="text-right py-2 pr-4">数据日期</th>
                    <th className="text-left py-2">来源</th>
                  </tr>
                </thead>
                <tbody>
                  {indicators.map((ind) => (
                    <tr key={ind.indicator} className="border-t border-white/5">
                      <td className="py-2.5 pr-4 text-[#ccc]">{ind.name}</td>
                      <td className="py-2.5 pr-4 text-right font-mono text-[#e0e0e0]">
                        {typeof ind.value === 'number' ? ind.value.toFixed(2) : ind.value}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-[#555]">{ind.date}</td>
                      <td className="py-2.5 text-[#555]">{ind.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* === 人工确认表单 === */}
        <div className="rounded-2xl p-5 mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="text-sm font-bold text-[#e0e0e0] mb-4">人工确认</h2>
          <div className="space-y-5">
            {/* 阶段选择 */}
            <div>
              <label className="text-[11px] text-[#555] block mb-2">阶段</label>
              <div className="flex gap-2 flex-wrap">
                {PHASES.map((p) => (
                  <button
                    key={p}
                    onClick={() => setFormPhase(p)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
                      formPhase === p ? 'text-[#0a0a14] font-bold' : 'text-[#777]'
                    }`}
                    style={{
                      background: formPhase === p ? PHASE_COLORS[p] : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${formPhase === p ? PHASE_COLORS[p] : 'rgba(255,255,255,0.06)'}`,
                    }}
                  >
                    {PHASE_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>

            {/* 点位滑块 */}
            <div>
              <label className="text-[11px] text-[#555] block mb-2">
                点位: <span className="font-mono text-[#e0e0e0]">{formPosition.toFixed(1)}</span> / 12
              </label>
              <input
                type="range"
                min="0"
                max="12"
                step="0.1"
                value={formPosition}
                onChange={(e) => setFormPosition(parseFloat(e.target.value))}
                className="w-full accent-[#eab308]"
              />
              <div className="flex justify-between text-[9px] text-[#444] mt-1">
                <span>0 (复苏)</span>
                <span>3 (过热)</span>
                <span>6 (滞胀)</span>
                <span>9 (衰退)</span>
                <span>12</span>
              </div>
            </div>

            {/* 置信度滑块 */}
            <div>
              <label className="text-[11px] text-[#555] block mb-2">
                置信度: <span className="font-mono text-[#e0e0e0]">{(formConfidence * 100).toFixed(0)}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={formConfidence}
                onChange={(e) => setFormConfidence(parseFloat(e.target.value))}
                className="w-full accent-[#eab308]"
              />
            </div>

            {/* 备注 */}
            <div>
              <label className="text-[11px] text-[#555] block mb-2">备注</label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={3}
                placeholder="可选：记录判断依据…"
                className="w-full rounded-lg px-4 py-3 text-sm text-[#e0e0e0] placeholder-[#555] outline-none resize-none focus:ring-1 focus:ring-[#eab308]"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            </div>

            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="rounded-lg px-6 py-3 text-sm font-bold bg-[#eab308] text-[#0a0a14] hover:bg-[#facc15] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {submitting ? '提交中…' : '提交确认'}
            </button>
          </div>
        </div>

        {/* === 评估历史 === */}
        {history.length > 0 && (
          <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 className="text-sm font-bold text-[#e0e0e0] mb-4">评估历史（最近 {history.length} 条）</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] text-[#555] uppercase tracking-wider">
                    <th className="text-left py-2 pr-3">时间</th>
                    <th className="text-left py-2 pr-3">阶段</th>
                    <th className="text-right py-2 pr-3">点位</th>
                    <th className="text-right py-2 pr-3">置信度</th>
                    <th className="text-left py-2 pr-3">触发</th>
                    <th className="text-left py-2">来源</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i} className="border-t border-white/5">
                      <td className="py-2.5 pr-3 text-[#555] whitespace-nowrap">{h.assessed_at?.slice(0, 19)}</td>
                      <td className="py-2.5 pr-3">
                        <span className="font-medium" style={{ color: PHASE_COLORS[h.final_phase] || '#aaa' }}>
                          {PHASE_LABELS[h.final_phase] || h.final_phase}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono text-[#ccc]">{h.final_position?.toFixed(1)}</td>
                      <td className="py-2.5 pr-3 text-right font-mono text-[#ccc]">{(h.final_confidence * 100).toFixed(0)}%</td>
                      <td className="py-2.5 pr-3 text-[#555]">{h.trigger_type || '-'}</td>
                      <td className="py-2.5 text-[#555]">
                        {h.human_phase ? '人工' : h.ai_phase ? 'AI+算法' : '算法'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// === 子组件 ===

function SourceCard({
  label,
  phase,
  position,
  confidence,
  notes,
}: {
  label: string
  phase: string | null
  position: number | null
  confidence: number | null
  notes?: string | null
}) {
  if (!phase) {
    return (
      <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="text-[10px] text-[#555] uppercase tracking-widest mb-2">{label}</div>
        <div className="text-[12px] text-[#444]">暂无数据</div>
      </div>
    )
  }

  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="text-[10px] text-[#555] uppercase tracking-widest mb-2">{label}</div>
      <div className="font-bold" style={{ color: PHASE_COLORS[phase] || '#aaa' }}>
        {PHASE_LABELS[phase] || phase}
      </div>
      <div className="text-[11px] text-[#777] mt-1">
        点位 <span className="font-mono">{position?.toFixed(1) ?? '-'}</span>
        {' · '}
        置信度 <span className="font-mono">{confidence != null ? (confidence * 100).toFixed(0) + '%' : '-'}</span>
      </div>
      {notes && <div className="text-[10px] text-[#555] mt-2 italic">📝 {notes}</div>}
    </div>
  )
}

function WeightsBar({ weights }: { weights: string }) {
  let parsed: Record<string, number> = {}
  try {
    parsed = JSON.parse(weights)
  } catch {
    return null
  }

  const entries = Object.entries(parsed).filter(([, v]) => v > 0)
  if (entries.length === 0) return null

  const WEIGHT_COLORS: Record<string, string> = {
    algo: '#3b82f6',
    ai: '#a855f7',
    human: '#22c55e',
  }
  const WEIGHT_LABELS: Record<string, string> = {
    algo: '算法',
    ai: 'AI',
    human: '人工',
  }

  return (
    <div>
      <div className="text-[10px] text-[#555] uppercase tracking-widest mb-2">权重分配</div>
      <div className="flex rounded-lg overflow-hidden h-6">
        {entries.map(([key, val]) => (
          <div
            key={key}
            className="flex items-center justify-center text-[10px] font-bold text-[#0a0a14]"
            style={{
              width: `${val * 100}%`,
              background: WEIGHT_COLORS[key] || '#777',
              minWidth: '40px',
            }}
          >
            {WEIGHT_LABELS[key] || key} {(val * 100).toFixed(0)}%
          </div>
        ))}
      </div>
    </div>
  )
}
