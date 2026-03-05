import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SaltProvider } from '@salt-ds/core'
import { AppShell } from './components/layout/AppShell'
import { useThemeStore } from './store'
import '@salt-ds/theme/index.css'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
})

function ThemedApp() {
  const { theme } = useThemeStore()
  return (
    <SaltProvider mode={theme} density="medium">
      <QueryClientProvider client={queryClient}>
        <AppShell />
      </QueryClientProvider>
    </SaltProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemedApp />
    </BrowserRouter>
  </React.StrictMode>
)
