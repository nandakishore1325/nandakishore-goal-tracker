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
import type { GoalCategory } from '@/types'

interface CategoriesState {
  categories: GoalCategory[]
  isLoading: boolean
  error: string | null

  // Subscriptions
  unsubscribe: Unsubscribe | null

  // Actions
  subscribe: (userId: string) => void
  unsubscribeFromCategories: () => void
  initializeDefaultCategories: (userId: string) => Promise<void>
  addCategory: (category: Omit<GoalCategory, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>
  updateCategory: (id: string, updates: Partial<GoalCategory>) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  reorderCategories: (categoryIds: string[]) => Promise<void>

  // Computed
  getActiveCategories: () => GoalCategory[]
  getCategoryById: (id: string) => GoalCategory | undefined
}

const defaultCategories: Omit<GoalCategory, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Professional',
    color: '#3b82f6', // Blue
    icon: 'briefcase',
    isActive: true,
    order: 0,
  },
]

const convertTimestamps = (id: string, data: Record<string, unknown>): GoalCategory => {
  return {
    ...data,
    id,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt,
  } as GoalCategory
}

// Store userId for category operations
let currentUserId: string | null = null

export const useCategoriesStore = create<CategoriesState>((set, get) => ({
  categories: [],
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

    const categoriesRef = collection(db, 'users', userId, 'categories')
    const q = query(categoriesRef, orderBy('order', 'asc'))

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        if (snapshot.empty) {
          // Initialize default categories if none exist
          await get().initializeDefaultCategories(userId)
        } else {
          const categories = snapshot.docs.map((docSnap) => convertTimestamps(docSnap.id, docSnap.data()))
          set({ categories, isLoading: false, error: null })
        }
      },
      (error) => {
        set({ error: error.message, isLoading: false })
      }
    )

    set({ unsubscribe })
  },

  unsubscribeFromCategories: () => {
    const { unsubscribe } = get()
    if (unsubscribe) {
      unsubscribe()
      set({ unsubscribe: null, categories: [] })
    }
    currentUserId = null
  },

  initializeDefaultCategories: async (userId: string) => {
    const categoriesRef = collection(db, 'users', userId, 'categories')
    const now = new Date()

    for (const category of defaultCategories) {
      await addDoc(categoriesRef, {
        ...category,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      })
    }
  },

  addCategory: async (categoryData) => {
    if (!currentUserId) throw new Error('No user logged in')

    const categoriesRef = collection(db, 'users', currentUserId, 'categories')
    const now = new Date()

    const docRef = await addDoc(categoriesRef, {
      ...categoryData,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
    })

    return docRef.id
  },

  updateCategory: async (id, updates) => {
    if (!currentUserId) throw new Error('No user logged in')

    const categoryRef = doc(db, 'users', currentUserId, 'categories', id)
    await updateDoc(categoryRef, {
      ...updates,
      updatedAt: Timestamp.fromDate(new Date()),
    })
  },

  deleteCategory: async (id) => {
    if (!currentUserId) throw new Error('No user logged in')

    const categoryRef = doc(db, 'users', currentUserId, 'categories', id)
    await deleteDoc(categoryRef)
  },

  reorderCategories: async (categoryIds) => {
    if (!currentUserId) throw new Error('No user logged in')

    const now = Timestamp.fromDate(new Date())

    await Promise.all(
      categoryIds.map(async (id, index) => {
        const categoryRef = doc(db, 'users', currentUserId!, 'categories', id)
        await updateDoc(categoryRef, {
          order: index,
          updatedAt: now,
        })
      })
    )
  },

  getActiveCategories: () => {
    const { categories } = get()
    return categories.filter((c) => c.isActive).sort((a, b) => a.order - b.order)
  },

  getCategoryById: (id) => {
    const { categories } = get()
    return categories.find((c) => c.id === id)
  },
}))
