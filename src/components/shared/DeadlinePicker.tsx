/**
 * DeadlinePicker — DSLM v5.0
 *
 * Reusable deadline input with two modes:
 *  1. Quick-pick dropdown (default): 1w, 2w, 1mo, 3mo, 6mo, 12mo, 2y → today + N days.
 *  2. Custom date toggle: switches to native date input (calendar).
 *
 * Value is always an ISO date string (YYYY-MM-DD) or empty string for "no deadline".
 */
import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarIcon } from 'lucide-react';

interface DeadlinePickerProps {
  value: string; // ISO date string or ''
  onChange: (value: string) => void;
  className?: string;
  /** Render compact (h-8) inputs */
  compact?: boolean;
}

const PRESETS: { label: string; days: number }[] = [
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
  { label: '6 months', days: 180 },
  { label: '12 months', days: 365 },
  { label: '2 years', days: 730 },
];

const toIsoDate = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const matchPreset = (value: string): number | null => {
  if (!value) return null;
  const target = new Date(value).getTime();
  const now = Date.now();
  const diffDays = Math.round((target - now) / 86400000);
  const found = PRESETS.find(p => Math.abs(p.days - diffDays) <= 1);
  return found ? found.days : null;
};

export const DeadlinePicker: React.FC<DeadlinePickerProps> = ({ value, onChange, className, compact }) => {
  // If incoming value matches a preset, default to dropdown; otherwise (custom date) start in custom mode.
  const [customMode, setCustomMode] = useState<boolean>(() => !!value && matchPreset(value) === null);

  // Keep custom mode if user has a non-preset date already set.
  useEffect(() => {
    if (value && matchPreset(value) === null) setCustomMode(true);
  }, [value]);

  const presetValue = matchPreset(value);
  const inputCls = compact ? 'h-8' : '';

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <CalendarIcon className="h-3 w-3" /> {customMode ? 'Custom date' : 'Quick pick'}
        </span>
        <div className="flex items-center gap-1.5">
          <Label htmlFor="deadline-custom-toggle" className="text-[11px] text-muted-foreground cursor-pointer">
            Custom date
          </Label>
          <Switch
            id="deadline-custom-toggle"
            checked={customMode}
            onCheckedChange={(checked) => {
              setCustomMode(checked);
              if (!checked) onChange(''); // clear when switching back to dropdown
            }}
          />
        </div>
      </div>

      {customMode ? (
        <Input
          type="date"
          className={inputCls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Select
          value={presetValue !== null ? String(presetValue) : ''}
          onValueChange={(v) => {
            if (!v) { onChange(''); return; }
            onChange(toIsoDate(parseInt(v, 10)));
          }}
        >
          <SelectTrigger className={inputCls}>
            <SelectValue placeholder="Select deadline…" />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map(p => (
              <SelectItem key={p.days} value={String(p.days)}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};