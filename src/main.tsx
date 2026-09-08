import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource-variable/montserrat'
import './styles/globals.css'
import './styles.css'
import './animations.css'
import './theme.css'
import './globe-topology.css'
import './hospital-building.css'
import './floor-map.css'
import './module-pages.css'
import './typography.css'
import './ui-fixes.css'
import './sidebar.css'
import './mobile.css'
import './interactions.css'
import { App } from './App'
import { AdminAuth } from './components/auth/AdminAuth'
import type { User } from '@supabase/supabase-js'

function AdminWorkspace({ user, onSignOut }: { user: User; onSignOut: () => Promise<void> }) {
  const [queryClient] = useState(() => new QueryClient())
  useEffect(() => () => { queryClient.clear() }, [queryClient])
  return <QueryClientProvider client={queryClient}><App adminEmail={user.email} onSignOut={onSignOut} /></QueryClientProvider>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminAuth>{(user, signOut) => <AdminWorkspace key={user.id} user={user} onSignOut={signOut} />}</AdminAuth>
  </StrictMode>,
)
