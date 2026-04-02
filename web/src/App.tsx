import { lazy } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'

// Lazy-loaded pages
const AdminClock = lazy(() => import('./pages/AdminClock'))
const AdminSettings = lazy(() => import('./pages/AdminSettings'))
const ValuationPage = lazy(() => import('./pages/ValuationPage'))
const DCAPage = lazy(() => import('./pages/DCAPage'))
const WarriorPage = lazy(() => import('./pages/WarriorPage'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="valuation" element={<ValuationPage />} />
            <Route path="dca" element={<DCAPage />} />
            <Route path="warrior" element={<WarriorPage />} />
            <Route path="admin/clock" element={<AdminClock />} />
            <Route path="admin/settings" element={<AdminSettings />} />
          </Route>
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  )
}

export default App
