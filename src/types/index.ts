// Goal Categories - Extensible for future additions
export interface GoalCategory {
  id: string
  name: string
  color: string
  icon: string
  isActive: boolean
  order: number
  createdAt: Date
  updatedAt: Date
}

// Goal Types
export type GoalType = 'long-term' | 'mid-term' | 'weekly' | 'daily'

export type GoalStatus = 'not-started' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled'

export type Priority = 'low' | 'medium' | 'high' | 'urgent'

// Progress Tracking Mode for goals
export type ProgressTrackingMode = 'manual' | 'automatic' // manual = user updates %, automatic = calculated from check-ins

// Main Goal Interface
export interface Goal {
  id: string
  userId: string
  categoryId: string // Links to GoalCategory (e.g., 'professional', 'personal')
  type: GoalType
  title: string
  description: string
  status: GoalStatus
  priority: Priority
  progress: number // 0-100

  // Hierarchy - links to parent goal
  parentGoalId: string | null

  // Dates
  startDate: Date | null
  targetDate: Date | null
  completedDate: Date | null

  // Progress Tracking Settings
  trackingMode: ProgressTrackingMode // 'manual' or 'automatic'
  targetDays: number | null // For automatic tracking: e.g., 180 days goal
  trackingStartDate: Date | null // When tracking started

  // Metadata
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

// Daily Check-in for automatic progress tracking
export interface DailyCheckIn {
  id: string
  userId: string
  goalId: string
  date: Date // The date of the check-in (normalized to start of day)
  completed: boolean
  notes: string | null
  createdAt: Date
}

// Todo Item
export type TodoStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled'

export interface Todo {
  id: string
  userId: string
  categoryId: string
  goalId: string | null // Optional link to a goal

  title: string
  description: string
  status: TodoStatus
  priority: Priority

  // Scheduling
  dueDate: Date | null
  scheduledDate: Date | null // The day it should appear in daily view

  // Recurrence (optional)
  isRecurring: boolean
  recurrencePattern: RecurrencePattern | null

  // Source tracking (for items from integrations)
  source: 'manual' | 'inbox' | 'calendar' | 'slack' | 'email'
  sourceId: string | null // ID of the original inbox item if applicable

  // Metadata
  tags: string[]
  createdAt: Date
  updatedAt: Date
  completedAt: Date | null
}

// Recurrence Pattern
export interface RecurrencePattern {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval: number // e.g., every 2 weeks
  daysOfWeek?: number[] // 0-6 for weekly
  dayOfMonth?: number // 1-31 for monthly
  endDate?: Date | null
}

// Inbox Items - Items from integrations that need review
export type InboxSource = 'slack' | 'email' | 'calendar'
export type InboxStatus = 'pending' | 'converted' | 'dismissed'

export interface InboxItem {
  id: string
  userId: string
  source: InboxSource
  status: InboxStatus

  // Content
  title: string
  description: string
  originalContent: string // Raw content from source

  // Source metadata
  sourceId: string // ID in the original system
  sourceUrl: string | null // Link to original item
  sourceSender: string | null // Who sent it (for email/slack)
  sourceChannel: string | null // Channel name (for slack)
  sourceDate: Date // When it was created in the source

  // Conversion tracking
  convertedToId: string | null // ID of the Todo it was converted to
  convertedAt: Date | null

  // Metadata
  createdAt: Date
  updatedAt: Date
}

// User Profile
export interface UserProfile {
  id: string
  email: string
  displayName: string
  photoURL: string | null

  // Settings
  settings: UserSettings

  // Integration tokens (stored securely)
  integrations: {
    google: IntegrationStatus
    slack: IntegrationStatus
  }

  createdAt: Date
  updatedAt: Date
}

export interface IntegrationStatus {
  isConnected: boolean
  connectedAt: Date | null
  lastSyncAt: Date | null
  accounts: string[] // For multi-account support (e.g., multiple Google accounts)
  // Slack-specific fields
  teamId?: string
  teamName?: string
  authedUserId?: string
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system'
  defaultCategory: string
  workingDays: number[] // 0-6, days of the week
  startOfWeek: 0 | 1 // 0 = Sunday, 1 = Monday
  dailyReviewTime: string | null // HH:MM format
  notifications: {
    enabled: boolean
    dailyDigest: boolean
    taskReminders: boolean
  }
}

// Calendar Event (from Google Calendar)
export interface CalendarEvent {
  id: string
  calendarId: string
  title: string
  description: string | null
  startTime: Date
  endTime: Date
  isAllDay: boolean
  location: string | null
  attendees: string[]
  meetingLink: string | null
}

// Slack Message (from Slack integration)
export interface SlackMessage {
  id: string
  channelId: string
  channelName: string
  senderId: string
  senderName: string
  text: string
  timestamp: Date
  threadId: string | null
  reactions: string[]
}

// Email (from Gmail integration)
export interface EmailMessage {
  id: string
  threadId: string
  from: string
  to: string[]
  subject: string
  snippet: string
  receivedAt: Date
  isRead: boolean
  labels: string[]
}

// Dashboard Stats
export interface DashboardStats {
  todayTodos: {
    total: number
    completed: number
    pending: number
  }
  weeklyProgress: {
    goalsCompleted: number
    goalsTotal: number
    todosCompleted: number
    todosTotal: number
  }
  inboxCount: number
  upcomingEvents: number
}

// Filter and Sort Options
export interface GoalFilters {
  categoryId?: string
  type?: GoalType
  status?: GoalStatus[]
  priority?: Priority[]
  search?: string
}

export interface TodoFilters {
  categoryId?: string
  goalId?: string
  status?: TodoStatus[]
  priority?: Priority[]
  dateRange?: {
    start: Date
    end: Date
  }
  search?: string
}

export type SortOption = 'priority' | 'dueDate' | 'createdAt' | 'title'
export type SortDirection = 'asc' | 'desc'
