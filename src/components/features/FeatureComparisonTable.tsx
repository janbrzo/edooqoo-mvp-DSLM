import React from 'react';
import { Check, X } from 'lucide-react';

export interface ComparisonRow {
  feature: string;
  edooqoo: boolean | string;
  competitors: (boolean | string)[];
}

interface FeatureComparisonTableProps {
  title?: string;
  competitorNames: string[];
  rows: ComparisonRow[];
}

const Cell: React.FC<{ value: boolean | string }> = ({ value }) => {
  if (typeof value === 'string') return <span className="text-xs text-muted-foreground">{value}</span>;
  return value ? <Check className="h-4 w-4 text-green-600 mx-auto" /> : <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />;
};

const FeatureComparisonTable: React.FC<FeatureComparisonTableProps> = ({
  title = 'How Edooqoo compares',
  competitorNames,
  rows,
}) => (
  <section className="py-16 bg-background">
    <div className="max-w-4xl mx-auto px-4">
      <h2 className="text-2xl font-bold text-foreground mb-8 text-center">{title}</h2>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary/50">
              <th className="text-left p-3 font-medium text-muted-foreground">Feature</th>
              <th className="p-3 font-semibold text-primary text-center">Edooqoo</th>
              {competitorNames.map(n => (
                <th key={n} className="p-3 font-medium text-muted-foreground text-center">{n}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-card' : 'bg-secondary/20'}>
                <td className="p-3 text-foreground text-xs">{row.feature}</td>
                <td className="p-3 text-center"><Cell value={row.edooqoo} /></td>
                {row.competitors.map((v, ci) => (
                  <td key={ci} className="p-3 text-center"><Cell value={v} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </section>
);

export default FeatureComparisonTable;
