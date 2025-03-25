// netlify/functions/meta-webhook-verification.js

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client for verification if needed
let supabase = null;
try {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  if (supabaseUrl && supabaseServiceKey) {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log("Supabase client initialized successfully in verification");
  } else {
    console.warn(`Missing Supabase credentials. URL: ${supabaseUrl ? 'Present' : 'Missing'}, Service Key: ${supabaseServiceKey ? 'Present' : 'Missing'}`);
  }
} catch (error) {
  console.error('Error initializing Supabase client:', error);
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed. Please use GET for webhook verification.' })
    };
  }

  try {
    const params = event.queryStringParameters || {};
    const mode = params['hub.mode'];
    const token = params['hub.verify_token'];
    const challenge = params['hub.challenge'];

    console.log('Verification request received:', {
      path: event.path,
      mode,
      token: token ? '[REDACTED]' : 'undefined',
      challenge: challenge || 'undefined',
      queryParams: params
    });

    if (mode !== 'subscribe') {
      console.log('Invalid hub.mode parameter:', mode);
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid hub.mode parameter. Expected "subscribe".' }) };
    }
    if (!token) {
      console.log('Missing hub.verify_token parameter');
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing hub.verify_token parameter.' }) };
    }

    // Extract userId and platform from the path if available
    const pathSegments = event.path.split('/');
    let userId = null;
    let platform = 'all';
    if (pathSegments.length >= 5 && pathSegments[2] === 'webhooks') {
      userId = pathSegments[3];
      platform = pathSegments[4];
      console.log(`Extracted userId: ${userId}, platform: ${platform}`);
    }

    // ---------- Known token fallback
    // const knownTokens = [
    //   '14abae006d729dbc83ca136af12bbbe1d9480eff'
    // ];
    // if (knownTokens.includes(token)) {
    //   console.log('Verification successful using known token');
    //   return {
    //     statusCode: 200,
    //     headers: { ...headers, 'Content-Type': 'text/plain' },
    //     body: challenge
    //   };
    // }

    // Query Supabase for a matching token
    if (supabase) {
      let query = supabase.from('webhook_configs').select('*').eq('verification_token', token);
      if (userId) {
        query = query.eq('user_id', userId);
        console.log(`Filtering by user_id: ${userId}`);
      }
      if (platform && platform !== 'all') {
        query = query.eq('platform', platform);
        console.log(`Filtering by platform: ${platform}`);
      }
      const { data: webhookConfigs, error } = await query;
      if (error) {
        console.error('Error querying webhook configurations:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error verifying webhook token.' }) };
      }
      if (webhookConfigs && webhookConfigs.length > 0) {
        console.log(`Verification successful for webhook configuration ID: ${webhookConfigs[0].id}`);
        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'text/plain' },
          body: challenge
        };
      }
    }

    console.log('No matching verification token found');
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid verification token.' }) };

  } catch (error) {
    console.error('Error in webhook verification:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error during webhook verification.' }) };
  }
};
