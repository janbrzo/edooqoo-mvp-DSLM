import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';
import { ChevronDown, Check, User, FileText, X, ClipboardCheck, Target, Map, Lightbulb, MousePointerClick, Calendar, Lock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate, useLocation } from 'react-router-dom';
import Confetti from 'react-confetti';
import { AddStudentDialog } from '@/components/dashboard/AddStudentDialog';
import { useStudents } from '@/hooks/useStudents';
import { triggerSpotlight } from '@/hooks/useSpotlight';

export const OnboardingChecklist = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [completionAnimation, setCompletionAnimation] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isTemporarilyDismissed, setIsTemporarilyDismissed] = useState(false);
  const [addStudentModalOpen, setAddStudentModalOpen] = useState(false);
  const { progress, loading, dismissOnboarding, getCompletionPercentage, shouldShow, refreshProgress } = useOnboardingProgress();
  const { students } = useStudents();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const tempDismissed = sessionStorage.getItem('onboarding-temp-dismissed') === 'true';
    setIsTemporarilyDismissed(tempDismissed);
  }, []);

  useEffect(() => {
    if (progress.completed && !completionAnimation) {
      setShowConfetti(true);
      setCompletionAnimation(true);
      const timer = setTimeout(() => setShowConfetti(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [progress.completed, completionAnimation]);

  if (loading || !shouldShow() || isTemporarilyDismissed || location.pathname.startsWith('/my')) {
    return null;
  }

  const handleTemporaryDismiss = () => {
    setIsTemporarilyDismissed(true);
    sessionStorage.setItem('onboarding-temp-dismissed', 'true');
    // User explicitly hid the checklist → clear the force-show flag so the
    // next reload respects dismissed/completed state again.
    localStorage.removeItem('onboarding_force_show');
  };

  const completionPercentage = getCompletionPercentage();

  // Pick a target student for deep links — first real (non-demo) student if available.
  const firstStudentId = students?.[0]?.id;
  // v6.9.33 — append cache-buster so React Router fires a fresh navigation
  // even when the user clicks the same focus link twice in a row.
  const studentDeepLink = (suffix: string) => {
    if (!firstStudentId) return '/dashboard';
    const sep = suffix.includes('?') ? '&' : '?';
    return `/student/${firstStudentId}${suffix}${sep}_=${Date.now()}`;
  };
  const hasStudent = !!firstStudentId;

  // v6.9.34 — navigate AND re-fire the spotlight from the click handler.
  // This eliminates the "second click does nothing" bug where the URL was
  // already cleaned by a prior visit so the URL-driven effect no-ops.
  // We also kick off a `refreshProgress()` ~1.8s later so a completed
  // action (e.g. Generate Next Lesson Ideas) updates the checklist quickly.
  const navAndSpotlight = (suffix: string, focusId: string) => {
    navigate(studentDeepLink(suffix));
    setTimeout(() => triggerSpotlight({ id: focusId }), 700);
    setTimeout(() => { try { refreshProgress(); } catch {} }, 1800);
  };

  type Step = {
    key: string;
    label: string;
    icon: typeof User;
    completed: boolean;
    action: () => void;
    requiresStudent?: boolean;
  };

  const setupSteps: Step[] = [
    {
      key: 'add_student',
      label: 'Add your first real student',
      icon: User,
      completed: !!progress.steps.add_student,
      action: () => setAddStudentModalOpen(true),
    },
    {
      key: 'send_welcome_test',
      label: 'Send Welcome Test',
      icon: ClipboardCheck,
      completed: !!progress.steps.send_welcome_test,
      action: () => navAndSpotlight('?tab=dslm&view=pathway&focus=send-welcome-test', 'send-welcome-test'),
      requiresStudent: true,
    },
    {
      key: 'add_goals',
      label: 'Add learning goals',
      icon: Target,
      completed: !!progress.steps.add_goals,
      action: () => navAndSpotlight('?tab=dslm&view=goals&focus=add-goal-modal', 'add-goal-modal'),
      requiresStudent: true,
    },
    {
      key: 'generate_roadmap',
      label: 'Generate Learning Roadmap',
      icon: Map,
      completed: !!progress.steps.generate_roadmap,
      action: () => navAndSpotlight('?tab=dslm&view=pathway&focus=learning-roadmap', 'learning-roadmap'),
      requiresStudent: true,
    },
  ];

  const prepSteps: Step[] = [
    {
      key: 'generate_next_ideas',
      label: 'Generate Next Lesson Ideas',
      icon: Lightbulb,
      completed: !!progress.steps.generate_next_ideas,
      action: () => navAndSpotlight('?tab=dslm&view=pathway&focus=next-lesson-ideas', 'next-lesson-ideas'),
      requiresStudent: true,
    },
    {
      key: 'pick_idea',
      label: 'Use one Next Lesson suggestion',
      icon: MousePointerClick,
      completed: !!progress.steps.pick_idea,
      action: () => navAndSpotlight('?tab=dslm&view=pathway&focus=pick-idea', 'pick-idea'),
      requiresStudent: true,
    },
    {
      key: 'generate_worksheet',
      label: 'Create a worksheet',
      icon: FileText,
      completed: !!progress.steps.generate_worksheet,
      action: () => navigate('/'),
    },
    {
      key: 'setup_calendar',
      label: 'Set up your calendar for lesson bookings',
      icon: Calendar,
      completed: !!(progress.steps as any).setup_calendar,
      action: () => navigate('/calendar'),
    },
  ];

  const renderStep = (step: Step) => {
    const IconComponent = step.icon;
    const locked = !!step.requiresStudent && !hasStudent && !step.completed;
    return (
      <div
        key={step.key}
        className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
          step.completed
            ? 'bg-green-50 border-green-200'
            : locked
            ? 'bg-muted/10 border-border opacity-70'
            : 'bg-muted/20 border-border hover:bg-muted/40'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-1.5 rounded-full flex-shrink-0 ${step.completed ? 'bg-green-100' : 'bg-muted'}`}>
            {step.completed ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : locked ? (
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <IconComponent className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <span className={`text-[12px] block leading-tight ${step.completed ? 'text-green-700 line-through' : 'text-foreground'}`}>
              {step.label}
            </span>
            {locked && (
              <span className="text-[10px] text-muted-foreground">Add a student first</span>
            )}
          </div>
        </div>
        {!step.completed && (
          locked ? (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>
                    <Button size="sm" variant="outline" disabled className="h-7 text-[11px] px-2">
                      Start
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left">Add a student first</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Button size="sm" variant="outline" onClick={step.action} className="h-7 text-[11px] px-2 flex-shrink-0">
              {step.key === 'add_student' ? 'Add' : 'Start'}
            </Button>
          )
        )}
      </div>
    );
  };

  return (
    <>
      {showConfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={300}
          gravity={0.3}
        />
      )}
      <div className={`fixed bottom-6 right-6 z-30 transition-opacity duration-1000 ${
        progress.completed && completionAnimation ? 'opacity-100' : 'animate-fade-in opacity-100'
      }`}>
        <Card className="shadow-lg border-2 border-primary/20 bg-white/95 backdrop-blur-sm max-w-[280px]">
          {!isExpanded ? (
            // Minimized view - compact with only icon and percentage
            <div 
              className="p-2 flex items-center gap-2 cursor-pointer hover:bg-muted/50 transition-colors rounded-lg" 
              onClick={() => setIsExpanded(true)}
            >
              <span className="text-lg">🚀</span>
              <Badge variant="secondary" className="text-[11px] font-semibold">
                {completionPercentage}%
              </Badge>
            </div>
          ) : (
            // Expanded view - full content
            <>
              <CardHeader 
                className="pb-2 px-3 pt-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center flex-1 min-w-0">
                    <CardTitle className="text-xs whitespace-nowrap truncate">Get started with Edooqoo 🚀</CardTitle>
                  </div>
                  <div className="flex items-center flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTemporaryDismiss();
                      }}
                      className="h-5 w-5 p-0 mr-1 hover:bg-destructive/20"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Progress value={completionPercentage} className="h-2 flex-1" />
                  <Badge variant="secondary" className="text-[10px] ml-2 flex-shrink-0">
                    {completionPercentage}%
                  </Badge>
                </div>
              </CardHeader>
            </>
          )}

          {isExpanded && (
            <CardContent className="pt-0 px-3 pb-3 animate-accordion-down max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                {progress.completed && (
                  <div className={`text-center p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border-2 border-green-200 transition-all duration-500 ${
                    completionAnimation ? 'animate-scale-in' : ''
                  }`}>
                    <div className="text-green-700 font-bold mb-2 text-lg">
                      🎉 Congratulations! You're all set up!
                    </div>
                    <div className="text-sm text-green-600">
                      You've completed all the onboarding steps. Happy teaching with Edooqoo!
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">
                    1. One-time student setup
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-1.5">
                    Teach Edooqoo about your student — one-time.
                  </p>
                  <div className="space-y-1.5">{setupSteps.map(renderStep)}</div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">
                    2. Weekly 1-Minute Prep
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-1.5">
                    Build context that moves prep toward 1 minute per student.
                  </p>
                  <div className="space-y-1.5">{prepSteps.map(renderStep)}</div>
                </div>

                {!progress.completed && (
                  <div className="pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={dismissOnboarding}
                      className="w-full text-[11px] h-7 text-muted-foreground hover:text-foreground"
                    >
                      Dismiss checklist
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
        
        {/* Add Student Modal - controlled externally */}
        <AddStudentDialog 
          triggerButton={false}
          open={addStudentModalOpen}
          onOpenChange={setAddStudentModalOpen}
          onStudentAdded={() => {
            setAddStudentModalOpen(false);
            refreshProgress();
          }}
        />
      </div>
    </>
  );
};

export default OnboardingChecklist;
