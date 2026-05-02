
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DeleteWorksheetButtonProps {
  worksheetId: string;
  worksheetTitle: string;
  onDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
  variant?: 'ghost' | 'outline' | 'destructive';
  size?: 'sm' | 'default';
}

export const DeleteWorksheetButton = ({
  worksheetId,
  worksheetTitle,
  onDelete,
  variant = 'ghost',
  size = 'sm'
}: DeleteWorksheetButtonProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const { toast } = useToast();

  const handleDelete = async () => {
    setIsDeleting(true);
    
    try {
      const result = await onDelete(worksheetId);
      
      if (result.success) {
        toast({
          title: "Worksheet deleted",
          description: "The worksheet has been successfully deleted.",
        });
      } else {
        throw new Error(result.error || 'Failed to delete worksheet');
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete worksheet",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Worksheet</AlertDialogTitle>
          <AlertDialogDescription>
            Type the worksheet name to confirm deletion. This action can be undone later if needed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-3 py-4">
          <p className="text-sm text-muted-foreground">Worksheet name:</p>
          <div className="flex gap-2">
            <code className="flex-1 p-2 bg-muted rounded text-sm break-all">
              {worksheetTitle}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(worksheetTitle);
                toast({
                  title: "Copied",
                  description: "Worksheet name copied to clipboard",
                });
              }}
            >
              Copy
            </Button>
          </div>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type worksheet name here"
            className="mt-2"
          />
        </div>
        
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirmText('')}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isDeleting || confirmText !== worksheetTitle}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
