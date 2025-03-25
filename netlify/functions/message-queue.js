// netlify/functions/message-queue.js

const { createClient } = require('@supabase/supabase-js');
const { retryWithBackoff, isTransientError } = require('./error-recovery');

let supabase = null;
try {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  if (supabaseUrl && supabaseServiceKey) {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log("Supabase client initialized successfully in message queue");
  } else {
    console.warn(`Missing Supabase credentials in message-queue.js. URL: ${supabaseUrl ? 'Present' : 'Missing'}, Service Key: ${supabaseServiceKey ? 'Present' : 'Missing'}`);
  }
} catch (error) {
  console.error('Error initializing Supabase client in message-queue.js:', error);
}

async function queueMessage(userId, platform, senderId, recipientId, messageContent, timestamp) {
  try {
    if (!supabase) throw new Error('Database connection not available');
    const { data, error } = await supabase
      .from('message_queue')
      .insert([{
        user_id: userId,
        platform,
        sender_id: senderId,
        recipient_id: recipientId,
        message_content: messageContent,
        timestamp: new Date(timestamp).toISOString(),
        status: 'pending'
      }])
      .select();
    if (error) throw error;
    await supabase
      .from('message_processing_status')
      .insert([{
        message_queue_id: data[0].id,
        stage: 'received',
        status: 'completed',
        metadata: { received_at: new Date().toISOString() }
      }]);
    console.log(`Message queued with ID: ${data[0].id}`);
    return data[0];
  } catch (error) {
    console.error('Error queueing message:', error);
    throw error;
  }
}

async function updateProcessingStatus(messageQueueId, stage, status, errorMsg = null, metadata = {}) {
  try {
    if (!supabase) throw new Error('Database connection not available');
    const { data, error } = await supabase
      .from('message_processing_status')
      .insert([{
        message_queue_id: messageQueueId,
        stage,
        status,
        error: errorMsg,
        metadata,
        updated_at: new Date().toISOString()
      }])
      .select();
    if (error) throw error;
    if (status === 'failed') {
      await supabase
        .from('message_queue')
        .update({ status: 'failed', error: `Failed at stage: ${stage} - ${errorMsg}` })
        .eq('id', messageQueueId);
    } else if (stage === 'response_sent' && status === 'completed') {
      await supabase
        .from('message_queue')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', messageQueueId);
    }
    return data[0];
  } catch (error) {
    console.error('Error updating processing status:', error);
    throw error;
  }
}

async function getPendingMessages(limit = 10) {
  try {
    if (!supabase) {
      console.warn('Database connection not available, cannot get pending messages');
      return [];
    }
    const { data, error } = await supabase
      .from('message_queue')
      .select('*')
      .in('status', ['pending', 'failed'])
      .lt('retry_count', 3)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting pending messages:', error);
    throw error;
  }
}

async function markMessageAsProcessing(messageId) {
  try {
    if (!supabase) throw new Error('Database connection not available');
    const { data, error } = await supabase
      .from('message_queue')
      .update({ 
        status: 'processing',
        last_retry_at: new Date().toISOString(),
        retry_count: supabase.raw('retry_count + 1')
      })
      .eq('id', messageId)
      .select();
    if (error) throw error;
    return !!data;
  } catch (error) {
    console.error('Error marking message as processing:', error);
    throw error;
  }
}

async function processQueuedMessage(messageId, processorFunction) {
  try {
    if (!supabase) throw new Error('Database connection not available');
    await markMessageAsProcessing(messageId);
    const { data: message, error } = await supabase
      .from('message_queue')
      .select('*')
      .eq('id', messageId)
      .single();
    if (error) throw error;
    try {
      await updateProcessingStatus(messageId, 'processing_started', 'completed');
      const result = await processorFunction(
        message.user_id,
        message.platform,
        message.sender_id,
        message.recipient_id,
        message.message_content,
        message.timestamp
      );
      await updateProcessingStatus(messageId, 'response_sent', 'completed', null, { result });
      return { success: true, messageId, result };
    } catch (processingError) {
      await updateProcessingStatus(
        messageId,
        'processing_failed',
        'failed',
        processingError.message,
        { error: processingError.message, stack: processingError.stack }
      );
      if (isTransientError(processingError) && message.retry_count < 3) {
        await supabase
          .from('message_queue')
          .update({ status: 'pending' })
          .eq('id', messageId);
        return { success: false, transient: true, messageId, error: processingError.message };
      }
      await supabase
        .from('message_queue')
        .update({ status: 'failed', error: processingError.message })
        .eq('id', messageId);
      return { success: false, messageId, error: processingError.message };
    }
  } catch (error) {
    console.error('Error processing queued message:', error);
    throw error;
  }
}

async function processPendingMessages(processorFunction, batchSize = 5) {
  try {
    if (!supabase) {
      console.warn('Database connection not available, cannot process pending messages');
      return { processed: 0, results: [] };
    }
    const pendingMessages = await getPendingMessages(batchSize);
    if (pendingMessages.length === 0) {
      return { processed: 0, results: [] };
    }
    console.log(`Processing ${pendingMessages.length} pending messages`);
    const results = [];
    for (const message of pendingMessages) {
      try {
        const result = await processQueuedMessage(message.id, processorFunction);
        results.push(result);
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        results.push({ success: false, messageId: message.id, error: error.message });
      }
    }
    return { processed: results.length, results };
  } catch (error) {
    console.error('Error processing pending messages:', error);
    throw error;
  }
}

module.exports = {
  queueMessage,
  updateProcessingStatus,
  getPendingMessages,
  processQueuedMessage,
  processPendingMessages
};
