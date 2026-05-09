import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Users, ChevronDown } from 'lucide-react';
import { useStudents } from '@/hooks/useStudents';

/**
 * v6.9.13 — Global student switcher in StickyNav.
 * Anchor-based items so middle-click / Ctrl/Cmd-click open the student page
 * in a new tab natively (browser default for <a href>).
 */
export const NavStudentSwitcher: React.FC = () => {
  const navigate = useNavigate();
  const { students = [], loading } = useStudents();
  const [open, setOpen] = React.useState(false);

  const sorted = React.useMemo(
    () => [...students].sort(
      (a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    ),
    [students]
  );

  if (!loading && sorted.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Users className="h-4 w-4" />
          Students
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="px-3 py-2 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Switch to student
        </div>
        <div className="max-h-80 overflow-y-auto p-1">
          {loading && (
            <div className="px-3 py-2 text-sm text-muted-foreground">Loading…</div>
          )}
          {!loading && sorted.map((s: any) => (
            <a
              key={s.id}
              href={`/student/${s.id}`}
              onClick={(e) => {
                // Let browser handle modifier / aux-clicks → opens new tab
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
                e.preventDefault();
                navigate(`/student/${s.id}`);
                setOpen(false);
              }}
              className="block px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors"
              title="Click to open · Middle/Ctrl-click for new tab"
            >
              <div className="font-medium truncate">{s.name}</div>
              <div className="text-[11px] text-muted-foreground truncate">
                {s.english_level}
              </div>
            </a>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
