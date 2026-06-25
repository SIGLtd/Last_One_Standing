import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { LandingSplash } from './components/LandingSplash'
import { AdminPage } from './pages/AdminPage'
import { CurrentPicksPage } from './pages/CurrentPicksPage'
import { DashboardPage } from './pages/DashboardPage'
import { HistoryPage } from './pages/HistoryPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { PickPage } from './pages/PickPage'
import { RulesPage } from './pages/RulesPage'
import { SignupPage } from './pages/SignupPage'

export default function App() {
  return (
    <LandingSplash>
      <AppShell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/pick" element={<PickPage />} />
          <Route path="/current-picks" element={<CurrentPicksPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </LandingSplash>
  )
}
