import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALERT_EMAIL = "j4n.brz0@gmail.com";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { errorMessage, errorType, userId, teacherEmail, promptPreview, model, timestamp } = await req.json();

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      console.warn('⚠️ RESEND_API_KEY not configured, skipping failure notification');
      return new Response(JSON.stringify({ skipped: true, reason: 'no_resend_key' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const solutions: Record<string, string> = {
      'quota': 'Gemini API quota exceeded. Check <a href="https://aistudio.google.com/">Google AI Studio</a> billing or switch primary model to OpenAI.',
      'validation': 'Prompt validation failed — likely empty or malformed prompt. Check frontend for race conditions or double-click issues.',
      'timeout': 'Generation timed out. Consider reducing exercise count or simplifying prompt.',
      'parse': 'AI returned invalid JSON. Model may need temperature adjustment or JSON mode enforcement.',
      'network': 'Network error connecting to AI provider. Check API key validity and provider status page.',
      'database': 'Failed to save worksheet to database. Check Supabase connection, RLS policies, and table constraints.',
      'default': 'Unknown error. Check edge function logs for full stack trace.',
    };

    const solution = solutions[errorType] || solutions['default'];
    const ts = timestamp || new Date().toISOString();

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; background:#f9fafb;">
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 700px; margin: 0 auto; padding: 24px;">
    <div style="background:white; border-radius:12px; border:1px solid #e5e7eb; overflow:hidden;">
      <div style="background:#dc2626; padding:16px 24px;">
        <h2 style="color:white; margin:0; font-size:18px;">⚠️ Worksheet Generation Failed</h2>
      </div>
      <div style="padding:24px;">
        <table style="width:100%; border-collapse:collapse; margin:0 0 20px 0;">
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:10px 12px; font-weight:600; color:#6b7280; width:120px; vertical-align:top;">Time</td>
            <td style="padding:10px 12px; color:#111827;">${ts}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:10px 12px; font-weight:600; color:#6b7280; vertical-align:top;">Teacher</td>
            <td style="padding:10px 12px; color:#111827;">${teacherEmail || 'anonymous'}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:10px 12px; font-weight:600; color:#6b7280; vertical-align:top;">User ID</td>
            <td style="padding:10px 12px; color:#111827; font-family:monospace; font-size:13px;">${userId || 'N/A'}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:10px 12px; font-weight:600; color:#6b7280; vertical-align:top;">Model</td>
            <td style="padding:10px 12px; color:#111827;">${model || 'unknown'}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:10px 12px; font-weight:600; color:#6b7280; vertical-align:top;">Error Type</td>
            <td style="padding:10px 12px;">
              <span style="background:#fef2f2; color:#dc2626; padding:4px 10px; border-radius:6px; font-weight:700; font-size:13px;">${errorType}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 12px; font-weight:600; color:#6b7280; vertical-align:top;">Error</td>
            <td style="padding:10px 12px; color:#111827;">${errorMessage || 'No error message'}</td>
          </tr>
        </table>

        <div style="background:#fef3c7; border-left:4px solid #f59e0b; padding:14px 16px; margin:0 0 20px 0; border-radius:0 8px 8px 0;">
          <strong style="color:#92400e;">💡 Proposed Solution:</strong><br/>
          <span style="color:#78350f;">${solution}</span>
        </div>

        ${promptPreview ? `
        <div style="margin:0 0 20px 0;">
          <div style="font-weight:600; color:#6b7280; margin-bottom:6px; font-size:13px;">📝 Prompt Preview (first 300 chars):</div>
          <pre style="background:#f5f5f5; padding:12px; font-size:11px; overflow:auto; border-radius:8px; border:1px solid #e5e7eb; white-space:pre-wrap; word-break:break-all; max-height:200px;">${promptPreview.substring(0, 300)}</pre>
        </div>
        ` : ''}

        <div style="text-align:center; margin-top:24px;">
          <a href="https://supabase.com/dashboard/project/bvfrkzdlklyvnhlpleck/functions/generateWorksheet/logs" 
             style="display:inline-block; padding:12px 28px; background:#2563eb; color:white; border-radius:8px; text-decoration:none; font-weight:600; font-size:14px;">
            🔍 View Edge Function Logs
          </a>
        </div>
      </div>
      <div style="background:#f9fafb; padding:12px 24px; border-top:1px solid #e5e7eb; text-align:center;">
        <span style="color:#9ca3af; font-size:12px;">EDOQOO Automated Alert System</span>
      </div>
    </div>
  </div>
</body>
</html>`;

    console.log(`📧 Sending failure alert email: type=${errorType}, teacher=${teacherEmail || 'anonymous'}`);

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'EDOQOO Alerts <notifications@edooqoo.com>',
        to: [ALERT_EMAIL],
        subject: `⚠️ Worksheet generation failed: ${errorType} — ${teacherEmail || 'anonymous'}`,
        html,
      }),
    });

    const emailResult = await emailRes.text();
    console.log(`📧 Resend response: ${emailRes.status}`, emailResult);

    if (!emailRes.ok) {
      console.error('❌ Failed to send alert email:', emailResult);
      return new Response(JSON.stringify({ sent: false, error: emailResult }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ notify-generation-failure error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
