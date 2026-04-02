/* 顶部导航栏
 *
 * - Logo + 品牌名
 * - 市场分类导航（总览/美股/A股/港股/加密）
 * - 登录按钮（预留）
 * - 毛玻璃效果 + sticky
 */

import { useState } from 'react'

export type MarketTab = 'all' | 'us' | 'cn' | 'hk' | 'crypto'

interface Props {
  activeTab: MarketTab
  onTabChange: (tab: MarketTab) => void
}

const TABS: { key: MarketTab; label: string; icon: string }[] = [
  { key: 'all',    label: '总览',   icon: '🌐' },
  { key: 'us',     label: '美股',   icon: '🇺🇸' },
  { key: 'cn',     label: 'A股',    icon: '🇨🇳' },
  { key: 'hk',     label: '港股',   icon: '🇭🇰' },
  { key: 'crypto', label: '加密',   icon: '₿' },
]

export default function Navbar({ activeTab, onTabChange }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.06]"
      style={{
        background: 'rgba(10, 10, 20, 0.82)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      }}>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16">

          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
              style={{
                background: 'linear-gradient(135deg, #00d4ff 0%, #7c3aed 100%)',
                boxShadow: '0 0 20px rgba(0,212,255,0.25)',
              }}>
              🌡️
            </div>
            <div className="flex items-baseline gap-0.5">
              <span className="text-lg font-bold tracking-tight"
                style={{
                  background: 'linear-gradient(90deg, #00d4ff, #7c3aed)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                GoldenHeat
              </span>
              <span className="text-[10px] text-[#555] font-medium ml-1 hidden sm:inline">v1.0</span>
            </div>
          </div>

          {/* Desktop 市场导航 */}
          <div className="hidden md:flex items-center gap-1">
            {TABS.map(tab => {
              const active = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => onTabChange(tab.key)}
                  className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    active
                      ? 'text-white'
                      : 'text-[#888] hover:text-[#ccc] hover:bg-white/[0.04]'
                  }`}
                >
                  {active && (
                    <div className="absolute inset-0 rounded-lg"
                      style={{
                        background: 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(124,58,237,0.12))',
                        border: '1px solid rgba(0,212,255,0.2)',
                      }} />
                  )}
                  <span className="relative flex items-center gap-1.5">
                    <span className="text-xs">{tab.icon}</span>
                    {tab.label}
                  </span>
                </button>
              )
            })}
          </div>

          {/* 右侧区域 */}
          <div className="flex items-center gap-3">
            {/* Login 按钮 */}
            <button
              className="px-4 py-1.5 text-xs font-medium rounded-lg border transition-all duration-200 hover:scale-[1.02]"
              style={{
                borderColor: 'rgba(0,212,255,0.3)',
                color: '#00d4ff',
                background: 'rgba(0,212,255,0.06)',
              }}
              onClick={() => {/* 预留: 跳转登录页 */}}
            >
              Login
            </button>

            {/* Mobile 汉堡菜单 */}
            <button
              className="md:hidden flex flex-col gap-1 p-2"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <span className={`w-5 h-0.5 bg-[#888] transition-all duration-200 ${mobileOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
              <span className={`w-5 h-0.5 bg-[#888] transition-all duration-200 ${mobileOpen ? 'opacity-0' : ''}`} />
              <span className={`w-5 h-0.5 bg-[#888] transition-all duration-200 ${mobileOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile 下拉菜单 */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/[0.06] pb-3"
          style={{ background: 'rgba(10, 10, 20, 0.95)' }}>
          {TABS.map(tab => {
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => { onTabChange(tab.key); setMobileOpen(false) }}
                className={`w-full text-left px-6 py-3 text-sm font-medium transition-colors ${
                  active
                    ? 'text-[#00d4ff] bg-white/[0.04]'
                    : 'text-[#888] hover:text-[#ccc] hover:bg-white/[0.02]'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            )
          })}
        </div>
      )}
    </nav>
  )
}
