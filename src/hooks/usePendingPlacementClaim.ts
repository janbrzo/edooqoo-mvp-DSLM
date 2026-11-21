import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { claimPlacementReport, clearPostSignupAddStudentIntent, rememberPendingClaim, takePendingClaim } from '@/lib/welcomeTest/placementReportApi';
import { studentTabPath } from '@/lib/students/workspaceTabs';
import { devError } from '@/utils/logger';

/** After signup (incl. email confirmation), adds the student from a remembered placement report. */
export function usePendingPlacementClaim(isRegisteredUser: boolean, isDemo: boolean) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const ran = useRef(false);
  useEffect(() => {
    if (!isRegisteredUser || isDemo || ran.current) return;
    ran.current = true;
    const token = takePendingClaim();
    if (!token) return;
    claimPlacementReport(token)
      .then(async ({ studentId, testId, alreadyClaimed }) => {
        clearPostSignupAddStudentIntent();
        await queryClient.invalidateQueries({ queryKey: ['students'] });
        if (!alreadyClaimed) toast.success('Student added with their placement profile.');
        navigate(studentTabPath(studentId, 'timeline', { filter: 'tests', testId }));
      })
      .catch((error) => {
        rememberPendingClaim(token);
        devError('Pending placement claim failed', error);
        toast.error(error?.message || 'Could not add the student from the placement report.');
      });
  }, [isRegisteredUser, isDemo, navigate, queryClient]);
}
