// meta-webhook-handler.js
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Import your other modules (adjust paths as needed)
const { 
  processMetaMessage, 
  processInstagramMessage, 
  prepareVoiceflowRequest, 
  formatVoiceflowResponse 
} = require('./message-processor');
const {
  retryWithBackoff,
  isTransientError,
  saveToDeadLetterQueue,
  processError
} = require('./error-recovery');
const {
  queueMessage,
  updateProcessingStatus,
  processPendingMessages
} = require('./message-queue');
const {
  getOrCreateSession,
  updateSessionContext,
  linkSessionToConversation,
  extendSession,
  prepareVoiceflowContext
} = require('./session-manager');
const { validateWebhook } = require('./webhook-security');

// Initialize Supabase client
let supabase = null;
try {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  if (supabaseUrl && supabaseServiceKey) {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log("Supabase client initialized successfully in webhook handler");
  } else {
    console.warn(`Missing Supabase credentials. URL: ${supabaseUrl ? 'Present' : 'Missing'}, Service Key: ${supabaseServiceKey ? 'Present' : 'Missing'}`);
  }
} catch (error) {
  console.error('Error initializing Supabase client:', error);
}

// Import the verification handler so we can delegate GET requests
const verificationHandler = require('./meta-webhook-verification');

// Main exported handler function for Netlify
exports.handler = async (event, context) => {
  // Set common CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Hub-Signature, X-Hub-Signature-256',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  // Delegate GET requests to the verification handler
  if (event.httpMethod === 'GET') {
    return await verificationHandler.handler(event, context);
  }

  // Only process POST requests for actual webhook events
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed. Please use POST for webhook events.' })
    };
  }

  // --- Begin POST webhook event processing ---
  // Enhanced webhook security validation
  const body = event.body;
  const appSecret = process.env.META_APP_SECRET;

  if (appSecret) {
    const validationResult = validateWebhook(event.headers, body, appSecret);
    if (!validationResult.valid) {
      console.error('Invalid webhook signature:', validationResult.message);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid webhook signature', details: validationResult.message })
      };
    }
    console.log('Webhook signature verified using:', validationResult.method);
  } else {
    console.warn('No META_APP_SECRET environment variable set. Skipping signature validation!');
  }

  // Extract path parameters from event.path
  const pathSegments = event.path.split('/');
  let userId = null;
  let platform = null;
  if (pathSegments.length >= 5 && pathSegments[2] === 'webhooks') {
    userId = pathSegments[3];
    platform = pathSegments[4];
  }
  if (!userId || !platform) {
    console.error('Missing userId or platform in webhook URL:', event.path);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid webhook URL format. Expected /api/webhooks/{userId}/{platform}/{timestamp}' })
    };
  }
  if (platform !== 'facebook' && platform !== 'instagram') {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid platform. Expected "facebook" or "instagram".' })
    };
  }

  try {
    let data;
    try {
      data = JSON.parse(body);
    } catch (e) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid request body. JSON parsing failed.' })
      };
    }
    if (!data.object || (data.object !== 'page' && data.object !== 'instagram')) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'ignored', message: 'Not a messaging webhook event' })
      };
    }
    console.log('Received webhook event:', JSON.stringify(data, null, 2));

    // Process entries and messaging events (your existing event processing logic)
    const queueResults = [];
    for (const entry of data.entry) {
      const messagingEvents = entry.messaging || entry.changes;
      if (!messagingEvents) continue;
      for (const evt of messagingEvents) {
        if (platform === 'instagram' && evt.field === 'messages') {
          const value = evt.value;
          const { senderId, recipientId, message, timestamp } = processInstagramMessage(value);
          const queueResult = await queueMessage(userId, platform, senderId, recipientId, message, timestamp);
          queueResults.push({ success: true, queueId: queueResult.id, platform: 'instagram' });
        } else if (platform === 'facebook' && evt.message && !evt.message.is_echo) {
          const senderId = evt.sender.id;
          const recipientId = evt.recipient.id;
          const timestamp = evt.timestamp;
          const queueResult = await queueMessage(userId, platform, senderId, recipientId, evt.message, timestamp);
          queueResults.push({ success: true, queueId: queueResult.id, platform: 'facebook', type: 'message' });
        } else if (platform === 'facebook' && evt.postback) {
          const senderId = evt.sender.id;
          const recipientId = evt.recipient.id;
          const timestamp = evt.timestamp;
          const postbackMessage = {
            mid: `postback-${Date.now()}`,
            postback: evt.postback
          };
          const queueResult = await queueMessage(userId, platform, senderId, recipientId, postbackMessage, timestamp);
          queueResults.push({ success: true, queueId: queueResult.id, platform: 'facebook', type: 'postback' });
        }
      }
    }

    // Process some messages immediately
    const processingResults = await processPendingMessages(processMessage, 2);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        status: 'success',
        message: 'Webhook events received and queued for processing',
        queued: queueResults.length,
        processed: processingResults.processed
      })
    };
  } catch (error) {
    console.error('Error handling webhook event:', error);
    return {
      statusCode: 200, // Always return 200 to Meta to avoid retries
      headers,
      body: JSON.stringify({ 
        status: 'error',
        message: 'Error processing webhook',
        error: error.message
      })
    };
  }
};

// Export processMessage if needed by other modules
exports.processMessage = processMessage;
