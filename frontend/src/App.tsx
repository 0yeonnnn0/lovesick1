import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Toaster } from './components/ui/sonner'
import Nav from './components/Nav'
import Dashboard from './pages/Dashboard'
import Logs from './pages/Logs'
import Settings from './pages/Settings'
import Login from './pages/Login'

function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/status')
      .then(res => {
        if (res.status === 401) setAuthed(false)
        else { setAuthed(true); return res.json() }
      })
      .catch(() => setAuthed(false))
  }, [])

  if (authed === null) return null
  if (!authed) return <Navigate to="/admin/login" replace />

  return (
    <>
      <Nav />
      <main>{children}</main>
    </>
  )
}

function App() {
  useLocation()

  return (
    <>
      <Routes>
        {/* Admin login */}
        <Route path="/admin/login" element={<Login />} />

        {/* Admin pages */}
        <Route path="/admin" element={<AdminLayout><Dashboard /></AdminLayout>} />
        <Route path="/admin/logs" element={<AdminLayout><Logs /></AdminLayout>} />
        <Route path="/admin/settings" element={<AdminLayout><Settings /></AdminLayout>} />

        {/* Redirects */}
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
      <Toaster position="top-right" />
    </>
  )
}

export default App
