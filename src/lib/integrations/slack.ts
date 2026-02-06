import { doc, updateDoc, getDoc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { SlackMessage } from '@/types'

// Slack API endpoints
const SLACK_API_BASE = 'https://slack.com/api'

// Slack OAuth configuration
const SLACK_CLIENT_ID = import.meta.env.VITE_SLACK_CLIENT_ID || ''

// Cloud Function URL for OAuth callback
const SLACK_OAUTH_CALLBACK_URL = `https://us-central1-nandakishore-goal-tracker.cloudfunctions.net/slackOAuthCallback`

// Required Slack scopes for bot
const SLACK_SCOPES = [
  'channels:history',
  'channels:read',
  'groups:history',
  'groups:read',
  'im:history',
  'im:read',
  'mpim:history',
  'mpim:read',
  'users:read',
  'reactions:read',
  'app_mentions:read',
].join(',')

interface SlackIntegration {
  accessToken?: string
  teamId: string
  teamName: string
  botUserId?: string
  authedUserId?: string
  isConnected: boolean
  connectedAt?: Date
  lastSyncAt?: Date
}

/**
 * Get Slack OAuth URL for user authorization
 */
export function getSlackAuthUrl(userId: string): string {
  // Include userId in state for the callback to know which user to associate
  const state = `${userId}:${Math.random().toString(36).substring(7)}`
  sessionStorage.setItem('slack_oauth_state', state)

  const params = new URLSearchParams({
    client_id: SLACK_CLIENT_ID,
    scope: SLACK_SCOPES,
    redirect_uri: SLACK_OAUTH_CALLBACK_URL,
    state,
  })

  return `https://slack.com/oauth/v2/authorize?${params}`
}

/**
 * Connect Slack account (opens OAuth flow)
 */
export function initiateSlackConnection(userId: string): void {
  if (!SLACK_CLIENT_ID) {
    alert('Slack Client ID not configured. Please set VITE_SLACK_CLIENT_ID in your .env file.')
    return
  }

  if (!userId) {
    alert('Please sign in before connecting Slack.')
    return
  }

  // Open OAuth flow in the same window (will redirect back after auth)
  const authUrl = getSlackAuthUrl(userId)
  window.location.href = authUrl
}

/**
 * Get Slack integration status from Firestore
 */
export async function getSlackIntegration(userId: string): Promise<SlackIntegration | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId))
    const data = userDoc.data()
    return data?.integrations?.slack || null
  } catch (error) {
    console.error('Failed to get Slack integration:', error)
    return null
  }
}

/**
 * Subscribe to Slack integration status changes
 */
export function subscribeToSlackStatus(
  userId: string,
  callback: (integration: SlackIntegration | null) => void
): () => void {
  const unsubscribe = onSnapshot(
    doc(db, 'users', userId),
    (snapshot) => {
      const data = snapshot.data()
      callback(data?.integrations?.slack || null)
    },
    (error) => {
      console.error('Error subscribing to Slack status:', error)
      callback(null)
    }
  )

  return unsubscribe
}

/**
 * Disconnect Slack account
 */
export async function disconnectSlackAccount(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId)

  await updateDoc(userRef, {
    'integrations.slack': {
      isConnected: false,
      accessToken: null,
      connectedAt: null,
      lastSyncAt: null,
    },
    updatedAt: new Date(),
  })
}

/**
 * Fetch messages from Slack channels
 * Note: Requires valid access token stored in Firestore
 */
export async function fetchSlackMessages(
  userId: string,
  channelId: string,
  limit: number = 20
): Promise<SlackMessage[]> {
  const integration = await getSlackIntegration(userId)

  if (!integration?.accessToken) {
    throw new Error('Not connected to Slack. Please connect your account.')
  }

  try {
    const response = await fetch(
      `${SLACK_API_BASE}/conversations.history?channel=${channelId}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${integration.accessToken}`,
        },
      }
    )

    const data = await response.json()

    if (!data.ok) {
      throw new Error(data.error || 'Failed to fetch Slack messages')
    }

    return (data.messages || []).map((msg: Record<string, unknown>) => ({
      id: msg.ts as string,
      channelId,
      channelName: '',
      senderId: msg.user as string,
      senderName: '',
      text: msg.text as string,
      timestamp: new Date(parseFloat(msg.ts as string) * 1000),
      threadId: (msg.thread_ts as string) || null,
      reactions: ((msg.reactions as Array<{ name: string }>) || []).map((r) => r.name),
    }))
  } catch (error) {
    console.error('Failed to fetch Slack messages:', error)
    throw error
  }
}

/**
 * Fetch saved messages (starred items)
 */
export async function fetchSavedMessages(userId: string): Promise<SlackMessage[]> {
  const integration = await getSlackIntegration(userId)

  if (!integration?.accessToken) {
    throw new Error('Not connected to Slack. Please connect your account.')
  }

  try {
    const response = await fetch(`${SLACK_API_BASE}/stars.list?limit=20`, {
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
      },
    })

    const data = await response.json()

    if (!data.ok) {
      throw new Error(data.error || 'Failed to fetch saved messages')
    }

    return (data.items || [])
      .filter((item: Record<string, unknown>) => item.type === 'message')
      .map((item: Record<string, unknown>) => {
        const message = item.message as Record<string, unknown>
        return {
          id: message.ts as string,
          channelId: item.channel as string,
          channelName: '',
          senderId: message.user as string,
          senderName: '',
          text: message.text as string,
          timestamp: new Date(parseFloat(message.ts as string) * 1000),
          threadId: (message.thread_ts as string) || null,
          reactions: [],
        }
      })
  } catch (error) {
    console.error('Failed to fetch saved messages:', error)
    throw error
  }
}

/**
 * Sync Slack messages to inbox (manual sync of saved messages)
 */
export async function syncSlackToInbox(
  userId: string,
  addToInbox: (item: Record<string, unknown>) => Promise<string>
): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = []
  let synced = 0

  try {
    const messages = await fetchSavedMessages(userId)

    for (const message of messages) {
      try {
        await addToInbox({
          userId,
          source: 'slack',
          status: 'pending',
          title: message.text.substring(0, 100) + (message.text.length > 100 ? '...' : ''),
          description: message.text,
          originalContent: JSON.stringify(message),
          sourceId: message.id,
          sourceUrl: null,
          sourceSender: message.senderName || message.senderId,
          sourceChannel: message.channelName || message.channelId,
          sourceDate: message.timestamp,
          convertedToId: null,
          convertedAt: null,
        })
        synced++
      } catch (error) {
        errors.push(`Failed to sync message: ${message.id}`)
      }
    }

    // Update last sync time
    await updateDoc(doc(db, 'users', userId), {
      'integrations.slack.lastSyncAt': new Date(),
    })
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Failed to sync Slack')
  }

  return { synced, errors }
}

/**
 * Check if Slack is connected (reads from Firestore)
 */
export async function isSlackConnected(userId: string): Promise<boolean> {
  const integration = await getSlackIntegration(userId)
  return integration?.isConnected === true
}
