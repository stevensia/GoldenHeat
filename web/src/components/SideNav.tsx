/** SideNav — 侧边栏导航 (桌面) + 底部 tab bar (移动端)
 *
 * 页面路由:
 *   /            → 首页
 *   /valuation   → 估值
 *   /dca         → 定投
 *   /warrior     → 战士
 *   /admin/clock → 管理 (需登录)
 */

import { NavLink } from 'react-router-dom'

export interface NavItem {
  to: string
  label: string
  icon: string
  requireAuth?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: '首页', icon: '📊' },
  { to: '/valuation', label: '估值', icon: '📈' },
  { to: '/dca', label: '定投', icon: '💰' },
  { to: '/warrior', label: '战士', icon: '⚔️' },
  { to: '/admin/clock', label: '管理', icon: '⚙️', requireAuth: true },
]

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
    isActive
      ? 'bg-[#eab308]/10 text-[#eab308] shadow-[inset_0_0_0_1px_rgba(234,179,8,0.2)]'
      : 'text-[#777] hover:text-[#ccc] hover:bg-white/[0.04]'
  }`
}

/** Desktop sidebar */
export function SideNav() {
  return (
    <aside className="hidden lg:flex w-[200px] shrink-0 flex-col gap-1.5 pt-4 pl-2">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={navLinkClass}
        >
          <span className="text-base">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </aside>
  )
}

/** Mobile bottom tab bar */
export function MobileTabBar() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex lg:hidden"
      style={{
        background: 'rgba(10,10,20,0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
              isActive ? 'text-[#eab308]' : 'text-[#555]'
            }`
          }
        >
          <span className="text-lg">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
