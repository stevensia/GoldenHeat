/* API Client — fetch wrapper for GoldenHeat backend */

import type {
  DashboardData,
  ValuationHistoryPoint,
  KlineHistoryPoint,
  MacroDetail,
  ClockSummary,
  ClockAssessment,
  ClockIndicator,
} from './types'

// API 基础路径：生产环境 /heat/api，开发环境 /api（vite proxy）
const API_BASE = import.meta.env.DEV ? '/api' : '/heat/api'

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`API ${path}: ${res.status} ${res.statusText}`)
  return res.json()
}

/**
 * 安全 fetch — 如果 API 404，返回 null（用于 Track A 还没就绪的端点）
 */
async function fetchJSONOrNull<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

/** 获取仪表盘聚合数据 */
export async function fetchDashboard(): Promise<DashboardData> {
  return fetchJSON<DashboardData>('/dashboard')
}

/** 手动刷新数据（需要 admin token） */
export async function refreshData(token: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}/refresh`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Refresh failed: ${res.status}`)
  return res.json()
}

/** 获取估值历史（Track A 端点，可能 404） */
export async function fetchValuationHistory(
  symbol: string,
  months = 120,
): Promise<ValuationHistoryPoint[] | null> {
  return fetchJSONOrNull<ValuationHistoryPoint[]>(
    `/valuation/history?symbol=${encodeURIComponent(symbol)}&months=${months}`,
  )
}

/** 获取 K 线历史（Track A 端点，可能 404） */
export async function fetchKlineHistory(
  symbol: string,
  months = 120,
): Promise<KlineHistoryPoint[] | null> {
  return fetchJSONOrNull<KlineHistoryPoint[]>(
    `/kline/history?symbol=${encodeURIComponent(symbol)}&months=${months}`,
  )
}

/** 获取宏观数据明细（Track A 端点，可能 404） */
export async function fetchMacroDetails(): Promise<MacroDetail[] | null> {
  return fetchJSONOrNull<MacroDetail[]>('/macro/details')
}

/** 获取双市场时钟摘要（无需 token） */
export async function fetchClockSummary(): Promise<ClockSummary> {
  return fetchJSON<ClockSummary>('/clock/summary')
}

// === Auth API ===

export interface AuthUser {
  username: string
  role: string
  display_name: string
  provider: string
}

export interface LoginResult {
  access_token: string
  token_type: string
  expires_in: number
  user: AuthUser
}

export interface OAuthConfig {
  enabled: boolean
  provider: string | null
  label: string | null
}

/** 密码登录 → JWT */
export async function authLogin(username: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '登录失败' }))
    throw new Error(err.detail || `登录失败: ${res.status}`)
  }
  return res.json()
}

/** 获取当前用户信息 */
export async function authMe(token: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('认证失败')
  return res.json()
}

/** 获取 OAuth 配置 */
export async function authOAuthConfig(): Promise<OAuthConfig> {
  return fetchJSON<OAuthConfig>('/auth/oauth/config')
}

/** OAuth 回调换 JWT */
export async function authOAuthCallback(code: string, state?: string): Promise<LoginResult> {
  const res = await fetch(`${API_BASE}/auth/oauth/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, state }),
  })
  if (!res.ok) throw new Error('OAuth 认证失败')
  return res.json()
}

// === Admin Clock API（需要 Bearer token） ===

async function fetchJSONWithToken<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`API ${path}: ${res.status} ${res.statusText}`)
  return res.json()
}

async function postJSONWithToken<T>(path: string, token: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`API ${path}: ${res.status} ${res.statusText}`)
  return res.json()
}

/** Admin: 获取最新评估 */
export async function fetchAdminClockLatest(token: string, market = 'cn'): Promise<ClockAssessment> {
  return fetchJSONWithToken<ClockAssessment>(`/admin/clock/latest?market=${market}`, token)
}

/** Admin: 获取评估历史 */
export async function fetchAdminClockHistory(token: string, market = 'cn', limit = 20): Promise<ClockAssessment[]> {
  return fetchJSONWithToken<ClockAssessment[]>(`/admin/clock/history?market=${market}&limit=${limit}`, token)
}

/** Admin: 获取指标 */
export async function fetchAdminClockIndicators(token: string, market = 'cn'): Promise<ClockIndicator[]> {
  return fetchJSONWithToken<ClockIndicator[]>(`/admin/clock/indicators?market=${market}`, token)
}

/** Admin: 触发评估 */
export async function postAdminClockAssess(token: string, market = 'cn'): Promise<unknown> {
  return postJSONWithToken('/admin/clock/assess', token, { market, trigger_type: 'manual' })
}

/** Admin: 人工确认 */
export async function postAdminClockConfirm(
  token: string,
  data: { market: string; phase: string; position: number; confidence: number; notes: string },
): Promise<unknown> {
  return postJSONWithToken('/admin/clock/confirm', token, data)
}
