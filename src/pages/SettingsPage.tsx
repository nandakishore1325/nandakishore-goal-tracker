import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  User,
  Bell,
  Palette,
  Link,
  MessageSquare,
  Calendar,
  ChevronRight,
  LogOut,
  Check,
  RefreshCw,
  Mail,
  AlertCircle,
  Sun,
  Moon,
  Monitor,
  Download,
  FileJson,
  FileSpreadsheet,
  Plus,
  Edit2,
  Trash2,
  Briefcase,
  BookOpen,
  Heart,
  Dumbbell,
  Home,
  DollarSign,
  Target,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useInboxStore } from '@/stores/inboxStore'
import { useGoalsStore } from '@/stores/goalsStore'
import { useTodosStore } from '@/stores/todosStore'
import { useCategoriesStore } from '@/stores/categoriesStore'
import { useTrackingStore } from '@/stores/trackingStore'
import { useTheme } from '@/hooks/useTheme'
import { CategoryDialog } from '@/components/settings/CategoryDialog'
import {
  connectGoogleAccount,
  disconnectGoogleAccount,
  syncCalendarToInbox,
  syncGmailToInbox,
} from '@/lib/integrations/google'
import {
  initiateSlackConnection,
  disconnectSlackAccount,
} from '@/lib/integrations/slack'
import {
  exportToJSON,
  exportGoalsToCSV,
  exportTodosToCSV,
  exportCheckInsToCSV,
  downloadFile,
} from '@/lib/dataExport'
import type { GoalCategory } from '@/types'

const iconMap: Record<string, React.ElementType> = {
  briefcase: Briefcase,
  user: User,
  'book-open': BookOpen,
  heart: Heart,
  dumbbell: Dumbbell,
  home: Home,
  'dollar-sign': DollarSign,
  target: Target,
}

export function SettingsPage() {
  const { profile, user, signOut } = useAuthStore()
  const { addItem } = useInboxStore()
  const { goals } = useGoalsStore()
  const { todos } = useTodosStore()
  const { categories, deleteCategory } = useCategoriesStore()
  const { checkIns } = useTrackingStore()
  const { theme, setTheme } = useTheme()

  const [isConnecting, setIsConnecting] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<{ type: string; synced: number; errors: string[] } | null>(null)
  const [showDisconnectDialog, setShowDisconnectDialog] = useState<string | null>(null)
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [editingCategory, setEditingCategory] = useState<GoalCategory | null>(null)
  const [showDeleteCategoryDialog, setShowDeleteCategoryDialog] = useState<GoalCategory | null>(null)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const handleConnectGoogle = async () => {
    setIsConnecting('google')
    try {
      const result = await connectGoogleAccount()
      if (!result.success) {
        alert(result.error || 'Failed to connect Google account')
      }
    } catch (error) {
      console.error('Google connection error:', error)
      alert('Failed to connect Google account')
    } finally {
      setIsConnecting(null)
    }
  }

  const handleDisconnectGoogle = async () => {
    if (!user) return
    await disconnectGoogleAccount(user.uid)
    setShowDisconnectDialog(null)
  }

  const handleConnectSlack = () => {
    if (!user) {
      alert('Please sign in before connecting Slack.')
      return
    }
    initiateSlackConnection(user.uid)
  }

  // Handle Slack OAuth callback (check URL params on mount)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const slackStatus = params.get('slack')

    if (slackStatus === 'success') {
      // Clear the URL params
      window.history.replaceState({}, '', window.location.pathname)
      alert('Slack connected successfully! Messages that mention you will now appear in your inbox.')
    } else if (slackStatus === 'error') {
      const message = params.get('message') || 'Unknown error'
      window.history.replaceState({}, '', window.location.pathname)
      alert(`Failed to connect Slack: ${decodeURIComponent(message)}`)
    }
  }, [])

  const handleDisconnectSlack = async () => {
    if (!user) return
    await disconnectSlackAccount(user.uid)
    setShowDisconnectDialog(null)
  }

  const handleSyncCalendar = async () => {
    if (!user) return
    setIsSyncing('calendar')
    try {
      const result = await syncCalendarToInbox(user.uid, addItem)
      setSyncResult({ type: 'Calendar', ...result })
    } catch (error) {
      setSyncResult({
        type: 'Calendar',
        synced: 0,
        errors: [error instanceof Error ? error.message : 'Sync failed'],
      })
    } finally {
      setIsSyncing(null)
    }
  }

  const handleSyncGmail = async () => {
    if (!user) return
    setIsSyncing('gmail')
    try {
      const result = await syncGmailToInbox(user.uid, addItem)
      setSyncResult({ type: 'Gmail', ...result })
    } catch (error) {
      setSyncResult({
        type: 'Gmail',
        synced: 0,
        errors: [error instanceof Error ? error.message : 'Sync failed'],
      })
    } finally {
      setIsSyncing(null)
    }
  }

  const handleExport = async (format: 'json' | 'csv-goals' | 'csv-todos' | 'csv-checkins') => {
    setIsExporting(true)
    try {
      const timestamp = new Date().toISOString().split('T')[0]

      switch (format) {
        case 'json':
          const jsonData = exportToJSON(categories, goals, todos, checkIns)
          downloadFile(jsonData, `goal-tracker-export-${timestamp}.json`, 'application/json')
          break
        case 'csv-goals':
          const goalsCSV = exportGoalsToCSV(goals, categories)
          downloadFile(goalsCSV, `goals-${timestamp}.csv`, 'text/csv')
          break
        case 'csv-todos':
          const todosCSV = exportTodosToCSV(todos, categories, goals)
          downloadFile(todosCSV, `todos-${timestamp}.csv`, 'text/csv')
          break
        case 'csv-checkins':
          const checkInsCSV = exportCheckInsToCSV(checkIns, goals)
          downloadFile(checkInsCSV, `checkins-${timestamp}.csv`, 'text/csv')
          break
      }
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to export data')
    } finally {
      setIsExporting(false)
      setShowExportDialog(false)
    }
  }

  const handleDeleteCategory = async () => {
    if (!showDeleteCategoryDialog) return
    try {
      await deleteCategory(showDeleteCategoryDialog.id)
      setShowDeleteCategoryDialog(null)
    } catch (error) {
      console.error('Failed to delete category:', error)
      alert('Failed to delete category')
    }
  }

  const formatLastSync = (date: Date | null) => {
    if (!date) return 'Never'
    const d = new Date(date)
    return d.toLocaleString()
  }

  const googleConnected = profile?.integrations?.google?.isConnected
  const slackConnected = profile?.integrations?.slack?.isConnected

  return (
    <div className="flex flex-col">
      <Header title="Settings" />

      <div className="flex flex-col gap-4 p-4">
        {/* Profile Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              {profile?.photoURL ? (
                <img
                  src={profile.photoURL}
                  alt={profile.displayName}
                  className="h-16 w-16 rounded-full"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div>
                <h3 className="font-semibold">{profile?.displayName || 'User'}</h3>
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Theme Switcher */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setTheme('light')}
              >
                <Sun className="h-4 w-4 mr-2" />
                Light
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setTheme('dark')}
              >
                <Moon className="h-4 w-4 mr-2" />
                Dark
              </Button>
              <Button
                variant={theme === 'system' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setTheme('system')}
              >
                <Monitor className="h-4 w-4 mr-2" />
                System
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Categories */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Goal Categories</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingCategory(null)
                  setShowCategoryDialog(true)
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
            <CardDescription>
              Manage your goal categories (Professional, Personal, etc.)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {categories.map((category) => {
                const IconComponent = iconMap[category.icon] || Target
                return (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full"
                        style={{ backgroundColor: category.color + '20' }}
                      >
                        <IconComponent className="h-4 w-4" style={{ color: category.color }} />
                      </div>
                      <span className="font-medium">{category.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingCategory(category)
                          setShowCategoryDialog(true)
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setShowDeleteCategoryDialog(category)}
                        disabled={categories.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Integrations */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Link className="h-4 w-4" />
              Integrations
            </CardTitle>
            <CardDescription>
              Connect your accounts to sync items to your inbox
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Google Integration */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">Google</p>
                    <p className="text-xs text-muted-foreground">
                      Calendar & Gmail
                    </p>
                  </div>
                </div>
                {googleConnected ? (
                  <Badge variant="secondary" className="gap-1">
                    <Check className="h-3 w-3" />
                    Connected
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleConnectGoogle}
                    disabled={isConnecting === 'google'}
                  >
                    {isConnecting === 'google' ? 'Connecting...' : 'Connect'}
                  </Button>
                )}
              </div>

              {googleConnected && (
                <>
                  <div className="text-xs text-muted-foreground mb-3">
                    Last sync: {formatLastSync(profile?.integrations?.google?.lastSyncAt as Date | null)}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSyncCalendar}
                      disabled={isSyncing === 'calendar'}
                    >
                      {isSyncing === 'calendar' ? (
                        <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Calendar className="h-4 w-4 mr-1" />
                      )}
                      Sync Calendar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSyncGmail}
                      disabled={isSyncing === 'gmail'}
                    >
                      {isSyncing === 'gmail' ? (
                        <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4 mr-1" />
                      )}
                      Sync Gmail
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setShowDisconnectDialog('google')}
                    >
                      Disconnect
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Slack Integration */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">Slack</p>
                    <p className="text-xs text-muted-foreground">
                      Messages & Saved Items
                    </p>
                  </div>
                </div>
                {slackConnected ? (
                  <Badge variant="secondary" className="gap-1">
                    <Check className="h-3 w-3" />
                    Connected
                  </Badge>
                ) : (
                  <Button size="sm" onClick={handleConnectSlack}>
                    Connect
                  </Button>
                )}
              </div>

              {slackConnected && (
                <>
                  <div className="text-xs text-muted-foreground mb-3">
                    <p>Connected to: {profile?.integrations?.slack?.teamName || 'Slack workspace'}</p>
                    <p className="mt-1">Messages that @mention you will automatically appear in your inbox.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setShowDisconnectDialog('slack')}
                    >
                      Disconnect
                    </Button>
                  </div>
                </>
              )}

              {!slackConnected && (
                <p className="text-xs text-muted-foreground mt-2">
                  Connect Slack to receive @mentions directly in your inbox
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between py-2">
              <span>Push Notifications</span>
              <Badge variant={profile?.settings?.notifications?.enabled ? 'default' : 'secondary'}>
                {profile?.settings?.notifications?.enabled ? 'On' : 'Off'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Data Export */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="h-4 w-4" />
              Data Export
            </CardTitle>
            <CardDescription>
              Export your goals, todos, and tracking data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => setShowExportDialog(true)}>
              Export Data
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        {/* Sign Out */}
        <Button variant="destructive" onClick={signOut} className="w-full">
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>

      {/* Category Dialog */}
      <CategoryDialog
        open={showCategoryDialog}
        onOpenChange={setShowCategoryDialog}
        category={editingCategory}
      />

      {/* Delete Category Confirmation */}
      <Dialog
        open={showDeleteCategoryDialog !== null}
        onOpenChange={() => setShowDeleteCategoryDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{showDeleteCategoryDialog?.name}"? Goals in this
              category will need to be reassigned.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteCategoryDialog(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteCategory}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Data</DialogTitle>
            <DialogDescription>
              Choose an export format for your data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleExport('json')}
              disabled={isExporting}
            >
              <FileJson className="h-4 w-4 mr-2" />
              Export All Data (JSON)
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleExport('csv-goals')}
              disabled={isExporting}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Goals (CSV)
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleExport('csv-todos')}
              disabled={isExporting}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Todos (CSV)
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleExport('csv-checkins')}
              disabled={isExporting}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Check-ins (CSV)
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect Confirmation Dialog */}
      <Dialog
        open={showDisconnectDialog !== null}
        onOpenChange={() => setShowDisconnectDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect {showDisconnectDialog === 'google' ? 'Google' : 'Slack'}</DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect your {showDisconnectDialog === 'google' ? 'Google' : 'Slack'} account?
              You will no longer receive synced items from this integration.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisconnectDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={
                showDisconnectDialog === 'google'
                  ? handleDisconnectGoogle
                  : handleDisconnectSlack
              }
            >
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sync Result Dialog */}
      <Dialog open={syncResult !== null} onOpenChange={() => setSyncResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {syncResult?.errors.length === 0 ? (
                <span className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  Sync Complete
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  Sync Completed with Issues
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm">
              {syncResult?.synced} {syncResult?.type} items synced to your inbox.
            </p>
            {syncResult?.errors && syncResult.errors.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-destructive">Errors:</p>
                <ul className="text-sm text-muted-foreground mt-1 list-disc list-inside">
                  {syncResult.errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setSyncResult(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
