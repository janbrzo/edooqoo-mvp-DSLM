/**
 * OnboardingChecklistGate — Dashboard Today (v6.9.109, Phase 6).
 *
 * `/dashboard` renders its own inline `GuidedStepsBar`, so the floating
 * `OnboardingChecklist` is suppressed there to avoid two competing onboarding
 * surfaces. Every other route keeps the original checklist unchanged.
 */
import { useLocation } from 'react-router-dom';
import OnboardingChecklist from './OnboardingChecklist';

export default function OnboardingChecklistGate() {
  const { pathname } = useLocation();
  if (pathname === '/dashboard') return null;
  return <OnboardingChecklist />;
}
