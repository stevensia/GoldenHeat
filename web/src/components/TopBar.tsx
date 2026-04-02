/** TopBar — 顶部全局栏
 *
 * 品牌 + 当前页面标题 + 快速操作
 * Navbar 的市场 Tab 已移入 Dashboard 内部（仅首页需要）
 */

import { useLocation, Link } from 'react-router-dom'
import { NAV_ITEMS } from './SideNav'

export default function TopBar() {
  const location = useLocation()

  // 找到当前页面的 label
  const current = NAV_ITEMS.find((item) => {
    if (item.to === '/') return location.pathname === '/'
    return location.pathname.startsWith(item.to)
  })

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: 'rgba(10,10,20,0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3 no-underline">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-[#555] font-medium">
              GoldenHeat
            </div>
            <div className="text-sm font-bold text-[#e0e0e0] tracking-tight">
              宏观位置感面板
            </div>
          </div>
        </Link>

        {/* Current page indicator (mobile) */}
        {current && current.to !== '/' && (
          <div className="flex items-center gap-2 lg:hidden">
            <span>{current.icon}</span>
            <span className="text-sm font-medium text-[#ccc]">{current.label}</span>
          </div>
        )}

        {/* Right side */}
        <div className="flex items-center gap-3">
          <div
            className="hidden rounded-lg px-3 py-1.5 text-[10px] text-[#555] font-medium lg:block"
            style={{ border: '1px solid rgba(255,255,255,0.06)' }}
          >
            月线级别
          </div>
        </div>
      </div>
    </header>
  )
}
