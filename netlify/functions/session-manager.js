// netlify/functions/session-manager.js

const { createClient } = require('@supabase/supabase-js');
const { retryWithBackoff, isTransientError } = require('./error-recovery');

let supabase = null;
try {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  if (supabaseUrl && supabaseServiceKey) {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log("Supabase client initialized successfully in session manager");
  } else {
    console.warn(`Missing Supabase credentials in session-manager.js. URL: ${supabaseUrl ? 'Present' : 'Missing'}, Service Key: ${supabaseServiceKey ? 'Present' : 'Missing'}`);
  }
} catch (error) {
  console.error('Error initializing Supabase client in session-manager.js:', error);
}

const SESSION_EXPIRY_HOURS = 8760; // 365 days

async function getOrCreateSession(userId, participantId, platform) {
  try {
    if (!supabase) throw new Error('Database connection not available');
    const { data: existingSessions, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('participant_id', participantId)
      .eq('platform', platform)
      .order('last_interaction', { ascending: false })
      .limit(1);
    if (error) throw error;
    if (existingSessions && existingSessions.length > 0) {
      await extendSession(existingSessions[0].id, SESSION_EXPIRY_HOURS);
      return existingSessions[0];
    }
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + SESSION_EXPIRY_HOURS);
    const { data: newSession, error: createError } = await supabase
      .from('user_sessions')
      .insert([{
        user_id: userId,
        participant_id: participantId,
        platform,
        context: { conversationHistory: [] },
        expires_at: expiryDate.toISOString()
      }])
      .select();
    if (createError) throw createError;
    return newSession[0];
  } catch (error) {
    console.error('Error getting or creating session:', error);
    throw error;
  }
}

async function updateSessionContext(sessionId, contextUpdates) {
  try {
    if (!supabase) throw new Error('Database connection not available');
    const { data: session, error } = await supabase
      .from('user_sessions')
      .select('context')
      .eq('id', sessionId)
      .single();
    if (error) throw error;
    const currentContext = session.context || {};
    if (!currentContext.conversationHistory) {
      currentContext.conversationHistory = [];
    }
    if (contextUpdates.lastUserMessage) {
      currentContext.conversationHistory.push({
        role: 'user',
        content: contextUpdates.lastUserMessage,
        timestamp: new Date().toISOString()
      });
    }
    if (contextUpdates.lastAssistantMessage) {
      currentContext.conversationHistory.push({
        role: 'assistant',
        content: contextUpdates.lastAssistantMessage,
        timestamp: new Date().toISOString()
      });
    }
    if (currentContext.conversationHistory.length > 50) {
      currentContext.conversationHistory = currentContext.conversationHistory.slice(-50);
    }
    const updatedContext = {
      ...currentContext,
      ...contextUpdates,
      lastUpdated: new Date().toISOString()
    };
    const { data: updatedSession, error: updateError } = await supabase
      .from('user_sessions')
      .update({ context: updatedContext, last_interaction: new Date().toISOString() })
      .eq('id', sessionId)
      .select();
    if (updateError) throw updateError;
    return updatedSession[0];
  } catch (error) {
    console.error('Error updating session context:', error);
    throw error;
  }
}

async function getSession(sessionId) {
  try {
    if (!supabase) throw new Error('Database connection not available');
    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting session:', error);
    throw error;
  }
}

async function linkSessionToConversation(conversationId, sessionId) {
  try {
    if (!supabase) throw new Error('Database connection not available');
    const { error } = await supabase
      .from('conversations')
      .update({ session_id: sessionId })
      .eq('id', conversationId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error linking session to conversation:', error);
    throw error;
  }
}

async function extendSession(sessionId, hours = SESSION_EXPIRY_HOURS) {
  try {
    if (!supabase) throw new Error('Database connection not available');
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + hours);
    const { data, error } = await supabase
      .from('user_sessions')
      .update({ expires_at: expiryDate.toISOString(), last_interaction: new Date().toISOString() })
      .eq('id', sessionId)
      .select();
    if (error) throw error;
    return data[0];
  } catch (error) {
    console.error('Error extending session:', error);
    throw error;
  }
}

async function cleanupExpiredSessions() {
  try {
    if (!supabase) throw new Error('Database connection not available');
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('user_sessions')
      .delete()
      .lt('expires_at', now)
      .select();
    if (error) throw error;
    console.log(`Cleaned up ${data.length} expired sessions`);
    return data.length;
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
    throw error;
  }
}

async function prepareVoiceflowContext(sessionId, additionalContext = {}) {
  try {
    if (!supabase) {
      return { ...additionalContext, error: 'Database connection not available' };
    }
    const session = await getSession(sessionId);
    const sessionContext = session.context || {};
    let conversationSummary = '';
    if (sessionContext.conversationHistory && sessionContext.conversationHistory.length > 0) {
      const recentMessages = sessionContext.conversationHistory.slice(-10);
      conversationSummary = recentMessages.map(msg => 
        `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
      ).join('\n');
    }
    const combinedContext = {
      ...sessionContext,
      ...additionalContext,
      sessionId: session.id,
      participantId: session.participant_id,
      platform: session.platform,
      sessionCreatedAt: session.created_at,
      lastInteraction: session.last_interaction,
      conversationSummary
    };
    return combinedContext;
  } catch (error) {
    console.error('Error preparing Voiceflow context:', error);
    return { ...additionalContext, error: 'Failed to load session context' };
  }
}

module.exports = {
  getOrCreateSession,
  updateSessionContext,
  getSession,
  linkSessionToConversation,
  extendSession,
  cleanupExpiredSessions,
  prepareVoiceflowContext
};
