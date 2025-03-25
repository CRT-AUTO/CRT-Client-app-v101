// netlify/functions/webhook-security.js

const crypto = require('crypto');

function verifySignatureSHA1(signature, body, appSecret) {
  if (!signature || !body || !appSecret) return false;
  try {
    const signatureParts = signature.split('=');
    if (signatureParts.length !== 2 || signatureParts[0] !== 'sha1') return false;
    const providedSignature = signatureParts[1];
    const hmac = crypto.createHmac('sha1', appSecret);
    hmac.update(body, 'utf-8');
    const expectedSignature = hmac.digest('hex');
    return crypto.timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature));
  } catch (error) {
    console.error('Error verifying SHA1 signature:', error);
    return false;
  }
}

function verifySignatureSHA256(signature, body, appSecret) {
  if (!signature || !body || !appSecret) return false;
  try {
    const signatureParts = signature.split('=');
    if (signatureParts.length !== 2 || signatureParts[0] !== 'sha256') return false;
    const providedSignature = signatureParts[1];
    const hmac = crypto.createHmac('sha256', appSecret);
    hmac.update(body, 'utf-8');
    const expectedSignature = hmac.digest('hex');
    return crypto.timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature));
  } catch (error) {
    console.error('Error verifying SHA256 signature:', error);
    return false;
  }
}

function validateWebhook(headers, body, appSecret) {
  if (!headers || !body || !appSecret) {
    return { valid: false, message: 'Missing required validation parameters' };
  }
  const sha1Signature = headers['x-hub-signature'] || headers['X-Hub-Signature'];
  const sha256Signature = headers['x-hub-signature-256'] || headers['X-Hub-Signature-256'];
  if (!sha1Signature && !sha256Signature) {
    return { valid: false, message: 'No signature headers found' };
  }
  let isValid = false;
  let method = '';
  if (sha256Signature) {
    isValid = verifySignatureSHA256(sha256Signature, body, appSecret);
    method = 'SHA-256';
  }
  if (!isValid && sha1Signature) {
    isValid = verifySignatureSHA1(sha1Signature, body, appSecret);
    method = 'SHA-1';
  }
  if (isValid) {
    return { valid: true, method, message: `Successfully validated webhook signature using ${method}` };
  } else {
    return { valid: false, method: method || 'None', message: `Invalid webhook signature${method ? ` (${method})` : ''}` };
  }
}

module.exports = {
  verifySignatureSHA1,
  verifySignatureSHA256,
  validateWebhook
};
