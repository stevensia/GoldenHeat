/* API Client — fetch wrapper for GoldenHeat backend */

import type {
  DashboardData,
  ValuationHistoryPoint,
  KlineHistoryPoint,
  MacroDetail,
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
