import type { Goal, Todo, GoalCategory, DailyCheckIn } from '@/types'

interface ExportData {
  exportedAt: string
  version: string
  categories: GoalCategory[]
  goals: Goal[]
  todos: Todo[]
  checkIns: DailyCheckIn[]
}

/**
 * Export all user data to JSON format
 */
export function exportToJSON(
  categories: GoalCategory[],
  goals: Goal[],
  todos: Todo[],
  checkIns: DailyCheckIn[]
): string {
  const exportData: ExportData = {
    exportedAt: new Date().toISOString(),
    version: '1.0.0',
    categories,
    goals,
    todos,
    checkIns,
  }

  return JSON.stringify(exportData, null, 2)
}

/**
 * Export goals to CSV format
 */
export function exportGoalsToCSV(goals: Goal[], categories: GoalCategory[]): string {
  const headers = [
    'Title',
    'Description',
    'Type',
    'Category',
    'Status',
    'Priority',
    'Progress',
    'Start Date',
    'Target Date',
    'Completed Date',
    'Tracking Mode',
    'Target Days',
    'Tags',
    'Created At',
  ]

  const getCategoryName = (id: string) => categories.find((c) => c.id === id)?.name || id

  const rows = goals.map((goal) => [
    escapeCSV(goal.title),
    escapeCSV(goal.description),
    goal.type,
    getCategoryName(goal.categoryId),
    goal.status,
    goal.priority,
    goal.progress.toString(),
    goal.startDate ? formatDate(goal.startDate) : '',
    goal.targetDate ? formatDate(goal.targetDate) : '',
    goal.completedDate ? formatDate(goal.completedDate) : '',
    goal.trackingMode || 'manual',
    goal.targetDays?.toString() || '',
    goal.tags.join('; '),
    formatDate(goal.createdAt),
  ])

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
}

/**
 * Export todos to CSV format
 */
export function exportTodosToCSV(todos: Todo[], categories: GoalCategory[], goals: Goal[]): string {
  const headers = [
    'Title',
    'Description',
    'Category',
    'Goal',
    'Status',
    'Priority',
    'Due Date',
    'Scheduled Date',
    'Is Recurring',
    'Recurrence Pattern',
    'Source',
    'Tags',
    'Created At',
    'Completed At',
  ]

  const getCategoryName = (id: string) => categories.find((c) => c.id === id)?.name || id
  const getGoalTitle = (id: string | null) => (id ? goals.find((g) => g.id === id)?.title || id : '')

  const rows = todos.map((todo) => [
    escapeCSV(todo.title),
    escapeCSV(todo.description),
    getCategoryName(todo.categoryId),
    escapeCSV(getGoalTitle(todo.goalId)),
    todo.status,
    todo.priority,
    todo.dueDate ? formatDate(todo.dueDate) : '',
    todo.scheduledDate ? formatDate(todo.scheduledDate) : '',
    todo.isRecurring ? 'Yes' : 'No',
    todo.recurrencePattern ? formatRecurrence(todo.recurrencePattern) : '',
    todo.source,
    todo.tags.join('; '),
    formatDate(todo.createdAt),
    todo.completedAt ? formatDate(todo.completedAt) : '',
  ])

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
}

/**
 * Export check-ins to CSV format
 */
export function exportCheckInsToCSV(checkIns: DailyCheckIn[], goals: Goal[]): string {
  const headers = ['Goal', 'Date', 'Completed', 'Notes', 'Created At']

  const getGoalTitle = (id: string) => goals.find((g) => g.id === id)?.title || id

  const rows = checkIns.map((checkIn) => [
    escapeCSV(getGoalTitle(checkIn.goalId)),
    formatDate(checkIn.date),
    checkIn.completed ? 'Yes' : 'No',
    escapeCSV(checkIn.notes || ''),
    formatDate(checkIn.createdAt),
  ])

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
}

/**
 * Download a file
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Helper functions
function escapeCSV(str: string): string {
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function formatDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date)
  return d.toISOString().split('T')[0]
}

function formatRecurrence(pattern: { frequency: string; interval: number }): string {
  return `Every ${pattern.interval} ${pattern.frequency}`
}
