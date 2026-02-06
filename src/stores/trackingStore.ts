import { create } from 'zustand'
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { DailyCheckIn } from '@/types'

interface TrackingState {
  checkIns: DailyCheckIn[]
  isLoading: boolean
  error: string | null

  // Subscriptions
  unsubscribe: Unsubscribe | null

  // Actions
  subscribe: (userId: string) => void
  unsubscribeFromTracking: () => void
  addCheckIn: (goalId: string, date: Date, completed: boolean, notes?: string) => Promise<string>
  removeCheckIn: (id: string) => Promise<void>
  toggleCheckIn: (goalId: string, date: Date) => Promise<void>

  // Computed
  getCheckInsForGoal: (goalId: string) => DailyCheckIn[]
  getCheckInForDate: (goalId: string, date: Date) => DailyCheckIn | undefined
  calculateProgress: (goalId: string, targetDays: number, trackingStartDate: Date) => number
  getStreakForGoal: (goalId: string) => number
}

// Store userId for operations
let currentUserId: string | null = null

const normalizeDate = (date: Date): Date => {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  return normalized
}

const convertTimestamps = (id: string, data: Record<string, unknown>): DailyCheckIn => {
  return {
    ...data,
    id,
    date: data.date instanceof Timestamp ? data.date.toDate() : data.date,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
  } as DailyCheckIn
}

export const useTrackingStore = create<TrackingState>((set, get) => ({
  checkIns: [],
  isLoading: true,
  error: null,
  unsubscribe: null,

  subscribe: (userId: string) => {
    currentUserId = userId
    const { unsubscribe: existingUnsubscribe } = get()
    if (existingUnsubscribe) {
      existingUnsubscribe()
    }

    set({ isLoading: true })

    const checkInsRef = collection(db, 'users', userId, 'checkIns')
    const q = query(checkInsRef, orderBy('date', 'desc'))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const checkIns = snapshot.docs.map((docSnap) => convertTimestamps(docSnap.id, docSnap.data()))
        set({ checkIns, isLoading: false, error: null })
      },
      (error) => {
        set({ error: error.message, isLoading: false })
      }
    )

    set({ unsubscribe })
  },

  unsubscribeFromTracking: () => {
    const { unsubscribe } = get()
    if (unsubscribe) {
      unsubscribe()
      set({ unsubscribe: null, checkIns: [] })
    }
    currentUserId = null
  },

  addCheckIn: async (goalId, date, completed, notes) => {
    if (!currentUserId) throw new Error('No user logged in')

    const checkInsRef = collection(db, 'users', currentUserId, 'checkIns')
    const normalizedDate = normalizeDate(date)
    const now = new Date()

    const docRef = await addDoc(checkInsRef, {
      userId: currentUserId,
      goalId,
      date: Timestamp.fromDate(normalizedDate),
      completed,
      notes: notes || null,
      createdAt: Timestamp.fromDate(now),
    })

    return docRef.id
  },

  removeCheckIn: async (id) => {
    if (!currentUserId) throw new Error('No user logged in')

    const checkInRef = doc(db, 'users', currentUserId, 'checkIns', id)
    await deleteDoc(checkInRef)
  },

  toggleCheckIn: async (goalId, date) => {
    if (!currentUserId) throw new Error('No user logged in')

    const existingCheckIn = get().getCheckInForDate(goalId, date)

    if (existingCheckIn) {
      // If exists and completed, remove it
      if (existingCheckIn.completed) {
        await get().removeCheckIn(existingCheckIn.id)
      }
    } else {
      // Create new check-in
      await get().addCheckIn(goalId, date, true)
    }
  },

  getCheckInsForGoal: (goalId) => {
    const { checkIns } = get()
    return checkIns.filter((c) => c.goalId === goalId)
  },

  getCheckInForDate: (goalId, date) => {
    const { checkIns } = get()
    const normalizedDate = normalizeDate(date)
    return checkIns.find((c) => {
      const checkInDate = normalizeDate(c.date)
      return c.goalId === goalId && checkInDate.getTime() === normalizedDate.getTime()
    })
  },

  calculateProgress: (goalId, targetDays, _trackingStartDate) => {
    const checkIns = get().getCheckInsForGoal(goalId)
    const completedDays = checkIns.filter((c) => c.completed).length

    // Calculate progress as percentage of target days
    const progress = Math.min(100, Math.round((completedDays / targetDays) * 100))
    return progress
  },

  getStreakForGoal: (goalId) => {
    const checkIns = get()
      .getCheckInsForGoal(goalId)
      .filter((c) => c.completed)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    if (checkIns.length === 0) return 0

    let streak = 0
    const today = normalizeDate(new Date())
    let currentDate = new Date(today)

    for (const checkIn of checkIns) {
      const checkInDate = normalizeDate(checkIn.date)

      // Check if this check-in is for the current date we're checking
      if (checkInDate.getTime() === currentDate.getTime()) {
        streak++
        currentDate.setDate(currentDate.getDate() - 1)
      } else if (checkInDate.getTime() < currentDate.getTime()) {
        // Gap in the streak
        break
      }
    }

    return streak
  },
}))
