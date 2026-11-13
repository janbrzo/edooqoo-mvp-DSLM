import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { claimPlacementReport, rememberPendingClaim, takePendingClaim } from '@/lib/welcomeTest/placementReportApi';
import { studentTabPath } from '@/lib/students/workspaceTabs';
import { devError } from '@/utils/logger';

/** After signup (incl. email confirmation), adds the student from a remembered placement report. */
export function usePendingPlacementClaim(isRegisteredUser: boolean, isDemo: boolean) {
  const navigate = useNavigate();
  const ran = useRef(false);
  useEffect(() => {
    if (!isRegisteredUser || isDemo || ran.current) return;
    ran.current = true;
    const token = takePendingClaim();
    if (!token) return;
    claimPlacementReport(token)
      .then(({ studentId }) => {
        toast.success('Student added with their placement profile.');
        navigate(studentTabPath(studentId, 'model', { view: 'profile' }));
      })
      .catch((error) => {
        rememberPendingClaim(token);
        devError('Pending placement claim failed', error);
        toast.error(error?.message || 'Could not add the student from the placement report.');
      });
  }, [isRegisteredUser, isDemo, navigate]);
}
