/** Layout — 通用页面布局
 *
 * 结构:
 *   ┌─────────────────────────────┐
 *   │         TopBar              │
 *   ├──────┬──────────────────────┤
 *   │ Side │     <Outlet />       │
 *   │ Nav  │   (page content)     │
 *   │      │                      │
 *   ├──────┴──────────────────────┤
 *   │   MobileTabBar (mobile)     │
 *   └─────────────────────────────┘
 */

import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { SideNav, MobileTabBar } from './SideNav'
import ErrorBoundary from './ErrorBoundary'
import PageSkeleton from './PageSkeleton'
import TopBar from './TopBar'

export default function Layout() {
  return (
    <div className="page-shell flex min-h-screen flex-col">
      <TopBar />

      <div className="flex flex-1">
        <SideNav />

        <main className="flex-1 min-w-0 pb-20 lg:pb-0">
          <ErrorBoundary>
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      <MobileTabBar />
    </div>
  )
}
