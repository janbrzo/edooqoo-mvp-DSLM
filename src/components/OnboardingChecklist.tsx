import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';
import { ChevronUp, ChevronDown, Check, User, FileText, Share2, X, BookOpen } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import Confetti from 'react-confetti';
import { AddStudentDialog } from '@/components/dashboard/AddStudentDialog';

export const OnboardingChecklist = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [completionAnimation, setCompletionAnimation] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isTemporarilyDismissed, setIsTemporarilyDismissed] = useState(false);
  const [addStudentModalOpen, setAddStudentModalOpen] = useState(false);
  const { progress, loading, dismissOnboarding, getCompletionPercentage, shouldShow, refreshProgress } = useOnboardingProgress();
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
  };

  const completionPercentage = getCompletionPercentage();

  const steps = [
    {
      key: 'add_student',
      label: 'Add your first student',
      icon: User,
      completed: progress.steps.add_student,
      action: () => setAddStudentModalOpen(true)
    },
    {
      key: 'generate_worksheet',
      label: 'Generate your first worksheet',
      icon: FileText,
      completed: progress.steps.generate_worksheet,
      action: () => navigate('/')
    },
    {
      key: 'share_worksheet',
      label: 'Share the worksheet',
      icon: Share2,
      completed: progress.steps.share_worksheet,
      action: () => navigate('/dashboard')
    },
    {
      key: 'create_homework',
      label: 'Create homework assignment',
      icon: BookOpen,
      completed: progress.steps.create_homework,
      action: () => navigate('/dashboard')
    }
  ];

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
      <div className={`fixed bottom-6 left-6 z-[70] transition-opacity duration-1000 ${
        progress.completed && completionAnimation ? 'opacity-100' : 'animate-fade-in opacity-100'
      }`}>
        <Card className="shadow-lg border-2 border-primary/20 bg-white/95 backdrop-blur-sm">
          {!isExpanded ? (
            // Minimized view - compact with only icon and percentage
            <div 
              className="p-3 flex items-center gap-2 cursor-pointer hover:bg-muted/50 transition-colors rounded-lg" 
              onClick={() => setIsExpanded(true)}
            >
              <span className="text-2xl">🚀</span>
              <Badge variant="secondary" className="text-sm font-semibold">
                {completionPercentage}%
              </Badge>
            </div>
          ) : (
            // Expanded view - full content
            <>
              <CardHeader 
                className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center flex-1 min-w-0">
                    <CardTitle className="text-sm whitespace-nowrap truncate">Get started with Edooqoo 🚀</CardTitle>
                  </div>
                  <div className="flex items-center flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTemporaryDismiss();
                      }}
                      className="h-6 w-6 p-0 mr-2 hover:bg-destructive/20"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Progress value={completionPercentage} className="h-2 flex-1" />
                  <Badge variant="secondary" className="text-xs ml-2 flex-shrink-0">
                    {completionPercentage}%
                  </Badge>
                </div>
              </CardHeader>
            </>
          )}

          {isExpanded && (
            <CardContent className="pt-0 animate-accordion-down">
              <div className="space-y-3">
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

                {steps.map((step) => {
                  const IconComponent = step.icon;
                  return (
                    <div
                      key={step.key}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                        step.completed 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-muted/20 border-border hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-full ${
                          step.completed ? 'bg-green-100' : 'bg-muted'
                        }`}>
                          {step.completed ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <IconComponent className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <span className={`text-sm ${
                          step.completed ? 'text-green-700 line-through' : 'text-foreground'
                        }`}>
                          {step.label}
                        </span>
                      </div>
                      
                      {!step.completed && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={step.action}
                          className="h-8 text-xs"
                        >
                          {step.key === 'add_student' ? 'Add' : 'Start'}
                        </Button>
                      )}
                    </div>
                  );
                })}

                {!progress.completed && (
                  <div className="pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={dismissOnboarding}
                      className="w-full text-xs text-muted-foreground hover:text-foreground"
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