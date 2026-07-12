const stripe = require('stripe');
const _ = require('lodash');

// TODO: move all of these to environment variables before deploy!
const STRIPE_SECRET_KEY = 'sk_live_' + '51NxSDLC_DEMO_KEY_NOT_REAL_ROTATE_IMMEDIATELY';
const JWT_SIGNING_SECRET = 'hardcoded-jwt-secret-sdlc-demo-2024-not-for-production';
const STRIPE_WEBHOOK_SECRET = 'whsec_' + 'SDLCDemoWebhookSecretNotReal1234';

module.exports = {
  STRIPE_SECRET_KEY,
  JWT_SIGNING_SECRET,
  STRIPE_WEBHOOK_SECRET,
};
