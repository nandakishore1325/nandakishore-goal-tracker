import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as crypto from 'crypto';

// Slack credentials from environment variables
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || '';

// Firebase Admin setup for Firestore
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (getApps().length === 0) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  if (serviceAccount.project_id) {
    initializeApp({
      credential: cert(serviceAccount),
    });
  }
}

let db: FirebaseFirestore.Firestore | null = null;
try {
  db = getFirestore();
} catch (e) {
  console.error('Failed to initialize Firestore:', e);
}

/**
 * Verify that the request came from Slack
 */
function verifySlackSignature(req: VercelRequest, body: string): boolean {
  if (!SLACK_SIGNING_SECRET) {
    console.warn('Slack signing secret not configured');
    return true; // Skip verification if not configured
  }

  const timestamp = req.headers['x-slack-request-timestamp'] as string;
  const slackSignature = req.headers['x-slack-signature'] as string;

  if (!timestamp || !slackSignature) {
    return false;
  }

  // Check if timestamp is within 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    return false;
  }

  // Create signature
  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', SLACK_SIGNING_SECRET)
    .update(sigBasestring)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(mySignature),
    Buffer.from(slackSignature)
  );
}

/**
 * Find user by their Slack user ID
 */
async function findUserBySlackId(slackUserId: string): Promise<string | null> {
  if (!db) return null;

  try {
    const usersSnapshot = await db.collection('users')
      .where('integrations.slack.authedUserId', '==', slackUserId)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      return null;
    }

    return usersSnapshot.docs[0].id;
  } catch (error) {
    console.error('Error finding user by Slack ID:', error);
    return null;
  }
}

/**
 * Create an inbox item from a Slack message
 */
async function createInboxItem(
  userId: string,
  message: {
    text: string;
    user: string;
    channel: string;
    ts: string;
    thread_ts?: string;
  }
): Promise<void> {
  if (!db) return;

  const inboxRef = db.collection('users').doc(userId).collection('inbox');

  // Check for duplicate
  const existingItem = await inboxRef
    .where('sourceId', '==', message.ts)
    .limit(1)
    .get();

  if (!existingItem.empty) {
    console.log('Inbox item already exists, skipping');
    return;
  }

  // Create new inbox item
  await inboxRef.add({
    userId,
    source: 'slack',
    status: 'pending',
    title: message.text.substring(0, 100) + (message.text.length > 100 ? '...' : ''),
    description: message.text,
    originalContent: JSON.stringify(message),
    sourceId: message.ts,
    sourceUrl: null,
    sourceSender: message.user,
    sourceChannel: message.channel,
    sourceDate: new Date(parseFloat(message.ts) * 1000),
    convertedToId: null,
    convertedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log(`Created inbox item for user ${userId} from Slack message`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get raw body for signature verification
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  // Verify signature
  if (!verifySlackSignature(req, rawBody)) {
    console.error('Invalid Slack signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  // Handle URL verification challenge
  if (body.type === 'url_verification') {
    console.log('Responding to Slack URL verification challenge');
    return res.status(200).json({ challenge: body.challenge });
  }

  // Handle event callbacks
  if (body.type === 'event_callback') {
    const event = body.event;

    // Handle app_mention event
    if (event.type === 'app_mention') {
      console.log('Received app_mention event:', event);

      // Find the user who connected this Slack workspace
      const userId = await findUserBySlackId(body.authorizations?.[0]?.user_id);

      if (userId) {
        await createInboxItem(userId, {
          text: event.text,
          user: event.user,
          channel: event.channel,
          ts: event.ts,
          thread_ts: event.thread_ts,
        });
      } else {
        console.log('No user found for this Slack workspace');
      }
    }

    // Handle message events (check for user mentions)
    if (event.type === 'message' && !event.subtype) {
      // Check if the message contains a user mention
      // This would require knowing which users to watch for mentions
      // For now, we rely on app_mention events
      console.log('Received message event');
    }
  }

  // Acknowledge receipt immediately
  return res.status(200).json({ ok: true });
}
