import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SaltProvider } from '@salt-ds/core'
import { AppShell } from './components/layout/AppShell'
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SaltProvider mode="light" density="medium">
      <QueryClientProvider client={queryClient}>
        <AppShell />
      </QueryClientProvider>
    </SaltProvider>
  </React.StrictMode>
)
