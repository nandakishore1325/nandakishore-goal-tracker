import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { WebClient } from '@slack/web-api';

const db = admin.firestore();

// Get Slack credentials from Firebase Functions config
const getSlackConfig = () => {
  const config = functions.config();
  return {
    clientId: config.slack?.client_id || process.env.SLACK_CLIENT_ID || '',
    clientSecret: config.slack?.client_secret || process.env.SLACK_CLIENT_SECRET || '',
    signingSecret: config.slack?.signing_secret || process.env.SLACK_SIGNING_SECRET || '',
  };
};

/**
 * Verify Slack request signature
 */
function verifySlackSignature(
  signingSecret: string,
  signature: string,
  timestamp: string,
  body: string
): boolean {
  // Check timestamp to prevent replay attacks (5 minutes window)
  const time = Math.floor(Date.now() / 1000);
  if (Math.abs(time - parseInt(timestamp)) > 300) {
    console.error('Slack request timestamp too old');
    return false;
  }

  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', signingSecret)
    .update(sigBasestring)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(mySignature),
    Buffer.from(signature)
  );
}

/**
 * Find user by Slack user ID
 */
async function findUserBySlackId(slackUserId: string): Promise<string | null> {
  const usersSnapshot = await db.collection('users')
    .where('integrations.slack.authedUserId', '==', slackUserId)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    return null;
  }

  return usersSnapshot.docs[0].id;
}

/**
 * Get user info from Slack
 */
async function getSlackUserInfo(client: WebClient, userId: string): Promise<{ name: string; realName: string }> {
  try {
    const result = await client.users.info({ user: userId });
    if (result.ok && result.user) {
      return {
        name: result.user.name || 'Unknown',
        realName: result.user.real_name || result.user.name || 'Unknown',
      };
    }
  } catch (error) {
    console.error('Error fetching Slack user info:', error);
  }
  return { name: 'Unknown', realName: 'Unknown' };
}

/**
 * Get channel info from Slack
 */
async function getSlackChannelInfo(client: WebClient, channelId: string): Promise<string> {
  try {
    const result = await client.conversations.info({ channel: channelId });
    if (result.ok && result.channel) {
      return (result.channel as { name?: string }).name || channelId;
    }
  } catch (error) {
    console.error('Error fetching Slack channel info:', error);
  }
  return channelId;
}

/**
 * Create inbox item for Slack message
 */
async function createInboxItem(
  userId: string,
  message: {
    text: string;
    senderName: string;
    channelName: string;
    channelId: string;
    timestamp: string;
    teamId: string;
  }
): Promise<void> {
  const inboxItem = {
    userId,
    source: 'slack',
    sourceId: `${message.channelId}-${message.timestamp}`,
    title: message.text.length > 100
      ? message.text.substring(0, 100) + '...'
      : message.text,
    description: message.text,
    status: 'pending',
    sourceChannel: message.channelName,
    sourceSender: message.senderName,
    sourceDate: new Date(parseFloat(message.timestamp) * 1000),
    sourceUrl: `https://slack.com/archives/${message.channelId}/p${message.timestamp.replace('.', '')}`,
    originalContent: JSON.stringify(message),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Check if item already exists (deduplication)
  const existingItems = await db.collection('users').doc(userId).collection('inbox')
    .where('sourceId', '==', inboxItem.sourceId)
    .limit(1)
    .get();

  if (!existingItems.empty) {
    console.log(`Inbox item already exists for message: ${inboxItem.sourceId}`);
    return;
  }

  await db.collection('users').doc(userId).collection('inbox').add(inboxItem);
  console.log(`Created inbox item for user ${userId}: ${inboxItem.title}`);
}

/**
 * Slack webhook handler
 * Receives events from Slack and creates inbox items for mentions
 */
export const slackWebhook = functions.https.onRequest(async (req, res) => {
  // Respond quickly to Slack (they require response within 3 seconds)
  const sendResponse = () => {
    if (!res.headersSent) {
      res.status(200).send('OK');
    }
  };

  try {
    const slackConfig = getSlackConfig();

    // Handle URL verification challenge (required for initial setup)
    if (req.body.type === 'url_verification') {
      console.log('Slack URL verification challenge received');
      res.status(200).send(req.body.challenge);
      return;
    }

    // Verify request signature
    const signature = req.headers['x-slack-signature'] as string;
    const timestamp = req.headers['x-slack-request-timestamp'] as string;
    const rawBody = JSON.stringify(req.body);

    if (slackConfig.signingSecret && signature && timestamp) {
      const isValid = verifySlackSignature(slackConfig.signingSecret, signature, timestamp, rawBody);
      if (!isValid) {
        console.error('Invalid Slack signature');
        res.status(401).send('Invalid signature');
        return;
      }
    } else {
      console.warn('Skipping signature verification (missing config or headers)');
    }

    const event = req.body.event;

    if (!event) {
      console.log('No event in request body');
      sendResponse();
      return;
    }

    console.log(`Received Slack event: ${event.type}`);

    // Handle app_mention events (when someone @mentions the bot)
    if (event.type === 'app_mention') {
      await handleAppMention(event);
      sendResponse();
      return;
    }

    // Handle message events (check for user mentions)
    if (event.type === 'message' && !event.bot_id && event.text) {
      await handleMessage(event);
      sendResponse();
      return;
    }

    sendResponse();

  } catch (error) {
    console.error('Slack webhook error:', error);
    // Still send 200 to prevent Slack from retrying
    sendResponse();
  }
});

/**
 * Handle app_mention event
 */
async function handleAppMention(event: {
  user: string;
  text: string;
  channel: string;
  ts: string;
  team: string;
}): Promise<void> {
  console.log(`App mention from user ${event.user} in channel ${event.channel}`);

  // Find all users connected to this Slack workspace
  const usersSnapshot = await db.collection('users')
    .where('integrations.slack.teamId', '==', event.team)
    .where('integrations.slack.isConnected', '==', true)
    .get();

  if (usersSnapshot.empty) {
    console.log('No connected users found for this workspace');
    return;
  }

  // Get sender info for the first user's token (they all have access)
  const firstUserDoc = usersSnapshot.docs[0];
  const slackData = firstUserDoc.data().integrations?.slack;

  if (!slackData?.accessToken) {
    console.log('No access token found');
    return;
  }

  const client = new WebClient(slackData.accessToken);
  const senderInfo = await getSlackUserInfo(client, event.user);
  const channelName = await getSlackChannelInfo(client, event.channel);

  // Create inbox item for each connected user
  for (const userDoc of usersSnapshot.docs) {
    await createInboxItem(userDoc.id, {
      text: event.text,
      senderName: senderInfo.realName,
      channelName: channelName,
      channelId: event.channel,
      timestamp: event.ts,
      teamId: event.team,
    });
  }
}

/**
 * Handle message event - check if it mentions any connected user
 */
async function handleMessage(event: {
  user: string;
  text: string;
  channel: string;
  ts: string;
  team?: string;
}): Promise<void> {
  // Extract user mentions from message text (format: <@USER_ID>)
  const mentionRegex = /<@([A-Z0-9]+)>/g;
  const mentions = event.text.match(mentionRegex);

  if (!mentions || mentions.length === 0) {
    return; // No mentions in the message
  }

  // Extract user IDs from mentions
  const mentionedUserIds = mentions.map(m => m.replace(/<@|>/g, ''));

  console.log(`Message mentions users: ${mentionedUserIds.join(', ')}`);

  // Find connected users who were mentioned
  for (const slackUserId of mentionedUserIds) {
    const userId = await findUserBySlackId(slackUserId);

    if (!userId) {
      continue; // User not connected to our app
    }

    // Get the user's Slack token to fetch additional info
    const userDoc = await db.collection('users').doc(userId).get();
    const slackData = userDoc.data()?.integrations?.slack;

    if (!slackData?.accessToken) {
      continue;
    }

    const client = new WebClient(slackData.accessToken);
    const senderInfo = await getSlackUserInfo(client, event.user);
    const channelName = await getSlackChannelInfo(client, event.channel);

    await createInboxItem(userId, {
      text: event.text,
      senderName: senderInfo.realName,
      channelName: channelName,
      channelId: event.channel,
      timestamp: event.ts,
      teamId: event.team || slackData.teamId,
    });
  }
}
