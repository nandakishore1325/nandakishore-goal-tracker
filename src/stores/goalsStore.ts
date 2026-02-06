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
import type { Goal, GoalType, GoalFilters } from '@/types'

interface GoalsState {
  goals: Goal[]
  isLoading: boolean
  error: string | null
  filters: GoalFilters

  // Subscriptions
  unsubscribe: Unsubscribe | null

  // Actions
  subscribe: (userId: string) => void
  unsubscribeFromGoals: () => void
  addGoal: (goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>
  updateGoal: (id: string, updates: Partial<Goal>) => Promise<void>
  deleteGoal: (id: string) => Promise<void>
  setFilters: (filters: GoalFilters) => void
  clearFilters: () => void

  // Computed
  getGoalsByType: (type: GoalType) => Goal[]
  getGoalsByParent: (parentId: string | null) => Goal[]
  getGoalById: (id: string) => Goal | undefined
  getChildGoals: (goalId: string) => Goal[]
}

const convertTimestamps = (id: string, data: Record<string, unknown>): Goal => {
  return {
    ...data,
    id,
    startDate: data.startDate instanceof Timestamp ? data.startDate.toDate() : data.startDate,
    targetDate: data.targetDate instanceof Timestamp ? data.targetDate.toDate() : data.targetDate,
    completedDate: data.completedDate instanceof Timestamp ? data.completedDate.toDate() : data.completedDate,
    trackingStartDate: data.trackingStartDate instanceof Timestamp ? data.trackingStartDate.toDate() : data.trackingStartDate,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt,
    trackingMode: data.trackingMode || 'manual',
    targetDays: data.targetDays || null,
  } as Goal
}

export const useGoalsStore = create<GoalsState>((set, get) => ({
  goals: [],
  isLoading: true,
  error: null,
  filters: {},
  unsubscribe: null,

  subscribe: (userId: string) => {
    const { unsubscribe: existingUnsubscribe } = get()
    if (existingUnsubscribe) {
      existingUnsubscribe()
    }

    set({ isLoading: true })

    const goalsRef = collection(db, 'users', userId, 'goals')
    const q = query(goalsRef, orderBy('createdAt', 'desc'))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const goals = snapshot.docs.map((docSnap) => convertTimestamps(docSnap.id, docSnap.data()))
        set({ goals, isLoading: false, error: null })
      },
      (error) => {
        set({ error: error.message, isLoading: false })
      }
    )

    set({ unsubscribe })
  },

  unsubscribeFromGoals: () => {
    const { unsubscribe } = get()
    if (unsubscribe) {
      unsubscribe()
      set({ unsubscribe: null, goals: [] })
    }
  },

  addGoal: async (goalData) => {
    const goalsRef = collection(db, 'users', goalData.userId, 'goals')
    const now = new Date()

    const docRef = await addDoc(goalsRef, {
      ...goalData,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
      startDate: goalData.startDate ? Timestamp.fromDate(goalData.startDate) : null,
      targetDate: goalData.targetDate ? Timestamp.fromDate(goalData.targetDate) : null,
      completedDate: goalData.completedDate ? Timestamp.fromDate(goalData.completedDate) : null,
      trackingStartDate: goalData.trackingStartDate ? Timestamp.fromDate(goalData.trackingStartDate) : null,
      trackingMode: goalData.trackingMode || 'manual',
      targetDays: goalData.targetDays || null,
    })

    return docRef.id
  },

  updateGoal: async (id, updates) => {
    const { goals } = get()
    const goal = goals.find((g) => g.id === id)
    if (!goal) return

    const goalRef = doc(db, 'users', goal.userId, 'goals', id)
    const updateData: Record<string, unknown> = {
      ...updates,
      updatedAt: Timestamp.fromDate(new Date()),
    }

    // Convert dates to Timestamps
    if (updates.startDate !== undefined) {
      updateData.startDate = updates.startDate ? Timestamp.fromDate(updates.startDate) : null
    }
    if (updates.targetDate !== undefined) {
      updateData.targetDate = updates.targetDate ? Timestamp.fromDate(updates.targetDate) : null
    }
    if (updates.completedDate !== undefined) {
      updateData.completedDate = updates.completedDate ? Timestamp.fromDate(updates.completedDate) : null
    }
    if (updates.trackingStartDate !== undefined) {
      updateData.trackingStartDate = updates.trackingStartDate ? Timestamp.fromDate(updates.trackingStartDate) : null
    }

    await updateDoc(goalRef, updateData)
  },

  deleteGoal: async (id) => {
    const { goals } = get()
    const goal = goals.find((g) => g.id === id)
    if (!goal) return

    const goalRef = doc(db, 'users', goal.userId, 'goals', id)
    await deleteDoc(goalRef)
  },

  setFilters: (filters) => set({ filters }),
  clearFilters: () => set({ filters: {} }),

  getGoalsByType: (type) => {
    const { goals, filters } = get()
    return goals.filter((g) => {
      if (g.type !== type) return false
      if (filters.categoryId && g.categoryId !== filters.categoryId) return false
      if (filters.status?.length && !filters.status.includes(g.status)) return false
      if (filters.priority?.length && !filters.priority.includes(g.priority)) return false
      if (filters.search) {
        const search = filters.search.toLowerCase()
        return g.title.toLowerCase().includes(search) || g.description.toLowerCase().includes(search)
      }
      return true
    })
  },

  getGoalsByParent: (parentId) => {
    const { goals } = get()
    return goals.filter((g) => g.parentGoalId === parentId)
  },

  getGoalById: (id) => {
    const { goals } = get()
    return goals.find((g) => g.id === id)
  },

  getChildGoals: (goalId) => {
    const { goals } = get()
    return goals.filter((g) => g.parentGoalId === goalId)
  },
}))
