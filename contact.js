// Vercel serverless function (Node.js runtime).
// Runs server-side only — the Resend API key never reaches the browser.
//
// Flow: contact form (main.js) --POST JSON--> this function --> Resend API --> your inbox.
//
// Required environment variables (set in Vercel, see README-CONTACT-FORM.md):
//   RESEND_API_KEY    - secret API key from resend.com
//   CONTACT_TO_EMAIL   - where inquiries should land (your inbox)
//   CONTACT_FROM_EMAIL - the "from" address Resend sends as (must be on a
//                         domain you've verified in Resend)

const { Resend } = require('resend');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 200;
const MAX_EMAIL = 320;
const MAX_MESSAGE = 5000;
const MIN_FILL_MS = 1500; // real humans take at least this long to fill the form

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readJsonBody(req) {
  // Vercel usually parses JSON bodies automatically, but guard against a
  // raw string body just in case (e.g. different content-type on the way in).
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return {};
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  const body = readJsonBody(req);

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const inquiryType = typeof body.inquiry_type === 'string' ? body.inquiry_type.trim().slice(0, 100) : '';
  const honeypot = typeof body.company === 'string' ? body.company.trim() : '';
  const startedAt = Number(body.started_at) || 0;

  // --- Spam protection (no database, all stateless/computed per-request) ---
  // 1) Honeypot field: hidden from real visitors via CSS, bots often fill it.
  // 2) Timing trap: a submission that arrives faster than a human could type
  //    is almost certainly scripted.
  // Both cases return a "success" response so bots don't learn to route
  // around the check, without ever calling Resend.
  if (honeypot) {
    return res.status(200).json({ ok: true });
  }
  if (startedAt && Date.now() - startedAt < MIN_FILL_MS) {
    return res.status(200).json({ ok: true });
  }

  // --- Server-side validation (never trust the client) ---
  if (!name || name.length > MAX_NAME) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid name.' });
  }
  if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
  }
  if (!message) {
    return res.status(400).json({ ok: false, error: 'Please add a message.' });
  }
  if (message.length > MAX_MESSAGE) {
    return res.status(400).json({ ok: false, error: 'Message is too long (5000 characters max).' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL;
  const fromEmail = process.env.CONTACT_FROM_EMAIL;

  if (!apiKey || !toEmail || !fromEmail) {
    console.error('Contact form is missing required environment variables (RESEND_API_KEY / CONTACT_TO_EMAIL / CONTACT_FROM_EMAIL).');
    return res.status(500).json({ ok: false, error: 'The contact form isn\u2019t fully configured yet. Please email me directly instead.' });
  }

  const resend = new Resend(apiKey);
  const subject = `New inquiry from ${name}${inquiryType ? ' \u2014 ' + inquiryType : ''}`;
  const textBody =
    `Name: ${name}\n` +
    `Email: ${email}\n` +
    (inquiryType ? `Inquiry type: ${inquiryType}\n` : '') +
    `\nMessage:\n${message}`;
  const htmlBody =
    `<p><strong>Name:</strong> ${escapeHtml(name)}</p>` +
    `<p><strong>Email:</strong> ${escapeHtml(email)}</p>` +
    (inquiryType ? `<p><strong>Inquiry type:</strong> ${escapeHtml(inquiryType)}</p>` : '') +
    `<p><strong>Message:</strong></p>` +
    `<p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`;

  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      replyTo: email,
      subject: subject,
      text: textBody,
      html: htmlBody
    });

    if (error) {
      console.error('Resend returned an error:', error);
      return res.status(502).json({ ok: false, error: 'Could not send your message right now. Please try again shortly, or email me directly.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Contact form send failed:', err);
    return res.status(500).json({ ok: false, error: 'Could not send your message right now. Please try again shortly, or email me directly.' });
  }
};
