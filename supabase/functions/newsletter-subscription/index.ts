import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2'
import {
  CONFIRMATION_TTL_MS,
  NEWSLETTER_CONSENT_VERSION,
  isValidNewsletterEmail,
  normalizeNewsletterEmail,
  normalizeNewsletterSource,
  planNewsletterSubscription,
  transitionNewsletterConfirmation,
  transitionNewsletterUnsubscribe,
} from '../_shared/newsletter-core.mjs'

const APP_BASE_URL = Deno.env.get('APP_BASE_URL') || 'https://edooqoo.com'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character] as string))
}

function redirect(path: string, status: string): Response {
  const url = new URL(path, APP_BASE_URL)
  url.searchParams.set('status', status)
  return Response.redirect(url.toString(), 303)
}

function appActionUrl(path: string, sourceUrl: URL, keys: string[]): URL {
  const actionUrl = new URL(path, APP_BASE_URL)
  for (const key of keys) {
    const value = sourceUrl.searchParams.get(key)
    if (value) actionUrl.searchParams.set(key, value)
  }
  return actionUrl
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
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

function secureEqualHex(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

async function consumeRateLimit(
  supabase: ReturnType<typeof createClient>,
  req: Request,
  email: string,
): Promise<boolean> {
  const ip = req.headers.get('cf-connecting-ip')
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown'
  const salt = Deno.env.get('NEWSLETTER_RATE_LIMIT_SALT') || SERVICE_ROLE_KEY
  const [ipHash, emailHash] = await Promise.all([
    sha256(`${salt}:ip:${ip}`),
    sha256(`${salt}:email:${email}`),
  ])
  const [ipResult, emailResult] = await Promise.all([
    supabase.rpc('consume_newsletter_rate_limit', {
      p_key_hash: ipHash,
      p_action: 'subscribe_ip',
      p_limit: 5,
      p_window_seconds: 900,
    }),
    supabase.rpc('consume_newsletter_rate_limit', {
      p_key_hash: emailHash,
      p_action: 'subscribe_email',
      p_limit: 3,
      p_window_seconds: 3600,
    }),
  ])
  if (ipResult.error || emailResult.error) {
    console.error('Newsletter rate limit failed', ipResult.error || emailResult.error)
    return false
  }
  return ipResult.data === true && emailResult.data === true
}

async function sendConfirmation(email: string, token: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!RESEND_API_KEY) return { ok: false, error: 'resend_not_configured' }

  const confirmationUrl = new URL('/newsletter/confirm', APP_BASE_URL)
  confirmationUrl.searchParams.set('token', token)
  const safeUrl = escapeHtml(confirmationUrl.toString())
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Edooqoo <hello@edooqoo.com>',
      to: [email],
      reply_to: 'edooqoo@gmail.com',
      subject: 'Confirm your What Should I Teach Next? subscription',
      html: `<!doctype html>
<html lang="en">
<body style="margin:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px">
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:32px">
      <p style="margin:0 0 10px;color:#6d28d9;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em">What Should I Teach Next?</p>
      <h1 style="margin:0 0 16px;font-size:26px;line-height:1.25">Confirm your subscription</h1>
      <p style="font-size:16px;line-height:1.65;color:#4b5563">Open the confirmation page below, then confirm that you want Edooqoo email updates about adult one-to-one English teaching.</p>
      <p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;background:#6d28d9;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px">Open confirmation page</a></p>
      <p style="font-size:13px;line-height:1.6;color:#6b7280">This link expires in 24 hours. If you did not request this email, ignore it and no subscription will be activated.</p>
    </div>
  </div>
</body>
</html>`,
    }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) return { ok: false, error: `Resend ${response.status}: ${JSON.stringify(result).slice(0, 400)}` }
  return { ok: true, id: result?.id }
}

async function handleSubscribe(req: Request): Promise<Response> {
  let body: Record<string, unknown> | null = null
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_request' }), { status: 400, headers: jsonHeaders })
  }

  if (typeof body?.company === 'string' && body.company.trim()) {
    return new Response(JSON.stringify({ ok: true, status: 'check-email' }), { status: 200, headers: jsonHeaders })
  }
  if (body?.consent !== true) {
    return new Response(JSON.stringify({ error: 'consent_required' }), { status: 400, headers: jsonHeaders })
  }

  const email = normalizeNewsletterEmail(body?.email)
  if (!isValidNewsletterEmail(email)) {
    return new Response(JSON.stringify({ error: 'invalid_email' }), { status: 400, headers: jsonHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  if (!(await consumeRateLimit(supabase, req, email))) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: jsonHeaders })
  }

  const { data: existing, error: lookupError } = await supabase
    .from('newsletter_subscribers')
    .select('*')
    .eq('email', email)
    .maybeSingle()
  if (lookupError) {
    console.error('Newsletter subscriber lookup failed', lookupError)
    return new Response(JSON.stringify({ error: 'subscription_unavailable' }), { status: 500, headers: jsonHeaders })
  }

  const plan = planNewsletterSubscription(existing)
  if (!plan.shouldSendConfirmation) {
    return new Response(JSON.stringify({ ok: true, status: 'check-email' }), { status: 200, headers: jsonHeaders })
  }

  const source = normalizeNewsletterSource(body?.source)
  const token = randomToken()
  const tokenHash = await sha256(token)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + CONFIRMATION_TTL_MS).toISOString()
  const record = {
    email,
    status: 'pending',
    source,
    consent_version: NEWSLETTER_CONSENT_VERSION,
    confirmation_token_hash: tokenHash,
    confirmation_expires_at: expiresAt,
    confirmation_sent_at: null,
    confirmed_at: null,
    unsubscribed_at: null,
    updated_at: now.toISOString(),
  }

  const writeResult = existing
    ? await supabase.from('newsletter_subscribers').update(record).eq('id', existing.id)
    : await supabase.from('newsletter_subscribers').insert(record)
  if (writeResult.error) {
    if (writeResult.error.code === '23505') {
      return new Response(JSON.stringify({ ok: true, status: 'check-email' }), {
        status: 200,
        headers: jsonHeaders,
      })
    }
    console.error('Newsletter subscriber write failed', writeResult.error)
    return new Response(JSON.stringify({ error: 'subscription_unavailable' }), { status: 500, headers: jsonHeaders })
  }

  const sendResult = await sendConfirmation(email, token)
  await supabase.from('email_send_log').insert({
    recipient_email: email,
    template_name: 'newsletter_confirmation',
    status: sendResult.ok ? 'sent' : 'failed',
    provider_message_id: sendResult.id || null,
    error_message: sendResult.error || null,
    sent_at: sendResult.ok ? now.toISOString() : null,
    metadata: { source, reason: plan.reason },
  })

  if (!sendResult.ok) {
    console.error('Newsletter confirmation failed', sendResult.error)
    return new Response(JSON.stringify({ error: 'confirmation_email_failed' }), { status: 502, headers: jsonHeaders })
  }

  await supabase
    .from('newsletter_subscribers')
    .update({ confirmation_sent_at: now.toISOString(), updated_at: now.toISOString() })
    .eq('email', email)

  return new Response(JSON.stringify({ ok: true, status: 'check-email' }), { status: 200, headers: jsonHeaders })
}

async function handleConfirm(url: URL): Promise<Response> {
  const token = url.searchParams.get('token') || ''
  if (token.length < 32) return redirect('/newsletter/confirmed', 'invalid')

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const tokenHash = await sha256(token)
  const { data: existing, error } = await supabase
    .from('newsletter_subscribers')
    .select('*')
    .eq('confirmation_token_hash', tokenHash)
    .maybeSingle()
  if (error) {
    console.error('Newsletter confirmation lookup failed', error)
    return redirect('/newsletter/confirmed', 'invalid')
  }

  const transition = transitionNewsletterConfirmation(existing)
  if (!transition.ok) return redirect('/newsletter/confirmed', transition.status)

  if (transition.status === 'confirmed') {
    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('newsletter_subscribers')
      .update({ status: 'active', confirmed_at: now, unsubscribed_at: null, updated_at: now })
      .eq('id', existing.id)
      .eq('status', 'pending')
    if (updateError) {
      console.error('Newsletter confirmation update failed', updateError)
      return redirect('/newsletter/confirmed', 'invalid')
    }
  }

  return redirect('/newsletter/confirmed', transition.status)
}

async function handleUnsubscribe(url: URL): Promise<Response> {
  const id = url.searchParams.get('id') || ''
  const signature = url.searchParams.get('signature') || ''
  if (!/^[0-9a-f-]{36}$/i.test(id) || signature.length !== 64) {
    return redirect('/newsletter/unsubscribed', 'invalid')
  }

  const expectedSignature = await hmac(id)
  if (!secureEqualHex(signature, expectedSignature)) return redirect('/newsletter/unsubscribed', 'invalid')

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const { data: existing, error } = await supabase
    .from('newsletter_subscribers')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    console.error('Newsletter unsubscribe lookup failed', error)
    return redirect('/newsletter/unsubscribed', 'invalid')
  }

  const transition = transitionNewsletterUnsubscribe(existing)
  if (!transition.ok) return redirect('/newsletter/unsubscribed', transition.status)

  if (transition.status === 'unsubscribed') {
    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('newsletter_subscribers')
      .update({ status: 'unsubscribed', unsubscribed_at: now, updated_at: now })
      .eq('id', id)
    if (updateError) {
      console.error('Newsletter unsubscribe update failed', updateError)
      return redirect('/newsletter/unsubscribed', 'invalid')
    }
  }

  return redirect('/newsletter/unsubscribed', transition.status)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)
  const action = url.searchParams.get('action')
  if (req.method === 'GET' && action === 'confirm') {
    const token = url.searchParams.get('token') || ''
    if (token.length < 32) return redirect('/newsletter/confirmed', 'invalid')
    return Response.redirect(appActionUrl('/newsletter/confirm', url, ['token']).toString(), 303)
  }
  if (req.method === 'POST' && action === 'confirm') return handleConfirm(url)
  if (req.method === 'GET' && action === 'unsubscribe') {
    const id = url.searchParams.get('id') || ''
    const signature = url.searchParams.get('signature') || ''
    if (!/^[0-9a-f-]{36}$/i.test(id) || signature.length !== 64) {
      return redirect('/newsletter/unsubscribed', 'invalid')
    }
    const expectedSignature = await hmac(id)
    if (!secureEqualHex(signature, expectedSignature)) {
      return redirect('/newsletter/unsubscribed', 'invalid')
    }
    return Response.redirect(appActionUrl('/newsletter/unsubscribe', url, ['id', 'signature']).toString(), 303)
  }
  if (req.method === 'POST' && action === 'unsubscribe') return handleUnsubscribe(url)
  if (req.method === 'POST') return handleSubscribe(req)

  return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: jsonHeaders })
})

