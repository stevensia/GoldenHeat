/* API Client — fetch wrapper for GoldenHeat backend */

import type { DashboardData } from './types'

// API 基础路径：开发时通过 vite proxy，生产环境同源
const API_BASE = '/api'

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`API ${path}: ${res.status} ${res.statusText}`)
  return res.json()
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
