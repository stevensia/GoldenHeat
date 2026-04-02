/* API Client — fetch wrapper for GoldenHeat backend
 *
 * V2.5 升级:
 * - v1 API base path 支持
 * - 统一响应解析 ({ok, data, meta} 格式)
 * - 请求拦截器: 自动添加 JWT
 * - 错误处理: 401 → 跳转登录
 */

import type {
  DashboardData,
  ValuationHistoryPoint,
  KlineHistoryPoint,
  MacroDetail,
  ClockSummary,
  ClockAssessment,
  ClockIndicator,
  IndexValuation,
  PEHistoryPoint,
  DCAPlan,
  DCARecord,
  DCAAnalysis,
  TechnicalAnalysis,
} from './types'

// === JWT 管理 ===
const JWT_STORAGE_KEY = 'goldenheat_jwt'

export function getStoredToken(): string | null {
  return localStorage.getItem(JWT_STORAGE_KEY)
}

export function setStoredToken(token: string): void {
  localStorage.setItem(JWT_STORAGE_KEY, token)
}

export function clearStoredToken(): void {
  localStorage.removeItem(JWT_STORAGE_KEY)
}

// === API 基础路径 ===
// 旧 API: /api (保持兼容)
// 新 API: /api/v1 (V2.5 新端点)
const API_BASE = import.meta.env.DEV ? '/api' : '/heat/api'
const API_V1_BASE = `${API_BASE}/v1`

// === 统一响应格式 (v1 API) ===
export interface ApiResponse<T> {
  ok: boolean
  data: T
  meta?: {
    total?: number
    page?: number
    updated_at?: string
    [key: string]: unknown
  }
}

// === 请求拦截器 ===

/** 构建带 JWT 的 headers */
function authHeaders(extraHeaders?: Record<string, string>): HeadersInit {
  const headers: Record<string, string> = { ...extraHeaders }
  const token = getStoredToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

/** 处理 401 → 跳转登录 */
function handle401(res: Response): void {
  if (res.status === 401) {
    clearStoredToken()
    // 如果当前在 admin 页面，跳转到管理登录
    if (window.location.hash.includes('/admin')) {
      window.location.hash = '#/admin/clock'
    }
  }
}

// === 核心 fetch 函数 ===

async function fetchJSON<T>(path: string, base = API_BASE): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    handle401(res)
    throw new Error(`API ${path}: ${res.status} ${res.statusText}`)
  }
  const json = await res.json()
  // 自动解包统一响应格式 {ok, data, meta}
  if (json && typeof json === 'object' && 'ok' in json && 'data' in json) {
    return json.data as T
  }
  return json as T
}

/**
 * 安全 fetch — 如果 API 404，返回 null（用于 Track A 还没就绪的端点）
 */
async function fetchJSONOrNull<T>(path: string, base = API_BASE): Promise<T | null> {
  try {
    const res = await fetch(`${base}${path}`, {
      headers: authHeaders(),
    })
    if (!res.ok) {
      handle401(res)
      return null
    }
    const json = await res.json()
    if (json && typeof json === 'object' && 'ok' in json && 'data' in json) {
      return json.data as T
    }
    return json as T
  } catch {
    return null
  }
}

/**
 * v1 API 统一响应解析 — 处理 {ok, data, meta} 格式
 * 如果后端返回旧格式(直接数据)，自动兼容
 */
async function fetchV1<T>(path: string): Promise<{ data: T; meta?: ApiResponse<T>['meta'] }> {
  const res = await fetch(`${API_V1_BASE}${path}`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    handle401(res)
    throw new Error(`API v1 ${path}: ${res.status} ${res.statusText}`)
  }
  const json = await res.json()

  // 如果是标准 {ok, data} 格式
  if (json && typeof json === 'object' && 'ok' in json && 'data' in json) {
    if (!json.ok) throw new Error(json.error || `API v1 ${path}: request failed`)
    return { data: json.data as T, meta: json.meta }
  }

  // 兼容旧格式: 直接返回数据
  return { data: json as T }
}

async function fetchV1OrNull<T>(path: string): Promise<{ data: T; meta?: ApiResponse<T>['meta'] } | null> {
  try {
    return await fetchV1<T>(path)
  } catch {
    return null
  }
}

async function postJSON<T>(path: string, body?: unknown, base = API_BASE): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    handle401(res)
    throw new Error(`API ${path}: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

// === 旧 API (保持兼容) ===

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
  const result: LoginResult = await res.json()
  // 自动存储 token
  setStoredToken(result.access_token)
  return result
}

/** 获取当前用户信息 */
export async function authMe(token: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    handle401(res)
    throw new Error('认证失败')
  }
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
  const result: LoginResult = await res.json()
  setStoredToken(result.access_token)
  return result
}

// === Admin Clock API（自动使用存储的 JWT） ===

async function fetchJSONWithToken<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    handle401(res)
    throw new Error(`API ${path}: ${res.status} ${res.statusText}`)
  }
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
  if (!res.ok) {
    handle401(res)
    throw new Error(`API ${path}: ${res.status} ${res.statusText}`)
  }
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

// === V1 新 API (V2.5) ===

/** V1: 估值总览 */
export async function fetchV1ValuationOverview() {
  return fetchV1<IndexValuation[]>('/valuation/overview')
}

/** V1: PE 历史 */
export async function fetchV1PEHistory(symbol: string, months = 120) {
  return fetchV1<PEHistoryPoint[]>(`/valuation/pe-history?symbol=${encodeURIComponent(symbol)}&months=${months}`)
}

/** V1: 定投计划列表 */
export async function fetchV1DCAPlans() {
  return fetchV1<DCAPlan[]>('/dca/plans')
}

/** V1: 创建定投计划 */
export async function createV1DCAPlan(body: {
  name: string
  symbol: string
  strategy?: string
  amount: number
  frequency?: string
  start_date?: string
  pe_low?: number | null
  pe_high?: number | null
}) {
  const res = await fetch(`${API_V1_BASE}/dca/plans`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    handle401(res)
    throw new Error(`创建定投计划失败: ${res.status}`)
  }
  return res.json()
}

/** V1: 修改定投计划 */
export async function updateV1DCAPlan(planId: number, body: Record<string, unknown>) {
  const res = await fetch(`${API_V1_BASE}/dca/plans/${planId}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    handle401(res)
    throw new Error(`修改定投计划失败: ${res.status}`)
  }
  return res.json()
}

/** V1: 删除定投计划 */
export async function deleteV1DCAPlan(planId: number) {
  const res = await fetch(`${API_V1_BASE}/dca/plans/${planId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    handle401(res)
    throw new Error(`删除定投计划失败: ${res.status}`)
  }
  return res.json()
}

/** V1: 添加定投记录 */
export async function addV1DCARecord(body: {
  plan_id: number
  date?: string
  amount: number
  price: number
  shares: number
  pe_at_buy?: number | null
  pe_percentile?: number | null
}) {
  const res = await fetch(`${API_V1_BASE}/dca/records`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    handle401(res)
    throw new Error(`添加定投记录失败: ${res.status}`)
  }
  return res.json()
}

/** V1: 定投历史 */
export async function fetchV1DCAHistory(planId?: number) {
  const query = planId ? `?plan_id=${planId}` : ''
  return fetchV1<DCARecord[]>(`/dca/history${query}`)
}

/** V1: 定投收益分析 */
export async function fetchV1DCAAnalysis(planId: number) {
  return fetchV1<DCAAnalysis>(`/dca/analysis?plan_id=${planId}`)
}

/** V1: 技术信号 */
export async function fetchV1TechnicalSignal(symbol: string) {
  return fetchV1<TechnicalAnalysis>(`/signal/technical?symbol=${encodeURIComponent(symbol)}`)
}

// Re-export for convenience
export { fetchV1, fetchV1OrNull, postJSON, API_BASE, API_V1_BASE }
