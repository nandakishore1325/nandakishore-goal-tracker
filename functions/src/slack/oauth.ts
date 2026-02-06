import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
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
 * OAuth callback handler for Slack
 * This function receives the authorization code from Slack and exchanges it for an access token
 */
export const slackOAuthCallback = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  const { code, state } = req.query;

  if (!code || !state) {
    console.error('Missing code or state parameter');
    res.redirect(`${getAppUrl()}/settings?slack=error&message=missing_params`);
    return;
  }

  try {
    // Parse state to get userId (state format: userId:randomString)
    const [userId] = (state as string).split(':');

    if (!userId) {
      throw new Error('Invalid state parameter - missing userId');
    }

    const slackConfig = getSlackConfig();

    if (!slackConfig.clientId || !slackConfig.clientSecret) {
      throw new Error('Slack configuration not set. Run: firebase functions:config:set slack.client_id="..." slack.client_secret="..."');
    }

    // Exchange code for access token
    const client = new WebClient();
    const result = await client.oauth.v2.access({
      client_id: slackConfig.clientId,
      client_secret: slackConfig.clientSecret,
      code: code as string,
    });

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
      connectedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Save to user's integrations document
    await db.collection('users').doc(userId).set({
      integrations: {
        slack: tokenData
      }
    }, { merge: true });

    console.log(`Slack connected successfully for user: ${userId}`);

    // Redirect back to the app with success
    res.redirect(`${getAppUrl()}/settings?slack=success`);

  } catch (error) {
    console.error('Slack OAuth error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.redirect(`${getAppUrl()}/settings?slack=error&message=${encodeURIComponent(errorMessage)}`);
  }
});

/**
 * Get the app URL based on environment
 */
function getAppUrl(): string {
  // In production, use the deployed URL
  // For now, use localhost for development
  return process.env.APP_URL || 'http://localhost:5173';
}
