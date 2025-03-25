// netlify/functions/error-recovery.js

async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 500,
    maxDelay = 10000,
    backoffFactor = 2,
    shouldRetry = () => true,
    onRetry = null
  } = options;
  
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = Math.min(
          maxDelay,
          initialDelay * Math.pow(backoffFactor, attempt - 1) * (0.8 + Math.random() * 0.4)
        );
        console.log(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms delay`);
        await new Promise(resolve => setTimeout(resolve, delay));
        if (onRetry) await onRetry(attempt, lastError);
      }
      return await fn();
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt + 1}/${maxRetries + 1} failed:`, error);
      if (attempt >= maxRetries || !shouldRetry(error, attempt)) {
        console.error('Max retries reached or should not retry. Giving up.');
        break;
      }
    }
  }
  throw lastError;
}

function isTransientError(error) {
  if (error.message?.includes('ECONNRESET') || 
      error.message?.includes('ETIMEDOUT') ||
      error.message?.includes('ENOTFOUND') ||
      error.message?.includes('network') ||
      error.code === 'ECONNABORTED') {
    return true;
  }
  if (error.response?.status === 429 || 
      error.response?.status === 503 ||
      error.response?.status === 504) {
    return true;
  }
  if (error.response?.status >= 500 && error.response?.status < 600) {
    return true;
  }
  if (error.message?.includes('Database connection') || error.message?.includes('not available')) {
    return true;
  }
  return false;
}

async function saveToDeadLetterQueue(userId, message, errorMessage, metadata = {}) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials for dead letter queue');
      return { success: false, error: 'Missing database credentials' };
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabase
      .from('message_dead_letters')
      .insert([{
        user_id,
        message_content: typeof message === 'string' ? message : JSON.stringify(message),
        error_message: errorMessage,
        metadata,
        failed_at: new Date().toISOString(),
        retry_count: 0,
        status: 'failed'
      }])
      .select();
    if (error) {
      console.error('Error saving to dead letter queue:', error);
      return { success: false, error };
    }
    return { success: true, deadLetterId: data[0].id };
  } catch (saveError) {
    console.error('Error in saveToDeadLetterQueue:', saveError);
    return { success: false, error: saveError };
  }
}

function processError(error, context = {}) {
  const errorInfo = {
    message: error.message,
    code: error.code,
    status: error.response?.status,
    data: error.response?.data,
    stack: error.stack,
    isTransient: isTransientError(error),
    context,
    timestamp: new Date().toISOString()
  };
  console.error('Processed error:', JSON.stringify(errorInfo, null, 2));
  return {
    error: true,
    message: error.message,
    isTransient: errorInfo.isTransient,
    code: error.code || error.response?.status || 'UNKNOWN_ERROR',
    timestamp: errorInfo.timestamp
  };
}

module.exports = {
  retryWithBackoff,
  isTransientError,
  saveToDeadLetterQueue,
  processError
};
