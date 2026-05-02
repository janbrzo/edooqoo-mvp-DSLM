import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FileText, BookOpen } from "lucide-react";

interface RenameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentTitle: string;
  onRename: (newTitle: string) => Promise<void>;
  type: 'worksheet' | 'homework';
}

const RenameDialog: React.FC<RenameDialogProps> = ({
  isOpen,
  onClose,
  currentTitle,
  onRename,
  type,
}) => {
  const [newTitle, setNewTitle] = useState(currentTitle);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setNewTitle(currentTitle);
    }
  }, [isOpen, currentTitle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || newTitle === currentTitle) {
      onClose();
      return;
    }

    setIsLoading(true);
    try {
      await onRename(newTitle.trim());
      onClose();
    } catch (error) {
      console.error('Error renaming:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const Icon = type === 'worksheet' ? FileText : BookOpen;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            Rename {type === 'worksheet' ? 'Worksheet' : 'Homework'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">New Title</Label>
              <Input
                id="title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Enter new title..."
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !newTitle.trim()}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RenameDialog;
