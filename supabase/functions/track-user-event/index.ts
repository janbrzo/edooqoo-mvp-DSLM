
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TrackEventRequest {
  eventType: string;
  eventData?: any;
  userIdentifier?: string;
  sessionId?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { eventType, eventData, userIdentifier, sessionId }: TrackEventRequest = await req.json();
    
    // Get client IP and user agent
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    
    console.log(`Tracking event: ${eventType} for user: ${userIdentifier || ip}`);

    // Call the database function to track the event
    const { data, error } = await supabase.rpc('track_user_event', {
      p_user_identifier: userIdentifier || ip,
      p_event_type: eventType,
      p_event_data: eventData || null,
      p_ip_address: ip,
      p_user_agent: userAgent,
      p_session_id: sessionId || null
    });

    if (error) {
      console.error('Error tracking event:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to track event' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, eventId: data }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in track-user-event function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
