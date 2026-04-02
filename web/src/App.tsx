import { useState, useEffect, lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Dashboard from './pages/Dashboard'

const AdminClock = lazy(() => import('./pages/AdminClock'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

/** 简单 hash router — 不引入 react-router 依赖 */
function useHashRoute() {
  const [route, setRoute] = useState(window.location.hash || '#/')

  useEffect(() => {
    const handler = () => setRoute(window.location.hash || '#/')
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  return route
}

function Router() {
  const route = useHashRoute()

  if (route === '#/admin/clock') {
    return (
      <Suspense fallback={
        <div className="page-shell flex items-center justify-center min-h-screen text-[#777] text-sm">
          加载中…
        </div>
      }>
        <AdminClock />
      </Suspense>
    )
  }

  return <Dashboard />
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
    </QueryClientProvider>
  )
}

export default App
