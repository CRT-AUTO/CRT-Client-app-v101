// netlify/functions/meta-data-deletion.js

function base64UrlDecode(input) {
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = input.length % 4;
  if (pad) {
    if (pad === 1) throw new Error('Invalid base64 string');
    input += new Array(5 - pad).join('=');
  }
  return Buffer.from(input, 'base64').toString('utf8');
}

function parseSignedRequest(signedRequest, secret) {
  const [encodedSignature, encodedPayload] = signedRequest.split('.');
  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  // In production, verify the signature using the secret
  return payload;
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  
  try {
    let params;
    if (event.body) {
      if (event.isBase64Encoded) {
        const buff = Buffer.from(event.body, 'base64');
        params = new URLSearchParams(buff.toString());
      } else {
        params = new URLSearchParams(event.body);
      }
    } else {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing request body' }) };
    }
    
    const signedRequest = params.get('signed_request');
    console.log('Received data deletion request. Body:', event.body);
    if (!signedRequest) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing signed_request parameter' }) };
    }
    
    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
      console.error('Missing META_APP_SECRET environment variable');
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) };
    }
    
    const data = parseSignedRequest(signedRequest, appSecret);
    const userId = data.user_id;
    if (!userId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid user data in the request' }) };
    }
    
    const confirmationCode = 'DEL' + Math.random().toString(36).substring(2, 10).toUpperCase();
    console.log(`Received data deletion request for user ID: ${userId}`);
    console.log(`Confirmation code: ${confirmationCode}`);
    
    await initiateDataDeletion(userId, confirmationCode);
    
    const baseUrl = process.env.URL || 'https://fantastic-gingersnap-f39ca5.netlify.app';
    const statusUrl = `${baseUrl}/deletion-status?code=${confirmationCode}`;
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: statusUrl, confirmation_code: confirmationCode })
    };
    
  } catch (error) {
    console.error('Error processing data deletion request:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};

async function initiateDataDeletion(userId, confirmationCode) {
  console.log(`Initiating data deletion for user ${userId} with confirmation code ${confirmationCode}`);
  // Implement actual deletion logic here.
  return true;
}
