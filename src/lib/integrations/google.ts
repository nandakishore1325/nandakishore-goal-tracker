import {
  signInWithPopup,
  GoogleAuthProvider,
  getAuth,
} from 'firebase/auth'
import { doc, updateDoc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { CalendarEvent, EmailMessage } from '@/types'

// Google API endpoints
const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3'
const GMAIL_API_BASE = 'https://www.googleapis.com/gmail/v1'

// Scopes for Google APIs
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
]

interface GoogleTokens {
  accessToken: string
  refreshToken?: string
  expiresAt: number
}

// Store tokens in memory (in production, store securely in Firestore)
let cachedTokens: GoogleTokens | null = null

/**
 * Connect Google account with Calendar and Gmail scopes
 */
export async function connectGoogleAccount(): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = getAuth()
    const provider = new GoogleAuthProvider()

    // Add required scopes
    GOOGLE_SCOPES.forEach(scope => provider.addScope(scope))

    // Force account selection
    provider.setCustomParameters({
      prompt: 'consent',
      access_type: 'offline',
    })

    const result = await signInWithPopup(auth, provider)
    const credential = GoogleAuthProvider.credentialFromResult(result)

    if (!credential?.accessToken) {
      return { success: false, error: 'Failed to get access token' }
    }

    // Store tokens
    cachedTokens = {
      accessToken: credential.accessToken,
      expiresAt: Date.now() + 3600 * 1000, // 1 hour
    }

    // Update user profile with integration status
    if (result.user) {
      await updateIntegrationStatus(result.user.uid, 'google', true, result.user.email || undefined)
    }

    return { success: true }
  } catch (error) {
    console.error('Google connection error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect Google account'
    }
  }
}

/**
 * Disconnect Google account
 */
export async function disconnectGoogleAccount(userId: string): Promise<void> {
  cachedTokens = null
  await updateIntegrationStatus(userId, 'google', false)
}

/**
 * Update integration status in Firestore
 */
async function updateIntegrationStatus(
  userId: string,
  integration: 'google' | 'slack',
  isConnected: boolean,
  accountEmail?: string
): Promise<void> {
  const userRef = doc(db, 'users', userId)
  const userSnap = await getDoc(userRef)

  if (userSnap.exists()) {
    await updateDoc(userRef, {
      [`integrations.${integration}`]: {
        isConnected,
        connectedAt: isConnected ? new Date() : null,
        lastSyncAt: null,
        accounts: isConnected && accountEmail ? [accountEmail] : [],
      },
      updatedAt: new Date(),
    })
  }
}

/**
 * Get access token (refresh if needed)
 */
async function getAccessToken(): Promise<string | null> {
  if (cachedTokens && cachedTokens.expiresAt > Date.now()) {
    return cachedTokens.accessToken
  }

  // Token expired or not available - user needs to reconnect
  return null
}

/**
 * Fetch calendar events from Google Calendar
 */
export async function fetchCalendarEvents(
  timeMin?: Date,
  timeMax?: Date,
  maxResults: number = 50
): Promise<CalendarEvent[]> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('Not authenticated with Google. Please reconnect your account.')
  }

  const now = new Date()
  const defaultTimeMin = timeMin || now
  const defaultTimeMax = timeMax || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const params = new URLSearchParams({
    timeMin: defaultTimeMin.toISOString(),
    timeMax: defaultTimeMax.toISOString(),
    maxResults: maxResults.toString(),
    singleEvents: 'true',
    orderBy: 'startTime',
  })

  try {
    const response = await fetch(
      `${CALENDAR_API_BASE}/calendars/primary/events?${params}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      if (response.status === 401) {
        cachedTokens = null
        throw new Error('Google session expired. Please reconnect your account.')
      }
      throw new Error('Failed to fetch calendar events')
    }

    const data = await response.json()

    return (data.items || []).map((event: any) => ({
      id: event.id,
      calendarId: 'primary',
      title: event.summary || 'Untitled Event',
      description: event.description || null,
      startTime: new Date(event.start?.dateTime || event.start?.date),
      endTime: new Date(event.end?.dateTime || event.end?.date),
      isAllDay: !event.start?.dateTime,
      location: event.location || null,
      attendees: (event.attendees || []).map((a: any) => a.email),
      meetingLink: event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri || null,
    }))
  } catch (error) {
    console.error('Failed to fetch calendar events:', error)
    throw error
  }
}

/**
 * Fetch emails from Gmail
 */
export async function fetchEmails(
  query: string = 'is:unread',
  maxResults: number = 20
): Promise<EmailMessage[]> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('Not authenticated with Google. Please reconnect your account.')
  }

  try {
    // First, get message IDs
    const listParams = new URLSearchParams({
      q: query,
      maxResults: maxResults.toString(),
    })

    const listResponse = await fetch(
      `${GMAIL_API_BASE}/users/me/messages?${listParams}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!listResponse.ok) {
      if (listResponse.status === 401) {
        cachedTokens = null
        throw new Error('Google session expired. Please reconnect your account.')
      }
      throw new Error('Failed to fetch emails')
    }

    const listData = await listResponse.json()
    const messageIds = (listData.messages || []).map((m: any) => m.id)

    if (messageIds.length === 0) {
      return []
    }

    // Fetch each message's details
    const emails: EmailMessage[] = []

    for (const messageId of messageIds.slice(0, 10)) { // Limit to 10 for performance
      const msgResponse = await fetch(
        `${GMAIL_API_BASE}/users/me/messages/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (msgResponse.ok) {
        const msgData = await msgResponse.json()
        const headers = msgData.payload?.headers || []

        const getHeader = (name: string) =>
          headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || ''

        emails.push({
          id: msgData.id,
          threadId: msgData.threadId,
          from: getHeader('From'),
          to: getHeader('To').split(',').map((e: string) => e.trim()),
          subject: getHeader('Subject') || '(No Subject)',
          snippet: msgData.snippet || '',
          receivedAt: new Date(parseInt(msgData.internalDate)),
          isRead: !msgData.labelIds?.includes('UNREAD'),
          labels: msgData.labelIds || [],
        })
      }
    }

    return emails
  } catch (error) {
    console.error('Failed to fetch emails:', error)
    throw error
  }
}

/**
 * Sync calendar events to inbox
 */
export async function syncCalendarToInbox(
  userId: string,
  addToInbox: (item: any) => Promise<string>
): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = []
  let synced = 0

  try {
    const events = await fetchCalendarEvents()

    for (const event of events) {
      try {
        await addToInbox({
          userId,
          source: 'calendar',
          status: 'pending',
          title: event.title,
          description: event.description || `${event.isAllDay ? 'All day' : formatTime(event.startTime)} - ${event.location || 'No location'}`,
          originalContent: JSON.stringify(event),
          sourceId: event.id,
          sourceUrl: null,
          sourceSender: null,
          sourceChannel: null,
          sourceDate: event.startTime,
          convertedToId: null,
          convertedAt: null,
        })
        synced++
      } catch (error) {
        errors.push(`Failed to sync event: ${event.title}`)
      }
    }

    // Update last sync time
    await updateDoc(doc(db, 'users', userId), {
      'integrations.google.lastSyncAt': new Date(),
    })
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Failed to sync calendar')
  }

  return { synced, errors }
}

/**
 * Sync emails to inbox
 */
export async function syncGmailToInbox(
  userId: string,
  addToInbox: (item: any) => Promise<string>,
  query: string = 'is:unread is:important'
): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = []
  let synced = 0

  try {
    const emails = await fetchEmails(query)

    for (const email of emails) {
      try {
        await addToInbox({
          userId,
          source: 'email',
          status: 'pending',
          title: email.subject,
          description: email.snippet,
          originalContent: JSON.stringify(email),
          sourceId: email.id,
          sourceUrl: `https://mail.google.com/mail/u/0/#inbox/${email.threadId}`,
          sourceSender: email.from,
          sourceChannel: null,
          sourceDate: email.receivedAt,
          convertedToId: null,
          convertedAt: null,
        })
        synced++
      } catch (error) {
        errors.push(`Failed to sync email: ${email.subject}`)
      }
    }

    // Update last sync time
    await updateDoc(doc(db, 'users', userId), {
      'integrations.google.lastSyncAt': new Date(),
    })
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Failed to sync emails')
  }

  return { synced, errors }
}

// Helper function to format time
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/**
 * Check if Google is connected
 */
export function isGoogleConnected(): boolean {
  return cachedTokens !== null && cachedTokens.expiresAt > Date.now()
}
