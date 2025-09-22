import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import Home from './screens/Home'
import SetupMatch from './screens/SetupMatch'
import PlanView from './screens/PlanView'
import LiveView from './screens/LiveView'
import Summary from './screens/Summary'
import './styles.css'
import './pwa/register-sw'

const router = createBrowserRouter([
  { path: '/', element: <App />, children: [
    { index: true, element: <Home /> },
    { path: 'setup', element: <SetupMatch /> },
    { path: 'plan/:matchId', element: <PlanView /> },
    { path: 'live/:matchId', element: <LiveView /> },
    { path: 'summary/:matchId', element: <Summary /> },
  ]}
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
