// src/lib/api.ts

import { supabase } from './supabase';
import type { 
  SocialConnection, 
  VoiceflowMapping, 
  Conversation, 
  Message,
  ApiRateLimit,
  TokenRefreshHistory,
  MessageAnalytics,
  DashboardStats,
  WebhookConfig,
  UserSummary,
  VoiceflowApiKey
} from '../types';

// Social connections
export async function getSocialConnections() {
  try {
    const { data, error } = await supabase.from('social_connections').select('*');
    if (error) throw error;
    return data as SocialConnection[];
  } catch (error) {
    console.error("Error fetching social connections:", error);
    return [];
  }
}

export async function getSocialConnectionsByUserId(userId: string) {
  try {
    let query = supabase.from('social_connections').select('*');
    if (userId) {
      query = query.eq('user_id', userId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data as SocialConnection[];
  } catch (error) {
    console.error(`Error fetching social connections for user ${userId}:`, error);
    return [];
  }
}

export async function createSocialConnection(connection: Omit<SocialConnection, 'id' | 'created_at'>) {
  try {
    if (!connection.user_id) throw new Error('User ID is required to create a social connection');
    const { data, error } = await supabase.from('social_connections').insert([{
      user_id: connection.user_id,
      fb_page_id: connection.fb_page_id,
      ig_account_id: connection.ig_account_id,
      access_token: connection.access_token,
      token_expiry: connection.token_expiry
    }]).select();
    if (error) throw error;
    return data[0] as SocialConnection;
  } catch (error) {
    console.error("Error creating social connection:", error);
    throw error;
  }
}

export async function refreshSocialConnectionToken(connectionId: string, newExpiryDate: string) {
  try {
    if (!connectionId) throw new Error('Connection ID is required to refresh token');
    const { data, error } = await supabase.from('social_connections').update({
      token_expiry: newExpiryDate,
      refreshed_at: new Date().toISOString()
    }).eq('id', connectionId).select();
    if (error) throw error;
    return data[0] as SocialConnection;
  } catch (error) {
    console.error(`Error refreshing token for connection ${connectionId}:`, error);
    throw error;
  }
}

// Function to get token refresh history for a user
export async function getTokenRefreshHistory(userId: string): Promise<TokenRefreshHistory[]> {
  try {
    if (!userId) {
      console.warn('No user ID provided for token refresh history');
      return [];
    }
    const { data, error } = await supabase.from('social_connections').select('*').eq('user_id', userId).not('refreshed_at', 'is', null);
    if (error) throw error;
    if (!data) return [];
    return data.map(conn => ({
      connectionId: conn.id,
      platformType: conn.fb_page_id ? 'Facebook' : 'Instagram',
      platformId: conn.fb_page_id || conn.ig_account_id || '',
      lastRefreshed: conn.refreshed_at || '',
      currentExpiry: conn.token_expiry
    })) as TokenRefreshHistory[];
  } catch (error) {
    console.error(`Error fetching token refresh history for user ${userId}:`, error);
    return [];
  }
}

// Voiceflow mappings
export async function getVoiceflowMappings() {
  try {
    const { data, error } = await supabase.from('voiceflow_mappings').select('*');
    if (error) throw error;
    return data as VoiceflowMapping[];
  } catch (error) {
    console.error("Error fetching Voiceflow mappings:", error);
    return [];
  }
}

export async function getVoiceflowMappingByUserId(userId: string) {
  try {
    let query = supabase.from('voiceflow_mappings').select('*');
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query.limit(1);
    if (error) throw error;
    return data && data.length > 0 ? data[0] as VoiceflowMapping : null;
  } catch (error) {
    console.error(`Error fetching Voiceflow mapping for user ${userId}:`, error);
    throw error;
  }
}

export async function createVoiceflowMapping(mapping: Omit<VoiceflowMapping, 'id' | 'created_at'>) {
  try {
    if (!mapping.user_id || !mapping.vf_project_id) throw new Error('User ID and Voiceflow project ID are required');
    const { data, error } = await supabase.from('voiceflow_mappings').insert([{
      user_id: mapping.user_id,
      vf_project_id: mapping.vf_project_id,
      flowbridge_config: mapping.flowbridge_config || {}
    }]).select();
    if (error) throw error;
    return data[0] as VoiceflowMapping;
  } catch (error) {
    console.error("Error creating Voiceflow mapping:", error);
    throw error;
  }
}

export async function updateVoiceflowMapping(id: string, mapping: Partial<VoiceflowMapping>) {
  try {
    if (!id) throw new Error('Mapping ID is required to update');
    const { data, error } = await supabase.from('voiceflow_mappings').update(mapping).eq('id', id).select();
    if (error) throw error;
    return data[0] as VoiceflowMapping;
  } catch (error) {
    console.error(`Error updating Voiceflow mapping ${id}:`, error);
    throw error;
  }
}

// Voiceflow API keys (admin only)
export async function getVoiceflowApiKeys() {
  try {
    const { data, error } = await supabase.from('voiceflow_api_keys').select('*');
    if (error) throw error;
    return data as VoiceflowApiKey[];
  } catch (error) {
    console.error("Error fetching Voiceflow API keys:", error);
    return [];
  }
}

export async function getVoiceflowApiKeyByUserId(userId: string) {
  try {
    let query = supabase.from('voiceflow_api_keys').select('*');
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query.limit(1);
    if (error) throw error;
    return data && data.length > 0 ? data[0] as VoiceflowApiKey : null;
  } catch (error) {
    console.error(`Error fetching Voiceflow API key for user ${userId}:`, error);
    throw error;
  }
}

export async function createVoiceflowApiKey(apiKey: Omit<VoiceflowApiKey, 'id' | 'created_at' | 'updated_at'>) {
  try {
    if (!apiKey.user_id || !apiKey.api_key) throw new Error('User ID and API key are required');
    const { data, error } = await supabase.from('voiceflow_api_keys').insert([{
      user_id: apiKey.user_id,
      api_key: apiKey.api_key
    }]).select();
    if (error) throw error;
    return data[0] as VoiceflowApiKey;
  } catch (error) {
    console.error("Error creating Voiceflow API key:", error);
    throw error;
  }
}

export async function updateVoiceflowApiKey(id: string, apiKey: Partial<VoiceflowApiKey>) {
  try {
    if (!id) throw new Error('API key ID is required to update');
    const updatedData = { ...apiKey, updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from('voiceflow_api_keys').update(updatedData).eq('id', id).select();
    if (error) throw error;
    return data[0] as VoiceflowApiKey;
  } catch (error) {
    console.error(`Error updating Voiceflow API key ${id}:`, error);
    throw error;
  }
}

// Webhook configs
export async function getWebhookConfigs() {
  try {
    const { data, error } = await supabase.from('webhook_configs').select('*');
    if (error) throw error;
    return data as WebhookConfig[];
  } catch (error) {
    console.error("Error fetching webhook configs:", error);
    return [];
  }
}

export async function getWebhookConfigByUserId(userId: string, platform?: 'all' | 'facebook' | 'instagram') {
  try {
    let query = supabase.from('webhook_configs').select('*');
    if (userId) query = query.eq('user_id', userId);
    if (platform) query = query.eq('platform', platform);
    const { data, error } = await query.limit(1);
    if (error) throw error;
    return data && data.length > 0 ? data[0] as WebhookConfig : null;
  } catch (error) {
    console.error(`Error fetching webhook config for user ${userId}:`, error);
    throw error;
  }
}

export async function getWebhookConfigsByUserId(userId: string) {
  try {
    let query = supabase.from('webhook_configs').select('*');
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query;
    if (error) throw error;
    return data as WebhookConfig[];
  } catch (error) {
    console.error(`Error fetching webhook configs for user ${userId}:`, error);
    throw error;
  }
}

export async function createWebhookConfig(config: Omit<WebhookConfig, 'id' | 'created_at' | 'updated_at'>) {
  try {
    if (!config.user_id) throw new Error('User ID is required to create a webhook config');
    const { data, error } = await supabase.from('webhook_configs').insert([{
      user_id: config.user_id,
      webhook_url: config.webhook_url,
      verification_token: config.verification_token,
      is_active: config.is_active !== undefined ? config.is_active : false,
      platform: config.platform || 'all',
      webhook_name: config.webhook_name,
      generated_url: config.generated_url
    }]).select();
    if (error) throw error;
    return data[0] as WebhookConfig;
  } catch (error) {
    console.error("Error creating webhook config:", error);
    throw error;
  }
}

export async function updateWebhookConfig(id: string, config: Partial<WebhookConfig>) {
  try {
    if (!id) throw new Error('Webhook config ID is required to update');
    const updateData = { ...config, updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from('webhook_configs').update(updateData).eq('id', id).select();
    if (error) throw error;
    return data[0] as WebhookConfig;
  } catch (error) {
    console.error(`Error updating webhook config ${id}:`, error);
    throw error;
  }
}

// Conversations
export async function getConversations() {
  try {
    const { data, error } = await supabase.from('conversations').select(`
      *,
      messages:messages(
        content,
        sender_type,
        sent_at
      )
    `).order('last_message_at', { ascending: false }).limit(1, { foreignTable: 'messages' });
    if (error) throw error;
    if (!data) return [];
    return data.map(conv => ({
      ...conv,
      latest_message: conv.messages && conv.messages.length > 0 ? conv.messages[0] : null,
      messages: undefined
    })) as Conversation[];
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return [];
  }
}

export async function getConversationsByUserId(userId: string) {
  try {
    if (!userId) {
      console.warn('No user ID provided for conversations');
      return [];
    }
    const { data, error } = await supabase.from('conversations').select(`
      *,
      messages:messages(
        content,
        sender_type,
        sent_at
      )
    `).eq('user_id', userId).order('last_message_at', { ascending: false }).limit(1, { foreignTable: 'messages' });
    if (error) throw error;
    if (!data) return [];
    return data.map(conv => ({
      ...conv,
      latest_message: conv.messages && conv.messages.length > 0 ? conv.messages[0] : null,
      messages: undefined
    })) as Conversation[];
  } catch (error) {
    console.error(`Error fetching conversations for user ${userId}:`, error);
    return [];
  }
}

export async function getConversation(id: string) {
  try {
    if (!id) throw new Error('Conversation ID is required');
    const { data, error } = await supabase.from('conversations').select('*').eq('id', id).limit(1);
    if (error) throw error;
    return data && data.length > 0 ? data[0] as Conversation : null;
  } catch (error) {
    console.error(`Error fetching conversation ${id}:`, error);
    throw error;
  }
}

export async function createConversation(conversation: Omit<Conversation, 'id' | 'created_at'>) {
  try {
    if (!conversation.user_id || !conversation.platform || !conversation.external_id || !conversation.participant_id) {
      throw new Error('Required conversation fields are missing');
    }
    const { data, error } = await supabase.from('conversations').insert([{
      user_id: conversation.user_id,
      platform: conversation.platform,
      external_id: conversation.external_id,
      participant_id: conversation.participant_id,
      participant_name: conversation.participant_name,
      last_message_at: conversation.last_message_at || new Date().toISOString()
    }]).select();
    if (error) throw error;
    return data[0] as Conversation;
  } catch (error) {
    console.error("Error creating conversation:", error);
    throw error;
  }
}

export async function updateConversation(id: string, updates: Partial<Conversation>) {
  try {
    if (!id) throw new Error('Conversation ID is required for update');
    const { data, error } = await supabase.from('conversations').update(updates).eq('id', id).select();
    if (error) throw error;
    return data[0] as Conversation;
  } catch (error) {
    console.error(`Error updating conversation ${id}:`, error);
    throw error;
  }
}

// Messages
export async function getMessages(conversationId: string) {
  try {
    if (!conversationId) {
      console.warn('No conversation ID provided for messages');
      return [];
    }
    const { data, error } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).order('sent_at', { ascending: true });
    if (error) throw error;
    return data as Message[];
  } catch (error) {
    console.error(`Error fetching messages for conversation ${conversationId}:`, error);
    return [];
  }
}

export async function createMessage(message: Omit<Message, 'id' | 'created_at'>) {
  try {
    if (!message.conversation_id || !message.content || !message.sender_type) {
      throw new Error('Required message fields are missing');
    }
    const { data, error } = await supabase.from('messages').insert([{
      conversation_id: message.conversation_id,
      content: message.content,
      sender_type: message.sender_type,
      external_id: message.external_id,
      sent_at: message.sent_at || new Date().toISOString()
    }]).select();
    if (error) throw error;
    try {
      await supabase.from('conversations').update({ last_message_at: message.sent_at || new Date().toISOString() }).eq('id', message.conversation_id);
    } catch (updateError) {
      console.error(`Error updating conversation timestamp for ${message.conversation_id}:`, updateError);
    }
    return data[0] as Message;
  } catch (error) {
    console.error("Error creating message:", error);
    throw error;
  }
}

// API Rate Limiting
export async function trackApiCall(userId: string, platform: string, endpoint: string) {
  try {
    if (!userId || !platform || !endpoint) {
      console.warn('Missing required parameters for API call tracking');
      return null;
    }
    const today = new Date();
    const resetDate = new Date(today);
    resetDate.setHours(0, 0, 0, 0);
    resetDate.setDate(resetDate.getDate() + 1);
    const { data: existingData, error: checkError } = await supabase.from('api_rate_limits').select('*').eq('user_id', userId).eq('platform', platform).eq('endpoint', endpoint).gte('reset_at', today.toISOString()).limit(1);
    if (checkError && checkError.code !== 'PGRST116') throw checkError;
    if (existingData && existingData.length > 0) {
      const { data, error } = await supabase.from('api_rate_limits').update({ calls_made: existingData[0].calls_made + 1 }).eq('id', existingData[0].id).select();
      if (error) throw error;
      return data[0] as ApiRateLimit;
    } else {
      const { data, error } = await supabase.from('api_rate_limits').insert([{
        user_id: userId,
        platform,
        endpoint,
        calls_made: 1,
        reset_at: resetDate.toISOString()
      }]).select();
      if (error) throw error;
      return data[0] as ApiRateLimit;
    }
  } catch (error) {
    console.error(`Error tracking API call for ${userId}/${platform}/${endpoint}:`, error);
    return null;
  }
}

export async function checkRateLimit(userId: string, platform: string, endpoint: string, limit: number) {
  try {
    if (!userId || !platform || !endpoint) {
      console.warn('Missing required parameters for rate limit check');
      return true;
    }
    const today = new Date();
    const { data, error } = await supabase.from('api_rate_limits').select('*').eq('user_id', userId).eq('platform', platform).eq('endpoint', endpoint).gte('reset_at', today.toISOString()).limit(1);
    if (error) throw error;
    if (!data || data.length === 0 || data[0].calls_made < limit) return true;
    return false;
  } catch (error) {
    console.error(`Error checking rate limit for ${userId}/${platform}/${endpoint}:`, error);
    return true;
  }
}

// Analytics functions
export async function getMessageAnalytics(userId: string, daysBack = 7): Promise<MessageAnalytics[]> {
  try {
    if (!userId) {
      console.warn('No user ID provided for message analytics');
      return createEmptyAnalytics(daysBack);
    }
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const { data: conversations, error: conversationsError } = await supabase.from('conversations').select('id, platform').eq('user_id', userId);
    if (conversationsError) throw conversationsError;
    if (!conversations || conversations.length === 0) return createEmptyAnalytics(daysBack);
    const conversationIds = conversations.map(c => c.id);
    const { data, error } = await supabase.from('messages').select(`
      id,
      sent_at,
      sender_type,
      conversation_id
    `).in('conversation_id', conversationIds).gte('sent_at', startDate.toISOString());
    if (error) throw error;
    const platformMap = conversations.reduce((map, conv) => {
      map[conv.id] = conv.platform;
      return map;
    }, {} as Record<string, string>);
    const messagesByDay = initializeMessagesByDay(daysBack);
    if (data && data.length > 0) {
      data.forEach(message => {
        const day = new Date(message.sent_at).toLocaleDateString();
        if (messagesByDay[day]) {
          messagesByDay[day].total += 1;
          const convPlatform = platformMap[message.conversation_id];
          if (convPlatform === 'facebook') {
            messagesByDay[day].facebook += 1;
          } else if (convPlatform === 'instagram') {
            messagesByDay[day].instagram += 1;
          }
          if (message.sender_type === 'user') {
            messagesByDay[day].user += 1;
          } else if (message.sender_type === 'assistant') {
            messagesByDay[day].assistant += 1;
          }
        }
      });
    }
    return formatMessageAnalytics(messagesByDay);
  } catch (error) {
    console.error('Error in getMessageAnalytics:', error);
    return createEmptyAnalytics(daysBack);
  }
}

function initializeMessagesByDay(daysBack: number) {
  const messagesByDay: Record<string, { total: number, facebook: number, instagram: number, user: number, assistant: number }> = {};
  for (let i = 0; i < daysBack; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const day = date.toLocaleDateString();
    messagesByDay[day] = { total: 0, facebook: 0, instagram: 0, user: 0, assistant: 0 };
  }
  return messagesByDay;
}

function createEmptyAnalytics(daysBack: number): MessageAnalytics[] {
  const result: MessageAnalytics[] = [];
  for (let i = 0; i < daysBack; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const day = date.toLocaleDateString();
    result.push({
      name: new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date),
      date: day,
      messages: 0,
      facebook: 0,
      instagram: 0,
      userMessages: 0,
      assistantMessages: 0
    });
  }
  return result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function formatMessageAnalytics(messagesByDay: Record<string, any>): MessageAnalytics[] {
  const result: MessageAnalytics[] = [];
  const days = Object.keys(messagesByDay).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  for (const day of days) {
    const date = new Date(day);
    result.push({
      name: new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date),
      date: day,
      messages: messagesByDay[day].total,
      facebook: messagesByDay[day].facebook,
      instagram: messagesByDay[day].instagram,
      userMessages: messagesByDay[day].user,
      assistantMessages: messagesByDay[day].assistant
    });
  }
  return result;
}

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  try {
    if (!userId) {
      console.warn('No user ID provided for dashboard stats');
      return {
        messageCount: 0,
        conversationCount: 0,
        responseTime: 0,
        successRate: 0,
        facebookPercentage: 0,
        instagramPercentage: 0
      };
    }
    const { data: conversations, error: conversationsError } = await supabase.from('conversations').select('id, platform').eq('user_id', userId);
    if (conversationsError) throw conversationsError;
    if (!conversations || conversations.length === 0) {
      return { messageCount: 0, conversationCount: 0, responseTime: 0, successRate: 0, facebookPercentage: 0, instagramPercentage: 0 };
    }
    const conversationIds = conversations.map(c => c.id);
    const { count: messageCount, error: countError } = await supabase.from('messages').select('id', { count: 'exact', head: true }).in('conversation_id', conversationIds);
    if (countError) throw countError;
    const conversationCount = conversations.length;
    const { data: allMessages, error: messagesError } = await supabase.from('messages').select('id, conversation_id, sender_type, sent_at').in('conversation_id', conversationIds).order('sent_at', { ascending: true });
    if (messagesError) throw messagesError;
    const { avgResponseTime, successRate } = calculateResponseMetrics(allMessages, conversationIds);
    const { facebookPercentage, instagramPercentage } = calculatePlatformDistribution(conversations);
    return { messageCount: messageCount || 0, conversationCount: conversationCount || 0, responseTime: avgResponseTime, successRate, facebookPercentage, instagramPercentage };
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    return { messageCount: 0, conversationCount: 0, responseTime: 0, successRate: 0, facebookPercentage: 0, instagramPercentage: 0 };
  }
}

export async function getRecentConversations(userId: string, limit = 5) {
  try {
    if (!userId) {
      console.warn('No user ID provided for recent conversations');
      return [];
    }
    const { data, error } = await supabase.from('conversations').select(`
      *,
      messages:messages(
        content,
        sender_type,
        sent_at
      )
    `).eq('user_id', userId).order('last_message_at', { ascending: false }).limit(limit).limit(1, { foreignTable: 'messages' });
    if (error) throw error;
    if (!data || data.length === 0) return [];
    return data.map(conv => ({
      ...conv,
      latest_message: conv.messages && conv.messages.length > 0 ? conv.messages[0] : null,
      messages: undefined
    })) as Conversation[];
  } catch (error) {
    console.error('Error getting recent conversations:', error);
    return [];
  }
}

export async function getMessageVolumeByHour(userId: string, daysBack = 7) {
  try {
    if (!userId) {
      console.warn('No user ID provided for message volume by hour');
      return createEmptyHourlyData();
    }
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const { data: conversations, error: conversationsError } = await supabase.from('conversations').select('id').eq('user_id', userId);
    if (conversationsError) throw conversationsError;
    if (!conversations || conversations.length === 0) return createEmptyHourlyData();
    const conversationIds = conversations.map(c => c.id);
    const { data, error } = await supabase.from('messages').select('sent_at').in('conversation_id', conversationIds).gte('sent_at', startDate.toISOString());
    if (error) throw error;
    const hourCounts = Array(24).fill(0);
    if (data && data.length > 0) {
      data.forEach(message => {
        const hour = new Date(message.sent_at).getHours();
        hourCounts[hour]++;
      });
    }
    return hourCounts.map((count, hour) => ({ hour, displayHour: `${hour}:00`, count }));
  } catch (error) {
    console.error('Error getting message volume by hour:', error);
    return createEmptyHourlyData();
  }
}

export async function getAllUsers() {
  try {
    const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting all users:', error);
    throw error;
  }
}

export async function getUserById(userId: string) {
  try {
    if (!userId) throw new Error('User ID is required');
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).limit(1);
    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error(`Error getting user by ID ${userId}:`, error);
    throw error;
  }
}

export async function getUserSummaries(): Promise<UserSummary[]> {
  try {
    const { data: users, error: usersError } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (usersError) throw usersError;
    if (!users || users.length === 0) return [];
    const summaries: UserSummary[] = [];
    for (const user of users) {
      try {
        const { data: connections } = await supabase.from('social_connections').select('*').eq('user_id', user.id);
        const { data: voiceflow } = await supabase.from('voiceflow_mappings').select('*').eq('user_id', user.id);
        const { data: webhook } = await supabase.from('webhook_configs').select('*').eq('user_id', user.id);
        const { count: conversationCount } = await supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
        const { data: conversations } = await supabase.from('conversations').select('id').eq('user_id', user.id);
        let messageCount = 0;
        if (conversations && conversations.length > 0) {
          const conversationIds = conversations.map(c => c.id);
          const { count: msgCount } = await supabase.from('messages').select('id', { count: 'exact', head: true }).in('conversation_id', conversationIds);
          messageCount = msgCount || 0;
        }
        summaries.push({
          id: user.id,
          email: user.email,
          role: user.role || 'customer',
          created_at: user.created_at,
          connections: {
            facebook: connections ? !!connections.some(c => c.fb_page_id) : false,
            instagram: connections ? !!connections.some(c => c.ig_account_id) : false
          },
          voiceflow: voiceflow && voiceflow.length > 0,
          webhook: webhook && webhook.length > 0,
          conversationCount: conversationCount || 0,
          messageCount: messageCount
        });
      } catch (userError) {
        console.error(`Error processing user ${user.id}:`, userError);
        summaries.push({
          id: user.id,
          email: user.email,
          role: user.role || 'customer',
          created_at: user.created_at,
          connections: { facebook: false, instagram: false },
          voiceflow: false,
          webhook: false,
          conversationCount: 0,
          messageCount: 0
        });
      }
    }
    return summaries;
  } catch (error) {
    console.error('Error getting user summaries:', error);
    return [];
  }
}

export async function updateUserRole(userId: string, role: string) {
  try {
    if (!userId) throw new Error('User ID is required');
    if (!role) throw new Error('Role is required');
    const { error: updateError } = await supabase.from('users').update({ role }).eq('id', userId);
    if (updateError) throw updateError;
    return { id: userId, role };
  } catch (error) {
    console.error(`Error updating user role for ${userId}:`, error);
    throw error;
  }
}
