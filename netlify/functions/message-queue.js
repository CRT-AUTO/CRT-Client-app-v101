// This module provides a message queue system to ensure reliable message processing

const { createClient } = require('@supabase/supabase-js');
const { retryWithBackoff, isTransientError } = require('./error-recovery');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Add a message to the queue for processing
 * 
 * @param {string} userId User ID
 * @param {string} platform 'facebook' or 'instagram'
 * @param {string} senderId Sender's ID
 * @param {string} recipientId Recipient's ID
 * @param {Object} messageContent Message content object
 * @param {number|string} timestamp Message timestamp
 * @returns {Promise<Object>} The queued message
 */
async function queueMessage(userId, platform, senderId, recipientId, messageContent, timestamp) {
  try {
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
    
    // Create initial processing status entry
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

/**
 * Update the processing status of a message in the queue
 * 
 * @param {string} messageQueueId Message queue ID
 * @param {string} stage Processing stage
 * @param {string} status 'pending', 'completed', or 'failed'
 * @param {string} error Error message if status is 'failed'
 * @param {Object} metadata Additional metadata for this stage
 * @returns {Promise<Object>} Updated processing status
 */
async function updateProcessingStatus(messageQueueId, stage, status, error = null, metadata = {}) {
  try {
    const { data, error: statusError } = await supabase
      .from('message_processing_status')
      .insert([{
        message_queue_id: messageQueueId,
        stage,
        status,
        error,
        metadata,
        updated_at: new Date().toISOString()
      }])
      .select();
      
    if (statusError) throw statusError;
    
    // Update the overall message status if stage is failed or completed
    if (status === 'failed') {
      await supabase
        .from('message_queue')
        .update({ 
          status: 'failed', 
          error: `Failed at stage: ${stage} - ${error}`
        })
        .eq('id', messageQueueId);
    } else if (stage === 'response_sent' && status === 'completed') {
      await supabase
        .from('message_queue')
        .update({ 
          status: 'completed', 
          completed_at: new Date().toISOString()
        })
        .eq('id', messageQueueId);
    }
    
    return data[0];
  } catch (error) {
    console.error('Error updating processing status:', error);
    throw error;
  }
}

/**
 * Get pending messages from the queue for processing
 * 
 * @param {number} limit Maximum number of messages to get
 * @returns {Promise<Array>} Array of pending messages
 */
async function getPendingMessages(limit = 10) {
  try {
    const { data, error } = await supabase
      .from('message_queue')
      .select('*')
      .in('status', ['pending', 'failed'])
      .lt('retry_count', 3) // Don't get messages that have already been retried 3 times
      .order('created_at', { ascending: true })
      .limit(limit);
      
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting pending messages:', error);
    throw error;
  }
}

/**
 * Mark a message as being processed
 * 
 * @param {string} messageId Message ID
 * @returns {Promise<boolean>} Success flag
 */
async function markMessageAsProcessing(messageId) {
  try {
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

/**
 * Process a specific message from the queue
 * 
 * @param {string} messageId Message ID to process
 * @param {Function} processorFunction Function that processes the message
 * @returns {Promise<Object>} Processing result
 */
async function processQueuedMessage(messageId, processorFunction) {
  try {
    // Mark message as being processed
    await markMessageAsProcessing(messageId);
    
    // Get the message details
    const { data: message, error } = await supabase
      .from('message_queue')
      .select('*')
      .eq('id', messageId)
      .single();
      
    if (error) throw error;
    
    try {
      // Update status to show we're starting processing
      await updateProcessingStatus(messageId, 'processing_started', 'completed');
      
      // Process the message using the provided function
      const result = await processorFunction(
        message.user_id,
        message.platform,
        message.sender_id,
        message.recipient_id,
        message.message_content,
        message.timestamp
      );
      
      // Update final status
      await updateProcessingStatus(
        messageId, 
        'response_sent', 
        'completed',
        null,
        { result }
      );
      
      return { success: true, messageId, result };
    } catch (processingError) {
      // Update status to show processing failed
      await updateProcessingStatus(
        messageId,
        'processing_failed',
        'failed',
        processingError.message,
        { 
          error: processingError.message,
          stack: processingError.stack
        }
      );
      
      // If this is a transient error, don't mark the message as failed completely
      if (isTransientError(processingError) && message.retry_count < 3) {
        await supabase
          .from('message_queue')
          .update({ status: 'pending' })
          .eq('id', messageId);
          
        return { 
          success: false, 
          transient: true, 
          messageId, 
          error: processingError.message
        };
      }
      
      // Mark as failed permanently
      await supabase
        .from('message_queue')
        .update({ status: 'failed', error: processingError.message })
        .eq('id', messageId);
        
      return { 
        success: false, 
        messageId, 
        error: processingError.message
      };
    }
  } catch (error) {
    console.error('Error processing queued message:', error);
    throw error;
  }
}

/**
 * Process a batch of pending messages
 * 
 * @param {Function} processorFunction Function that processes each message
 * @param {number} batchSize Number of messages to process in one batch
 * @returns {Promise<Array>} Array of processing results
 */
async function processPendingMessages(processorFunction, batchSize = 5) {
  try {
    // Get pending messages
    const pendingMessages = await getPendingMessages(batchSize);
    
    if (pendingMessages.length === 0) {
      return { processed: 0, results: [] };
    }
    
    console.log(`Processing ${pendingMessages.length} pending messages`);
    
    // Process each message
    const results = [];
    for (const message of pendingMessages) {
      try {
        const result = await processQueuedMessage(message.id, processorFunction);
        results.push(result);
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        results.push({ 
          success: false, 
          messageId: message.id, 
          error: error.message
        });
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