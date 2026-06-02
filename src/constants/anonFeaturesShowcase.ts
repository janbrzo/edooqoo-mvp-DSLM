import { Brain, Calendar, ClipboardCheck, Layers, GraduationCap, User, type LucideIcon } from 'lucide-react';

export type AnonFeatureMockupId =
  | 'dslm'
  | 'calendar'
  | 'homework'
  | 'flashcards'
  | 'welcome-test'
  | 'student-hub';

export interface AnonFeature {
  id: AnonFeatureMockupId;
  icon: LucideIcon;
  title: string;
  benefit: string;
  ctaHref: string;
  ctaLabel: string;
}

/**
 * Single source of truth for the 6 features showcased to anonymous teachers.
 * Consumed by AnonFeatureCarousel (in GeneratingModal) and MiniFeatureGrid
 * (in AnonPostWorksheetLandingPage).
 */
export const ANON_FEATURES: AnonFeature[] = [
  {
    id: 'dslm',
    icon: Brain,
    title: "DSLM organizes student signals",
    benefit: 'Use profile, goals, and activity context to choose a clearer next focus.',
    ctaHref: '/signup',
    ctaLabel: 'Sign up free →',
  },
  {
    id: 'calendar',
    icon: Calendar,
    title: 'Never lose a lesson to a no-show',
    benefit: 'Google Calendar sync + auto reminders 24h before.',
    ctaHref: '/signup',
    ctaLabel: 'Sign up free →',
  },
  {
    id: 'homework',
    icon: ClipboardCheck,
    title: 'Homework review gets faster',
    benefit: 'Send a link, then review AI-assisted feedback where supported.',
    ctaHref: '/signup',
    ctaLabel: 'Sign up free →',
  },
  {
    id: 'flashcards',
    icon: Layers,
    title: 'Vocabulary review with SM-2 logic',
    benefit: 'Student review activity can feed future prep context.',
    ctaHref: '/signup',
    ctaLabel: 'Sign up free →',
  },
  {
    id: 'welcome-test',
    icon: GraduationCap,
    title: '49-question Welcome Test',
    benefit: 'Multi-skill diagnostic context plus Learning Profile input.',
    ctaHref: '/signup',
    ctaLabel: 'Sign up free →',
  },
  {
    id: 'student-hub',
    icon: User,
    title: 'Your students get their own dashboard',
    benefit: 'Self-profile, homework, flashcards — branded as you.',
    ctaHref: '/signup',
    ctaLabel: 'Sign up free →',
  },
];
