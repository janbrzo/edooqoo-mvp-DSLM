import React from 'react';
import type { AnonFeatureMockupId } from '@/constants/anonFeaturesShowcase';

/**
 * Schematic SVG wireframes per feature — intentionally abstract to suggest
 * UI shape without promising specific pixel-perfect screens. Cheap to ship,
 * easy to swap for real screenshots later.
 */

const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg
    viewBox="0 0 320 140"
    className="w-full h-auto rounded-lg border border-border bg-gradient-to-br from-secondary/40 to-accent/30"
    role="presentation"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const Bar = (props: React.SVGProps<SVGRectElement>) => (
  <rect rx={3} fill="hsl(var(--primary) / 0.25)" {...props} />
);

const SoftBar = (props: React.SVGProps<SVGRectElement>) => (
  <rect rx={3} fill="hsl(var(--muted-foreground) / 0.18)" {...props} />
);

export const AnonFeatureMockup: React.FC<{ id: AnonFeatureMockupId }> = ({ id }) => {
  switch (id) {
    case 'dslm':
      return (
        <Frame>
          {/* mastery bars */}
          <SoftBar x={16} y={20} width={70} height={8} />
          <Bar x={16} y={36} width={140} height={10} fill="hsl(142 70% 45% / 0.6)" />
          <SoftBar x={16} y={56} width={70} height={8} />
          <Bar x={16} y={72} width={90} height={10} fill="hsl(38 90% 55% / 0.7)" />
          <SoftBar x={16} y={92} width={70} height={8} />
          <Bar x={16} y={108} width={50} height={10} fill="hsl(0 75% 60% / 0.6)" />
          {/* radar dot */}
          <circle cx={250} cy={70} r={48} fill="none" stroke="hsl(var(--primary) / 0.3)" />
          <circle cx={250} cy={70} r={28} fill="none" stroke="hsl(var(--primary) / 0.3)" />
          <circle cx={250} cy={70} r={6} fill="hsl(var(--primary))" />
        </Frame>
      );
    case 'calendar':
      return (
        <Frame>
          {Array.from({ length: 5 }).map((_, c) => (
            <SoftBar key={`h${c}`} x={20 + c * 58} y={18} width={48} height={8} />
          ))}
          {Array.from({ length: 3 }).map((_, r) =>
            Array.from({ length: 5 }).map((_, c) => (
              <rect
                key={`${r}-${c}`}
                x={20 + c * 58}
                y={36 + r * 32}
                width={48}
                height={24}
                rx={3}
                fill="hsl(var(--muted-foreground) / 0.08)"
                stroke="hsl(var(--muted-foreground) / 0.18)"
              />
            ))
          )}
          <Bar x={78} y={36} width={48} height={24} />
          <Bar x={194} y={68} width={48} height={24} fill="hsl(142 70% 45% / 0.55)" />
          <Bar x={136} y={100} width={48} height={24} fill="hsl(38 90% 55% / 0.6)" />
        </Frame>
      );
    case 'homework':
      return (
        <Frame>
          <SoftBar x={16} y={18} width={120} height={10} />
          {Array.from({ length: 3 }).map((_, i) => (
            <g key={i}>
              <rect
                x={16}
                y={36 + i * 30}
                width={288}
                height={22}
                rx={4}
                fill="white"
                stroke="hsl(var(--muted-foreground) / 0.18)"
              />
              <SoftBar x={28} y={43 + i * 30} width={140} height={8} />
              <Bar
                x={260}
                y={42 + i * 30}
                width={36}
                height={10}
                fill={i === 0 ? 'hsl(142 70% 45% / 0.7)' : i === 1 ? 'hsl(38 90% 55% / 0.7)' : 'hsl(var(--primary) / 0.5)'}
              />
            </g>
          ))}
        </Frame>
      );
    case 'flashcards':
      return (
        <Frame>
          <rect x={40} y={26} width={240} height={88} rx={8} fill="white" stroke="hsl(var(--muted-foreground) / 0.2)" />
          <rect x={50} y={20} width={240} height={88} rx={8} fill="white" stroke="hsl(var(--primary) / 0.5)" />
          <SoftBar x={70} y={48} width={120} height={10} />
          <SoftBar x={70} y={68} width={180} height={8} />
          <Bar x={70} y={86} width={60} height={8} fill="hsl(142 70% 45% / 0.6)" />
          <Bar x={140} y={86} width={60} height={8} fill="hsl(38 90% 55% / 0.6)" />
        </Frame>
      );
    case 'welcome-test':
      return (
        <Frame>
          <SoftBar x={16} y={18} width={140} height={10} />
          <rect x={16} y={36} width={288} height={10} rx={5} fill="hsl(var(--muted-foreground) / 0.15)" />
          <rect x={16} y={36} width={170} height={10} rx={5} fill="hsl(var(--primary) / 0.7)" />
          {Array.from({ length: 3 }).map((_, i) => (
            <g key={i}>
              <rect
                x={16}
                y={60 + i * 24}
                width={288}
                height={18}
                rx={4}
                fill="white"
                stroke="hsl(var(--muted-foreground) / 0.18)"
              />
              <circle cx={28} cy={69 + i * 24} r={4} fill={i === 0 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.3)'} />
              <SoftBar x={42} y={65 + i * 24} width={180} height={8} />
            </g>
          ))}
        </Frame>
      );
    case 'student-hub':
      return (
        <Frame>
          <rect x={16} y={16} width={70} height={108} rx={4} fill="white" stroke="hsl(var(--muted-foreground) / 0.18)" />
          <Bar x={26} y={28} width={50} height={8} />
          <SoftBar x={26} y={44} width={50} height={8} />
          <SoftBar x={26} y={60} width={50} height={8} />
          <SoftBar x={26} y={76} width={50} height={8} />
          <rect x={98} y={16} width={206} height={50} rx={4} fill="white" stroke="hsl(var(--muted-foreground) / 0.18)" />
          <SoftBar x={108} y={28} width={120} height={10} />
          <SoftBar x={108} y={46} width={180} height={8} />
          <rect x={98} y={74} width={100} height={50} rx={4} fill="white" stroke="hsl(var(--muted-foreground) / 0.18)" />
          <Bar x={108} y={86} width={60} height={10} fill="hsl(142 70% 45% / 0.6)" />
          <SoftBar x={108} y={104} width={80} height={8} />
          <rect x={208} y={74} width={96} height={50} rx={4} fill="white" stroke="hsl(var(--muted-foreground) / 0.18)" />
          <Bar x={218} y={86} width={50} height={10} fill="hsl(38 90% 55% / 0.6)" />
          <SoftBar x={218} y={104} width={70} height={8} />
        </Frame>
      );
    default:
      return <Frame>{null}</Frame>;
  }
};

export default AnonFeatureMockup;