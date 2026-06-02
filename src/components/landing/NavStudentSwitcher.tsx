import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Users, ChevronDown, Plus } from 'lucide-react';
import { useStudents } from '@/hooks/useStudents';
import { AddStudentDialog } from '@/components/dashboard/AddStudentDialog';

/**
 * v6.9.13 — Global student switcher in StickyNav.
 * Anchor-based items so middle-click / Ctrl/Cmd-click open the student page
 * in a new tab natively (browser default for <a href>).
 */
export const NavStudentSwitcher: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { students = [], loading } = useStudents();
  const [open, setOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);

  const sorted = React.useMemo(
    () => [...students].sort(
      (a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    ),
    [students]
  );

  // v6.9.33 — show current student name when we're on /student/:id.
  const currentStudentId = React.useMemo(() => {
    const m = location.pathname.match(/^\/student\/([^/?#]+)/);
    return m ? m[1] : null;
  }, [location.pathname]);
  const currentStudent = currentStudentId
    ? students.find((s: any) => s.id === currentStudentId)
    : null;

  return (
    <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 max-w-[200px]">
          <Users className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{currentStudent?.name || 'Students'}</span>
          <ChevronDown className="h-3 w-3 opacity-60 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="px-3 py-2 border-b flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Switch to student
          </span>
          <button
            type="button"
            onClick={() => { setOpen(false); setAddOpen(true); }}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto p-1">
          {loading && (
            <div className="px-3 py-2 text-sm text-muted-foreground">Loading…</div>
          )}
          {!loading && sorted.length === 0 && (
            <div className="px-3 py-3 text-xs text-muted-foreground">
              No students yet. Add your first one below.
            </div>
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
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="font-medium truncate">{s.name}</span>
                {s.english_level && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                    {s.english_level}
                  </span>
                )}
              </div>
            </a>
          ))}
        </div>
      </PopoverContent>
    </Popover>
    <AddStudentDialog
      triggerButton={false}
      open={addOpen}
      onOpenChange={setAddOpen}
    />
    </>
  );
};
