// netlify/functions/cleanup-sessions.js

const { cleanupExpiredSessions } = require('./session-manager');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  try {
    console.log('Starting session cleanup');
    const cleanedCount = await cleanupExpiredSessions();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ status: 'success', message: `Cleaned up ${cleanedCount} expired sessions` })
    };
  } catch (error) {
    console.error('Error cleaning up sessions:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ status: 'error', message: 'Error cleaning up sessions', error: error.message })
    };
  }
};
