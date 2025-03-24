// This is a Netlify serverless function that handles Meta's webhook verification process
// When setting up webhooks, Meta will send a GET request to verify ownership

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = async (event, context) => {
  // Set CORS headers for all responses
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };
  
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers
    };
  }
  
  // Only accept GET requests for webhook verification
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed. Please use GET for webhook verification.' })
    };
  }
  
  try {
    // Extract verification parameters sent by Meta
    const params = event.queryStringParameters || {};
    const mode = params['hub.mode'];
    const token = params['hub.verify_token'];
    const challenge = params['hub.challenge'];
    
    // Path parameters can help identify which user and platform this is for
    const path = event.path;
    const pathSegments = path.split('/');
    
    // Log request details for debugging
    console.log('Webhook verification request received:', {
      path,
      mode,
      token: token ? '[REDACTED]' : 'undefined',
      challenge: challenge || 'undefined'
    });
    
    // Verification mode must be 'subscribe'
    if (mode !== 'subscribe') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid hub.mode parameter. Expected "subscribe".' })
      };
    }
    
    // Verify the token against stored tokens in the database
    if (!token) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing hub.verify_token parameter.' })
      };
    }
    
    // Extract user ID and platform from path if they exist
    // Expected format: /api/webhooks/{userId}/{platform}/{timestamp}
    let userId = null;
    let platform = 'all';
    
    if (pathSegments.length >= 5 && pathSegments[2] === 'webhooks') {
      userId = pathSegments[3];
      platform = pathSegments[4];
    }
    
    // Query webhook configurations to find a matching token
    let query = supabase.from('webhook_configs').select('*').eq('verification_token', token);
    
    // If we have user ID and platform, filter by those too
    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (platform && platform !== 'all') {
      query = query.eq('platform', platform);
    }
    
    const { data: webhookConfigs, error } = await query;
    
    if (error) {
      console.error('Error querying webhook configurations:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Error verifying webhook token.' })
      };
    }
    
    // If we found a matching webhook configuration, return the challenge
    if (webhookConfigs && webhookConfigs.length > 0) {
      console.log(`Verification successful for webhook configuration ID: ${webhookConfigs[0].id}`);
      
      // Return only the challenge value in the response
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'text/plain'
        },
        body: challenge
      };
    }
    
    // No matching token found
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Invalid verification token.' })
    };
    
  } catch (error) {
    console.error('Error in webhook verification:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error during webhook verification.' })
    };
  }
};