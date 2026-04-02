/* 顶部导航栏 v2
 *
 * 参考 clock-web: 简洁、渐变标题、紧凑
 * - 毛玻璃 sticky navbar
 * - Logo 渐变
 * - 市场 tab 紧凑 pill 样式
 * - 右侧: 状态灯 + Login
 */

import { useState } from 'react'

export type MarketTab = 'all' | 'us' | 'cn' | 'hk' | 'crypto'

interface Props {
  activeTab: MarketTab
  onTabChange: (tab: MarketTab) => void
}

const TABS: { key: MarketTab; label: string }[] = [
  { key: 'all',    label: '总览' },
  { key: 'us',     label: '美股' },
  { key: 'cn',     label: 'A股' },
  { key: 'hk',     label: '港股' },
  { key: 'crypto', label: '加密' },
]

export default function Navbar({ activeTab, onTabChange }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50"
      style={{
        background: 'linear-gradient(180deg, rgba(10,10,20,0.95) 0%, rgba(10,10,20,0.85) 100%)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
      <div className="max-w-[1200px] mx-auto px-5 sm:px-8">
        <div className="flex items-center justify-between h-12">

          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-lg font-extrabold gradient-text tracking-tight">
              GoldenHeat
            </span>
          </div>

          {/* Desktop 市场 tab — pill group */}
          <div className="hidden md:flex items-center rounded-lg p-0.5"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            {TABS.map(tab => {
              const active = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => onTabChange(tab.key)}
                  className={`px-3.5 py-1 text-[13px] font-medium rounded-md transition-all duration-200 ${
                    active
                      ? 'text-white shadow-sm'
                      : 'text-[#666] hover:text-[#aaa]'
                  }`}
                  style={active ? {
                    background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(124,58,237,0.15))',
                    boxShadow: '0 0 12px rgba(0,212,255,0.1)',
                  } : undefined}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Right: Login + Hamburger */}
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1 text-[11px] font-medium rounded-md border transition-all duration-200 hover:bg-white/[0.04]"
              style={{
                borderColor: 'rgba(255,255,255,0.1)',
                color: '#888',
              }}
            >
              Login
            </button>

            {/* Mobile hamburger */}
            <button
              className="md:hidden flex flex-col gap-[3px] p-1.5"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <span className={`w-4 h-[1.5px] bg-[#888] transition-all ${mobileOpen ? 'rotate-45 translate-y-[5px]' : ''}`} />
              <span className={`w-4 h-[1.5px] bg-[#888] transition-all ${mobileOpen ? 'opacity-0' : ''}`} />
              <span className={`w-4 h-[1.5px] bg-[#888] transition-all ${mobileOpen ? '-rotate-45 -translate-y-[5px]' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/[0.04] px-5 pb-2"
          style={{ background: 'rgba(10, 10, 20, 0.98)' }}>
          <div className="flex gap-1 py-2">
            {TABS.map(tab => {
              const active = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => { onTabChange(tab.key); setMobileOpen(false) }}
                  className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${
                    active ? 'text-[#00d4ff] bg-white/[0.05]' : 'text-[#666]'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </nav>
  )
}
