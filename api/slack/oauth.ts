import type { VercelRequest, VercelResponse } from '@vercel/node';

// Slack credentials from environment variables
const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID || '';
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET || '';
const APP_URL = process.env.APP_URL || 'https://nandakishore-goal-tracker.vercel.app';

// Firebase Admin setup for Firestore
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (getApps().length === 0) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const { code, state } = req.query;

  if (!code || !state) {
    console.error('Missing code or state parameter');
    return res.redirect(`${APP_URL}/settings?slack=error&message=missing_params`);
  }

  try {
    // Parse state to get userId (state format: userId:randomString)
    const [userId] = (state as string).split(':');

    if (!userId) {
      throw new Error('Invalid state parameter - missing userId');
    }

    if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET) {
      throw new Error('Slack credentials not configured');
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
        code: code as string,
      }),
    });

    const result = await tokenResponse.json();

    // For user tokens, the access_token is in authed_user object
    const userAccessToken = result.authed_user?.access_token;
    const userSlackId = result.authed_user?.id;

    if (!result.ok || !userAccessToken) {
      throw new Error(`Slack OAuth failed: ${result.error || 'Unknown error - no user token received'}`);
    }

    // Store the USER token in Firestore (not bot token)
    const tokenData = {
      accessToken: userAccessToken,  // User's token for searching their mentions
      tokenType: result.authed_user?.token_type || 'user',
      teamId: result.team?.id || '',
      teamName: result.team?.name || '',
      slackUserId: userSlackId,  // The user's Slack ID - needed to search for @mentions
      scope: result.authed_user?.scope || '',
      isConnected: true,
      connectedAt: new Date(),
      lastSyncAt: null,  // Will be set when first sync runs
    };

    // Save to user's integrations document
    await db.collection('users').doc(userId).set({
      integrations: {
        slack: tokenData
      },
      updatedAt: new Date(),
    }, { merge: true });

    console.log(`Slack connected successfully for user: ${userId}`);

    // Redirect back to the app with success
    return res.redirect(`${APP_URL}/settings?slack=success`);

  } catch (error) {
    console.error('Slack OAuth error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.redirect(`${APP_URL}/settings?slack=error&message=${encodeURIComponent(errorMessage)}`);
  }
}
