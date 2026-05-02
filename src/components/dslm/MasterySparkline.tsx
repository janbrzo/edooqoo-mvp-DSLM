import React from 'react';
import { ResponsiveContainer, LineChart, Line } from 'recharts';

interface MasterySparklineProps {
  history: Array<{ mastery: number; date: string }>;
  trend: 'improving' | 'declining' | 'stable';
}

export function MasterySparkline({ history, trend }: MasterySparklineProps) {
  if (!history || history.length < 2) return null;

  const color = trend === 'improving' ? '#22c55e' : trend === 'declining' ? '#ef4444' : '#94a3b8';

  return (
    <div className="w-[80px] h-[24px] flex-shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={history}>
          <Line
            type="monotone"
            dataKey="mastery"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
