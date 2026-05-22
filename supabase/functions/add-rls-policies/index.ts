
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Adding comprehensive RLS policies for security...');

    // Enable RLS on worksheets table and add policies
    await supabase.rpc('exec_sql', {
      sql: `
        -- Enable RLS on worksheets table
        ALTER TABLE public.worksheets ENABLE ROW LEVEL SECURITY;
        
        -- Policy for users to view their own worksheets
        CREATE POLICY IF NOT EXISTS "users_view_own_worksheets" ON public.worksheets
        FOR SELECT 
        USING (
          user_id = auth.uid() OR 
          auth.uid() IS NOT NULL
        );
        
        -- Policy for authenticated users to create worksheets
        CREATE POLICY IF NOT EXISTS "authenticated_users_create_worksheets" ON public.worksheets
        FOR INSERT 
        WITH CHECK (
          auth.uid() IS NOT NULL AND
          (user_id = auth.uid() OR user_id IS NULL)
        );
        
        -- Policy for users to update their own worksheets
        CREATE POLICY IF NOT EXISTS "users_update_own_worksheets" ON public.worksheets
        FOR UPDATE 
        USING (user_id = auth.uid() OR auth.uid() IS NOT NULL);
        
        -- Policy for users to delete their own worksheets
        CREATE POLICY IF NOT EXISTS "users_delete_own_worksheets" ON public.worksheets
        FOR DELETE 
        USING (user_id = auth.uid());
      `
    });

    // Enable RLS on feedbacks table and add policies
    await supabase.rpc('exec_sql', {
      sql: `
        -- Enable RLS on feedbacks table
        ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
        
        -- Policy for users to view feedback for worksheets they have access to
        CREATE POLICY IF NOT EXISTS "users_view_accessible_feedback" ON public.feedbacks
        FOR SELECT 
        USING (
          user_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM public.worksheets w 
            WHERE w.id = feedbacks.worksheet_id 
            AND (w.user_id = auth.uid() OR auth.uid() IS NOT NULL)
          )
        );
        
        -- Policy for authenticated users to create feedback
        CREATE POLICY IF NOT EXISTS "authenticated_users_create_feedback" ON public.feedbacks
        FOR INSERT 
        WITH CHECK (
          auth.uid() IS NOT NULL AND
          (user_id = auth.uid() OR user_id IS NULL)
        );
        
        -- Policy for users to update their own feedback
        CREATE POLICY IF NOT EXISTS "users_update_own_feedback" ON public.feedbacks
        FOR UPDATE 
        USING (user_id = auth.uid());
        
        -- Policy for users to delete their own feedback
        CREATE POLICY IF NOT EXISTS "users_delete_own_feedback" ON public.feedbacks
        FOR DELETE 
        USING (user_id = auth.uid());
      `
    });

    // Update export_payments RLS policies for better security
    await supabase.rpc('exec_sql', {
      sql: `
        -- Drop existing policies on export_payments
        DROP POLICY IF EXISTS "view_own_payments" ON public.export_payments;
        DROP POLICY IF EXISTS "service_manage_payments" ON public.export_payments;
        
        -- Policy for users to view their own payments (using user_identifier for anonymous users)
        CREATE POLICY IF NOT EXISTS "users_view_own_payments" ON public.export_payments
        FOR SELECT 
        USING (
          (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
          (auth.uid() IS NOT NULL AND user_identifier = auth.uid()::text) OR
          (auth.uid() IS NULL AND user_identifier IS NOT NULL)
        );
        
        -- Policy for service role to manage payments
        CREATE POLICY IF NOT EXISTS "service_role_manage_payments" ON public.export_payments
        FOR ALL
        USING (auth.role() = 'service_role')
        WITH CHECK (auth.role() = 'service_role');
        
        -- Policy for authenticated users to create payments
        CREATE POLICY IF NOT EXISTS "authenticated_users_create_payments" ON public.export_payments
        FOR INSERT 
        WITH CHECK (
          auth.uid() IS NOT NULL AND
          (user_id = auth.uid() OR user_identifier = auth.uid()::text)
        );
      `
    });

    // Update download_sessions RLS policies
    await supabase.rpc('exec_sql', {
      sql: `
        -- Policy for users to view download sessions for their payments
        CREATE POLICY IF NOT EXISTS "users_view_own_download_sessions" ON public.download_sessions
        FOR SELECT 
        USING (
          EXISTS (
            SELECT 1 FROM public.export_payments ep 
            WHERE ep.id = download_sessions.payment_id 
            AND (
              (auth.uid() IS NOT NULL AND ep.user_id = auth.uid()) OR
              (auth.uid() IS NOT NULL AND ep.user_identifier = auth.uid()::text)
            )
          )
        );
        
        -- Keep existing service role policy
        CREATE POLICY IF NOT EXISTS "service_role_manage_download_sessions" ON public.download_sessions
        FOR ALL
        USING (auth.role() = 'service_role')
        WITH CHECK (auth.role() = 'service_role');
      `
    });

    console.log('RLS policies updated successfully with comprehensive security');

    return new Response(
      JSON.stringify({ success: true, message: 'Comprehensive RLS policies configured' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error adding RLS policies:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to add RLS policies', details: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
