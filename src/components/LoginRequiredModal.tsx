import React from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, UserPlus, LogIn } from "lucide-react";

interface LoginRequiredModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName: string;
  description?: string;
}

export const LoginRequiredModal: React.FC<LoginRequiredModalProps> = ({
  open,
  onOpenChange,
  featureName,
  description
}) => {
  const navigate = useNavigate();

  const handleSignUp = () => {
    onOpenChange(false);
    navigate('/signup');
  };

  const handleLogin = () => {
    onOpenChange(false);
    navigate('/login');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md z-[100]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-full">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>{featureName} - Login Required</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            {description || `The "${featureName}" feature is available for registered users only. Create a free account to unlock this feature and get 2 free worksheet tokens!`}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/50 p-4 rounded-lg my-4">
          <h4 className="font-semibold text-sm mb-2">Benefits of creating a free account:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>✓ 2 free worksheet tokens</li>
            <li>✓ Student management & assignment</li>
            <li>✓ Flashcard creation</li>
            <li>✓ Homework assignments</li>
            <li>✓ Share worksheets with students</li>
            <li>✓ Worksheet history & editing</li>
          </ul>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleLogin} className="flex-1">
            <LogIn className="mr-2 h-4 w-4" />
            Log In
          </Button>
          <Button onClick={handleSignUp} className="flex-1 bg-primary hover:bg-primary/90">
            <UserPlus className="mr-2 h-4 w-4" />
            Sign Up Free
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
