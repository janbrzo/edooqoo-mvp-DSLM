
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDemoContext } from '@/contexts/DemoContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { devWarn } from '@/utils/logger';

const DemoEntry: React.FC = () => {
  const navigate = useNavigate();
  const { enterDemo, isDemoMode } = useDemoContext();
  const [status, setStatus] = useState('Detecting your location...');

  useEffect(() => {
    // If already in demo, go to dashboard
    if (isDemoMode) {
      navigate('/dashboard', { replace: true });
      return;
    }

    const init = async () => {
      let countryCode = 'DEFAULT';

      try {
        setStatus('Preparing your demo experience...');
        const { data, error } = await supabase.functions.invoke('get-demo-locale');
        if (!error && data?.country) {
          countryCode = data.country;
        }
      } catch (e) {
        // Fallback to DEFAULT
        devWarn('Could not detect locale, using default:', e);
      }

      enterDemo(countryCode);
      navigate('/dashboard', { replace: true });
    };

    init();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">{status}</p>
      </div>
    </div>
  );
};

export default DemoEntry;
