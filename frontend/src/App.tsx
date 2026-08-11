import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './layout/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { EventDetailPage } from './pages/EventPages'
import { RiskReviewPage } from './pages/RiskReviewPage'
import { RiskReviewCaseDetailPage } from './pages/RiskReviewCaseDetailPage'
import { JournalPage } from './pages/JournalPage'
import { LoginPage } from './pages/LoginPage'
import { RiskDetailPage, RiskListPage } from './pages/RiskPages'
import { SettingsPage } from './pages/SettingsPage'
import { UploadPage } from './pages/UploadPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="risks" element={<RiskListPage />} />
        <Route path="risks/:riskId" element={<RiskDetailPage />} />
        <Route path="events" element={<RiskReviewPage />} />
        <Route path="events/:eventId" element={<EventDetailPage />} />
        <Route path="risk-reviews/:reviewCaseId" element={<RiskReviewCaseDetailPage />} />
        <Route path="journals" element={<JournalPage />} />
        <Route path="uploads" element={<UploadPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

