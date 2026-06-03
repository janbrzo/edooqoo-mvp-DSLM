
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { EmailConfirmationModal } from '@/components/EmailConfirmationModal';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { DashboardPreviewBackground } from '@/components/DashboardPreviewBackground';
import { claimPendingWorksheets, getPendingClaimIds } from '@/hooks/useWorksheetClaim';
import { toast as sonnerToast } from 'sonner';
import { devLog } from '@/utils/logger';

const Signup = () => {
  useEffect(() => {
    document.title = "Start 1-Minute Prep Free — Edooqoo | 2 Free Worksheets";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Create your free Edooqoo account, add your first student, and start building the context for 1-Minute Prep. Includes 2 free worksheets. No credit card required.');
  }, []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [schoolInstitution, setSchoolInstitution] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const signupState = location.state as { from?: string; startOneMinutePrep?: boolean } | null;
  const fromPath = signupState?.from || '/';
  const shouldStartOneMinutePrep = signupState?.startOneMinutePrep === true || fromPath.startsWith('/one-minute-prep');
  // v6.9.34 — ALWAYS land on the generator with Add Student modal queued up
  // after a fresh signup. This is the 1-Minute Prep onboarding entry point.
  const postSignupPath = fromPath !== '/' && !shouldStartOneMinutePrep
    ? fromPath
    : '/?action=add-student';
  const hasPendingClaims = getPendingClaimIds().length > 0;

  // After auth completes (including email-confirmed sessions returning here),
  // claim any pending anonymous worksheets and redirect appropriately.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session && !session.user.is_anonymous) {
        const claimedIds = await claimPendingWorksheets();
        if (claimedIds.length > 0) {
          sonnerToast.success(
            claimedIds.length === 1
              ? 'Your worksheet was saved to your account'
              : `${claimedIds.length} worksheets saved to your account`
          );
          navigate(`/worksheet/${claimedIds[0]}`);
        } else {
          navigate(postSignupPath);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate, postSignupPath]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive"
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Error", 
        description: "Password must be at least 6 characters long",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${shouldStartOneMinutePrep ? '/?action=add-student' : '/'}`,
          data: {
            first_name: firstName,
            last_name: lastName,
            school_institution: schoolInstitution
          }
        }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast({
            title: "Account exists",
            description: "This email is already registered. Please sign in instead.",
            variant: "destructive"
          });
          return;
        }
        throw error;
      }

      if (data?.user && !data.session) {
        // Email confirmation required
        setRegisteredEmail(email);
        setShowEmailModal(true);
        devLog('Account created, email confirmation required');
      } else if (data?.session) {
        // Immediate login (shouldn't happen with email confirmation enabled)
        toast({
          title: "Success",
          description: "Account created and signed in successfully!",
        });
        navigate(postSignupPath);
      }

    } catch (error: any) {
      console.error('Signup error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create account",
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
      
      {/* Signup Modal Dialog */}
      <Dialog open={true} onOpenChange={(open) => !open && navigate(fromPath)}>
        <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="sr-only">
            <DialogTitle>Create Account</DialogTitle>
            <DialogDescription>Sign up for a free Edooqoo account</DialogDescription>
          </DialogHeader>
          <Card className="border-0 shadow-none">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold text-center">Create Account</CardTitle>
              <CardDescription className="text-center">
                Add your first student and start building context for 1-Minute Prep.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <GoogleSignInButton mode="signup" disabled={loading} />
                
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

                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Input
                        type="text"
                        placeholder="First Name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Input
                        type="text"
                        placeholder="Last Name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  
                  <Input
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  
                  <Input
                    type="text"
                    placeholder="School/Institution (Optional)"
                    value={schoolInstitution}
                    onChange={(e) => setSchoolInstitution(e.target.value)}
                  />
                  
                  <Input
                    type="password"
                    placeholder="Password (min. 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  
                  <Input
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-worksheet-purple hover:bg-worksheet-purpleDark"
                    disabled={loading}
                  >
                    {loading ? 'Creating Account...' : 'Create Account'}
                  </Button>
                </form>
              </div>
              
              <div className="mt-4 text-center space-y-2">
                <p className="text-sm text-gray-600">
                  Already have an account?{' '}
                  <Link to="/login" className="text-worksheet-purple hover:underline font-medium">
                    Sign in here
                  </Link>
                </p>
                <p>
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                    onClick={() => navigate('/demo')}
                  >
                    🎯 Try Demo First — explore without signing up
                  </button>
                </p>
              </div>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>

      <EmailConfirmationModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        email={registeredEmail}
      />
    </>
  );
};

export default Signup;
