import type { VercelRequest, VercelResponse } from '@vercel/node';

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
 * Search Slack for messages mentioning a user
 */
async function searchMentions(
  accessToken: string,
  slackUserId: string,
  since?: Date
): Promise<Array<{
  text: string;
  user: string;
  channel: string;
  ts: string;
  permalink: string;
}>> {
  // Build search query - search for @mentions of the user
  // Format: <@U12345> is how Slack encodes user mentions
  let query = `<@${slackUserId}>`;

  // If we have a since date, add time filter
  if (since) {
    const afterDate = since.toISOString().split('T')[0];
    query += ` after:${afterDate}`;
  }

  const params = new URLSearchParams({
    query,
    sort: 'timestamp',
    sort_dir: 'desc',
    count: '50',  // Get up to 50 recent mentions
  });

  const response = await fetch(`https://slack.com/api/search.messages?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const result = await response.json();

  if (!result.ok) {
    console.error('Slack search failed:', result.error);
    throw new Error(`Slack search failed: ${result.error}`);
  }

  // Extract messages from search results
  const messages = result.messages?.matches || [];

  return messages.map((match: any) => ({
    text: match.text || '',
    user: match.user || match.username || 'unknown',
    channel: match.channel?.id || match.channel?.name || 'unknown',
    channelName: match.channel?.name || '',
    ts: match.ts,
    permalink: match.permalink || '',
  }));
}

/**
 * Create inbox item from a Slack mention
 */
async function createInboxItemFromMention(
  userId: string,
  mention: {
    text: string;
    user: string;
    channel: string;
    channelName?: string;
    ts: string;
    permalink: string;
  }
): Promise<boolean> {
  if (!db) return false;

  const inboxRef = db.collection('users').doc(userId).collection('inbox');

  // Check for duplicate using the message timestamp as sourceId
  const existingItem = await inboxRef
    .where('sourceId', '==', mention.ts)
    .limit(1)
    .get();

  if (!existingItem.empty) {
    // Already have this mention
    return false;
  }

  // Create new inbox item
  await inboxRef.add({
    userId,
    source: 'slack',
    status: 'pending',
    title: mention.text.substring(0, 100) + (mention.text.length > 100 ? '...' : ''),
    description: mention.text,
    originalContent: JSON.stringify(mention),
    sourceId: mention.ts,
    sourceUrl: mention.permalink || null,
    sourceSender: mention.user,
    sourceChannel: mention.channelName || mention.channel,
    sourceDate: new Date(parseFloat(mention.ts) * 1000),
    convertedToId: null,
    convertedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return true;
}

/**
 * Sync mentions for a single user
 */
async function syncUserMentions(userId: string, slackData: any): Promise<{ synced: number; error?: string }> {
  const { accessToken, slackUserId, lastSyncAt } = slackData;

  if (!accessToken || !slackUserId) {
    return { synced: 0, error: 'Missing access token or Slack user ID' };
  }

  try {
    // Search for mentions since last sync (or last 24 hours if never synced)
    const since = lastSyncAt?.toDate() || new Date(Date.now() - 24 * 60 * 60 * 1000);

    const mentions = await searchMentions(accessToken, slackUserId, since);

    let synced = 0;
    for (const mention of mentions) {
      const created = await createInboxItemFromMention(userId, mention);
      if (created) synced++;
    }

    // Update last sync time
    if (db) {
      await db.collection('users').doc(userId).update({
        'integrations.slack.lastSyncAt': new Date(),
      });
    }

    return { synced };
  } catch (error) {
    console.error(`Error syncing mentions for user ${userId}:`, error);
    return { synced: 0, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // This endpoint is called by Vercel Cron
  // Verify it's a cron request (Vercel sets this header)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  // In production, verify the request is from Vercel Cron
  // For now, we'll also allow manual triggers for testing
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Check if it's a Vercel cron request
    const isVercelCron = req.headers['x-vercel-cron'] === '1';
    if (!isVercelCron && process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (!db) {
    return res.status(500).json({ error: 'Database not initialized' });
  }

  try {
    // Find all users with connected Slack
    const usersSnapshot = await db.collection('users')
      .where('integrations.slack.isConnected', '==', true)
      .get();

    const results: Array<{ userId: string; synced: number; error?: string }> = [];

    for (const userDoc of usersSnapshot.docs) {
      const slackData = userDoc.data()?.integrations?.slack;
      if (slackData) {
        const result = await syncUserMentions(userDoc.id, slackData);
        results.push({ userId: userDoc.id, ...result });
      }
    }

    const totalSynced = results.reduce((sum, r) => sum + r.synced, 0);

    console.log(`Slack sync complete: ${totalSynced} new mentions across ${results.length} users`);

    return res.status(200).json({
      ok: true,
      usersProcessed: results.length,
      totalMentionsSynced: totalSynced,
      results,
    });
  } catch (error) {
    console.error('Slack sync error:', error);
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
