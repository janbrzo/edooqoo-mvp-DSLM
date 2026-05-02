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
    title: "AI tracks every student's mastery",
    benefit: 'Each worksheet auto-targets weak skills — no more guessing.',
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
    title: 'Homework grades itself',
    benefit: 'Send a link, AI evaluates speaking & writing instantly.',
    ctaHref: '/signup',
    ctaLabel: 'Sign up free →',
  },
  {
    id: 'flashcards',
    icon: Layers,
    title: 'Spaced repetition that actually works',
    benefit: "Cards adapt per word — no more 'easy' button abuse.",
    ctaHref: '/signup',
    ctaLabel: 'Sign up free →',
  },
  {
    id: 'welcome-test',
    icon: GraduationCap,
    title: '49-question placement test in 8 minutes',
    benefit: 'Whisper-based pronunciation analysis + auto Learning Path.',
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