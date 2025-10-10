import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import AppLayout from '@/layouts/AppLayout'

// eksisterende skjerm-imports
import Home from '@/screens/Home'           // hvis du har
import SetupMatch from '@/screens/SetupMatch'
import PlanView from '@/screens/PlanView'
import LiveView from '@/screens/LiveView'
// …

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <AppLayout>
        <SetupMatch />   {/* eller Home hvis du har en egen hjemskjerm */}
      </AppLayout>
    ),
  },
  {
    path: '/plan/:matchId',
    element: (
      <AppLayout>
        <PlanView />
      </AppLayout>
    ),
  },
  {
    path: '/live/:matchId',
    element: (
      <AppLayout>
        <LiveView />
      </AppLayout>
    ),
  },
  // valgfritt:
  { path: '/settings', element: <AppLayout><div className="card">Innstillinger (kommer)</div></AppLayout> },
  // fallback:
  { path: '*', element: <AppLayout><div className="card">Ikke funnet</div></AppLayout> },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
