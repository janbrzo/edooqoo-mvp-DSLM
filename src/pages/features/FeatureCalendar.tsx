import React from 'react';
import FeaturePageLayout from '@/components/features/FeaturePageLayout';
import FeatureHero from '@/components/features/FeatureHero';
import FeatureBenefits from '@/components/features/FeatureBenefits';
import FeatureSteps from '@/components/features/FeatureSteps';
import FeatureFAQ from '@/components/features/FeatureFAQ';
import FeatureCTA from '@/components/features/FeatureCTA';
import DSLMBadge from '@/components/features/DSLMBadge';
import RelatedFeatures from '@/components/features/RelatedFeatures';
import { CalendarDays, RefreshCcw, Video, Globe } from 'lucide-react';

const CalendarHeroMockup = () => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const hours = ['9:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
  const slots: Record<string, { name: string; status: string }> = {
    'Mon-9:00': { name: 'Julia K.', status: 'booked' },
    'Mon-14:00': { name: '', status: 'available' },
    'Tue-10:00': { name: 'Marco R.', status: 'booked' },
    'Tue-15:00': { name: '', status: 'available' },
    'Wed-9:00': { name: 'Anna C.', status: 'completed' },
    'Wed-11:00': { name: '', status: 'available' },
    'Thu-14:00': { name: 'Julia K.', status: 'pending' },
    'Thu-16:00': { name: '', status: 'available' },
    'Fri-10:00': { name: 'Marco R.', status: 'booked' },
  };

  const statusColors: Record<string, string> = {
    booked: 'bg-primary/10 border-primary/30 text-primary',
    available: 'bg-green-50 border-green-200 text-green-700',
    completed: 'bg-muted/50 border-border text-muted-foreground',
    pending: 'bg-amber-50 border-amber-200 text-amber-700',
  };

  return (
    <div className="p-4 md:p-6 text-xs">
      <div className="flex items-center justify-between mb-4">
        <span className="font-semibold text-foreground">April 14–18, 2026</span>
        <div className="flex gap-2">
          {['booked', 'available', 'pending', 'completed'].map(s => (
            <span key={s} className="flex items-center gap-1 text-[10px]">
              <span className={`w-2 h-2 rounded-sm ${statusColors[s].split(' ')[0]} border ${statusColors[s].split(' ')[1]}`} />
              {s}
            </span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-6 gap-1">
        <div />
        {days.map(d => <div key={d} className="text-center font-medium text-muted-foreground py-1">{d}</div>)}
        {hours.map(h => (
          <React.Fragment key={h}>
            <div className="text-right pr-2 text-muted-foreground py-2">{h}</div>
            {days.map(d => {
              const key = `${d}-${h}`;
              const slot = slots[key];
              return (
                <div key={key} className={`rounded-lg border py-2 px-1 text-center text-[10px] ${slot ? statusColors[slot.status] : 'bg-muted/20 border-transparent'}`}>
                  {slot?.name || (slot?.status === 'available' ? '◦' : '')}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

const benefits = [
  { icon: CalendarDays, title: 'Public booking page', description: 'Students book lessons through your personal link. No back-and-forth messages. Slots update in real-time.' },
  { icon: RefreshCcw, title: 'Google Calendar sync', description: 'Bidirectional sync with Google Calendar. Per-status colors. Auto-generate Google Meet links for online lessons.' },
  { icon: Video, title: 'Reschedule system', description: 'Students request reschedule → you confirm or reject. Calendar updates automatically. No manual coordination.' },
  { icon: Globe, title: 'Student GCal sync', description: 'Students sync lessons to their own Google Calendar with customizable colors and reminder settings.' },
];

const steps = [
  { number: 1, title: 'Set your availability', description: 'Define weekly recurring slots (e.g., Monday 9:00–10:00, Thursday 14:00–15:00). Set buffer time between lessons.' },
  { number: 2, title: 'Share your booking page', description: 'Send students your public booking link. They see available slots and book directly — no messages needed.' },
  { number: 3, title: 'Manage bookings', description: 'Confirm or reject bookings. Handle reschedule requests. Use bulk actions for batch operations. Everything syncs to Google Calendar.' },
  { number: 4, title: 'Teach and track', description: 'Mark lessons as completed or no-show. Calendar data feeds into DSLM for consistency tracking.' },
];

const faqItems = [
  { question: 'Does it sync with Google Calendar?', answer: 'Yes, bidirectional sync. When a student books a lesson, it appears in your Google Calendar. When you create a slot in Edooqoo, it can sync to GCal. You can customize colors per status (booked, available, completed, no-show).' },
  { question: 'Can students book without creating an account?', answer: 'Yes. Students access the public booking page via a link. They select a slot, enter their name and email, and the booking is confirmed. No registration required.' },
  { question: 'How does rescheduling work?', answer: 'Students can request a reschedule through their Student Hub or a direct link. You see the request in your calendar notifications and can confirm, reject, or suggest an alternative. All changes sync automatically to both Google Calendars.' },
  { question: 'Can I set different prices per student?', answer: 'Yes. Calendar supports per-student pricing, prepaid lesson packages, and payment tracking. You can set a default price and override it per student.' },
  { question: 'How does the calendar connect to DSLM?', answer: 'Lesson frequency and consistency are tracked by DSLM. If a student has regular weekly lessons, DSLM can plan more continuous skill development. Irregular schedules get more review-focused suggestions.' },
];

const FeatureCalendar: React.FC = () => (
  <FeaturePageLayout
    title="Lesson Calendar for English Teachers — Google Calendar Sync | Edooqoo"
    metaDescription="Students book lessons through your public page. Auto-syncs with Google Calendar. Reschedule system, bulk actions, payment tracking. All in one place."
  >
    <FeatureHero
      badge="GCal Sync"
      badgeColor="bg-green-100 text-green-700 border-green-200"
      headline="Students book. Calendar syncs. You teach."
      subheadline="Your personal booking page, bidirectional Google Calendar sync, reschedule management, and payment tracking — no more Calendly, spreadsheets, or WhatsApp messages."
    >
      <CalendarHeroMockup />
    </FeatureHero>

    <DSLMBadge feature="Calendar" description="Lesson frequency and consistency feed into DSLM, enabling adaptive planning based on how regularly each student attends." />
    <FeatureBenefits benefits={benefits} />
    <FeatureSteps steps={steps} />
    <FeatureFAQ items={faqItems} />
    <FeatureCTA headline="Simplify your scheduling" subheadline="Public booking page + Google Calendar sync. Free to start." />
    <RelatedFeatures currentPath="/features/calendar" />
  </FeaturePageLayout>
);

export default FeatureCalendar;
