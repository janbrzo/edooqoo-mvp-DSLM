import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_BASE_URL = Deno.env.get('APP_BASE_URL') || 'https://edooqoo.com'

const TEMPLATE_NAME = 'welcome_email'

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function renderWelcomeHtml(firstName: string, signupSource: string): string {
  const safeName = escapeHtml(firstName)
  const addStudentUrl = `${APP_BASE_URL}/dashboard?action=add-student`
  const dashboardUrl = `${APP_BASE_URL}/dashboard`
  const howItWorksUrl = `${APP_BASE_URL}/how-it-works`
  const glossaryUrl = `${APP_BASE_URL}/glossary`
  const sourceLine = signupSource === 'google'
    ? 'Glad you signed in with Google — your account is ready to go.'
    : "Glad you confirmed your email — your account is now active."

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Welcome to Edooqoo</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0b1220;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:32px 32px 8px;">
          <div style="font-size:14px;color:#5E3FD9;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;">Edooqoo</div>
          <h1 style="margin:12px 0 8px;font-size:26px;line-height:1.25;color:#0b1220;font-weight:700;">Welcome${safeName ? ', ' + safeName : ''} 👋</h1>
          <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#4b5563;">${sourceLine}</p>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#4b5563;">Edooqoo helps English tutors prep professional, adult‑level lessons in minutes — not hours.</p>
        </td></tr>

        <tr><td style="padding:24px 32px 8px;">
          <h2 style="margin:0 0 12px;font-size:16px;color:#0b1220;font-weight:700;">What you can do right now</h2>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:6px 0;font-size:14px;line-height:1.6;color:#374151;"><strong>👤&nbsp;&nbsp;Add your first student</strong> — capture their professional goals (start here)</td></tr>
            <tr><td style="padding:6px 0;font-size:14px;line-height:1.6;color:#374151;">📊&nbsp;&nbsp;Run the Welcome Placement Test to map their level &amp; gaps</td></tr>
            <tr><td style="padding:6px 0;font-size:14px;line-height:1.6;color:#374151;">📅&nbsp;&nbsp;Set your calendar availability so students can book lessons</td></tr>
            <tr><td style="padding:6px 0;font-size:14px;line-height:1.6;color:#374151;">📝&nbsp;&nbsp;Generate a fully editable, goal‑specific worksheet</td></tr>
            <tr><td style="padding:6px 0;font-size:14px;line-height:1.6;color:#374151;">🚀&nbsp;&nbsp;Send interactive homework with auto‑grading</td></tr>
          </table>
        </td></tr>

        <tr><td align="center" style="padding:24px 32px 8px;">
          <a href="${addStudentUrl}" style="display:inline-block;background-color:#5E3FD9;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:8px;">Add your first student</a>
          <div style="margin-top:10px;font-size:12px;color:#6b7280;">or just <a href="${dashboardUrl}" style="color:#5E3FD9;text-decoration:underline;">open the dashboard</a></div>
        </td></tr>

        <tr><td style="padding:24px 32px 8px;">
          <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">New to Edooqoo? Skim the <a href="${howItWorksUrl}" style="color:#5E3FD9;text-decoration:underline;">How it works</a> guide or check the <a href="${glossaryUrl}" style="color:#5E3FD9;text-decoration:underline;">glossary</a>.</p>
        </td></tr>

        <tr><td style="padding:20px 32px 28px;border-top:1px solid #f1f5f9;">
          <p style="margin:0 0 4px;font-size:12px;line-height:1.6;color:#9ca3af;">Questions? Just reply to this email — we read every message.</p>
          <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">Edooqoo · hello@edooqoo.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured')
    return new Response(JSON.stringify({ error: 'resend_not_configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // --- Auth: shared internal secret ---
  const provided = req.headers.get('x-internal-secret') || ''
  const { data: cfg, error: cfgErr } = await supabase
    .from('app_internal_config')
    .select('value')
    .eq('key', 'welcome_email_secret')
    .maybeSingle()
  if (cfgErr || !cfg?.value) {
    console.error('Failed to load welcome_email_secret', cfgErr)
    return new Response(JSON.stringify({ error: 'config_missing' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
  if (provided !== cfg.value) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // --- Parse + validate body ---
  let body: any
  try { body = await req.json() } catch { body = null }
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const firstName = typeof body?.firstName === 'string' ? body.firstName.trim().slice(0, 80) : ''
  const signupSource = body?.signupSource === 'google' ? 'google' : 'email'
  const userId = typeof body?.userId === 'string' ? body.userId : null

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: 'invalid_email' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // --- Idempotency: skip if already sent ---
  const { data: existing } = await supabase
    .from('email_send_log')
    .select('id, status')
    .eq('recipient_email', email)
    .eq('template_name', TEMPLATE_NAME)
    .eq('status', 'sent')
    .limit(1)
    .maybeSingle()
  if (existing) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // --- Send via Resend ---
  const html = renderWelcomeHtml(firstName, signupSource)
  const subject = firstName
    ? `Welcome to Edooqoo, ${firstName} 👋`
    : 'Welcome to Edooqoo 👋'

  let providerMessageId: string | null = null
  let errorMessage: string | null = null
  let status: 'sent' | 'failed' = 'sent'

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Edooqoo <hello@edooqoo.com>',
        to: [email],
        reply_to: 'edooqoo@gmail.com',
        subject,
        html,
      }),
    })
    const json = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      status = 'failed'
      errorMessage = `Resend ${resp.status}: ${JSON.stringify(json).slice(0, 500)}`
    } else {
      providerMessageId = json?.id || null
    }
  } catch (e) {
    status = 'failed'
    errorMessage = e instanceof Error ? e.message : 'unknown_error'
  }

  await supabase.from('email_send_log').insert({
    recipient_email: email,
    template_name: TEMPLATE_NAME,
    status,
    provider_message_id: providerMessageId,
    error_message: errorMessage,
    sent_at: status === 'sent' ? new Date().toISOString() : null,
    metadata: { signupSource, userId, firstName },
  })

  if (status === 'failed') {
    console.error('Welcome email failed', { email, errorMessage })
    return new Response(JSON.stringify({ ok: false, error: errorMessage }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({ ok: true, messageId: providerMessageId }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})