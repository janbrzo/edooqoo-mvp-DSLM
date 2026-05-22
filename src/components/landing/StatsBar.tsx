import React from 'react';

const stats = [
  { value: '29', label: 'exercise types available' },
  { value: '2,000+', label: 'worksheets generated' },
  { value: '<2 min', label: 'average generation time' },
];

const StatsBar: React.FC = () => {
  return (
    <section className="bg-background border-y border-border py-10 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-violet-50/30 via-transparent to-indigo-50/30"></div>
      <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-center gap-10 md:gap-0 relative z-10">
        {stats.map((stat, i) => (
          <React.Fragment key={stat.label}>
            {i > 0 && <div className="hidden md:block w-px h-12 bg-border mx-12" />}
            <div className="text-center w-full md:w-auto">
              <div className="text-3xl md:text-4xl font-extrabold text-foreground mb-1 tracking-tight">{stat.value}</div>
              <div className="text-sm font-medium text-muted-foreground">{stat.label}</div>
            </div>
          </React.Fragment>
        ))}
      </div>
    </section>
  );
};

export default StatsBar;