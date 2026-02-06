import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, googleProvider, db } from '@/lib/firebase'
import type { UserProfile, UserSettings } from '@/types'

interface AuthState {
  user: User | null
  profile: UserProfile | null
  isLoading: boolean
  isInitialized: boolean
  error: string | null

  // Actions
  initialize: () => () => void
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>
  clearError: () => void
}

const defaultSettings: UserSettings = {
  theme: 'system',
  defaultCategory: 'professional',
  workingDays: [1, 2, 3, 4, 5], // Monday to Friday
  startOfWeek: 1, // Monday
  dailyReviewTime: '09:00',
  notifications: {
    enabled: true,
    dailyDigest: true,
    taskReminders: true,
  },
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      isLoading: true,
      isInitialized: false,
      error: null,

      initialize: () => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            // Fetch or create user profile
            const profileRef = doc(db, 'users', user.uid)
            const profileSnap = await getDoc(profileRef)

            if (profileSnap.exists()) {
              set({
                user,
                profile: profileSnap.data() as UserProfile,
                isLoading: false,
                isInitialized: true,
              })
            } else {
              // Create new profile
              const newProfile: UserProfile = {
                id: user.uid,
                email: user.email || '',
                displayName: user.displayName || '',
                photoURL: user.photoURL,
                settings: defaultSettings,
                integrations: {
                  google: {
                    isConnected: true,
                    connectedAt: new Date(),
                    lastSyncAt: null,
                    accounts: [user.email || ''],
                  },
                  slack: {
                    isConnected: false,
                    connectedAt: null,
                    lastSyncAt: null,
                    accounts: [],
                  },
                },
                createdAt: new Date(),
                updatedAt: new Date(),
              }
              await setDoc(profileRef, newProfile)
              set({
                user,
                profile: newProfile,
                isLoading: false,
                isInitialized: true,
              })
            }
          } else {
            set({
              user: null,
              profile: null,
              isLoading: false,
              isInitialized: true,
            })
          }
        })

        return unsubscribe
      },

      signInWithGoogle: async () => {
        set({ isLoading: true, error: null })
        try {
          await signInWithPopup(auth, googleProvider)
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to sign in',
            isLoading: false,
          })
        }
      },

      signOut: async () => {
        set({ isLoading: true, error: null })
        try {
          await firebaseSignOut(auth)
          set({ user: null, profile: null, isLoading: false })
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to sign out',
            isLoading: false,
          })
        }
      },

      updateProfile: async (updates) => {
        const { user, profile } = get()
        if (!user || !profile) return

        const updatedProfile = {
          ...profile,
          ...updates,
          updatedAt: new Date(),
        }

        await setDoc(doc(db, 'users', user.uid), updatedProfile)
        set({ profile: updatedProfile })
      },

      updateSettings: async (settings) => {
        const { user, profile } = get()
        if (!user || !profile) return

        const updatedProfile = {
          ...profile,
          settings: { ...profile.settings, ...settings },
          updatedAt: new Date(),
        }

        await setDoc(doc(db, 'users', user.uid), updatedProfile)
        set({ profile: updatedProfile })
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: () => ({}), // Don't persist anything, Firebase handles auth state
    }
  )
)
