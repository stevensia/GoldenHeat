import { useState } from 'react'

export type MarketTab = 'all' | 'us' | 'cn' | 'hk' | 'crypto'

interface Props {
  activeTab: MarketTab
  onTabChange: (tab: MarketTab) => void
}

const TABS: { key: MarketTab; label: string; short: string }[] = [
  { key: 'all', label: 'Overview', short: '总览' },
  { key: 'us', label: 'US', short: '美股' },
  { key: 'cn', label: 'China', short: 'A股' },
  { key: 'hk', label: 'Hong Kong', short: '港股' },
  { key: 'crypto', label: 'Crypto', short: '加密' },
]

export default function Navbar({ activeTab, onTabChange }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-[rgba(17,24,39,0.08)] bg-[rgba(247,243,236,0.82)] backdrop-blur-xl supports-[backdrop-filter]:bg-[rgba(247,243,236,0.72)]">
      <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">GoldenHeat</div>
            <div className="mt-1 text-lg font-semibold tracking-[-0.04em] text-[var(--ink)]">Market Intelligence Desk</div>
          </div>
        </div>

        <nav className="hidden items-center gap-2 lg:flex">
          {TABS.map((tab) => {
            const active = tab.key === activeTab
            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={`rounded-full px-4 py-2 text-sm transition-all ${
                  active
                    ? 'bg-[var(--ink)] text-[var(--paper)] shadow-[0_10px_24px_rgba(17,24,39,0.16)]'
                    : 'text-[var(--muted-strong)] hover:bg-[rgba(17,24,39,0.06)] hover:text-[var(--ink)]'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <div className="rounded-full border border-[rgba(17,24,39,0.08)] bg-[rgba(255,255,255,0.52)] px-3 py-2 text-xs text-[var(--muted-strong)]">
            Multi-market dashboard
          </div>
        </div>

        <button
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(17,24,39,0.08)] bg-[rgba(255,255,255,0.5)] text-[var(--ink)] lg:hidden"
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
        <div className="border-t border-[rgba(17,24,39,0.08)] px-4 py-3 lg:hidden sm:px-6">
          <div className="grid grid-cols-2 gap-2">
            {TABS.map((tab) => {
              const active = tab.key === activeTab
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    onTabChange(tab.key)
                    setOpen(false)
                  }}
                  className={`rounded-2xl px-4 py-3 text-left text-sm transition-all ${
                    active
                      ? 'bg-[var(--ink)] text-[var(--paper)]'
                      : 'bg-[rgba(255,255,255,0.46)] text-[var(--muted-strong)]'
                  }`}
                >
                  <div className="font-medium">{tab.short}</div>
                  <div className={`mt-1 text-xs ${active ? 'text-[rgba(247,243,236,0.72)]' : 'text-[var(--muted)]'}`}>{tab.label}</div>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </header>
  )
}
