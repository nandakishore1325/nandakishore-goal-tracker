import { create } from 'zustand'
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Todo, Priority, TodoFilters, SortOption, SortDirection, RecurrencePattern } from '@/types'

// Helper to calculate next occurrence date
function getNextOccurrenceDate(currentDate: Date, pattern: RecurrencePattern): Date | null {
  const next = new Date(currentDate)

  // Check if we've passed the end date
  if (pattern.endDate && currentDate >= new Date(pattern.endDate)) {
    return null
  }

  switch (pattern.frequency) {
    case 'daily':
      next.setDate(next.getDate() + pattern.interval)
      break
    case 'weekly':
      next.setDate(next.getDate() + 7 * pattern.interval)
      break
    case 'monthly':
      next.setMonth(next.getMonth() + pattern.interval)
      if (pattern.dayOfMonth) {
        next.setDate(pattern.dayOfMonth)
      }
      break
    case 'yearly':
      next.setFullYear(next.getFullYear() + pattern.interval)
      break
  }

  // Check again if next date exceeds end date
  if (pattern.endDate && next > new Date(pattern.endDate)) {
    return null
  }

  return next
}

interface TodosState {
  todos: Todo[]
  isLoading: boolean
  error: string | null
  filters: TodoFilters
  sortBy: SortOption
  sortDirection: SortDirection

  // Subscriptions
  unsubscribe: Unsubscribe | null

  // Actions
  subscribe: (userId: string) => void
  unsubscribeFromTodos: () => void
  addTodo: (todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>
  updateTodo: (id: string, updates: Partial<Todo>) => Promise<void>
  deleteTodo: (id: string) => Promise<void>
  toggleTodoStatus: (id: string) => Promise<void>
  createNextRecurrence: (todo: Todo) => Promise<string | null>
  setFilters: (filters: TodoFilters) => void
  clearFilters: () => void
  setSort: (sortBy: SortOption, direction?: SortDirection) => void

  // Computed
  getTodayTodos: () => Todo[]
  getTodosByGoal: (goalId: string) => Todo[]
  getFilteredTodos: () => Todo[]
  getPendingCount: () => number
  getCompletedTodayCount: () => number
  getRecurringTodos: () => Todo[]
}

const convertTimestamps = (id: string, data: Record<string, unknown>): Todo => {
  return {
    ...data,
    id,
    dueDate: data.dueDate instanceof Timestamp ? data.dueDate.toDate() : data.dueDate,
    scheduledDate: data.scheduledDate instanceof Timestamp ? data.scheduledDate.toDate() : data.scheduledDate,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt,
    completedAt: data.completedAt instanceof Timestamp ? data.completedAt.toDate() : data.completedAt,
  } as Todo
}

const isToday = (date: Date | null): boolean => {
  if (!date) return false
  const today = new Date()
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

const priorityOrder: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export const useTodosStore = create<TodosState>((set, get) => ({
  todos: [],
  isLoading: true,
  error: null,
  filters: {},
  sortBy: 'priority',
  sortDirection: 'asc',
  unsubscribe: null,

  subscribe: (userId: string) => {
    const { unsubscribe: existingUnsubscribe } = get()
    if (existingUnsubscribe) {
      existingUnsubscribe()
    }

    set({ isLoading: true })

    const todosRef = collection(db, 'users', userId, 'todos')
    const q = query(todosRef, orderBy('createdAt', 'desc'))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const todos = snapshot.docs.map((docSnap) => convertTimestamps(docSnap.id, docSnap.data()))
        set({ todos, isLoading: false, error: null })
      },
      (error) => {
        set({ error: error.message, isLoading: false })
      }
    )

    set({ unsubscribe })
  },

  unsubscribeFromTodos: () => {
    const { unsubscribe } = get()
    if (unsubscribe) {
      unsubscribe()
      set({ unsubscribe: null, todos: [] })
    }
  },

  addTodo: async (todoData) => {
    const todosRef = collection(db, 'users', todoData.userId, 'todos')
    const now = new Date()

    const docRef = await addDoc(todosRef, {
      ...todoData,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
      dueDate: todoData.dueDate ? Timestamp.fromDate(todoData.dueDate) : null,
      scheduledDate: todoData.scheduledDate ? Timestamp.fromDate(todoData.scheduledDate) : null,
      completedAt: null,
    })

    return docRef.id
  },

  updateTodo: async (id, updates) => {
    const { todos } = get()
    const todo = todos.find((t) => t.id === id)
    if (!todo) return

    const todoRef = doc(db, 'users', todo.userId, 'todos', id)
    const updateData: Record<string, unknown> = {
      ...updates,
      updatedAt: Timestamp.fromDate(new Date()),
    }

    // Convert dates to Timestamps
    if (updates.dueDate !== undefined) {
      updateData.dueDate = updates.dueDate ? Timestamp.fromDate(updates.dueDate) : null
    }
    if (updates.scheduledDate !== undefined) {
      updateData.scheduledDate = updates.scheduledDate ? Timestamp.fromDate(updates.scheduledDate) : null
    }
    if (updates.completedAt !== undefined) {
      updateData.completedAt = updates.completedAt ? Timestamp.fromDate(updates.completedAt) : null
    }

    await updateDoc(todoRef, updateData)
  },

  deleteTodo: async (id) => {
    const { todos } = get()
    const todo = todos.find((t) => t.id === id)
    if (!todo) return

    const todoRef = doc(db, 'users', todo.userId, 'todos', id)
    await deleteDoc(todoRef)
  },

  toggleTodoStatus: async (id) => {
    const { todos, updateTodo, createNextRecurrence } = get()
    const todo = todos.find((t) => t.id === id)
    if (!todo) return

    if (todo.status === 'completed') {
      await updateTodo(id, { status: 'pending', completedAt: null })
    } else {
      await updateTodo(id, { status: 'completed', completedAt: new Date() })

      // If recurring, create next instance
      if (todo.isRecurring && todo.recurrencePattern) {
        await createNextRecurrence(todo)
      }
    }
  },

  createNextRecurrence: async (todo) => {
    if (!todo.isRecurring || !todo.recurrencePattern) return null

    const baseDate = todo.scheduledDate || todo.dueDate || new Date()
    const nextDate = getNextOccurrenceDate(baseDate, todo.recurrencePattern)

    if (!nextDate) return null // End date reached

    const todosRef = collection(db, 'users', todo.userId, 'todos')
    const now = new Date()

    const newTodo = {
      userId: todo.userId,
      categoryId: todo.categoryId,
      goalId: todo.goalId,
      title: todo.title,
      description: todo.description,
      status: 'pending',
      priority: todo.priority,
      dueDate: todo.dueDate ? Timestamp.fromDate(nextDate) : null,
      scheduledDate: todo.scheduledDate ? Timestamp.fromDate(nextDate) : null,
      isRecurring: true,
      recurrencePattern: todo.recurrencePattern,
      source: todo.source,
      sourceId: todo.sourceId,
      tags: todo.tags,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
      completedAt: null,
    }

    const docRef = await addDoc(todosRef, newTodo)
    return docRef.id
  },

  setFilters: (filters) => set({ filters }),
  clearFilters: () => set({ filters: {} }),
  setSort: (sortBy, direction) =>
    set((state) => ({
      sortBy,
      sortDirection: direction ?? state.sortDirection,
    })),

  getTodayTodos: () => {
    const { todos, sortBy, sortDirection } = get()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    return todos
      .filter((t) => {
        // Include if scheduled for today, due today, or no date but pending
        const scheduledToday = t.scheduledDate && isToday(t.scheduledDate)
        const dueToday = t.dueDate && isToday(t.dueDate)
        const noDatePending = !t.scheduledDate && !t.dueDate && t.status === 'pending'
        return scheduledToday || dueToday || noDatePending
      })
      .sort((a, b) => {
        // Completed items go to the bottom
        if (a.status === 'completed' && b.status !== 'completed') return 1
        if (a.status !== 'completed' && b.status === 'completed') return -1

        let comparison = 0
        switch (sortBy) {
          case 'priority':
            comparison = priorityOrder[a.priority] - priorityOrder[b.priority]
            break
          case 'dueDate':
            comparison = (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity)
            break
          case 'createdAt':
            comparison = a.createdAt.getTime() - b.createdAt.getTime()
            break
          case 'title':
            comparison = a.title.localeCompare(b.title)
            break
        }
        return sortDirection === 'asc' ? comparison : -comparison
      })
  },

  getTodosByGoal: (goalId) => {
    const { todos } = get()
    return todos.filter((t) => t.goalId === goalId)
  },

  getFilteredTodos: () => {
    const { todos, filters, sortBy, sortDirection } = get()

    return todos
      .filter((t) => {
        if (filters.categoryId && t.categoryId !== filters.categoryId) return false
        if (filters.goalId && t.goalId !== filters.goalId) return false
        if (filters.status?.length && !filters.status.includes(t.status)) return false
        if (filters.priority?.length && !filters.priority.includes(t.priority)) return false
        if (filters.dateRange) {
          const date = t.dueDate || t.scheduledDate
          if (!date) return false
          if (date < filters.dateRange.start || date > filters.dateRange.end) return false
        }
        if (filters.search) {
          const search = filters.search.toLowerCase()
          return t.title.toLowerCase().includes(search) || t.description.toLowerCase().includes(search)
        }
        return true
      })
      .sort((a, b) => {
        let comparison = 0
        switch (sortBy) {
          case 'priority':
            comparison = priorityOrder[a.priority] - priorityOrder[b.priority]
            break
          case 'dueDate':
            comparison = (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity)
            break
          case 'createdAt':
            comparison = a.createdAt.getTime() - b.createdAt.getTime()
            break
          case 'title':
            comparison = a.title.localeCompare(b.title)
            break
        }
        return sortDirection === 'asc' ? comparison : -comparison
      })
  },

  getPendingCount: () => {
    const { todos } = get()
    return todos.filter((t) => t.status === 'pending').length
  },

  getCompletedTodayCount: () => {
    const { todos } = get()
    return todos.filter((t) => t.status === 'completed' && t.completedAt && isToday(t.completedAt)).length
  },

  getRecurringTodos: () => {
    const { todos } = get()
    return todos.filter((t) => t.isRecurring)
  },
}))
