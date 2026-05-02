import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export interface FAQItem {
  question: string;
  answer: string;
}

interface FeatureFAQProps {
  title?: string;
  items: FAQItem[];
}

const FeatureFAQ: React.FC<FeatureFAQProps> = ({ title = 'Frequently Asked Questions', items }) => (
  <section className="py-16 bg-background">
    <div className="max-w-3xl mx-auto px-4">
      <h2 className="text-2xl font-bold text-foreground mb-8 text-center">{title}</h2>
      <Accordion type="single" collapsible className="space-y-2">
        {items.map((item, i) => (
          <AccordionItem key={i} value={`faq-${i}`} className="border border-border rounded-xl px-4 bg-card">
            <AccordionTrigger className="text-sm font-medium text-foreground text-left">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  </section>
);

export default FeatureFAQ;
