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

    if (!result.ok || !result.access_token) {
      throw new Error(`Slack OAuth failed: ${result.error || 'Unknown error'}`);
    }

    // Store the token in Firestore
    const tokenData = {
      accessToken: result.access_token,
      tokenType: result.token_type,
      teamId: result.team?.id || '',
      teamName: result.team?.name || '',
      botUserId: result.bot_user_id || '',
      authedUserId: result.authed_user?.id || '',
      scope: result.scope || '',
      isConnected: true,
      connectedAt: new Date(),
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
