// netlify/functions/process-message-queue.js

const { processPendingMessages } = require('./message-queue');
// Import processMessage from meta-webhook-handler (ensure it is exported)
const { processMessage } = require('./meta-webhook-handler');

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
    console.log('Starting message queue processing');
    const batchSize = event.queryStringParameters?.batchSize 
      ? parseInt(event.queryStringParameters.batchSize, 10) 
      : 5;
    const result = await processPendingMessages(processMessage, batchSize);
    console.log(`Processed ${result.processed} messages from the queue`);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ status: 'success', processed: result.processed, results: result.results })
    };
  } catch (error) {
    console.error('Error processing message queue:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ status: 'error', message: 'Error processing message queue', error: error.message })
    };
  }
};
