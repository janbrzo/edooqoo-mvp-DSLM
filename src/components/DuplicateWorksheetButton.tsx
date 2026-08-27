import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { DuplicateWorksheetModal } from './DuplicateWorksheetModal';
import { useDemoContext } from '@/contexts/DemoContext';

interface DuplicateWorksheetButtonProps {
  worksheetId: string;
  worksheetTitle: string;
  onDuplicate: () => void;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export const DuplicateWorksheetButton = ({ 
  worksheetId, 
  worksheetTitle, 
  onDuplicate,
  variant = 'ghost',
  size = 'sm',
  className = ''
}: DuplicateWorksheetButtonProps) => {
  const [modalOpen, setModalOpen] = useState(false);
  const { isDemoMode, showDemoBlockedToast } = useDemoContext();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering parent onClick handlers
    if (isDemoMode) { showDemoBlockedToast('Duplicating worksheets'); return; }
    setModalOpen(true);
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        title="Duplicate worksheet"
        aria-label="Duplicate worksheet"
        className={className}
      >
        <Copy className="h-4 w-4" />
        {size !== 'icon' && <span className="ml-1">Duplicate</span>}
      </Button>
      
      <DuplicateWorksheetModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        worksheetId={worksheetId}
        worksheetTitle={worksheetTitle}
        onSuccess={onDuplicate}
      />
    </>
  );
};
