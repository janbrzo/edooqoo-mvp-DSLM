import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Users, UserPlus } from 'lucide-react';
import { useDemoContext } from '@/contexts/DemoContext';

interface EmptyDashboardProps {
  onAddStudent: () => void;
}

/** v6.9.109 — the only thing a teacher with 0 students sees: one block, one action. */
export const EmptyDashboard: React.FC<EmptyDashboardProps> = ({ onAddStudent }) => {
  const { isDemoMode } = useDemoContext();

  return (
    <section
      aria-labelledby="empty-dashboard-heading"
      className="rounded-xl border border-dashed border-border px-6 py-16 text-center"
    >
      <Users className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
      <h2 id="empty-dashboard-heading" className="mt-4 text-xl font-semibold text-foreground">
        Add your first student
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Edooqoo builds the learner context once, then every weekly prep starts from it.
      </p>
      <Button className="mt-6" onClick={onAddStudent}>
        <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
        Add your first student
      </Button>
      {!isDemoMode && (
        <Link to="/demo" className="mt-3 block text-xs text-muted-foreground hover:text-foreground">
          See a sample student instead
        </Link>
      )}
    </section>
  );
};

export default EmptyDashboard;
