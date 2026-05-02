import React from 'react';

export interface Step {
  number: number;
  title: string;
  description: string;
  mockup?: React.ReactNode;
}

interface FeatureStepsProps {
  title?: string;
  subtitle?: string;
  steps: Step[];
}

const FeatureSteps: React.FC<FeatureStepsProps> = ({
  title = 'How it works',
  subtitle,
  steps,
}) => (
  <section className="py-16 bg-secondary/20">
    <div className="max-w-5xl mx-auto px-4">
      <div className="text-center mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-2">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="space-y-12">
        {steps.map((step, i) => (
          <div
            key={step.number}
            className={`flex flex-col ${i % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-8`}
          >
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                  {step.number}
                </span>
                <h3 className="font-semibold text-foreground text-lg">{step.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed pl-11">{step.description}</p>
            </div>
            {step.mockup && (
              <div className="flex-1 w-full">
                <div className="rounded-xl border border-border bg-card shadow-lg overflow-hidden p-4">
                  {step.mockup}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default FeatureSteps;
