import React, { useState, useEffect } from 'react';
import { Paintbrush, Sun, Moon, Monitor, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';

const PATTERNS = [
  { id: 'particles', label: 'Particles', preview: '✦' },
  { id: 'isometric', label: 'Isometric Grid', preview: '◇' },
  { id: 'dots', label: 'Dots', preview: '·' },
  { id: 'waves', label: 'Waves', preview: '~' },
  { id: 'crosshatch', label: 'Cross Hatch', preview: '×' },
  { id: 'clean', label: 'Clean', preview: '○' },
] as const;

type PatternId = typeof PATTERNS[number]['id'];

const STORAGE_KEY = 'edooqoo-bg-pattern';

const THEMES = [
  { id: 'system' as const, label: 'System', icon: Monitor },
  { id: 'light' as const, label: 'Light', icon: Sun },
  { id: 'dark' as const, label: 'Dark', icon: Moon },
];

export const BackgroundPatternSwitcher: React.FC = () => {
  const [activePattern, setActivePattern] = useState<PatternId>('particles');
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  // Load saved pattern on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as PatternId | null;
    if (saved && PATTERNS.some(p => p.id === saved)) {
      setActivePattern(saved);
      applyPattern(saved);
    } else {
      applyPattern('particles');
    }
  }, []);

  const applyPattern = (pattern: PatternId) => {
    const shell = document.querySelector('.auth-bg-shell');
    if (shell) {
      shell.setAttribute('data-pattern', pattern);
    }
    window.dispatchEvent(new CustomEvent('edooqoo-bg-pattern-changed', { detail: pattern }));
  };

  const handleSelect = (pattern: PatternId) => {
    setActivePattern(pattern);
    localStorage.setItem(STORAGE_KEY, pattern);
    applyPattern(pattern);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="fixed left-4 bottom-4 z-40 w-10 h-10 p-0 shadow-lg bg-background/95 backdrop-blur-sm"
          title="Change background pattern"
        >
          <Paintbrush className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-48 p-2">
        <p className="text-xs font-medium text-muted-foreground mb-2 px-1">Background</p>
        <div className="space-y-1">
          {PATTERNS.map((pattern) => (
            <Button
              key={pattern.id}
              variant="ghost"
              size="sm"
              onClick={() => handleSelect(pattern.id)}
              className={cn(
                "w-full justify-start gap-2 h-8 text-xs",
                activePattern === pattern.id && "bg-primary text-primary-foreground"
              )}
            >
              <span className="text-base w-5 text-center">{pattern.preview}</span>
              {pattern.label}
            </Button>
          ))}
        </div>
        <div className="border-t mt-2 pt-2">
          <p className="text-xs font-medium text-muted-foreground mb-2 px-1">Theme</p>
          <div className="space-y-1">
            {THEMES.map((t) => {
              const Icon = t.icon;
              return (
                <Button
                  key={t.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => setTheme(t.id)}
                  className={cn(
                    "w-full justify-start gap-2 h-8 text-xs",
                    theme === t.id && "bg-primary text-primary-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </Button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
