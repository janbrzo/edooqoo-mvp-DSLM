import React from 'react';
import { User, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Student {
  id: string;
  name: string;
  english_level: string;
  updated_at: string;
}

interface StudentSwitcherPopoverProps {
  students: Student[];
  currentStudentId: string;
  onSelect: (studentId: string) => void;
}

export function StudentSwitcherPopover({ students, currentStudentId, onSelect }: StudentSwitcherPopoverProps) {
  const [open, setOpen] = React.useState(false);

  // Sort by updated_at DESC (same as dashboard)
  const sorted = React.useMemo(
    () => [...students].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [students]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1 mr-3 p-1 rounded-md hover:bg-muted transition-colors cursor-pointer"
          title="Switch student"
        >
          <User className="h-8 w-8 text-blue-600" />
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="px-3 py-2 border-b">
          <p className="text-sm font-medium">Switch Student</p>
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
            {sorted.map(s => (
              <button
                key={s.id}
                className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between transition-colors ${
                  s.id === currentStudentId
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'hover:bg-muted'
                }`}
                onClick={() => {
                  if (s.id !== currentStudentId) {
                    onSelect(s.id);
                  }
                  setOpen(false);
                }}
              >
                <span className="truncate">{s.name}</span>
                <Badge variant="secondary" className="text-xs ml-2 shrink-0">
                  {s.english_level}
                </Badge>
              </button>
            ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
