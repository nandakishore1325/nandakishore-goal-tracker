#!/bin/bash

# Deploy Firebase Functions for Slack Integration
# Run this script in a terminal: ./deploy-functions.sh

echo "=== Goal Tracker - Firebase Functions Deployment ==="
echo ""

# Navigate to project directory
cd "$(dirname "$0")"

# Check if firebase-tools is installed
if ! ./node_modules/.bin/firebase --version > /dev/null 2>&1; then
    echo "Installing firebase-tools..."
    npm install --save-dev firebase-tools
fi

# Login to Firebase (this will open a browser)
echo "Step 1: Logging into Firebase..."
./node_modules/.bin/firebase login

# Set Slack configuration
echo ""
echo "Step 2: Setting Slack configuration..."
./node_modules/.bin/firebase functions:config:set \
    slack.client_id="4418602569.10441248404823" \
    slack.client_secret="d8761e22e2e48cf22e927d57193544e6" \
    slack.signing_secret="452c2fe641d39374d859dbaab7b00664"

# Deploy functions
echo ""
echo "Step 3: Deploying functions..."
./node_modules/.bin/firebase deploy --only functions

echo ""
echo "=== Deployment Complete! ==="
echo ""
echo "Next steps:"
echo "1. Go to https://api.slack.com/apps/A0ACZ7ABWQ7/event-subscriptions"
echo "2. Enter the webhook URL: https://us-central1-nandakishore-goal-tracker.cloudfunctions.net/slackWebhook"
echo "3. Click 'Retry' to verify the URL"
echo "4. Subscribe to 'app_mention' event"
echo "5. Save changes"
echo ""
