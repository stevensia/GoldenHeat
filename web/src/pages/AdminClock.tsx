/* AdminClock — 美林时钟管理页 v2
 *
 * 功能：
 * 1. Token 登录（localStorage 缓存）
 * 2. 最新评估详情（三方对比 + 加权结果）
 * 3. 指标表格（含变化趋势、数据新鲜度警告）
 * 4. 评估历史
 * 5. 人工确认表单
 * 6. 触发重新评估
 * 7. 📚 美林时钟科普：理论介绍、象限解释、判断逻辑、数据来源说明、参考链接
 */

import { useState, useEffect, useCallback } from 'react'
import {
  fetchAdminClockLatest,
  fetchAdminClockHistory,
  fetchAdminClockIndicators,
  postAdminClockAssess,
  postAdminClockConfirm,
  authLogin,
  authMe,
  authOAuthConfig,
} from '../api/client'
import type { ClockAssessment, ClockIndicator } from '../api/types'
import type { AuthUser, OAuthConfig } from '../api/client'

const STORAGE_KEY = 'goldenheat_jwt'
const PHASES = ['recovery', 'overheat', 'stagflation', 'recession'] as const
const PHASE_LABELS: Record<string, string> = {
  recovery: '复苏', overheat: '过热',
  stagflation: '滞胀', recession: '衰退',
}
const PHASE_COLORS: Record<string, string> = {
  recovery: '#22c55e', overheat: '#ef4444',
  stagflation: '#eab308', recession: '#3b82f6',
}
const PHASE_ASSETS: Record<string, string> = {
  recovery: '股票', overheat: '商品',
  stagflation: '现金', recession: '债券',
}

// === 指标中文名映射 ===
const INDICATOR_NAMES: Record<string, string> = {
  cn_gdp: '🇨🇳 GDP增速', cn_cpi: '🇨🇳 CPI同比', cn_ppi: '🇨🇳 PPI同比',
  cn_pmi: '🇨🇳 制造业PMI', cn_m2: '🇨🇳 M2增速', cn_lpr: '🇨🇳 LPR利率',
  us_gdp: '🇺🇸 GDP增速', us_cpi: '🇺🇸 CPI同比',
  us_fed_rate: '🇺🇸 联邦基金利率', us_payroll: '🇺🇸 非农就业(千人)',
}

export default function AdminClock() {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY) || '')
  const [authed, setAuthed] = useState(false)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [market, setMarket] = useState<'cn' | 'us'>('cn')

  // Login form
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [oauthConfig, setOauthConfig] = useState<OAuthConfig | null>(null)

  const [latest, setLatest] = useState<ClockAssessment | null>(null)
  const [history, setHistory] = useState<ClockAssessment[]>([])
  const [indicators, setIndicators] = useState<ClockIndicator[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formPhase, setFormPhase] = useState<string>('recovery')
  const [formPosition, setFormPosition] = useState(0)
  const [formConfidence, setFormConfidence] = useState(0.7)
  const [formNotes, setFormNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState('')

  // 展开/折叠
  const [showTheory, setShowTheory] = useState(false)
  const [showLogic, setShowLogic] = useState(false)
  const [showSources, setShowSources] = useState(false)
  const [showLinks, setShowLinks] = useState(false)

  const loadData = useCallback(async (t: string, m: string) => {
    setLoading(true); setError('')
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
    } finally { setLoading(false) }
  }, [])

  const handleLogin = async () => {
    if (!loginUsername.trim() || !loginPassword.trim()) return
    setError('')
    try {
      const result = await authLogin(loginUsername.trim(), loginPassword.trim())
      localStorage.setItem(STORAGE_KEY, result.access_token)
      setToken(result.access_token)
      setCurrentUser(result.user)
      setAuthed(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : '登录失败')
    }
  }

  // 自动登录 — 检查 JWT 有效性
  useEffect(() => {
    if (token) {
      authMe(token)
        .then((user) => { setCurrentUser(user); setAuthed(true) })
        .catch(() => { localStorage.removeItem(STORAGE_KEY); setToken('') })
    }
    // 加载 OAuth 配置
    authOAuthConfig().then(setOauthConfig).catch(() => {})
  }, [token])

  useEffect(() => {
    if (authed && token) loadData(token, market)
  }, [authed, token, market, loadData])

  const handleAssess = async () => {
    setSubmitting(true); setSubmitMsg('')
    try {
      await postAdminClockAssess(token, market)
      setSubmitMsg('✅ 评估完成'); loadData(token, market)
    } catch (e) {
      setSubmitMsg(`❌ ${e instanceof Error ? e.message : '评估失败'}`)
    } finally { setSubmitting(false) }
  }

  const handleConfirm = async () => {
    setSubmitting(true); setSubmitMsg('')
    try {
      await postAdminClockConfirm(token, { market, phase: formPhase, position: formPosition, confidence: formConfidence, notes: formNotes })
      setSubmitMsg('✅ 已提交人工确认'); setFormNotes(''); loadData(token, market)
    } catch (e) {
      setSubmitMsg(`❌ ${e instanceof Error ? e.message : '提交失败'}`)
    } finally { setSubmitting(false) }
  }

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setToken(''); setAuthed(false); setLatest(null); setHistory([]); setIndicators([])
  }

  // === 未登录 ===
  if (!authed) {
    return (
      <div className="min-h-[60vh]">
        <div className="mx-auto max-w-md px-4 pt-24">
          <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-center mb-6">
              <div className="text-[10px] text-[#555] uppercase tracking-widest mb-2">GoldenHeat Admin</div>
              <h1 className="text-xl font-bold text-[#e0e0e0]">美林时钟管理</h1>
              <p className="text-[11px] text-[#555] mt-2">三方加权判断 · 人工修正 · 历史追踪</p>
            </div>
            <div className="space-y-4">
              {/* 用户名密码登录 */}
              <div>
                <input type="text" placeholder="用户名" value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && document.getElementById('pw-input')?.focus()}
                  className="w-full rounded-lg px-4 py-3 text-sm text-[#e0e0e0] placeholder-[#555] outline-none focus:ring-1 focus:ring-[#eab308]"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }} />
              </div>
              <div>
                <input id="pw-input" type="password" placeholder="密码" value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  className="w-full rounded-lg px-4 py-3 text-sm text-[#e0e0e0] placeholder-[#555] outline-none focus:ring-1 focus:ring-[#eab308]"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }} />
              </div>
              <button onClick={handleLogin}
                className="w-full rounded-lg py-3 text-sm font-bold bg-[#eab308] text-[#0a0a14] hover:bg-[#facc15] transition-colors cursor-pointer">
                登录
              </button>

              {/* OAuth 登录按钮 */}
              {oauthConfig?.enabled && (
                <>
                  <div className="flex items-center gap-3 text-[10px] text-[#555]">
                    <div className="flex-1 h-px bg-white/5" />
                    <span>或</span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>
                  <button
                    onClick={() => window.location.href = `${import.meta.env.DEV ? '/api' : '/heat/api'}/auth/oauth/authorize`}
                    className="w-full rounded-lg py-3 text-sm font-medium text-[#e0e0e0] hover:bg-white/[0.04] transition-colors cursor-pointer flex items-center justify-center gap-2"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6.5" height="6.5" fill="#F35325"/><rect x="8.5" y="1" width="6.5" height="6.5" fill="#81BC06"/><rect x="1" y="8.5" width="6.5" height="6.5" fill="#05A6F0"/><rect x="8.5" y="8.5" width="6.5" height="6.5" fill="#FFBA08"/></svg>
                    {oauthConfig.label || 'Microsoft 登录'}
                  </button>
                </>
              )}

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

  // 解析 algo_details
  let algoDetails: Record<string, unknown> = {}
  if (latest?.algo_details) {
    try { algoDetails = JSON.parse(typeof latest.algo_details === 'string' ? latest.algo_details : JSON.stringify(latest.algo_details)) } catch { /* */ }
  }

  // 数据新鲜度计算
  const now = new Date()
  const getStaleMonths = (dateStr: string) => {
    const d = new Date(dateStr + '-01')
    return Math.floor((now.getTime() - d.getTime()) / (30 * 24 * 60 * 60 * 1000))
  }

  // === 已登录 ===
  return (
    <div className="min-h-[60vh]">
      <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-6 sm:px-6">
        {/* 顶栏 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-[10px] text-[#555] uppercase tracking-widest">GoldenHeat Admin</div>
            <h1 className="text-lg font-bold text-[#e0e0e0] tracking-tight">美林时钟管理面板</h1>
            {currentUser && (
              <div className="text-[10px] text-[#555] mt-0.5">
                {currentUser.display_name} · {currentUser.provider === 'local' ? '密码登录' : currentUser.provider === 'entra' ? 'Microsoft' : 'Token'} · {currentUser.role}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <a href="#/" className="text-[11px] text-[#555] hover:text-[#888] transition-colors">← 首页</a>
            <button onClick={handleLogout} className="text-[11px] text-[#555] hover:text-red-400 transition-colors cursor-pointer">登出</button>
          </div>
        </div>

        {/* 市场切换 + 操作 */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {(['cn', 'us'] as const).map((m) => (
            <button key={m} onClick={() => setMarket(m)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all cursor-pointer ${market === m ? 'bg-[#eab308] text-[#0a0a14]' : 'text-[#777] hover:text-[#ccc]'}`}
              style={market !== m ? { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' } : undefined}>
              {m === 'cn' ? '🇨🇳 中国' : '🌍 美国'}
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={handleAssess} disabled={submitting}
            className="rounded-lg px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors cursor-pointer">
            {submitting ? '评估中…' : '🔄 触发评估'}
          </button>
        </div>

        {loading && <div className="text-[#777] text-sm mb-4">加载中…</div>}
        {error && <div className="text-red-400 text-sm mb-4">{error}</div>}
        {submitMsg && <div className="text-sm mb-4 text-[#aaa]">{submitMsg}</div>}

        {/* ============================================================ */}
        {/* 1. 最新评估结果 */}
        {/* ============================================================ */}
        {latest && !('error' in latest) && (
          <div className="rounded-2xl p-5 mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 className="text-sm font-bold text-[#e0e0e0] mb-4">📊 最新评估结果</h2>

            {/* 最终结果卡 */}
            <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${PHASE_COLORS[latest.final_phase] || '#333'}22` }}>
              <div className="text-[10px] text-[#555] uppercase tracking-widest mb-2">最终加权结果</div>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-2xl font-bold" style={{ color: PHASE_COLORS[latest.final_phase] || '#eab308' }}>
                  {PHASE_LABELS[latest.final_phase] || latest.final_phase}
                </span>
                <span className="text-sm text-[#aaa]">
                  点位 <span className="font-mono font-medium text-[#e0e0e0]">{latest.final_position?.toFixed(1)}</span> / 12
                </span>
                <span className="text-sm text-[#aaa]">
                  置信度 <span className="font-mono font-medium text-[#e0e0e0]">{(latest.final_confidence * 100).toFixed(0)}%</span>
                </span>
                <span className="text-[10px] text-[#555]">{latest.assessed_at}</span>
              </div>
              <div className="mt-2 text-[11px] text-[#777]">
                → 建议超配 <span className="text-[#e0e0e0] font-medium">{PHASE_ASSETS[latest.final_phase] || '—'}</span>
              </div>
            </div>

            {/* 三方对比 */}
            <div className="grid gap-3 sm:grid-cols-3">
              <SourceCard label="🤖 算法" phase={latest.algo_phase} position={latest.algo_position} confidence={latest.algo_confidence} />
              <SourceCard label="🧠 AI" phase={latest.ai_phase} position={latest.ai_position} confidence={latest.ai_confidence} />
              <SourceCard label="👤 人工" phase={latest.human_phase} position={latest.human_position} confidence={latest.human_confidence} notes={latest.human_notes} />
            </div>

            {latest.weights && <div className="mt-4"><WeightsBar weights={latest.weights} /></div>}

            {/* 算法判断逻辑详情 */}
            {Object.keys(algoDetails).length > 0 && (
              <div className="mt-4 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.03)' }}>
                <div className="text-[10px] text-[#555] uppercase tracking-widest mb-3">算法判断依据</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                  <div>
                    <span className="text-[#555]">GDP趋势</span>
                    <div className="font-medium mt-0.5" style={{ color: algoDetails.gdp_trend === 'up' ? '#22c55e' : '#ef4444' }}>
                      {algoDetails.gdp_trend === 'up' ? '↑ 扩张' : '↓ 收缩'}
                      <span className="text-[#555] ml-1">(slope: {typeof algoDetails.gdp_slope === 'number' ? (algoDetails.gdp_slope as number).toFixed(3) : '—'})</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[#555]">CPI趋势</span>
                    <div className="font-medium mt-0.5" style={{ color: algoDetails.cpi_trend === 'up' ? '#ef4444' : '#22c55e' }}>
                      {algoDetails.cpi_trend === 'up' ? '↑ 通胀' : '↓ 通缩'}
                      <span className="text-[#555] ml-1">(slope: {typeof algoDetails.cpi_slope === 'number' ? (algoDetails.cpi_slope as number).toFixed(4) : '—'})</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[#555]">PMI</span>
                    <div className="font-medium mt-0.5 text-[#e0e0e0]">
                      {String(algoDetails.pmi_value ?? '—')}
                      <span className="text-[#555] ml-1">({algoDetails.pmi_confirm ? '✅ 确认' : '⚠️ 矛盾'})</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[#555]">信用环境</span>
                    <div className="font-medium mt-0.5 text-[#e0e0e0]">
                      M2 {String(algoDetails.m2_growth ?? '—')}% vs GDP {String(algoDetails.gdp_growth ?? '—')}%
                      <span className="text-[#555] ml-1">({String(algoDetails.credit_signal) || '—'})</span>
                    </div>
                  </div>
                </div>
                {typeof algoDetails.transition_warning === 'string' && algoDetails.transition_warning && (
                  <div className="mt-3 px-3 py-1.5 rounded-lg text-[11px] text-[#eab308] border border-[#eab30822]"
                    style={{ background: 'rgba(234,179,8,0.06)' }}>
                    ⚠️ {String(algoDetails.transition_warning)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* 2. 指标数据表（增强版：含新鲜度警告） */}
        {/* ============================================================ */}
        {indicators.length > 0 && (
          <div className="rounded-2xl p-5 mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 className="text-sm font-bold text-[#e0e0e0] mb-1">📈 宏观指标数据</h2>
            <p className="text-[10px] text-[#555] mb-4">美林时钟判断的底层数据，来自国家统计局(NBS)、中国人民银行(PBoC)、美联储经济数据库(FRED)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] text-[#555] uppercase tracking-wider">
                    <th className="text-left py-2 pr-4">指标</th>
                    <th className="text-right py-2 pr-4">当前值</th>
                    <th className="text-right py-2 pr-4">数据日期</th>
                    <th className="text-center py-2 pr-4">新鲜度</th>
                    <th className="text-left py-2">来源</th>
                  </tr>
                </thead>
                <tbody>
                  {indicators.map((ind) => {
                    const stale = getStaleMonths(ind.date)
                    const isStale = stale > 2
                    const isVeryStale = stale > 5
                    return (
                      <tr key={ind.indicator} className="border-t border-white/5">
                        <td className="py-2.5 pr-4 text-[#ccc]">{INDICATOR_NAMES[ind.indicator] || ind.name || ind.indicator}</td>
                        <td className="py-2.5 pr-4 text-right font-mono text-[#e0e0e0] font-medium">
                          {typeof ind.value === 'number' ? ind.value.toFixed(2) : ind.value}
                          {ind.indicator.includes('pmi') && <span className="text-[9px] text-[#555] ml-1">{(ind.value as number) >= 50 ? '扩张' : '收缩'}</span>}
                        </td>
                        <td className="py-2.5 pr-4 text-right text-[#555]">{ind.date}</td>
                        <td className="py-2.5 pr-4 text-center">
                          {isVeryStale ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">🔴 {stale}月前</span>
                          ) : isStale ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400">🟡 {stale}月前</span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">🟢 最新</span>
                          )}
                        </td>
                        <td className="py-2.5 text-[#555] text-[11px]">{ind.source}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-[10px] text-[#444]">
              💡 数据超过 3 个月标黄，超过 5 个月标红。过期数据会降低时钟判断准确性。
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 3. 人工确认表单 */}
        {/* ============================================================ */}
        <div className="rounded-2xl p-5 mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="text-sm font-bold text-[#e0e0e0] mb-1">✍️ 人工确认</h2>
          <p className="text-[10px] text-[#555] mb-4">根据你的判断修正时钟位置。人工权重占 30%，与算法(40%)和 AI(30%) 加权合成最终结果。</p>
          <div className="space-y-5">
            <div>
              <label className="text-[11px] text-[#555] block mb-2">选择阶段</label>
              <div className="flex gap-2 flex-wrap">
                {PHASES.map((p) => (
                  <button key={p} onClick={() => { setFormPhase(p); setFormPosition(p === 'recovery' ? 0 : p === 'overheat' ? 3 : p === 'stagflation' ? 6 : 9) }}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-all cursor-pointer ${formPhase === p ? 'text-[#0a0a14] font-bold' : 'text-[#777]'}`}
                    style={{ background: formPhase === p ? PHASE_COLORS[p] : 'rgba(255,255,255,0.03)', border: `1px solid ${formPhase === p ? PHASE_COLORS[p] : 'rgba(255,255,255,0.06)'}` }}>
                    {PHASE_LABELS[p]} → {PHASE_ASSETS[p]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] text-[#555] block mb-2">
                点位: <span className="font-mono text-[#e0e0e0]">{formPosition.toFixed(1)}</span> / 12
                <span className="text-[#444] ml-2">({positionToPhaseLabel(formPosition)})</span>
              </label>
              <input type="range" min="0" max="12" step="0.1" value={formPosition}
                onChange={(e) => setFormPosition(parseFloat(e.target.value))} className="w-full accent-[#eab308]" />
              <div className="flex justify-between text-[9px] text-[#444] mt-1">
                <span>0 复苏中心</span><span>3 过热中心</span><span>6 滞胀中心</span><span>9 衰退中心</span><span>12</span>
              </div>
            </div>
            <div>
              <label className="text-[11px] text-[#555] block mb-2">
                置信度: <span className="font-mono text-[#e0e0e0]">{(formConfidence * 100).toFixed(0)}%</span>
                <span className="text-[#444] ml-2">({formConfidence < 0.4 ? '低 — 不确定' : formConfidence < 0.7 ? '中 — 有依据' : '高 — 很确定'})</span>
              </label>
              <input type="range" min="0" max="1" step="0.05" value={formConfidence}
                onChange={(e) => setFormConfidence(parseFloat(e.target.value))} className="w-full accent-[#eab308]" />
            </div>
            <div>
              <label className="text-[11px] text-[#555] block mb-2">判断备注</label>
              <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={3}
                placeholder="记录判断依据，例如：PMI连续3月回升，CPI拐头向上，地缘风险推高油价…"
                className="w-full rounded-lg px-4 py-3 text-sm text-[#e0e0e0] placeholder-[#555] outline-none resize-none focus:ring-1 focus:ring-[#eab308]"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }} />
            </div>
            <button onClick={handleConfirm} disabled={submitting}
              className="rounded-lg px-6 py-3 text-sm font-bold bg-[#eab308] text-[#0a0a14] hover:bg-[#facc15] disabled:opacity-50 transition-colors cursor-pointer">
              {submitting ? '提交中…' : '提交确认'}
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 4. 评估历史 */}
        {/* ============================================================ */}
        {history.length > 0 && (
          <div className="rounded-2xl p-5 mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 className="text-sm font-bold text-[#e0e0e0] mb-4">📋 评估历史（最近 {history.length} 条）</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] text-[#555] uppercase tracking-wider">
                    <th className="text-left py-2 pr-3">时间</th>
                    <th className="text-left py-2 pr-3">阶段</th>
                    <th className="text-right py-2 pr-3">点位</th>
                    <th className="text-right py-2 pr-3">置信度</th>
                    <th className="text-left py-2 pr-3">触发方式</th>
                    <th className="text-left py-2">判断来源</th>
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
                      <td className="py-2.5 pr-3 text-[#555]">
                        {h.trigger_type === 'manual' ? '🖱 手动' : h.trigger_type === 'quarterly_auto' ? '🔄 季度自动' : h.trigger_type || '—'}
                      </td>
                      <td className="py-2.5 text-[#555]">
                        {h.human_phase ? '👤人工+🤖算法' : h.ai_phase ? '🧠AI+🤖算法' : '🤖 算法'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 5. 📚 美林时钟科普 & 参考资料 */}
        {/* ============================================================ */}
        <div className="space-y-4">
          {/* 理论介绍 */}
          <CollapsibleSection title="📖 什么是美林时钟" open={showTheory} onToggle={() => setShowTheory(!showTheory)}>
            <div className="space-y-3 text-[12px] text-[#999] leading-relaxed">
              <p>
                <span className="text-[#e0e0e0] font-medium">美林投资时钟（Merrill Lynch Investment Clock）</span>是由美林证券在 2004 年提出的经济周期资产配置框架。
                核心思想：<span className="text-[#eab308]">经济周期可以用 GDP增长（产出缺口）和 CPI通胀（通胀动能）两个维度划分为四个阶段</span>，
                每个阶段有不同的最优资产配置。
              </p>
              <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <pre className="text-[11px] text-[#888] font-mono leading-5 whitespace-pre">{`             GDP ↑ (产出扩张)
      ┌──────────┬──────────┐
      │  复苏期   │  过热期   │
      │ GDP↑CPI↓ │ GDP↑CPI↑ │
      │ → 股票    │ → 商品    │
 CPI↓ ├──────────┼──────────┤ CPI↑
      │  衰退期   │  滞胀期   │
      │ GDP↓CPI↓ │ GDP↓CPI↑ │
      │ → 债券    │ → 现金    │
      └──────────┴──────────┘
             GDP ↓ (产出收缩)`}</pre>
              </div>
              <p>
                <span className="text-[#e0e0e0]">四阶段顺时针流转：</span>
                <span className="text-[#22c55e]">复苏</span> → <span className="text-[#ef4444]">过热</span> →
                <span className="text-[#eab308]">滞胀</span> → <span className="text-[#3b82f6]">衰退</span> → 复苏 ...
                一个完整周期通常持续 3-8 年。
              </p>
              <div className="grid grid-cols-2 gap-2">
                <PhaseExplain phase="recovery" label="复苏期" desc="经济回暖但通胀尚低，企业盈利改善，股票表现最佳" asset="股票" signal="GDP↑ CPI↓ PMI回升" />
                <PhaseExplain phase="overheat" label="过热期" desc="经济高增长带动通胀上升，商品需求旺盛，央行开始加息" asset="商品" signal="GDP↑ CPI↑ 产能饱和" />
                <PhaseExplain phase="stagflation" label="滞胀期" desc="增长放缓但通胀高企（成本推动），现金为王等待机会" asset="现金" signal="GDP↓ CPI↑ 油价高" />
                <PhaseExplain phase="recession" label="衰退期" desc="经济全面收缩、通胀回落，央行降息利好债券" asset="债券" signal="GDP↓ CPI↓ 降息周期" />
              </div>
            </div>
          </CollapsibleSection>

          {/* 系统判断逻辑 */}
          <CollapsibleSection title="⚙️ 系统判断逻辑" open={showLogic} onToggle={() => setShowLogic(!showLogic)}>
            <div className="space-y-3 text-[12px] text-[#999] leading-relaxed">
              <p className="text-[#e0e0e0] font-medium">GoldenHeat 采用三方加权机制：</p>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="rounded-lg p-3" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.1)' }}>
                  <div className="text-[11px] text-blue-400 font-medium mb-1">🤖 算法判断 (40%)</div>
                  <ul className="text-[11px] text-[#888] space-y-1">
                    <li>• 对 GDP 和 CPI 时间序列做<span className="text-[#ccc]">线性回归</span>，取斜率判断趋势方向</li>
                    <li>• GDP slope &gt; 0 → 扩张；CPI slope &gt; 0 → 通胀</li>
                    <li>• PMI 辅助修正：若 PMI 与 GDP 趋势矛盾，置信度 ×0.7</li>
                    <li>• M2 vs GDP 判断信用环境（宽松/紧缩）</li>
                    <li>• 用 6 个月滚动窗口拟合</li>
                  </ul>
                </div>
                <div className="rounded-lg p-3" style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.1)' }}>
                  <div className="text-[11px] text-purple-400 font-medium mb-1">🧠 AI 判断 (30%)</div>
                  <ul className="text-[11px] text-[#888] space-y-1">
                    <li>• 将最新指标数据 + 算法结果输入 LLM</li>
                    <li>• LLM 综合分析给出独立判断</li>
                    <li>• 可以识别算法难以捕捉的结构性变化</li>
                    <li>• 例如：地缘冲击、政策突变</li>
                    <li>• AI 不可用时自动降级为 算法 50% + 人工 50%</li>
                  </ul>
                </div>
                <div className="rounded-lg p-3" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.1)' }}>
                  <div className="text-[11px] text-green-400 font-medium mb-1">👤 人工判断 (30%)</div>
                  <ul className="text-[11px] text-[#888] space-y-1">
                    <li>• 在本页面手动确认阶段和点位</li>
                    <li>• 考虑算法/AI 难以量化的因素</li>
                    <li>• 如战争、黑天鹅、政策预期</li>
                    <li>• 人工未介入时权重归零，算法和 AI 各 50%</li>
                    <li>• 每季度系统提醒确认</li>
                  </ul>
                </div>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="text-[11px] text-[#777]">
                  <span className="text-[#e0e0e0] font-medium">点位系统 (0-12)：</span>
                  将四阶段映射到钟表刻度。0/12 = 复苏中心，3 = 过热中心，6 = 滞胀中心，9 = 衰退中心。
                  中间值表示过渡区间，如 1.5 = 复苏后期/接近过热。精确点位由 confidence 和指标斜率大小决定。
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* 数据来源 */}
          <CollapsibleSection title="🗄️ 数据来源说明" open={showSources} onToggle={() => setShowSources(!showSources)}>
            <div className="space-y-3 text-[12px] text-[#999] leading-relaxed">
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-[10px] text-[#555] uppercase">
                      <th className="text-left py-2 pr-3">指标</th>
                      <th className="text-left py-2 pr-3">来源</th>
                      <th className="text-left py-2 pr-3">频率</th>
                      <th className="text-left py-2">说明</th>
                    </tr>
                  </thead>
                  <tbody className="text-[#888]">
                    <tr className="border-t border-white/5"><td className="py-2 pr-3 text-[#ccc]">🇨🇳 GDP</td><td className="pr-3">国家统计局 (NBS)</td><td className="pr-3">季度</td><td>累计同比增速，一般延迟1个月发布</td></tr>
                    <tr className="border-t border-white/5"><td className="py-2 pr-3 text-[#ccc]">🇨🇳 CPI</td><td className="pr-3">国家统计局 (NBS)</td><td className="pr-3">月度</td><td>居民消费价格同比，每月10日前后发布</td></tr>
                    <tr className="border-t border-white/5"><td className="py-2 pr-3 text-[#ccc]">🇨🇳 PPI</td><td className="pr-3">国家统计局 (NBS)</td><td className="pr-3">月度</td><td>工业生产者出厂价格同比，与CPI同日发布</td></tr>
                    <tr className="border-t border-white/5"><td className="py-2 pr-3 text-[#ccc]">🇨🇳 PMI</td><td className="pr-3">国家统计局 (NBS)</td><td className="pr-3">月度</td><td>制造业采购经理指数，50为荣枯线，月末最后一天发布</td></tr>
                    <tr className="border-t border-white/5"><td className="py-2 pr-3 text-[#ccc]">🇨🇳 M2</td><td className="pr-3">中国人民银行 (PBoC)</td><td className="pr-3">月度</td><td>广义货币供应量同比增速</td></tr>
                    <tr className="border-t border-white/5"><td className="py-2 pr-3 text-[#ccc]">🇺🇸 GDP</td><td className="pr-3">FRED (BEA)</td><td className="pr-3">季度</td><td>实际GDP环比年化增长率</td></tr>
                    <tr className="border-t border-white/5"><td className="py-2 pr-3 text-[#ccc]">🇺🇸 CPI</td><td className="pr-3">FRED (BLS)</td><td className="pr-3">月度</td><td>CPI-U 同比变化率</td></tr>
                    <tr className="border-t border-white/5"><td className="py-2 pr-3 text-[#ccc]">🇺🇸 Fed Rate</td><td className="pr-3">FRED</td><td className="pr-3">月度</td><td>联邦基金有效利率</td></tr>
                    <tr className="border-t border-white/5"><td className="py-2 pr-3 text-[#ccc]">🇺🇸 非农</td><td className="pr-3">FRED (BLS)</td><td className="pr-3">月度</td><td>非农就业总人数（千人），每月第一个周五发布</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="text-[11px] text-[#666]">
                <p><span className="text-[#aaa]">采集方式：</span>中国数据通过 <a href="https://github.com/akfamily/akshare" target="_blank" rel="noopener" className="text-blue-400 hover:underline">akshare</a> 采集（可能有延迟）；美国数据通过 <a href="https://fred.stlouisfed.org/" target="_blank" rel="noopener" className="text-blue-400 hover:underline">FRED API</a> 实时获取。</p>
                <p className="mt-1"><span className="text-[#aaa]">已知限制：</span>akshare 中国数据有时滞后 1-2 个月。如遇数据缺失，可手动补录确认。</p>
              </div>
            </div>
          </CollapsibleSection>

          {/* 参考链接 */}
          <CollapsibleSection title="🔗 参考资料与延伸阅读" open={showLinks} onToggle={() => setShowLinks(!showLinks)}>
            <div className="space-y-2 text-[12px]">
              <LinkItem title="The Investment Clock (原始论文)" url="https://www.merrilledge.com/article/understanding-business-cycle" desc="美林证券原始投资时钟论文概述" />
              <LinkItem title="FRED Economic Data" url="https://fred.stlouisfed.org/" desc="美联储经济数据库 — 美国宏观指标官方来源" />
              <LinkItem title="国家统计局" url="https://www.stats.gov.cn/" desc="中国 GDP、CPI、PPI、PMI 等官方数据发布" />
              <LinkItem title="akshare 文档" url="https://akshare.akfamily.xyz/" desc="Python 金融数据接口库，本系统中国数据采集来源" />
              <LinkItem title="OECD Economic Outlook" url="https://www.oecd.org/economic-outlook/" desc="OECD 全球经济展望，宏观趋势参考" />
              <LinkItem title="美林时钟中国应用研究" url="https://xueqiu.com/3818429473/109236498" desc="雪球用户整理的美林时钟在中国市场的适用性分析" />
              <LinkItem title="投资时钟的缺陷与改进" url="https://www.zhihu.com/question/307285986" desc="知乎讨论：美林时钟在中国失效了吗？" />
            </div>
          </CollapsibleSection>
        </div>
      </div>
    </div>
  )
}

// === 子组件 ===

function positionToPhaseLabel(pos: number): string {
  const p = ((pos % 12) + 12) % 12
  if (p < 1.5 || p >= 10.5) return '复苏区间'
  if (p < 4.5) return '过热区间'
  if (p < 7.5) return '滞胀区间'
  return '衰退区间'
}

function CollapsibleSection({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <button onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-[#e0e0e0] hover:bg-white/[0.02] transition-colors cursor-pointer">
        <span>{title}</span>
        <span className="text-[#555] text-lg transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  )
}

function PhaseExplain({ phase, label, desc, asset, signal }: { phase: string; label: string; desc: string; asset: string; signal: string }) {
  return (
    <div className="rounded-lg p-2.5" style={{ background: `${PHASE_COLORS[phase]}08`, border: `1px solid ${PHASE_COLORS[phase]}15` }}>
      <div className="text-[11px] font-bold" style={{ color: PHASE_COLORS[phase] }}>{label}</div>
      <div className="text-[10px] text-[#888] mt-0.5">{desc}</div>
      <div className="text-[10px] text-[#666] mt-1">超配: <span className="text-[#ccc]">{asset}</span> | 信号: {signal}</div>
    </div>
  )
}

function LinkItem({ title, url, desc }: { title: string; url: string; desc: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="block rounded-lg px-4 py-3 hover:bg-white/[0.02] transition-colors"
      style={{ border: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="text-[12px] text-blue-400 font-medium">{title} ↗</div>
      <div className="text-[10px] text-[#666] mt-0.5">{desc}</div>
    </a>
  )
}

function SourceCard({ label, phase, position, confidence, notes }: {
  label: string; phase: string | null; position: number | null; confidence: number | null; notes?: string | null
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
      <div className="font-bold" style={{ color: PHASE_COLORS[phase] || '#aaa' }}>{PHASE_LABELS[phase] || phase}</div>
      <div className="text-[11px] text-[#777] mt-1">
        点位 <span className="font-mono">{position?.toFixed(1) ?? '—'}</span>
        {' · '}置信度 <span className="font-mono">{confidence != null ? (confidence * 100).toFixed(0) + '%' : '—'}</span>
      </div>
      {notes && <div className="text-[10px] text-[#555] mt-2 italic">📝 {notes}</div>}
    </div>
  )
}

function WeightsBar({ weights }: { weights: string }) {
  let parsed: Record<string, number> = {}
  try { parsed = JSON.parse(weights) } catch { return null }
  const entries = Object.entries(parsed).filter(([, v]) => v > 0)
  if (entries.length === 0) return null
  const WEIGHT_COLORS: Record<string, string> = { algo: '#3b82f6', ai: '#a855f7', human: '#22c55e' }
  const WEIGHT_LABELS: Record<string, string> = { algo: '🤖 算法', ai: '🧠 AI', human: '👤 人工' }
  return (
    <div>
      <div className="text-[10px] text-[#555] uppercase tracking-widest mb-2">权重分配</div>
      <div className="flex rounded-lg overflow-hidden h-7">
        {entries.map(([key, val]) => (
          <div key={key} className="flex items-center justify-center text-[10px] font-bold text-[#0a0a14]"
            style={{ width: `${val * 100}%`, background: WEIGHT_COLORS[key] || '#777', minWidth: '50px' }}>
            {WEIGHT_LABELS[key] || key} {(val * 100).toFixed(0)}%
          </div>
        ))}
      </div>
    </div>
  )
}
