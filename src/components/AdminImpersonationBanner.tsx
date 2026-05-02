/**
 * AdminImpersonationBanner - Red banner shown when admin is viewing as a teacher
 * Detects ?admin_view=true in URL and persists in localStorage
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ShieldAlert, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AdminImpersonationBanner() {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [teacherEmail, setTeacherEmail] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    // Check URL param on mount
    if (searchParams.get('admin_view') === 'true') {
      localStorage.setItem('admin_impersonation', 'true');
      setIsImpersonating(true);
    } else if (localStorage.getItem('admin_impersonation') === 'true') {
      setIsImpersonating(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isImpersonating) return;
    supabase.auth.getUser().then(({ data }) => {
      setTeacherEmail(data.user?.email || 'Unknown');
    });
  }, [isImpersonating]);

  const handleExit = async () => {
    localStorage.removeItem('admin_impersonation');
    await supabase.auth.signOut();
    setIsImpersonating(false);
    navigate('/login');
  };

  if (!isImpersonating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-red-600 text-white px-4 py-2 flex items-center justify-between text-sm shadow-lg">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4" />
        <span className="font-semibold">ADMIN VIEW</span>
        <span className="opacity-90">— Viewing as: {teacherEmail}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleExit}
        className="text-white hover:bg-red-700 gap-1.5 h-7"
      >
        <LogOut className="h-3.5 w-3.5" />
        Exit
      </Button>
    </div>
  );
}

export default AdminImpersonationBanner;
