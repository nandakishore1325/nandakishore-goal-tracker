"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.slackOAuthCallback = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const web_api_1 = require("@slack/web-api");
const db = admin.firestore();
// Get Slack credentials from Firebase Functions config
const getSlackConfig = () => {
    var _a, _b, _c;
    const config = functions.config();
    return {
        clientId: ((_a = config.slack) === null || _a === void 0 ? void 0 : _a.client_id) || process.env.SLACK_CLIENT_ID || '',
        clientSecret: ((_b = config.slack) === null || _b === void 0 ? void 0 : _b.client_secret) || process.env.SLACK_CLIENT_SECRET || '',
        signingSecret: ((_c = config.slack) === null || _c === void 0 ? void 0 : _c.signing_secret) || process.env.SLACK_SIGNING_SECRET || '',
    };
};
/**
 * OAuth callback handler for Slack
 * This function receives the authorization code from Slack and exchanges it for an access token
 */
exports.slackOAuthCallback = functions.https.onRequest(async (req, res) => {
    var _a, _b, _c;
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
        const [userId] = state.split(':');
        if (!userId) {
            throw new Error('Invalid state parameter - missing userId');
        }
        const slackConfig = getSlackConfig();
        if (!slackConfig.clientId || !slackConfig.clientSecret) {
            throw new Error('Slack configuration not set. Run: firebase functions:config:set slack.client_id="..." slack.client_secret="..."');
        }
        // Exchange code for access token
        const client = new web_api_1.WebClient();
        const result = await client.oauth.v2.access({
            client_id: slackConfig.clientId,
            client_secret: slackConfig.clientSecret,
            code: code,
        });
        if (!result.ok || !result.access_token) {
            throw new Error(`Slack OAuth failed: ${result.error || 'Unknown error'}`);
        }
        // Store the token in Firestore
        const tokenData = {
            accessToken: result.access_token,
            tokenType: result.token_type,
            teamId: ((_a = result.team) === null || _a === void 0 ? void 0 : _a.id) || '',
            teamName: ((_b = result.team) === null || _b === void 0 ? void 0 : _b.name) || '',
            botUserId: result.bot_user_id || '',
            authedUserId: ((_c = result.authed_user) === null || _c === void 0 ? void 0 : _c.id) || '',
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
    }
    catch (error) {
        console.error('Slack OAuth error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.redirect(`${getAppUrl()}/settings?slack=error&message=${encodeURIComponent(errorMessage)}`);
    }
});
/**
 * Get the app URL based on environment
 */
function getAppUrl() {
    // In production, use the deployed URL
    // For now, use localhost for development
    return process.env.APP_URL || 'http://localhost:5173';
}
//# sourceMappingURL=oauth.js.map