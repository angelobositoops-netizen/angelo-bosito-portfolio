# Contact form backend — setup guide

## What was added / changed

| File | Status | Purpose |
|---|---|---|
| `api/contact.js` | **new** | Vercel serverless function. Validates the submission and sends the email via Resend. Holds the API key — never sent to the browser. |
| `package.json` | **new** | Declares the `resend` dependency so Vercel installs it at build time. |
| `main.js` | **modified** | Only the `contactForm()` block changed: it now POSTs JSON to `/api/contact` instead of the old mailto fallback, and shows whatever success/error message the server returns. |
| `index.html` | unchanged | Same form markup, same fields, same styling. |
| `styles.css` | unchanged | No visual changes. |

## How a submission flows

1. Visitor fills in **Name / Email / What do you need help with? / Message** and clicks **Send Inquiry**.
2. `main.js` validates the fields in the browser (fast feedback), then does `fetch('/api/contact', { method: 'POST', body: JSON.stringify({...}) })`.
3. Vercel routes that request to the serverless function at `api/contact.js`.
4. The function, running server-side only:
   - Rejects anything that isn't a POST.
   - Checks the honeypot field and a timing trap (see **Spam protection** below).
   - Re-validates name / email / message server-side (never trusts the browser).
   - Calls `resend.emails.send({ from, to, replyTo: visitorEmail, subject, text, html })` using `RESEND_API_KEY` from Vercel's environment variables.
5. Resend delivers the email to your inbox (`CONTACT_TO_EMAIL`), with **Reply-To set to the visitor's email** — hit reply in your inbox and it goes straight to them.
6. The function returns `{ ok: true }` or `{ ok: false, error: "..." }`; `main.js` shows a matching success or error message in the existing `#form-status` element.

No database anywhere — the function is stateless and only talks to Resend.

## Environment variables to add in Vercel

Go to **Vercel Dashboard → your project → Settings → Environment Variables** and add these three (Production, and Preview if you want the form to work on preview deployments too):

| Name | Example value | Notes |
|---|---|---|
| `RESEND_API_KEY` | `re_xxxxxxxxxxxxxxxxx` | From Resend → API Keys. Keep this secret — it's only read server-side in `api/contact.js`. |
| `CONTACT_TO_EMAIL` | `angelo.bosito.ops@gmail.com` | Where inquiries land. Can be any inbox you own — doesn't need to be on the verified sending domain. |
| `CONTACT_FROM_EMAIL` | `Angelo Bosito Portfolio <contact@yourdomain.com>` | The "from" address. **Must be on a domain you've verified in Resend** (see below) — you cannot use a plain Gmail/Yahoo address here. |

After adding or changing env vars you must **redeploy** for them to take effect (Vercel doesn't hot-reload functions on env var changes).

## What to configure in Resend

1. **Create an account** at resend.com and grab an API key (Dashboard → API Keys → Create). Use that for `RESEND_API_KEY`.
2. **Verify a sending domain** (Dashboard → Domains → Add Domain):
   - You need a domain you control (e.g. your own custom domain, or a subdomain like `mail.yourdomain.com`). A bare `vercel.app` URL can't be verified for sending — you'll need a real domain pointed at Resend via DNS.
   - Resend gives you a few DNS records (SPF/DKIM, typically 2–3 `TXT`/`CNAME` records) to add at your domain registrar or DNS host.
   - Verification usually completes within minutes once the DNS records propagate.
   - Once verified, set `CONTACT_FROM_EMAIL` to an address on that domain, e.g. `contact@yourdomain.com`.
3. **Don't use `onboarding@resend.dev` as `CONTACT_FROM_EMAIL` in production** — it's a Resend test address only, fine for local testing but not meant for real traffic.
4. If you don't have a custom domain yet: you can test everything using `onboarding@resend.dev` as `CONTACT_FROM_EMAIL`, but Resend will restrict delivery (only to the email address on your Resend account) until a real domain is verified — plan to add one before relying on this in production.

## Spam protection (no database, kept simple)

- **Honeypot field**: the form already has a hidden `company` field (invisible to real visitors via CSS, `tabindex="-1"`). If it's filled in, the function silently returns success without sending — bots don't learn to route around it.
- **Timing trap**: the browser records when the form was rendered and sends that timestamp. If a "submission" arrives less than ~1.5 seconds later, it's treated as a bot and silently accepted without sending.
- **Server-side validation**: name/email/message are all re-checked and length-limited server-side regardless of what the browser already validated.

This is intentionally lightweight per your request — no CAPTCHA, no rate-limiting database. If spam becomes a real problem later, the easiest upgrade is adding Cloudflare Turnstile (free, no backend changes needed beyond one more server-side check) rather than standing up infrastructure.

## Deployment & testing checklist

1. **Add the three environment variables** in Vercel (see table above) for the Production environment.
2. **Commit and push** `api/contact.js`, `package.json`, and the updated `main.js` to your repo (or redeploy via the Vercel CLI/dashboard if you deploy by upload).
3. Confirm the **Vercel build log** shows `npm install` picking up the `resend` package (check the "Installing dependencies" step).
4. In **Resend → Domains**, confirm your sending domain shows a green "Verified" status before relying on real delivery.
5. Once deployed, open your **live production URL** (not `localhost`) and submit the contact form with a real email address.
6. Check:
   - The form shows the success message.
   - The email arrives at `CONTACT_TO_EMAIL` (check spam folder the first time).
   - Hitting **Reply** in your inbox addresses the visitor's email, not your own.
7. Test the error path once: temporarily remove/misspell `RESEND_API_KEY` in Vercel, redeploy, submit the form, and confirm you get a clear error message instead of a silent failure — then restore the correct key and redeploy again.
8. Check the **Vercel → your project → Logs** tab (or `vercel logs`) if anything fails — `api/contact.js` logs the specific Resend error server-side (never shown to the visitor) to help you debug.

Local testing note: running this with `vercel dev` locally works the same way once your `.env.local` has the three variables set — but always do a final check against the **production** URL, since local and preview environments can have different env vars configured.
