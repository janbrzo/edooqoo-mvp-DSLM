
import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { DashboardPreviewBackground } from '@/components/DashboardPreviewBackground';
import { setRobotsMeta } from '@/hooks/useCanonical';
import { claimPendingWorksheets } from '@/hooks/useWorksheetClaim';
import { toast as sonnerToast } from 'sonner';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as { from?: string } | null)?.from || '/';

  useEffect(() => {
    document.title = "Log In — Edooqoo 1-Minute Prep for English Teachers";
    // SEO: auth form has no value in Google index
    const cleanup = setRobotsMeta("noindex, follow");
    return cleanup;
  }, []);

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && !session.user.is_anonymous) {
        const claimedIds = await claimPendingWorksheets();
        if (claimedIds.length > 0) {
          sonnerToast.success(
            claimedIds.length === 1
              ? 'Your worksheet was saved to your account'
              : `${claimedIds.length} worksheets saved to your account`
          );
          navigate(`/worksheet/${claimedIds[0]}`);
        } else {
          navigate(fromPath !== '/' ? fromPath : '/dashboard');
        }
      }
    };
    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session && !session.user.is_anonymous) {
        const claimedIds = await claimPendingWorksheets();
        if (claimedIds.length > 0) {
          sonnerToast.success(
            claimedIds.length === 1
              ? 'Your worksheet was saved to your account'
              : `${claimedIds.length} worksheets saved to your account`
          );
          navigate(`/worksheet/${claimedIds[0]}`);
        } else {
          navigate(fromPath !== '/' ? fromPath : '/dashboard');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, fromPath]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast({
            title: "Invalid credentials",
            description: "Please check your email and password.",
            variant: "destructive"
          });
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Dashboard Preview Background */}
      <DashboardPreviewBackground />
      
      {/* Login Modal Dialog */}
      <Dialog open={true} onOpenChange={(open) => !open && navigate(fromPath)}>
        <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="sr-only">
            <DialogTitle>Log In</DialogTitle>
            <DialogDescription>Sign in to your Edooqoo account</DialogDescription>
          </DialogHeader>
          <Card className="border-0 shadow-none">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Log In</CardTitle>
                  <CardDescription>Welcome back! Please sign in to your account.</CardDescription>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => navigate('/')}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <GoogleSignInButton mode="signin" disabled={loading} />
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                </div>

                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <Link
                        to="/forgot-password"
                        className="text-sm text-primary hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Loading...' : 'Log In'}
                  </Button>
                </form>
              </div>

              <div className="mt-4 text-center space-y-2">
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                  onClick={() => navigate('/signup', { state: { from: fromPath } })}
                >
                  Don't have an account? Get started
                </button>
              </div>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Login;
