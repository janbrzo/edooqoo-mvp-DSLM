import React from 'react';
import {
  BookOpenCheck,
  Calendar,
  ClipboardCheck,
  Goal,
  Layers,
  Map,
  Radio,
  StickyNote,
  Users,
} from 'lucide-react';

const unlockFeatures = [
  { icon: BookOpenCheck, label: 'Welcome Test baseline' },
  { icon: Goal, label: 'Student goals' },
  { icon: StickyNote, label: 'Teacher notes' },
  { icon: ClipboardCheck, label: 'Homework evidence' },
  { icon: Layers, label: 'Flashcard retention' },
  { icon: Radio, label: 'Live worksheet answers' },
  { icon: Calendar, label: 'Calendar context' },
  { icon: Users, label: 'Student Hub access' },
  { icon: Map, label: 'Learning Roadmap' },
];

/**
 * v6.9.89 — extracted from HeroHeadline to reduce first-screen density.
 * Content is unchanged; it now sits directly below the worksheet generator,
 * where the "create an account to keep student context" message is relevant.
 */
const UnlockFeaturesTicker: React.FC = () => (
  <div className="px-4 pt-10 pb-12">
    <div className="w-full max-w-full sm:max-w-3xl mx-auto overflow-hidden border border-border rounded-2xl bg-white/80 py-3 shadow-sm">
      <p className="mx-auto mb-3 w-fit max-w-[calc(100%-2rem)] rounded-full border border-violet-100 bg-violet-50/80 px-3 py-1 text-center text-xs font-semibold tracking-wide text-violet-800">
        Create a free account to save student context for 1-Minute Prep
      </p>
      <div className="flex overflow-hidden border-t border-border/60 pt-3">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...unlockFeatures, ...unlockFeatures].map(({ icon: Icon, label }, i) => (
            <div key={i} className="flex items-center gap-1.5 text-sm text-foreground/80 mx-4 shrink-0">
              <Icon className="h-3.5 w-3.5 text-violet-500 flex-shrink-0" />
              <span>{label}</span>
              <span className="mx-3 text-muted-foreground/40">·</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default UnlockFeaturesTicker;