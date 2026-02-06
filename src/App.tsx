import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { TodayPage } from '@/pages/TodayPage'
import { WeekPage } from '@/pages/WeekPage'
import { GoalsPage } from '@/pages/GoalsPage'
import { InboxPage } from '@/pages/InboxPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { LoginPage } from '@/pages/LoginPage'
import { useAuthStore } from '@/stores/authStore'
import { useCategoriesStore } from '@/stores/categoriesStore'
import { useInboxStore } from '@/stores/inboxStore'
import { useTrackingStore } from '@/stores/trackingStore'
import { useTheme } from '@/hooks/useTheme'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isInitialized } = useAuthStore()

  if (!isInitialized || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isInitialized } = useAuthStore()

  if (!isInitialized || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function AppContent() {
  const { user, initialize } = useAuthStore()
  const { subscribe: subscribeCategories, unsubscribeFromCategories } = useCategoriesStore()
  const { subscribe: subscribeInbox, unsubscribeFromInbox } = useInboxStore()
  const { subscribe: subscribeTracking, unsubscribeFromTracking } = useTrackingStore()

  // Initialize theme
  useTheme()

  // Initialize auth listener
  useEffect(() => {
    const unsubscribe = initialize()
    return () => unsubscribe()
  }, [initialize])

  // Subscribe to global stores when user is authenticated
  useEffect(() => {
    if (user) {
      subscribeCategories(user.uid)
      subscribeInbox(user.uid)
      subscribeTracking(user.uid)
    }
    return () => {
      unsubscribeFromCategories()
      unsubscribeFromInbox()
      unsubscribeFromTracking()
    }
  }, [user, subscribeCategories, subscribeInbox, subscribeTracking, unsubscribeFromCategories, unsubscribeFromInbox, unsubscribeFromTracking])

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<TodayPage />} />
        <Route path="week" element={<WeekPage />} />
        <Route path="goals" element={<GoalsPage />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}
