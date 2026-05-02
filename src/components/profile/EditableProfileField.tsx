
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, X, Edit2 } from 'lucide-react';

interface EditableProfileFieldProps {
  label: string;
  value: string | null;
  placeholder?: string;
  onSave: (value: string) => void;
  disabled?: boolean;
}

export const EditableProfileField = ({ 
  label, 
  value, 
  placeholder = 'Not set', 
  onSave,
  disabled = false 
}: EditableProfileFieldProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value || '');
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div>
        <label className="text-sm font-medium text-muted-foreground">{label}</label>
        <div className="flex items-center gap-2 mt-1">
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
            autoFocus
            disabled={disabled}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleSave}
            disabled={disabled}
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            disabled={disabled}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="text-sm font-medium text-muted-foreground">{label}</label>
      <div 
        className="flex items-center justify-between group cursor-pointer hover:bg-muted/30 p-2 rounded -ml-2"
        onClick={() => !disabled && setIsEditing(true)}
      >
        <p className="text-lg">{value || placeholder}</p>
        {!disabled && (
          <Button
            size="sm"
            variant="ghost"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Edit2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
};
