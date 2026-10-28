import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { FilterProvider }       from './context/FilterContext'
import { AuthProvider }         from './context/AuthContext'
import { ThemeProvider }        from './context/ThemeContext'
import { NotificationProvider } from './context/NotificationContext'
import PrivateRoute             from './components/auth/PrivateRoute'
import Layout                   from './components/layout/Layout'
import Login                    from './pages/Login'
import Dashboard                from './pages/Dashboard'
import BuildingComparison       from './pages/BuildingComparison'
import DailyTrends              from './pages/DailyTrends'
import MonthlyTrends            from './pages/MonthlyTrends'
import PeakUsage                from './pages/PeakUsage'
import WastageIndicators        from './pages/WastageIndicators'
import Reports                  from './pages/Reports'
import ErrorBoundary            from './components/common/ErrorBoundary'
import UCCursor                 from './components/common/UCCursor'

export default function App() {
  return (
    <ThemeProvider>
      {/* Custom cursor — rendered outside the router tree so it's always visible */}
      <UCCursor />

      <BrowserRouter>
        {/* AuthProvider must be inside BrowserRouter so it can call useNavigate */}
        <AuthProvider>
          <FilterProvider>
            <NotificationProvider>
              <ErrorBoundary>
                <Routes>

                  {/* ── Public route ──────────────────────────────── */}
                  <Route path="/login" element={<Login />} />

                  {/* ── Protected routes — require JWT ────────────── */}
                  <Route
                    path="/*"
                    element={
                      <PrivateRoute>
                        <Layout>
                          <Routes>
                            <Route path="/"               element={<Dashboard />} />
                            <Route path="/buildings"      element={<BuildingComparison />} />
                            <Route path="/trends/daily"   element={<DailyTrends />} />
                            <Route path="/trends/monthly" element={<MonthlyTrends />} />
                            <Route path="/peaks"          element={<PeakUsage />} />
                            <Route path="/wastage"        element={<WastageIndicators />} />
                            <Route path="/reports"        element={<Reports />} />
                            <Route path="*"               element={<Navigate to="/" replace />} />
                          </Routes>
                        </Layout>
                      </PrivateRoute>
                    }
                  />
                </Routes>
              </ErrorBoundary>
            </NotificationProvider>
          </FilterProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
