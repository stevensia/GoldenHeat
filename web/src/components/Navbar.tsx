import { useState } from 'react'

export type MarketTab = 'all' | 'us' | 'cn' | 'hk' | 'crypto'

interface Props {
  activeTab: MarketTab
  onTabChange: (tab: MarketTab) => void
}

const TABS: { key: MarketTab; label: string; short: string }[] = [
  { key: 'all', label: '总览', short: '总览' },
  { key: 'us', label: '美股', short: '美股' },
  { key: 'cn', label: 'A股', short: 'A股' },
  { key: 'hk', label: '港股', short: '港股' },
  { key: 'crypto', label: '加密', short: '加密' },
]

export default function Navbar({ activeTab, onTabChange }: Props) {
  const [open, setOpen] = useState(false)

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
        <div className="flex items-center gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-[#555] font-medium">GoldenHeat</div>
            <div className="text-sm font-bold text-[#e0e0e0] tracking-tight">宏观位置感面板</div>
          </div>
        </div>

        <nav className="hidden items-center gap-1 lg:flex">
          {TABS.map((tab) => {
            const active = tab.key === activeTab
            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all cursor-pointer ${
                  active
                    ? 'bg-[#eab308] text-[#0a0a14] shadow-[0_0_12px_rgba(234,179,8,0.3)]'
                    : 'text-[#777] hover:text-[#ccc] hover:bg-white/[0.04]'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <div className="rounded-lg px-3 py-1.5 text-[10px] text-[#555] font-medium"
            style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            月线级别
          </div>
        </div>

        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#888] lg:hidden"
          style={{ border: '1px solid rgba(255,255,255,0.06)' }}
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle navigation"
        >
          <span className="flex flex-col gap-1.5">
            <span className={`block h-[1.5px] w-5 bg-current transition ${open ? 'translate-y-[6px] rotate-45' : ''}`} />
            <span className={`block h-[1.5px] w-5 bg-current transition ${open ? 'opacity-0' : ''}`} />
            <span className={`block h-[1.5px] w-5 bg-current transition ${open ? '-translate-y-[6px] -rotate-45' : ''}`} />
          </span>
        </button>
      </div>

      {open ? (
        <div className="px-4 py-3 lg:hidden sm:px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="grid grid-cols-3 gap-2">
            {TABS.map((tab) => {
              const active = tab.key === activeTab
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    onTabChange(tab.key)
                    setOpen(false)
                  }}
                  className={`rounded-lg px-3 py-2.5 text-center text-sm transition-all cursor-pointer ${
                    active
                      ? 'bg-[#eab308] text-[#0a0a14] font-bold'
                      : 'text-[#777] hover:text-[#ccc]'
                  }`}
                  style={!active ? { background: 'rgba(255,255,255,0.03)' } : undefined}
                >
                  {tab.short}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </header>
  )
}
