import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { CheckCircle, Users, Zap, ArrowLeft } from 'lucide-react';
import { claimPendingWorksheets } from '@/hooks/useWorksheetClaim';
import { toast as sonnerToast } from 'sonner';

type PlanType = 'demo' | 'side-gig' | 'full-time' | null;

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [schoolInstitution, setSchoolInstitution] = useState('');
  const [isSignUp, setIsSignUp] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>(null);
  const [step, setStep] = useState<'plan' | 'auth'>('plan');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

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
          navigate('/dashboard');
        }
      }
    };
    checkUser();

    // Check for plan from URL params
    const planFromUrl = searchParams.get('plan') as PlanType;
    if (planFromUrl) {
      setSelectedPlan(planFromUrl);
      setStep('auth');
      setIsSignUp(true); // Default to sign up for plan selection
    } else {
      // If no plan specified, check if this is a login request
      const isLogin = searchParams.get('mode') === 'login';
      if (isLogin) {
        setStep('auth');
        setIsSignUp(false); // Show login form
      }
    }

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
          navigate('/dashboard');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, searchParams]);

  const handlePlanSelection = async (plan: PlanType) => {
    setSelectedPlan(plan);
    
    if (plan === 'demo') {
      setStep('auth');
    } else {
      // For paid plans, redirect to Stripe first
      try {
        setLoading(true);
        const planData = plan === 'side-gig' 
          ? { name: 'Side-Gig Plan', price: 9, tokens: 15 }
          : { name: 'Full-Time Plan (30 worksheets)', price: 19, tokens: 30 };

        const { data, error } = await supabase.functions.invoke('create-subscription', {
          body: {
            planType: plan,
            monthlyLimit: planData.tokens,
            price: planData.price,
            planName: planData.name,
            redirectToRegistration: true
          }
        });

        if (error) {
          throw error;
        }

        if (data?.url) {
          // Store plan info for after payment
          sessionStorage.setItem('pendingPlan', plan);
          window.location.href = data.url;
        }
      } catch (error: any) {
        console.error('Payment initiation error:', error);
        toast({
          title: "Payment Error",
          description: "There was an issue setting up your subscription. You can still register for Free Demo.",
          variant: "destructive"
        });
        // Fallback to demo plan
        setSelectedPlan('demo');
        setStep('auth');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            first_name: firstName,
            last_name: lastName,
            school_institution: schoolInstitution,
            account_type: selectedPlan
          }
        }
      });

      if (error) {
        if (error.message.includes('User already registered')) {
          toast({
            title: "Account exists",
            description: "This email is already registered. Please sign in instead.",
            variant: "destructive"
          });
          setIsSignUp(false);
        } else {
          throw error;
        }
      } else {
        // Add tokens for demo users after successful registration
        if (selectedPlan === 'demo') {
          setTimeout(async () => {
            try {
              const { error } = await supabase.functions.invoke('add-tokens', {
                body: { amount: 2, description: 'Welcome bonus for Free Demo account' }
              });
              if (error) {
                console.error('Error adding welcome tokens:', error);
              } else {
                toast({
                  title: "Welcome!",
                  description: "Your account has been created and you've received 2 free tokens to get started.",
                });
              }
            } catch (error) {
              console.error('Error adding welcome tokens:', error);
            }
          }, 1000);
        }
        
        toast({
          title: "Registration successful!",
          description: "Please check your email to confirm your account.",
        });
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

  const handleBackClick = () => {
    // If we came from a URL with a plan parameter, go back to previous page
    if (searchParams.get('plan')) {
      navigate(-1);
    } else {
      // Otherwise, show plan selection
      setStep('plan');
    }
  };

  const PlanSelection = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Choose Your Plan</h2>
        <p className="text-muted-foreground">Select the plan that works best for you</p>
      </div>

      <div className="grid gap-4">
        {/* Free Demo */}
        <Card 
          className={`cursor-pointer transition-all hover:border-primary/50 ${
            selectedPlan === 'demo' ? 'border-primary shadow-lg' : ''
          }`}
          onClick={() => handlePlanSelection('demo')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <CardTitle className="text-lg">Free Demo</CardTitle>
            </div>
            <Badge variant="secondary">2 worksheets</Badge>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-2xl font-bold">Free</p>
                <p className="text-sm text-muted-foreground">Try it out</p>
              </div>
              <Button variant="outline" disabled={loading}>
                {loading && selectedPlan === 'demo' ? 'Loading...' : 'Start Free'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Side-Gig Plan */}
        <Card 
          className={`cursor-pointer transition-all hover:border-primary/50 ${
            selectedPlan === 'side-gig' ? 'border-primary shadow-lg' : ''
          }`}
          onClick={() => handlePlanSelection('side-gig')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Side-Gig Plan</CardTitle>
            </div>
            <Badge variant="secondary">15 worksheets/month</Badge>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-2xl font-bold">$9<span className="text-lg text-muted-foreground">/month</span></p>
                <p className="text-sm text-muted-foreground">Part-time teaching</p>
              </div>
              <Button disabled={loading}>
                {loading && selectedPlan === 'side-gig' ? 'Processing...' : 'Choose Plan'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Full-Time Plan */}
        <Card 
          className={`cursor-pointer transition-all hover:border-primary/50 ${
            selectedPlan === 'full-time' ? 'border-primary shadow-lg' : ''
          }`}
          onClick={() => handlePlanSelection('full-time')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Full-Time Plan</CardTitle>
              <Badge className="ml-2">Popular</Badge>
            </div>
            <Badge variant="secondary">30+ worksheets/month</Badge>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-2xl font-bold">From $19<span className="text-lg text-muted-foreground">/month</span></p>
                <p className="text-sm text-muted-foreground">Professional teaching</p>
              </div>
              <Button disabled={loading}>
                {loading && selectedPlan === 'full-time' ? 'Processing...' : 'Choose Plan'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="text-center">
        <Button variant="ghost" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Generator
        </Button>
      </div>
    </div>
  );

  if (step === 'plan') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-6">
            <PlanSelection />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{isSignUp ? 'Create Account' : 'Log In'}</CardTitle>
              <CardDescription>
                {selectedPlan && (
                  <Badge variant="outline" className="mt-2">
                    {selectedPlan === 'demo' ? 'Free Demo' : 
                     selectedPlan === 'side-gig' ? 'Side-Gig Plan' : 'Full-Time Plan'}
                  </Badge>
                )}
              </CardDescription>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleBackClick}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-4">
            {isSignUp && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="school">School/Institution</Label>
                  <Input
                    id="school"
                    value={schoolInstitution}
                    onChange={(e) => setSchoolInstitution(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </>
            )}
            
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
              <Label htmlFor="password">Password</Label>
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
              {loading ? 'Loading...' : (isSignUp ? 'Create Account' : 'Log In')}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? 'Already have an account? Log in' : "Don't have an account? Get started"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
