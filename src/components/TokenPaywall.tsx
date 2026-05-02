
import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Coins, Zap, Users } from 'lucide-react';

interface TokenPaywallProps {
  isDemo: boolean;
  tokenLeft: number;
  profile?: any;
  onUpgrade?: () => void;
}

export const TokenPaywall: React.FC<TokenPaywallProps> = ({ 
  isDemo, 
  tokenLeft,
  profile,
  onUpgrade 
}) => {
  const currentPlan = profile?.subscription_type;
  const tokensFrozen = profile?.is_tokens_frozen;

  if (isDemo) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader className="text-center">
          <Zap className="w-12 h-12 mx-auto mb-4 text-primary" />
          <CardTitle>Ready to Generate More?</CardTitle>
          <CardDescription>
            Sign up for a free account to get tokens and generate unlimited worksheets
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-primary/10 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Free Account Benefits:</h4>
            <ul className="text-sm space-y-1">
              <li>• 2 free tokens to start</li>
              <li>• Save and manage students</li>
              <li>• Access to all worksheet types</li>
              <li>• Choose from subscription plans</li>
            </ul>
          </div>
          <Button asChild className="w-full">
            <Link to="/auth">Sign Up for Free</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/auth">Sign In</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Handle frozen tokens case
  if (tokensFrozen) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader className="text-center">
          <Coins className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <CardTitle>Subscription Expired</CardTitle>
          <CardDescription>
            Your tokens are currently frozen. Reactivate your subscription to continue generating worksheets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-destructive/10 p-4 rounded-lg border border-destructive/20">
            <h4 className="font-semibold mb-2 text-destructive">Available Tokens: {tokenLeft} (Frozen)</h4>
            <p className="text-sm">Your tokens will be available again once you reactivate your subscription.</p>
          </div>
          <Button asChild className="w-full">
            <Link to="/pricing">Reactivate Subscription</Link>
          </Button>
          <div className="flex gap-2 pt-4">
            <Button asChild variant="outline" className="flex-1">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link to="/profile">Profile</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getUpgradeContent = () => {
    if (!currentPlan || currentPlan === 'Free Demo') {
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
            <h4 className="font-semibold">Upgrade Your Plan</h4>
            <p className="text-sm text-muted-foreground mb-2">Get more worksheets per month</p>
            <div className="text-xs space-y-1">
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

  const upgradeContent = getUpgradeContent();

  return (
    <Card className="max-w-md mx-auto mt-8">
      <CardHeader className="text-center">
        <Coins className="w-12 h-12 mx-auto mb-4 text-primary" />
        <CardTitle>
          {currentPlan && currentPlan !== 'Free Demo' ? 'Upgrade Your Plan' : 'No Tokens Remaining'}
        </CardTitle>
        <CardDescription>
          {currentPlan && currentPlan !== 'Free Demo' 
            ? `You have ${tokenLeft} tokens left. Upgrade your ${currentPlan} to get more tokens.`
            : `You have ${tokenLeft} tokens left. Choose a subscription plan to get more tokens.`
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {upgradeContent}
        <Button asChild className="w-full">
          <Link to="/pricing">
            {currentPlan && currentPlan !== 'Free Demo' ? 'Upgrade Plan' : 'Choose Your Plan'}
          </Link>
        </Button>
        <div className="flex gap-2 pt-4">
          <Button asChild variant="outline" className="flex-1">
            <Link to="/dashboard">Dashboard</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link to="/profile">Profile</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
