import { create } from 'zustand'
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { InboxItem, InboxSource, Todo } from '@/types'
import { useTodosStore } from './todosStore'

interface InboxState {
  items: InboxItem[]
  isLoading: boolean
  error: string | null
  selectedSource: InboxSource | 'all'

  // Subscriptions
  unsubscribe: Unsubscribe | null

  // Actions
  subscribe: (userId: string) => void
  unsubscribeFromInbox: () => void
  addItem: (item: Omit<InboxItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>
  dismissItem: (id: string) => Promise<void>
  convertToTodo: (
    id: string,
    todoData: Omit<Todo, 'id' | 'createdAt' | 'updatedAt' | 'source' | 'sourceId'>
  ) => Promise<string>
  bulkDismiss: (ids: string[]) => Promise<void>
  bulkConvert: (
    ids: string[],
    defaultData: Partial<Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>>
  ) => Promise<void>
  setSourceFilter: (source: InboxSource | 'all') => void

  // Computed
  getPendingItems: () => InboxItem[]
  getItemsBySource: (source: InboxSource) => InboxItem[]
  getPendingCount: () => number
  getCountBySource: () => Record<InboxSource, number>
}

const convertTimestamps = (id: string, data: Record<string, unknown>): InboxItem => {
  return {
    ...data,
    id,
    sourceDate: data.sourceDate instanceof Timestamp ? data.sourceDate.toDate() : data.sourceDate,
    convertedAt: data.convertedAt instanceof Timestamp ? data.convertedAt.toDate() : data.convertedAt,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt,
  } as InboxItem
}

export const useInboxStore = create<InboxState>((set, get) => ({
  items: [],
  isLoading: true,
  error: null,
  selectedSource: 'all',
  unsubscribe: null,

  subscribe: (userId: string) => {
    const { unsubscribe: existingUnsubscribe } = get()
    if (existingUnsubscribe) {
      existingUnsubscribe()
    }

    set({ isLoading: true })

    const inboxRef = collection(db, 'users', userId, 'inbox')
    const q = query(
      inboxRef,
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) => convertTimestamps(docSnap.id, docSnap.data()))
        set({ items, isLoading: false, error: null })
      },
      (error) => {
        set({ error: error.message, isLoading: false })
      }
    )

    set({ unsubscribe })
  },

  unsubscribeFromInbox: () => {
    const { unsubscribe } = get()
    if (unsubscribe) {
      unsubscribe()
      set({ unsubscribe: null, items: [] })
    }
  },

  addItem: async (itemData) => {
    const inboxRef = collection(db, 'users', itemData.userId, 'inbox')
    const now = new Date()

    const docRef = await addDoc(inboxRef, {
      ...itemData,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
      sourceDate: itemData.sourceDate ? Timestamp.fromDate(itemData.sourceDate) : null,
      convertedAt: null,
    })

    return docRef.id
  },

  dismissItem: async (id) => {
    const { items } = get()
    const item = items.find((i) => i.id === id)
    if (!item) return

    const itemRef = doc(db, 'users', item.userId, 'inbox', id)
    await updateDoc(itemRef, {
      status: 'dismissed',
      updatedAt: Timestamp.fromDate(new Date()),
    })
  },

  convertToTodo: async (id, todoData) => {
    const { items } = get()
    const item = items.find((i) => i.id === id)
    if (!item) throw new Error('Inbox item not found')

    // Create the todo
    const todoId = await useTodosStore.getState().addTodo({
      ...todoData,
      source: 'inbox',
      sourceId: id,
    })

    // Update the inbox item
    const itemRef = doc(db, 'users', item.userId, 'inbox', id)
    await updateDoc(itemRef, {
      status: 'converted',
      convertedToId: todoId,
      convertedAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date()),
    })

    return todoId
  },

  bulkDismiss: async (ids) => {
    const { items } = get()
    const now = Timestamp.fromDate(new Date())

    await Promise.all(
      ids.map(async (id) => {
        const item = items.find((i) => i.id === id)
        if (!item) return

        const itemRef = doc(db, 'users', item.userId, 'inbox', id)
        await updateDoc(itemRef, {
          status: 'dismissed',
          updatedAt: now,
        })
      })
    )
  },

  bulkConvert: async (ids, defaultData) => {
    const { items, convertToTodo } = get()

    await Promise.all(
      ids.map(async (id) => {
        const item = items.find((i) => i.id === id)
        if (!item) return

        await convertToTodo(id, {
          userId: item.userId,
          categoryId: defaultData.categoryId || 'professional',
          goalId: defaultData.goalId || null,
          title: item.title,
          description: item.description,
          status: 'pending',
          priority: defaultData.priority || 'medium',
          dueDate: defaultData.dueDate || null,
          scheduledDate: defaultData.scheduledDate || null,
          isRecurring: false,
          recurrencePattern: null,
          tags: defaultData.tags || [],
          completedAt: null,
        })
      })
    )
  },

  setSourceFilter: (source) => set({ selectedSource: source }),

  getPendingItems: () => {
    const { items, selectedSource } = get()
    if (selectedSource === 'all') {
      return items.filter((i) => i.status === 'pending')
    }
    return items.filter((i) => i.status === 'pending' && i.source === selectedSource)
  },

  getItemsBySource: (source) => {
    const { items } = get()
    return items.filter((i) => i.source === source && i.status === 'pending')
  },

  getPendingCount: () => {
    const { items } = get()
    return items.filter((i) => i.status === 'pending').length
  },

  getCountBySource: () => {
    const { items } = get()
    const pending = items.filter((i) => i.status === 'pending')
    return {
      slack: pending.filter((i) => i.source === 'slack').length,
      email: pending.filter((i) => i.source === 'email').length,
      calendar: pending.filter((i) => i.source === 'calendar').length,
    }
  },
}))
