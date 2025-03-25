// netlify/functions/meta-webhook-handler.js

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Import helper modules (adjust paths as needed)
const { 
  processMetaMessage, 
  processInstagramMessage, 
  prepareVoiceflowRequest, 
  formatVoiceflowResponse 
} = require('./message-processor');
const { retryWithBackoff, isTransientError, saveToDeadLetterQueue, processError } = require('./error-recovery');
const { queueMessage, updateProcessingStatus, processPendingMessages } = require('./message-queue');
const { getOrCreateSession, updateSessionContext, linkSessionToConversation, extendSession, prepareVoiceflowContext } = require('./session-manager');
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

// Import the verification handler (for GET requests)
const verificationHandler = require('./meta-webhook-verification');

/**
 * Core message processing function.
 * This function implements your message processing workflow including:
 * - Finding social connections, session creation, and conversation management
 * - Voiceflow API integration and error recovery
 */
async function processMessage(userId, platform, senderId, recipientId, message, timestamp) {
  try {
    if (!supabase) throw new Error('Database connection is not available');

    // Retrieve social connection with retry
    const getSocialConnection = async () => {
      const { data: connections, error: connectionError } = await supabase
        .from('social_connections')
        .select('*')
        .eq('user_id', userId)
        .eq(platform === 'facebook' ? 'fb_page_id' : 'ig_account_id', recipientId);
      if (connectionError) throw connectionError;
      if (!connections || connections.length === 0) {
        throw new Error(`No ${platform} connection found for user ${userId}, page ID ${recipientId}`);
      }
      return connections[0];
    };

    const connection = await retryWithBackoff(getSocialConnection, {
      maxRetries: 3,
      initialDelay: 300,
      shouldRetry: (error) => isTransientError(error)
    });

    // Get or create a session
    const session = await getOrCreateSession(userId, senderId, platform);

    // Find or create a conversation
    const getOrCreateConversation = async () => {
      let { data: conversations, error: conversationError } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .eq('platform', platform)
        .eq('external_id', senderId);
      if (conversationError) throw conversationError;
      if (!conversations || conversations.length === 0) {
        const { data: newConversation, error: createError } = await supabase
          .from('conversations')
          .insert([{
            user_id: userId,
            platform,
            external_id: senderId,
            participant_id: senderId,
            participant_name: null,
            last_message_at: new Date(timestamp).toISOString(),
            session_id: session.id
          }])
          .select();
        if (createError) throw createError;
        if (!newConversation || newConversation.length === 0) {
          throw new Error('Failed to create conversation');
        }
        return newConversation[0];
      } else {
        await supabase
          .from('conversations')
          .update({ 
            last_message_at: new Date(timestamp).toISOString(),
            session_id: session.id
          })
          .eq('id', conversations[0].id);
        return conversations[0];
      }
    };

    const conversation = await retryWithBackoff(getOrCreateConversation, {
      maxRetries: 3,
      initialDelay: 300,
      shouldRetry: (error) => isTransientError(error)
    });
    const conversationId = conversation.id;

    // Link session to conversation if needed
    await linkSessionToConversation(conversationId, session.id);

    // Process the incoming message
    const processedMessage = processMetaMessage(message, platform);

    // Store the incoming user message
    const saveUserMessage = async () => {
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversationId,
          content: processedMessage.text,
          sender_type: 'user',
          external_id: message.mid || null,
          sent_at: new Date(timestamp).toISOString()
        }])
        .select();
      if (error) throw error;
      return data[0];
    };
    const savedMessage = await retryWithBackoff(saveUserMessage, {
      maxRetries: 2,
      initialDelay: 300,
      shouldRetry: (error) => isTransientError(error)
    });

    // Update session context with the user message
    await updateSessionContext(session.id, { lastUserMessage: processedMessage.text });

    // Retrieve Voiceflow mapping
    const getVoiceflowMapping = async () => {
      const { data, error } = await supabase
        .from('voiceflow_mappings')
        .select('*')
        .eq('user_id', userId)
        .limit(1);
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('No Voiceflow agent configured');
      return data[0];
    };
    const voiceflowMapping = await retryWithBackoff(getVoiceflowMapping, {
      maxRetries: 2,
      initialDelay: 300,
      shouldRetry: (error) => isTransientError(error)
    });

    // Retrieve Voiceflow API key
    const getApiKey = async () => {
      const { data } = await supabase
        .from('voiceflow_api_keys')
        .select('api_key')
        .eq('user_id', userId)
        .limit(1);
      return data && data.length > 0 ? data[0].api_key : process.env.VOICEFLOW_API_KEY;
    };
    const apiKey = await retryWithBackoff(getApiKey, {
      maxRetries: 2,
      initialDelay: 300,
      shouldRetry: (error) => isTransientError(error)
    });
    if (!apiKey) {
      throw new Error('No Voiceflow API key found');
    }

    // Prepare context and Voiceflow request
    const baseContext = {
      messageId: savedMessage.id,
      participantId: senderId,
      platform,
      conversationId,
      timestamp: new Date(timestamp).toISOString()
    };
    const voiceflowContext = await prepareVoiceflowContext(session.id, baseContext);
    const voiceflowRequest = prepareVoiceflowRequest(processedMessage, voiceflowContext);

    // Call Voiceflow API
    const callVoiceflow = async () => {
      return await axios.post(
        `https://general-runtime.voiceflow.com/state/user/${userId}/interact`,
        voiceflowRequest,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );
    };

    let voiceflowResponse;
    try {
      voiceflowResponse = await retryWithBackoff(callVoiceflow, {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 5000,
        shouldRetry: (error) => isTransientError(error) || (error.response && error.response.status >= 500)
      });

      // Extract context updates from Voiceflow response and update session context
      const contextUpdates = extractContextFromVoiceflowResponse(voiceflowResponse.data);
      if (Object.keys(contextUpdates).length > 0) {
        await updateSessionContext(session.id, contextUpdates);
      }
      await extendSession(session.id);
    } catch (voiceflowError) {
      await saveToDeadLetterQueue(
        userId, 
        processedMessage.text, 
        voiceflowError.message,
        { platform, conversationId, messageId: savedMessage.id, timestamp, sessionId: session.id }
      );
      throw new Error('Failed to process message with AI assistant after multiple attempts');
    }

    // Format Voiceflow response and save assistant message
    const formattedResponse = formatVoiceflowResponse(voiceflowResponse.data);
    const saveAssistantMessage = async () => {
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversationId,
          content: formattedResponse.text,
          sender_type: 'assistant',
          sent_at: new Date().toISOString()
        }])
        .select();
      if (error) throw error;
      return data[0];
    };
    const assistantMessage = await retryWithBackoff(saveAssistantMessage, { maxRetries: 2, initialDelay: 300 });
    await updateSessionContext(session.id, { lastAssistantMessage: formattedResponse.text });

    // Send response back to user via Meta API
    const accessToken = connection.access_token;
    const sendResponse = async () => {
      if (platform === 'facebook') {
        const fbResponse = {
          recipient: { id: senderId },
          message: formattedResponse,
          messaging_type: 'RESPONSE'
        };
        return await axios.post(
          `https://graph.facebook.com/v18.0/me/messages`,
          fbResponse,
          { params: { access_token: accessToken }, timeout: 10000 }
        );
      } else if (platform === 'instagram') {
        const igResponse = {
          recipient: { id: senderId },
          message: formattedResponse,
          messaging_type: 'RESPONSE'
        };
        return await axios.post(
          `https://graph.facebook.com/v18.0/${connection.ig_account_id}/messages`,
          igResponse,
          { params: { access_token: accessToken }, timeout: 10000 }
        );
      }
    };

    try {
      await retryWithBackoff(sendResponse, { maxRetries: 3, initialDelay: 1000, shouldRetry: (error) => isTransientError(error) });
    } catch (sendError) {
      console.error('Failed to send response after retries:', sendError);
      return { 
        success: true, 
        warning: 'Message processed but failed to deliver to user',
        messageId: assistantMessage.id,
        sessionId: session.id
      };
    }

    return { success: true, messageId: assistantMessage.id, sessionId: session.id };

  } catch (error) {
    const errorDetails = processError(error, { userId, platform, senderId: null, recipientId: null });
    console.error('Failed to process message:', errorDetails);
    if (errorDetails.isTransient) {
      return { success: false, error: error.message, transient: true, shouldRetry: true };
    }
    return { success: false, error: error.message };
  }
}

/**
 * Extract context variables from Voiceflow response.
 * @param {Array} voiceflowResponse Response array from Voiceflow API.
 * @returns {Object} Context updates.
 */
function extractContextFromVoiceflowResponse(voiceflowResponse) {
  if (!Array.isArray(voiceflowResponse)) return {};
  const contextUpdates = {};
  voiceflowResponse.forEach(item => {
    if (item.type === 'set-variables' && item.payload) {
      Object.entries(item.payload).forEach(([key, value]) => {
        contextUpdates[key] = value;
      });
    }
    if (item.type === 'text' && item.payload && item.payload.message) {
      const contextMarkerRegex = /\[\[SET:([a-zA-Z0-9_]+)=([^\]]+)\]\]/g;
      let match;
      while ((match = contextMarkerRegex.exec(item.payload.message)) !== null) {
        const [ , key, value ] = match;
        contextUpdates[key] = value;
      }
    }
  });
  return contextUpdates;
}

// Export processMessage for use in process-message-queue.js
exports.processMessage = processMessage;
