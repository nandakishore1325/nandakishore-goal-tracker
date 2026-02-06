import * as dotenv from 'dotenv';
import * as admin from 'firebase-admin';

// Load environment variables from .env file
dotenv.config();

// Initialize Firebase Admin
admin.initializeApp();

// Export Slack functions
export { slackOAuthCallback } from './slack/oauth';
export { slackWebhook } from './slack/webhook';
