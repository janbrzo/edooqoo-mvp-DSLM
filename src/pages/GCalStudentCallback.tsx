import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function GCalStudentCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const stateParam = searchParams.get('state');

    if (!code || !stateParam) {
      setError('Missing OAuth parameters');
      return;
    }

    let email: string;
    let teacherToken: string;
    try {
      const parsed = JSON.parse(atob(stateParam));
      email = parsed.email;
      teacherToken = parsed.teacherToken;
      if (!email || !teacherToken) throw new Error('Invalid state');
    } catch {
      setError('Invalid OAuth state parameter');
      return;
    }

    const handleCallback = async () => {
      try {
        const redirectUri = `${window.location.origin}/gcal-student-callback`;
        const { data, error: fnError } = await supabase.functions.invoke('student-gcal-auth-callback', {
          body: { code, redirectUri, email, teacherToken },
        });
        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);
        
        toast.success('Google Calendar connected successfully!');
        navigate(`/my/${teacherToken}/settings?gcal=connected`, { replace: true });
      } catch (err: any) {
        console.error('OAuth callback error:', err);
        toast.error('Failed to connect Google Calendar: ' + (err.message || 'Unknown error'));
        navigate(`/my/${teacherToken}/settings?gcal=error`, { replace: true });
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span>Connecting Google Calendar...</span>
    </div>
  );
}
