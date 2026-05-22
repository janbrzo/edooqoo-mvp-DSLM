import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { shareToken, recipientEmail, setTitle, teacherName, isAllSets, portalUrl } = await req.json();

    if (!shareToken || !recipientEmail) {
      return new Response(
        JSON.stringify({ error: 'Missing shareToken or recipientEmail' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use portalUrl for all sets, or build standard flashcard URL for single set
    const shareUrl = (isAllSets && portalUrl) 
      ? portalUrl 
      : `${req.headers.get('origin') || 'https://worksheetgenerator.lovable.app'}/flashcards/${shareToken}`;

    console.log('[send-flashcard-email] Sending to:', recipientEmail);
    console.log('[send-flashcard-email] Share URL:', shareUrl);
    console.log('[send-flashcard-email] isAllSets:', isAllSets);

    // Different email content for all sets vs single set
    const emailSubject = isAllSets
      ? `${teacherName || 'Your teacher'} shared your flashcard dashboard with you`
      : `${teacherName || 'Your teacher'} shared flashcards with you: ${setTitle}`;

    const emailBody = isAllSets
      ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #7c3aed;">📚 Your Flashcard Dashboard</h2>
          <p>Hello,</p>
          <p><strong>${teacherName || 'Your teacher'}</strong> has shared all your flashcard sets with you.</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #1f2937;">Access All Your Sets</h3>
            <p style="margin: 0; color: #4b5563;">Click below to view and study all your flashcard sets in one place.</p>
          </div>
          <p>Click the button below to access your learning dashboard:</p>
          <a href="${shareUrl}" 
             style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0;">
            Open Dashboard
          </a>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            This link will remain active for 1 year. You can access your flashcards anytime.
          </p>
          <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
            Or copy and paste this URL: ${shareUrl}
          </p>
        </div>
      `
      : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #7c3aed;">📚 New Flashcard Set Shared!</h2>
          <p>Hello,</p>
          <p><strong>${teacherName || 'Your teacher'}</strong> has shared a flashcard set with you:</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #1f2937;">${setTitle}</h3>
          </div>
          <p>Click the button below to start learning:</p>
          <a href="${shareUrl}" 
             style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0;">
            Start Learning
          </a>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            This link will remain active for 1 year. You can practice these flashcards as many times as you like.
          </p>
          <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
            Or copy and paste this URL: ${shareUrl}
          </p>
        </div>
      `;

    // Send email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Worksheet Generator <noreply@edooqoo.com>',
        to: [recipientEmail],
        subject: emailSubject,
        html: emailBody,
      }),
    });

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error('[send-flashcard-email] Resend error:', emailData);
      throw new Error(emailData.message || 'Failed to send email');
    }

    console.log('[send-flashcard-email] Email sent successfully:', emailData.id);

    return new Response(
      JSON.stringify({ success: true, emailId: emailData.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[send-flashcard-email] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
