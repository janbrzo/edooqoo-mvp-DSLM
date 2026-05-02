
import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Coins, Zap, Users } from 'lucide-react';

interface TokenPaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableTokens: number;
  profile?: any;
  onUpgrade?: () => void;
}

export const TokenPaywallModal: React.FC<TokenPaywallModalProps> = ({ 
  isOpen,
  onClose,
  availableTokens, 
  profile,
  onUpgrade 
}) => {
  const currentPlan = profile?.subscription_type;
  const isDemo = !currentPlan || currentPlan === 'Free Demo';
  const tokensFrozen = profile?.is_tokens_frozen;

  const getUpgradeOptions = () => {
    if (tokensFrozen) {
      return (
        <div className="bg-destructive/10 p-4 rounded-lg text-center border border-destructive/20">
          <Coins className="w-8 h-8 mx-auto mb-2 text-destructive" />
          <h4 className="font-semibold">Tokens Frozen</h4>
          <p className="text-sm text-muted-foreground">Reactivate your subscription to unfreeze {availableTokens} tokens</p>
        </div>
      );
    }

    if (isDemo) {
      return (
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-secondary/50 p-4 rounded-lg text-center">
            <Users className="w-8 h-8 mx-auto mb-2 text-primary" />
            <h4 className="font-semibold">Side-Gig</h4>
            <p className="text-2xl font-bold">$9</p>
            <p className="text-sm text-muted-foreground">15 worksheets/month</p>
          </div>
          <div className="bg-primary/10 p-4 rounded-lg text-center border border-primary/20">
            <Zap className="w-8 h-8 mx-auto mb-2 text-primary" />
            <h4 className="font-semibold">Full-Time Plans</h4>
            <p className="text-2xl font-bold">From $19</p>
            <p className="text-sm text-muted-foreground">30-120 worksheets/month</p>
          </div>
        </div>
      );
    }

    if (currentPlan === 'Side-Gig') {
      return (
        <div className="bg-primary/10 p-4 rounded-lg text-center border border-primary/20">
          <Zap className="w-8 h-8 mx-auto mb-2 text-primary" />
          <h4 className="font-semibold">Upgrade to Full-Time</h4>
          <p className="text-2xl font-bold">From $19</p>
          <p className="text-sm text-muted-foreground">30-120 worksheets/month</p>
        </div>
      );
    }

    if (currentPlan?.startsWith('Full-Time')) {
      const currentLimit = profile?.monthly_worksheet_limit || 0;
      if (currentLimit < 120) {
        return (
          <div className="bg-primary/10 p-4 rounded-lg text-center border border-primary/20">
            <Zap className="w-8 h-8 mx-auto mb-2 text-primary" />
            <h4 className="font-semibold">Upgrade Full-Time Plan</h4>
            <p className="text-sm text-muted-foreground">Get more worksheets per month</p>
            <div className="mt-2 space-y-1 text-xs">
              {currentLimit < 60 && <p>• 60 worksheets - $39/month</p>}
              {currentLimit < 90 && <p>• 90 worksheets - $59/month</p>}
              {currentLimit < 120 && <p>• 120 worksheets - $79/month</p>}
            </div>
          </div>
        );
      }
    }

    return null;
  };

  const getTitle = () => {
    if (tokensFrozen) return "Subscription Expired";
    if (isDemo) return "No Tokens Remaining";
    return "Upgrade Your Plan";
  };

  const getDescription = () => {
    if (tokensFrozen) {
      return `You have ${availableTokens} tokens but they are frozen. Reactivate your subscription to continue.`;
    }
    
    if (isDemo) {
      return `You have ${availableTokens} tokens left. Choose a subscription plan to continue generating worksheets.`;
    }
    
    return `You have ${availableTokens} tokens left. Upgrade your ${currentPlan} to get more tokens.`;
  };

  const upgradeOptions = getUpgradeOptions();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-center">
          <Coins className="w-12 h-12 mx-auto mb-4 text-primary" />
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>
            {getDescription()}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {upgradeOptions && (
            <div className="space-y-4">
              {upgradeOptions}
            </div>
          )}
          <Button asChild className="w-full">
            <Link to="/pricing">
              {tokensFrozen ? "Reactivate Subscription" : 
               isDemo ? "Choose Your Plan" : "Upgrade Plan"}
            </Link>
          </Button>
          <div className="flex gap-2 pt-4">
            <Button asChild variant="outline" className="flex-1">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
