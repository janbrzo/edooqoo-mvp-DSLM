
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveCaller } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Granting tokens is a server-to-server operation only (service role).
    // Signed-in users can never credit their own balance.
    const caller = await resolveCaller(req)
    if (caller.kind !== 'service') {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { amount, description, reference_id, teacher_id } = await req.json()
    if (typeof teacher_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(teacher_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid teacher' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const user = { id: teacher_id }

    if (!Number.isInteger(amount) || amount <= 0 || amount > 1000) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call the add_tokens function which now includes teacher_email
    const { error: addTokensError } = await supabase.rpc('add_tokens', {
      p_teacher_id: user.id,
      p_amount: amount,
      p_description: description || 'Tokens added',
      p_reference_id: reference_id || null
    })

    if (addTokensError) {
      console.error('Error adding tokens:', addTokensError)
      return new Response(
        JSON.stringify({ error: 'Failed to add tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }


    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully added ${amount} tokens`,
        amount: amount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in add-tokens:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
