import React from 'react';
import FeaturePageLayout from '@/components/features/FeaturePageLayout';
import FeatureHero from '@/components/features/FeatureHero';
import FeatureBenefits from '@/components/features/FeatureBenefits';
import FeatureFAQ from '@/components/features/FeatureFAQ';
import FeatureCTA from '@/components/features/FeatureCTA';
import DSLMBadge from '@/components/features/DSLMBadge';
import RelatedFeatures from '@/components/features/RelatedFeatures';
import FeatureScreenshotFrame from '@/components/features/FeatureScreenshotFrame';
import FeatureWorkflowMap from '@/components/features/FeatureWorkflowMap';
import { GraduationCap, MailOpen, Shield, CalendarDays } from 'lucide-react';

const StudentHubMockup = () => (
  <div className="p-6 space-y-4 text-sm">
    <div className="flex items-center justify-between">
      <div>
        <div className="font-semibold text-foreground">Julia's Learning Hub</div>
        <div className="text-xs text-muted-foreground">Teacher: Sarah M. · B2 Business English</div>
      </div>
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">JK</div>
    </div>

    {/* Dashboard cards */}
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: 'Worksheets', count: 12, color: 'bg-primary/10 text-primary' },
        { label: 'Homework', count: 3, color: 'bg-amber-100 text-amber-700', badge: '1 due' },
        { label: 'Flashcards', count: 156, color: 'bg-violet-100 text-violet-700', badge: '8 due' },
      ].map(c => (
        <div key={c.label} className="p-3 rounded-xl border border-border bg-card text-center">
          <div className={`text-2xl font-bold ${c.color.split(' ')[1]}`}>{c.count}</div>
          <div className="text-xs text-muted-foreground">{c.label}</div>
          {c.badge && <div className="text-[10px] text-amber-600 font-medium mt-1">{c.badge}</div>}
        </div>
      ))}
    </div>

    {/* Recent activity */}
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">Recent Activity</div>
      {[
        { action: 'Completed homework: Business Writing Unit 3', time: '2h ago', icon: '✓' },
        { action: 'Reviewed 24 flashcards (19 correct)', time: 'Yesterday', icon: '📚' },
        { action: 'Next lesson: Thursday 14:00', time: 'In 2 days', icon: '📅' },
      ].map(a => (
        <div key={a.action} className="flex items-start gap-2 bg-muted/30 rounded-lg px-3 py-2">
          <span className="text-sm shrink-0">{a.icon}</span>
          <div className="flex-1">
            <span className="text-xs text-foreground">{a.action}</span>
            <div className="text-[10px] text-muted-foreground">{a.time}</div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const benefits = [
  { icon: GraduationCap, title: 'Everything in one place', description: 'Worksheets, homework, flashcards, lesson schedule, and settings — all accessible through a single link.' },
  { icon: MailOpen, title: 'No account needed', description: 'Students access their Hub via email — no registration, no password, no app to install. Just click the link.' },
  { icon: Shield, title: 'Teacher control', description: 'You decide what\'s shared. Students see their materials and progress, but can\'t access other students\' data.' },
  { icon: CalendarDays, title: 'GCal integration', description: 'Students sync lessons to their own Google Calendar with customizable event colors and reminder settings.' },
];

const faqItems = [
  { question: 'What can students see in the Hub?', answer: 'Students see their assigned worksheets, pending and completed homework, flashcard sets with study interface, upcoming lessons, and basic settings. They cannot see other students\' data or your internal notes.' },
  { question: 'Do students need to create an account?', answer: 'No. Access is email-based. When you add a student, they receive a link to their Hub. They can bookmark it for easy access. No password, no registration form.' },
  { question: 'Can students sync with Google Calendar?', answer: 'Yes. Students can connect their own Google Calendar through the Hub settings. Lessons sync automatically with customizable event colors per status (upcoming, completed, cancelled).' },
  { question: 'How does Student Hub connect to DSLM?', answer: 'Supported Hub activity — such as homework completion, flashcard review, and worksheet access — can contribute learning signals for future prep. The Hub is both a student workspace and a source of context for teacher-reviewed planning.' },
];

const FeatureStudentHub: React.FC = () => (
  <FeaturePageLayout
    title="Student Portal for ESL — Worksheets, Homework, Flashcards | Edooqoo"
    metaDescription="Your students' personal learning space. Worksheets, homework, flashcards, and lesson schedule — all in one link. No account needed."
  >
    <FeatureHero
      badge="Student Portal"
      badgeColor="bg-teal-100 text-teal-700 border-teal-200"
      headline="The student workspace behind the loop."
      subheadline="One link gives students access to worksheets, homework, flashcards, bookings, and tests. Supported activity can add context for teacher-reviewed future prep."
    >
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <FeatureScreenshotFrame
          src="/features/student-dashboard.png"
          alt="Student Hub dashboard with worksheets, homework, flashcards, and next lesson"
          caption="Student dashboard: one place for active work, flashcards, homework, worksheets, and the next lesson."
          imageClassName="h-72"
          objectPosition="center top"
          loading="eager"
        />
        <FeatureScreenshotFrame
          src="/features/student-bookings.png"
          alt="Student Hub lessons and booking calendar with available and pending slots"
          caption="Lessons and booking: students can see schedule context without needing a separate app."
          imageClassName="h-72"
          objectPosition="center top"
          loading="eager"
        />
      </div>
    </FeatureHero>

    <FeatureWorkflowMap activeKey="student-hub" />
    <DSLMBadge feature="Student Hub" description="Supported Student Hub activity can add learning signals for DSLM and help future prep start from stronger context." />
    <FeatureBenefits benefits={benefits} />
    <FeatureFAQ items={faqItems} />
    <FeatureCTA headline="Give your students their own space" subheadline="Student Hub is included in every plan. Start free." />
    <RelatedFeatures currentPath="/features/student-hub" />
  </FeaturePageLayout>
);

export default FeatureStudentHub;
