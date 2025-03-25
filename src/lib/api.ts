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
    const { data, error } = await supabase
      .from('social_connections')
      .select('*');

    if (error) throw error;
    return data as SocialConnection[];
  } catch (error) {
    console.error("Error fetching social connections:", error);
    return [];
  }
}

export async function getSocialConnectionsByUserId(userId: string) {
  try {
    let query = supabase
      .from('social_connections')
      .select('*');
      
    // Only filter by user_id if it's provided
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
    if (!connection.user_id) {
      throw new Error('User ID is required to create a social connection');
    }
    
    const { data, error } = await supabase
      .from('social_connections')
      .insert([{
        user_id: connection.user_id,
        fb_page_id: connection.fb_page_id,
        ig_account_id: connection.ig_account_id,
        access_token: connection.access_token,
        token_expiry: connection.token_expiry
      }])
      .select();

    if (error) throw error;
    return data[0] as SocialConnection;
  } catch (error) {
    console.error("Error creating social connection:", error);
    throw error;
  }
}

export async function refreshSocialConnectionToken(connectionId: string, newExpiryDate: string) {
  try {
    if (!connectionId) {
      throw new Error('Connection ID is required to refresh token');
    }
    
    const { data, error } = await supabase
      .from('social_connections')
      .update({
        token_expiry: newExpiryDate,
        refreshed_at: new Date().toISOString()
      })
      .eq('id', connectionId)
      .select();

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
    
    const { data, error } = await supabase
      .from('social_connections')
      .select('*')
      .eq('user_id', userId)
      .not('refreshed_at', 'is', null);

    if (error) throw error;
    if (!data) return [];

    // Convert social connections with refresh history to TokenRefreshHistory objects
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
    const { data, error } = await supabase
      .from('voiceflow_mappings')
      .select('*');

    if (error) throw error;
    return data as VoiceflowMapping[];
  } catch (error) {
    console.error("Error fetching Voiceflow mappings:", error);
    return [];
  }
}

export async function getVoiceflowMappingByUserId(userId: string) {
  try {
    let query = supabase
      .from('voiceflow_mappings')
      .select('*');
      
    // Only filter by user_id if it's provided  
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query.maybeSingle();

    if (error) throw error;
    return data as VoiceflowMapping | null;
  } catch (error) {
    console.error(`Error fetching Voiceflow mapping for user ${userId}:`, error);
    throw error;
  }
}

// Voiceflow API keys (admin only)
export async function getVoiceflowApiKeys() {
  try {
    const { data, error } = await supabase
      .from('voiceflow_api_keys')
      .select('*');

    if (error) throw error;
    return data as VoiceflowApiKey[];
  } catch (error) {
    console.error("Error fetching Voiceflow API keys:", error);
    return [];
  }
}

export async function getVoiceflowApiKeyByUserId(userId: string) {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const { data, error } = await supabase
      .from('voiceflow_api_keys')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data as VoiceflowApiKey | null;
  } catch (error) {
    console.error(`Error fetching Voiceflow API key for user ${userId}:`, error);
    throw error;
  }
}

export async function createVoiceflowApiKey(apiKey: Omit<VoiceflowApiKey, 'id' | 'created_at' | 'updated_at'>) {
  try {
    if (!apiKey.user_id || !apiKey.api_key) {
      throw new Error('User ID and API key are required');
    }

    // First check if a key already exists for this user
    const existingKey = await getVoiceflowApiKeyByUserId(apiKey.user_id);
    
    if (existingKey) {
      // Update existing key
      return await updateVoiceflowApiKey(existingKey.id, { api_key: apiKey.api_key });
    }
    
    // Create new key
    const { data, error } = await supabase
      .from('voiceflow_api_keys')
      .insert([{
        user_id: apiKey.user_id,
        api_key: apiKey.api_key
      }])
      .select();

    if (error) throw error;
    return data[0] as VoiceflowApiKey;
  } catch (error) {
    console.error("Error creating/updating Voiceflow API key:", error);
    throw error;
  }
}

export async function updateVoiceflowApiKey(id: string, apiKey: Partial<VoiceflowApiKey>) {
  try {
    if (!id) {
      throw new Error('API key ID is required to update');
    }
    
    const updatedData = {
      ...apiKey,
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('voiceflow_api_keys')
      .update(updatedData)
      .eq('id', id)
      .select();

    if (error) throw error;
    return data[0] as VoiceflowApiKey;
  } catch (error) {
    console.error(`Error updating Voiceflow API key ${id}:`, error);
    throw error;
  }
}

export async function createVoiceflowMapping(mapping: Omit<VoiceflowMapping, 'id' | 'created_at'>) {
  try {
    if (!mapping.user_id || !mapping.vf_project_id) {
      throw new Error('User ID and Voiceflow project ID are required');
    }
    
    // First check if a mapping already exists for this user
    const existingMapping = await getVoiceflowMappingByUserId(mapping.user_id);
    
    if (existingMapping) {
      // Update existing mapping
      return await updateVoiceflowMapping(existingMapping.id, {
        vf_project_id: mapping.vf_project_id,
        flowbridge_config: mapping.flowbridge_config
      });
    }
    
    // Create new mapping
    const { data, error } = await supabase
      .from('voiceflow_mappings')
      .insert([{
        user_id: mapping.user_id,
        vf_project_id: mapping.vf_project_id,
        flowbridge_config: mapping.flowbridge_config || {}
      }])
      .select();

    if (error) throw error;
    return data[0] as VoiceflowMapping;
  } catch (error) {
    console.error("Error creating/updating Voiceflow mapping:", error);
    throw error;
  }
}

export async function updateVoiceflowMapping(id: string, mapping: Partial<VoiceflowMapping>) {
  try {
    if (!id) {
      throw new Error('Mapping ID is required to update');
    }
    
    const { data, error } = await supabase
      .from('voiceflow_mappings')
      .update(mapping)
      .eq('id', id)
      .select();

    if (error) throw error;
    return data[0] as VoiceflowMapping;
  } catch (error) {
    console.error(`Error updating Voiceflow mapping ${id}:`, error);
    throw error;
  }
}

// Webhook configs
export async function getWebhookConfigs() {
  try {
    const { data, error } = await supabase
      .from('webhook_configs')
      .select('*');

    if (error) throw error;
    return data as WebhookConfig[];
  } catch (error) {
    console.error("Error fetching webhook configs:", error);
    return [];
  }
}

export async function getWebhookConfigByUserId(userId: string, platform?: 'all' | 'facebook' | 'instagram') {
  try {
    let query = supabase
      .from('webhook_configs')
      .select('*');
      
    // Only filter by user_id if it's provided
    if (userId) {
      query = query.eq('user_id', userId);
    }
      
    if (platform) {
      query = query.eq('platform', platform);
    }
    
    const { data, error } = await query.maybeSingle();

    if (error) throw error;
    return data as WebhookConfig | null;
  } catch (error) {
    console.error(`Error fetching webhook config for user ${userId}:`, error);
    throw error;
  }
}

export async function getWebhookConfigsByUserId(userId: string) {
  try {
    let query = supabase
      .from('webhook_configs')
      .select('*');
      
    // Only filter by user_id if it's provided
    if (userId) {
      query = query.eq('user_id', userId);
    }

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
    if (!config.user_id) {
      throw new Error('User ID is required to create a webhook config');
    }
    
    const { data, error } = await supabase
      .from('webhook_configs')
      .insert([{
        user_id: config.user_id,
        webhook_url: config.webhook_url,
        verification_token: config.verification_token,
        is_active: config.is_active !== undefined ? config.is_active : false,
        platform: config.platform || 'all',
        webhook_name: config.webhook_name,
        generated_url: config.generated_url
      }])
      .select();

    if (error) throw error;
    return data[0] as WebhookConfig;
  } catch (error) {
    console.error("Error creating webhook config:", error);
    throw error;
  }
}

export async function updateWebhookConfig(id: string, config: Partial<WebhookConfig>) {
  try {
    if (!id) {
      throw new Error('Webhook config ID is required to update');
    }
    
    const updateData = {
      ...config,
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('webhook_configs')
      .update(updateData)
      .eq('id', id)
      .select();

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
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        messages:messages(
          content,
          sender_type,
          sent_at
        )
      `)
      .order('last_message_at', { ascending: false })
      .limit(1, { foreignTable: 'messages' });

    if (error) throw error;
    if (!data) return [];
    
    // Transform the data to include the latest message
    return data.map(conv => ({
      ...conv,
      latest_message: conv.messages && conv.messages.length > 0 ? conv.messages[0] : null,
      // Remove the messages array from the conversation object
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
    
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        messages:messages(
          content,
          sender_type,
          sent_at
        )
      `)
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false })
      .limit(1, { foreignTable: 'messages' });

    if (error) throw error;
    if (!data) return [];
    
    // Transform the data to include the latest message
    return data.map(conv => ({
      ...conv,
      latest_message: conv.messages && conv.messages.length > 0 ? conv.messages[0] : null,
      // Remove the messages array from the conversation object
      messages: undefined
    })) as Conversation[];
  } catch (error) {
    console.error(`Error fetching conversations for user ${userId}:`, error);
    return [];
  }
}

export async function getConversation(id: string) {
  try {
    if (!id) {
      throw new Error('Conversation ID is required');
    }
    
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Conversation;
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
    
    const { data, error } = await supabase
      .from('conversations')
      .insert([{
        user_id: conversation.user_id,
        platform: conversation.platform,
        external_id: conversation.external_id,
        participant_id: conversation.participant_id,
        participant_name: conversation.participant_name,
        last_message_at: conversation.last_message_at || new Date().toISOString()
      }])
      .select();

    if (error) throw error;
    return data[0] as Conversation;
  } catch (error) {
    console.error("Error creating conversation:", error);
    throw error;
  }
}

export async function updateConversation(id: string, updates: Partial<Conversation>) {
  try {
    if (!id) {
      throw new Error('Conversation ID is required for update');
    }
    
    const { data, error } = await supabase
      .from('conversations')
      .update(updates)
      .eq('id', id)
      .select();

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
    
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('sent_at', { ascending: true });

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
    
    const { data, error } = await supabase
      .from('messages')
      .insert([{
        conversation_id: message.conversation_id,
        content: message.content,
        sender_type: message.sender_type,
        external_id: message.external_id,
        sent_at: message.sent_at || new Date().toISOString()
      }])
      .select();

    if (error) throw error;
    
    // Update the conversation's last_message_at timestamp
    try {
      await supabase
        .from('conversations')
        .update({ last_message_at: message.sent_at || new Date().toISOString() })
        .eq('id', message.conversation_id);
    } catch (updateError) {
      console.error(`Error updating conversation timestamp for ${message.conversation_id}:`, updateError);
      // Continue even if this fails
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
    resetDate.setDate(resetDate.getDate() + 1); // Reset at midnight
    
    // Check if we already have a rate limit record for today
    const { data: existingData, error: checkError } = await supabase
      .from('api_rate_limits')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', platform)
      .eq('endpoint', endpoint)
      .gte('reset_at', today.toISOString())
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" error, which is expected
      throw checkError;
    }
      
    if (existingData) {
      // Update existing record
      const { data, error } = await supabase
        .from('api_rate_limits')
        .update({
          calls_made: existingData.calls_made + 1
        })
        .eq('id', existingData.id)
        .select();
        
      if (error) throw error;
      return data[0] as ApiRateLimit;
    } else {
      // Create new record
      const { data, error } = await supabase
        .from('api_rate_limits')
        .insert([{
          user_id: userId,
          platform,
          endpoint,
          calls_made: 1,
          reset_at: resetDate.toISOString()
        }])
        .select();
        
      if (error) throw error;
      return data[0] as ApiRateLimit;
    }
  } catch (error) {
    console.error(`Error tracking API call for ${userId}/${platform}/${endpoint}:`, error);
    // Don't throw, just report the error and return null
    return null;
  }
}

export async function checkRateLimit(userId: string, platform: string, endpoint: string, limit: number) {
  try {
    if (!userId || !platform || !endpoint) {
      console.warn('Missing required parameters for rate limit check');
      return true; // Allow the request if we can't check properly
    }
    
    const today = new Date();
    
    // Get current rate limit usage
    const { data, error } = await supabase
      .from('api_rate_limits')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', platform)
      .eq('endpoint', endpoint)
      .gte('reset_at', today.toISOString())
      .single();
      
    if (error && error.code !== 'PGRST116') { // PGRST116 is not found error
      throw error;
    }
    
    // If no data or calls_made < limit, we're good
    if (!data || data.calls_made < limit) {
      return true;
    }
    
    // We've hit the limit
    return false;
  } catch (error) {
    console.error(`Error checking rate limit for ${userId}/${platform}/${endpoint}:`, error);
    return true; // Allow the request if the check fails
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
    
    // First get all conversations for the user
    const { data: conversations, error: conversationsError } = await supabase
      .from('conversations')
      .select('id, platform')
      .eq('user_id', userId);
      
    if (conversationsError) throw conversationsError;
    if (!conversations || conversations.length === 0) {
      // No conversations found, return empty data
      return createEmptyAnalytics(daysBack);
    }
    
    // Extract conversation IDs
    const conversationIds = conversations.map(c => c.id);
    
    // Now query messages for these conversations
    const { data, error } = await supabase
      .from('messages')
      .select(`
        id,
        sent_at,
        sender_type,
        conversation_id
      `)
      .in('conversation_id', conversationIds)
      .gte('sent_at', startDate.toISOString());
      
    if (error) throw error;
    
    // Create a map of conversation id to platform
    const platformMap = conversations.reduce((map, conv) => {
      map[conv.id] = conv.platform;
      return map;
    }, {} as Record<string, string>);
    
    // Process data to get counts by day and platform
    const messagesByDay = initializeMessagesByDay(daysBack);
    
    // Fill in the data
    if (data && data.length > 0) {
      data.forEach(message => {
        const day = new Date(message.sent_at).toLocaleDateString();
        if (messagesByDay[day]) {
          messagesByDay[day].total += 1;
          
          // Count by platform
          const platform = platformMap[message.conversation_id];
          if (platform === 'facebook') {
            messagesByDay[day].facebook += 1;
          } else if (platform === 'instagram') {
            messagesByDay[day].instagram += 1;
          }
          
          // Count by sender type
          if (message.sender_type === 'user') {
            messagesByDay[day].user += 1;
          } else if (message.sender_type === 'assistant') {
            messagesByDay[day].assistant += 1;
          }
        }
      });
    }
    
    // Format the result
    return formatMessageAnalytics(messagesByDay);
  } catch (error) {
    console.error('Error in getMessageAnalytics:', error);
    // Return empty data on error
    return createEmptyAnalytics(daysBack);
  }
}

// Helper function to initialize message counts by day
function initializeMessagesByDay(daysBack: number) {
  const messagesByDay: Record<string, { 
    total: number, 
    facebook: number, 
    instagram: number, 
    user: number, 
    assistant: number 
  }> = {};
  
  for (let i = 0; i < daysBack; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const day = date.toLocaleDateString();
    
    messagesByDay[day] = {
      total: 0,
      facebook: 0,
      instagram: 0,
      user: 0,
      assistant: 0
    };
  }
  
  return messagesByDay;
}

// Helper function to create empty analytics data
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
  
  // Sort by date (oldest to newest)
  return result.sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });
}

// Helper function to format message analytics
function formatMessageAnalytics(messagesByDay: Record<string, any>): MessageAnalytics[] {
  const result: MessageAnalytics[] = [];
  const days = Object.keys(messagesByDay).sort((a, b) => {
    return new Date(a).getTime() - new Date(b).getTime();
  });
  
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
    
    // First get all conversations for the user
    const { data: conversations, error: conversationsError } = await supabase
      .from('conversations')
      .select('id, platform')
      .eq('user_id', userId);
      
    if (conversationsError) throw conversationsError;
    if (!conversations || conversations.length === 0) {
      // No conversations, return empty stats
      return {
        messageCount: 0,
        conversationCount: 0,
        responseTime: 0,
        successRate: 0,
        facebookPercentage: 0,
        instagramPercentage: 0
      };
    }
    
    // Extract conversation IDs
    const conversationIds = conversations.map(c => c.id);
    
    // Get total message count
    const { count: messageCount, error: countError } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .in('conversation_id', conversationIds);
      
    if (countError) throw countError;
    
    // Get conversation count (we already have it from the conversations query)
    const conversationCount = conversations.length;
    
    // Get all messages for the conversations for response time calculation
    const { data: allMessages, error: messagesError } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_type, sent_at')
      .in('conversation_id', conversationIds)
      .order('sent_at', { ascending: true });
      
    if (messagesError) throw messagesError;
    
    // Calculate average response time and success rate
    const { avgResponseTime, successRate } = calculateResponseMetrics(allMessages, conversationIds);
    
    // Calculate platform distribution
    const { facebookPercentage, instagramPercentage } = calculatePlatformDistribution(conversations);
    
    return {
      messageCount: messageCount || 0,
      conversationCount: conversationCount || 0,
      responseTime: avgResponseTime,
      successRate: successRate,
      facebookPercentage,
      instagramPercentage
    };
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    // Return default values if there's an error
    return {
      messageCount: 0,
      conversationCount: 0,
      responseTime: 0,
      successRate: 0,
      facebookPercentage: 0,
      instagramPercentage: 0
    };
  }
}

// Helper function to calculate response time and success rate
function calculateResponseMetrics(messages: any[] | null, conversationIds: string[]) {
  // Default values
  let avgResponseTime = 0;
  let successRate = 100;
  
  if (!messages || messages.length === 0) {
    return { avgResponseTime, successRate };
  }
  
  // Group messages by conversation
  const messagesByConversation: Record<string, any[]> = {};
  conversationIds.forEach(id => { messagesByConversation[id] = []; });
  
  messages.forEach(message => {
    if (messagesByConversation[message.conversation_id]) {
      messagesByConversation[message.conversation_id].push(message);
    }
  });
  
  // Calculate response times
  let totalResponseTime = 0;
  let responseCount = 0;
  
  // Track user messages and responses for success rate
  let userMessageCount = 0;
  let respondedUserMessageCount = 0;
  
  // Process each conversation
  Object.values(messagesByConversation).forEach(conversationMessages => {
    if (conversationMessages.length < 2) return;
    
    // Calculate response times and track responses
    for (let i = 1; i < conversationMessages.length; i++) {
      const prevMessage = conversationMessages[i-1];
      const currMessage = conversationMessages[i];
      
      // If previous is user and current is assistant, calculate response time
      if (prevMessage.sender_type === 'user' && currMessage.sender_type === 'assistant') {
        const prevTime = new Date(prevMessage.sent_at).getTime();
        const currTime = new Date(currMessage.sent_at).getTime();
        const responseTime = (currTime - prevTime) / 1000; // in seconds
        
        // Only count reasonable response times (< 5 minutes)
        if (responseTime > 0 && responseTime < 300) {
          totalResponseTime += responseTime;
          responseCount++;
        }
        
        respondedUserMessageCount++;
      }
      
      // Count user messages
      if (prevMessage.sender_type === 'user') {
        userMessageCount++;
      }
    }
    
    // Count the last message if it's from a user
    const lastMessage = conversationMessages[conversationMessages.length - 1];
    if (lastMessage.sender_type === 'user') {
      userMessageCount++;
    }
  });
  
  // Calculate average response time
  if (responseCount > 0) {
    avgResponseTime = totalResponseTime / responseCount;
  }
  
  // Calculate success rate
  if (userMessageCount > 0) {
    successRate = (respondedUserMessageCount / userMessageCount) * 100;
  }
  
  return { avgResponseTime, successRate };
}

// Helper function to calculate platform distribution
function calculatePlatformDistribution(conversations: any[] | null) {
  if (!conversations || conversations.length === 0) {
    return { facebookPercentage: 0, instagramPercentage: 0 };
  }
  
  const facebookCount = conversations.filter(c => c.platform === 'facebook').length;
  const instagramCount = conversations.filter(c => c.platform === 'instagram').length;
  
  const totalPlatformCount = facebookCount + instagramCount;
  const facebookPercentage = totalPlatformCount > 0 ? (facebookCount / totalPlatformCount) * 100 : 0;
  const instagramPercentage = totalPlatformCount > 0 ? (instagramCount / totalPlatformCount) * 100 : 0;
  
  return { facebookPercentage, instagramPercentage };
}

// Get recent conversations
export async function getRecentConversations(userId: string, limit = 5) {
  try {
    if (!userId) {
      console.warn('No user ID provided for recent conversations');
      return [];
    }
    
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        messages:messages(
          content,
          sender_type,
          sent_at
        )
      `)
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false })
      .limit(limit)
      .limit(1, { foreignTable: 'messages' });

    if (error) throw error;
    if (!data || data.length === 0) return [];
    
    // Transform the data to include the latest message
    return data.map(conv => ({
      ...conv,
      latest_message: conv.messages && conv.messages.length > 0 ? conv.messages[0] : null,
      // Remove the messages array from the conversation object
      messages: undefined
    })) as Conversation[];
  } catch (error) {
    console.error('Error getting recent conversations:', error);
    return [];
  }
}

// Get message volume by hour of day
export async function getMessageVolumeByHour(userId: string, daysBack = 7) {
  try {
    if (!userId) {
      console.warn('No user ID provided for message volume by hour');
      return createEmptyHourlyData();
    }
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    
    // First get all conversations for the user
    const { data: conversations, error: conversationsError } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId);
      
    if (conversationsError) throw conversationsError;
    if (!conversations || conversations.length === 0) {
      // No conversations, return empty data
      return createEmptyHourlyData();
    }
    
    // Extract conversation IDs
    const conversationIds = conversations.map(c => c.id);
    
    // Get all messages for these conversations
    const { data, error } = await supabase
      .from('messages')
      .select('sent_at')
      .in('conversation_id', conversationIds)
      .gte('sent_at', startDate.toISOString());
      
    if (error) throw error;
    
    // Initialize counts for each hour of the day (0-23)
    const hourCounts = Array(24).fill(0);
    
    // Count messages per hour
    if (data && data.length > 0) {
      data.forEach(message => {
        const hour = new Date(message.sent_at).getHours();
        hourCounts[hour]++;
      });
    }
    
    // Format the result for recharts
    return hourCounts.map((count, hour) => ({
      hour: hour,
      displayHour: `${hour}:00`,
      count: count
    }));
  } catch (error) {
    console.error('Error getting message volume by hour:', error);
    // Return empty data with zero counts for all hours
    return createEmptyHourlyData();
  }
}

// Helper function to create empty hourly data
function createEmptyHourlyData() {
  return Array(24).fill(0).map((_, hour) => ({
    hour: hour,
    displayHour: `${hour}:00`,
    count: 0
  }));
}

// Admin functions for user management
export async function getAllUsers() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting all users:', error);
    throw error;
  }
}

export async function getUserById(userId: string) {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`Error getting user by ID ${userId}:`, error);
    throw error;
  }
}

export async function getUserSummaries(): Promise<UserSummary[]> {
  try {
    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (usersError) throw usersError;
    if (!users || users.length === 0) return [];
    
    // Process each user to create a summary
    const summaries: UserSummary[] = [];
    
    for (const user of users) {
      try {
        // Get social connections
        const { data: connections } = await supabase
          .from('social_connections')
          .select('*')
          .eq('user_id', user.id);
          
        // Get voiceflow mapping
        const { data: voiceflow } = await supabase
          .from('voiceflow_mappings')
          .select('*')
          .eq('user_id', user.id);
          
        // Get webhook config
        const { data: webhook } = await supabase
          .from('webhook_configs')
          .select('*')
          .eq('user_id', user.id);
          
        // Get conversation count
        const { count: conversationCount } = await supabase
          .from('conversations')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id);
          
        // Get all conversations for this user
        const { data: conversations } = await supabase
          .from('conversations')
          .select('id')
          .eq('user_id', user.id);
        
        // Get message count if there are conversations
        let messageCount = 0;
        if (conversations && conversations.length > 0) {
          const conversationIds = conversations.map(c => c.id);
          const { count: msgCount } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .in('conversation_id', conversationIds);
          
          messageCount = msgCount || 0;
        }
          
        // Create summary
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
        // Add basic user info even if we can't get all their data
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
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    if (!role) {
      throw new Error('Role is required');
    }
    
    // Update role in public.users table
    const { error: updateError } = await supabase
      .from('users')
      .update({ role })
      .eq('id', userId);
      
    if (updateError) throw updateError;
    
    return { id: userId, role };
  } catch (error) {
    console.error(`Error updating user role for ${userId}:`, error);
    throw error;
  }
}
