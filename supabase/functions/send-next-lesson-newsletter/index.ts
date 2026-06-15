import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2'
import { isAllowedNewsletterCanonical } from '../_shared/newsletter-core.mjs'

const APP_BASE_URL = Deno.env.get('APP_BASE_URL') || 'https://edooqoo.com'
const FUNCTION_BASE_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/newsletter-subscription`
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-internal-call',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character] as string))
}

async function hmac(value: string): Promise<string> {
  const secret = Deno.env.get('NEWSLETTER_UNSUBSCRIBE_SECRET') || SERVICE_ROLE_KEY
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function idempotencyKey(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function renderEmail(title: string, summary: string, canonicalUrl: string, unsubscribeUrl: string): string {
  return `<!doctype html>
<html lang="en">
<body style="margin:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827">
  <div style="max-width:640px;margin:0 auto;padding:32px 20px">
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:32px">
      <p style="margin:0 0 10px;color:#6d28d9;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em">What Should I Teach Next?</p>
      <h1 style="margin:0 0 16px;font-size:27px;line-height:1.25">${escapeHtml(title)}</h1>
      <p style="font-size:16px;line-height:1.7;color:#4b5563">${escapeHtml(summary)}</p>
      <p style="margin:28px 0"><a href="${escapeHtml(canonicalUrl)}" style="display:inline-block;background:#6d28d9;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px">Read the full resource</a></p>
      <p style="font-size:13px;line-height:1.6;color:#6b7280">The full article or worked example is the canonical source. This email contains only the weekly summary.</p>
      <hr style="border:0;border-top:1px solid #e5e7eb;margin:28px 0">
      <p style="font-size:12px;line-height:1.6;color:#9ca3af">Edooqoo · Weekly decision support for adult one-to-one English tutors · <a href="${escapeHtml(unsubscribeUrl)}" style="color:#6d28d9">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const expectedSecret = Deno.env.get('CRON_SECRET')
  if (!expectedSecret || req.headers.get('x-internal-call') !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'resend_not_configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: Record<string, unknown> | null = null
  try {
    body = await req.json()
  } catch {
    body = null
  }

  const campaignKey = typeof body?.campaignKey === 'string' ? body.campaignKey.trim().slice(0, 80) : ''
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 160) : ''
  const summary = typeof body?.summary === 'string' ? body.summary.trim().slice(0, 1200) : ''
  const canonicalUrl = typeof body?.canonicalUrl === 'string' ? body.canonicalUrl.trim() : ''
  if (!/^[a-z0-9][a-z0-9_-]{2,79}$/i.test(campaignKey) || !title || !summary || !isAllowedNewsletterCanonical(canonicalUrl)) {
    return new Response(JSON.stringify({ error: 'invalid_campaign' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const { data: subscribers, error: subscriberError } = await supabase
    .from('newsletter_subscribers')
    .select('id,email')
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1000)
  if (subscriberError) {
    console.error('Newsletter audience lookup failed', subscriberError)
    return new Response(JSON.stringify({ error: 'audience_unavailable' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const templateName = `next_lesson_newsletter:${campaignKey}`
  const { data: sentLogs } = await supabase
    .from('email_send_log')
    .select('recipient_email')
    .eq('template_name', templateName)
    .eq('status', 'sent')
  const alreadySent = new Set((sentLogs || []).map((row) => row.recipient_email))
  const recipients = (subscribers || []).filter((subscriber) => !alreadySent.has(subscriber.email))

  let sent = 0
  const failures: string[] = []
  for (let offset = 0; offset < recipients.length; offset += 100) {
    const batch = recipients.slice(offset, offset + 100)
    const messages = await Promise.all(batch.map(async (subscriber) => {
      const signature = await hmac(subscriber.id)
      const unsubscribeUrl = `${FUNCTION_BASE_URL}?action=unsubscribe&id=${encodeURIComponent(subscriber.id)}&signature=${signature}`
      return {
        from: 'Edooqoo <hello@edooqoo.com>',
        to: [subscriber.email],
        reply_to: 'edooqoo@gmail.com',
        subject: title,
        html: renderEmail(title, summary, canonicalUrl, unsubscribeUrl),
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
        tags: [
          { name: 'newsletter', value: 'what_to_teach_next' },
          { name: 'campaign', value: campaignKey },
        ],
      }
    }))

    const response = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': await idempotencyKey(`${campaignKey}:${offset}`),
      },
      body: JSON.stringify(messages),
    })
    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      failures.push(`batch_${offset}:${response.status}`)
      await supabase.from('email_send_log').insert(batch.map((subscriber) => ({
        recipient_email: subscriber.email,
        template_name: templateName,
        status: 'failed',
        error_message: `Resend ${response.status}: ${JSON.stringify(result).slice(0, 400)}`,
        metadata: { campaignKey, canonicalUrl },
      })))
      continue
    }

    const providerRows = Array.isArray(result?.data) ? result.data : []
    sent += batch.length
    await supabase.from('email_send_log').insert(batch.map((subscriber, index) => ({
      recipient_email: subscriber.email,
      template_name: templateName,
      status: 'sent',
      provider_message_id: providerRows[index]?.id || null,
      sent_at: new Date().toISOString(),
      metadata: { campaignKey, canonicalUrl },
    })))
  }

  return new Response(JSON.stringify({
    ok: failures.length === 0,
    activeSubscribers: subscribers?.length || 0,
    skipped: alreadySent.size,
    sent,
    failures,
    canonicalUrl,
    appBaseUrl: APP_BASE_URL,
  }), {
    status: failures.length ? 502 : 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

