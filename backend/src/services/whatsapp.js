/**
 * WhatsApp messaging service with a pluggable provider.
 *
 * Choose the provider via WHATSAPP_PROVIDER:
 *   - stub    : logs only, no real send (default / for development)
 *   - meta    : Meta WhatsApp Cloud API (official)
 *   - twilio  : Twilio WhatsApp
 *
 * Every provider implements: sendIntroMessage({ to, leadName }) -> { id }
 *
 * The "intro" message is the one-time message sent automatically on a lead's
 * 2nd follow-up: a Nexton Lubricants heading, a catalogue link, and a product
 * photo. With Meta/Twilio the exact formatting depends on an approved template.
 */

const CATALOGUE_URL =
  process.env.WHATSAPP_CATALOGUE_URL || 'https://nexton.example.com/catalogue';
const PRODUCT_IMAGE_URL =
  process.env.WHATSAPP_PRODUCT_IMAGE_URL ||
  'https://nexton.example.com/product.jpg';

function buildIntroText(leadName) {
  const hi = leadName ? `Hello ${leadName},` : 'Hello,';
  return (
    `*Nexton Lubricants*\n\n` +
    `${hi}\n` +
    `Thank you for your interest. Here is our product catalogue:\n` +
    `${CATALOGUE_URL}\n\n` +
    `We look forward to working with you.`
  );
}

// --- stub provider -------------------------------------------------
async function stubSend({ to, leadName }) {
  // eslint-disable-next-line no-console
  console.log(
    `[whatsapp:stub] -> ${to}\n${buildIntroText(leadName)}\nimage: ${PRODUCT_IMAGE_URL}`
  );
  return { id: `stub-${to}-${Date.now()}` };
}

// --- Meta WhatsApp Cloud API --------------------------------------
async function metaSend({ to }) {
  const phoneId = process.env.META_WA_PHONE_NUMBER_ID;
  const token = process.env.META_WA_ACCESS_TOKEN;
  const template = process.env.META_WA_TEMPLATE_NAME || 'nexton_intro';
  if (!phoneId || !token) {
    throw new Error('META_WA_PHONE_NUMBER_ID / META_WA_ACCESS_TOKEN not set');
  }

  // Sends an approved template. The template should contain the heading,
  // the catalogue link, and a header image (product photo) configured in the
  // Meta Business Manager. Adjust components to match your template.
  const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    to: String(to).replace(/[^\d]/g, ''),
    type: 'template',
    template: {
      name: template,
      language: { code: 'en' },
      components: [
        {
          type: 'header',
          parameters: [{ type: 'image', image: { link: PRODUCT_IMAGE_URL } }],
        },
        {
          type: 'body',
          parameters: [{ type: 'text', text: CATALOGUE_URL }],
        },
      ],
    },
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(
      `Meta WhatsApp send failed: ${data.error?.message || resp.status}`
    );
  }
  return { id: data.messages?.[0]?.id || 'meta-unknown' };
}

// --- Twilio WhatsApp ----------------------------------------------
async function twilioSend({ to, leadName }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !auth || !from) {
    throw new Error('TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM not set');
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const params = new URLSearchParams({
    From: from,
    To: `whatsapp:${String(to).startsWith('+') ? to : '+' + to}`,
    Body: buildIntroText(leadName),
    MediaUrl: PRODUCT_IMAGE_URL,
  });
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sid}:${auth}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`Twilio WhatsApp send failed: ${data.message || resp.status}`);
  }
  return { id: data.sid };
}

const PROVIDERS = { stub: stubSend, meta: metaSend, twilio: twilioSend };

async function sendIntroMessage({ to, leadName }) {
  const provider = (process.env.WHATSAPP_PROVIDER || 'stub').toLowerCase();
  const fn = PROVIDERS[provider] || stubSend;
  return fn({ to, leadName });
}

module.exports = { sendIntroMessage, buildIntroText };
