// Time-based OTP (TOTP) — the free, no-SMS, no-account 2FA that works with any
// authenticator app (Google Authenticator, Authy, Microsoft Authenticator).
const { authenticator } = require('otplib');

// Allow ±1 time-step (30s) so a slightly off phone clock still verifies.
authenticator.options = { window: 1 };

function generateSecret() {
  return authenticator.generateSecret();
}

// The otpauth:// URI that becomes the QR the user scans.
function otpauthURL(email, secret) {
  return authenticator.keyuri(email || 'user', 'Nexton CRM', secret);
}

function verifyToken(secret, token) {
  if (!secret || !token) return false;
  try {
    return authenticator.verify({ token: String(token).replace(/\s/g, ''), secret });
  } catch {
    return false;
  }
}

module.exports = { generateSecret, otpauthURL, verifyToken };
