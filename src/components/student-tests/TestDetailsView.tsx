/**
 * TestDetailsView - Detailed view of a test with questions and results
 * Used by teachers to review tests and apply results to Progress
 * Issues fixed: welcome test score (4), teacher notes (10), re-take (10), audio player (1)
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, 
  Share2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Target,
  TrendingUp,
  Loader2,
  Copy,
  ExternalLink,
  Sparkles,
  StickyNote,
  RotateCcw,
  Play,
  Pause,
  FileText,
  Download,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { useStudentTests } from '@/hooks/useStudentTests';
import { toast } from 'sonner';
import { ShareTestModal } from './ShareTestModal';
import { supabase } from '@/integrations/supabase/client';
import { WelcomeTestResults } from './WelcomeTestResults';
import { ALL_WELCOME_TEST_QUESTIONS } from '@/data/welcomeTestQuestions';
import { 
  TEST_STATUS_CONFIG, 
  TEST_TYPES, 
  ELEMENT_TYPES,
  type StudentTest, 
  type TestQuestion,
  type TestSkillResult 
} from '@/types/studentTests';

interface TestDetailsViewProps {
  testId: string;
  teacherId: string;
  studentId: string;
  onBack: () => void;
}

export function TestDetailsView({ testId, teacherId, studentId, onBack }: TestDetailsViewProps) {
  const { fetchTestWithQuestions, generateShareToken, applyResultsToProgress, calculateResults, createTest, addQuestions } = 
    useStudentTests({ studentId, teacherId });
  
  const [test, setTest] = useState<StudentTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharingLoading, setSharingLoading] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [studentEmail, setStudentEmail] = useState<string>('');
  const [teacherName, setTeacherName] = useState<string>('');
  const [retaking, setRetaking] = useState(false);

  useEffect(() => {
    loadTest();
    loadStudentAndTeacherInfo();
  }, [testId]);

  const loadTest = async () => {
    setLoading(true);
    const data = await fetchTestWithQuestions(testId);
    setTest(data);
    setLoading(false);
  };

  const loadStudentAndTeacherInfo = async () => {
    try {
      const { data: student } = await supabase
        .from('students')
        .select('student_email, name')
        .eq('id', studentId)
        .single();
      
      if (student?.student_email) setStudentEmail(student.student_email);
      
      const { data: teacher } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', teacherId)
        .single();
      
      if (teacher) {
        const name = [teacher.first_name, teacher.last_name].filter(Boolean).join(' ');
        setTeacherName(name || teacher.email || '');
      }
    } catch (error) {
      console.error('Error loading student/teacher info:', error);
    }
  };

  const handleGenerateShareLink = async () => {
    setSharingLoading(true);
    const token = await generateShareToken(testId);
    if (token) {
      const isWelcome = test?.test_type === 'welcome';
      const url = isWelcome 
        ? `${window.location.origin}/welcome-test/${token}`
        : `${window.location.origin}/test/${token}`;
      await navigator.clipboard.writeText(url);
      toast.success('Share link copied to clipboard!');
      loadTest();
    }
    setSharingLoading(false);
  };

  const handleApplyResults = async () => {
    if (!test?.skill_results) return;
    const success = await applyResultsToProgress(testId, test.skill_results);
    if (success) loadTest();
  };

  const handleCalculateResults = async () => {
    const success = await calculateResults(testId);
    if (success) loadTest();
  };

  // Re-take: archive current test, create new welcome test
  const handleRetake = async () => {
    if (!test || test.test_type !== 'welcome') return;
    setRetaking(true);
    try {
      // Do NOT soft-delete old test - keep results visible
      // Get student name
      const { data: student } = await supabase
        .from('students')
        .select('name')
        .eq('id', studentId)
        .single();

      // Create new test
      const newTest = await createTest({
        student_id: studentId,
        test_type: 'welcome',
        title: `Welcome Test - ${student?.name || 'Student'} (Retake)`,
        description: 'Comprehensive placement & learning profile assessment (retake)',
      });

      if (newTest) {
        const questionsToAdd = ALL_WELCOME_TEST_QUESTIONS.map(q => ({
          question_type: q.question_type as any,
          question_text: q.question_text,
          question_data: (q.options ? { options: q.options } : {}) as any,
          correct_answer: (q.correct_answer || '') as any,
          explanation: q.description || undefined,
          element_type: q.element_type as any,
          difficulty_level: q.difficulty_level,
          skill_tags: q.nano_skill ? [q.nano_skill] : [],
        }));
        await addQuestions(newTest.id, questionsToAdd);

        const token = await generateShareToken(newTest.id);
        if (token) {
          const url = `${window.location.origin}/welcome-test/${token}`;
          await navigator.clipboard.writeText(url);
          toast.success('New Welcome Test created! Link copied to clipboard.');
        }
        onBack(); // Go back to test list
      }
    } catch (err) {
      console.error('Error creating retake:', err);
      toast.error('Failed to create retake');
    } finally {
      setRetaking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!test) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Test not found</p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tests
        </Button>
      </div>
    );
  }

  const statusConfig = TEST_STATUS_CONFIG[test.status];
  const questions = test.questions || [];
  const isWelcomeTest = test.test_type === 'welcome';
  
  // No Quick Version logic - always show all questions
  const answeredQuestions = questions.filter(q => q.student_answer !== null);

  // Issue 4: For welcome tests, only count skill questions (those with correct_answer)
  const skillQuestions = isWelcomeTest 
    ? questions.filter(q => q.correct_answer && q.correct_answer !== '' && q.correct_answer !== '""')
    : questions;
  const correctSkillQuestions = skillQuestions.filter(q => q.is_correct === true);
  const skillScorePercent = skillQuestions.length > 0 
    ? Math.round((correctSkillQuestions.length / skillQuestions.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tests
        </Button>
        <div className="flex items-center gap-2 flex-wrap">
          {isWelcomeTest && (test.status === 'completed' || test.status === 'reviewed') && (
            <Button variant="outline" onClick={handleRetake} disabled={retaking}>
              {retaking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              Re-take Test
            </Button>
          )}
          {test.status === 'draft' && !test.share_token && (
            <Button onClick={handleGenerateShareLink} disabled={sharingLoading}>
              {sharingLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Share2 className="h-4 w-4 mr-2" />
                  Generate Share Link
                </>
              )}
            </Button>
          )}
          {test.share_token && (
            <Button variant="default" onClick={() => setShareModalOpen(true)}>
              <Share2 className="h-4 w-4 mr-2" />
              Share Test
            </Button>
          )}
        </div>
      </div>

      <ShareTestModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        shareToken={test.share_token}
        testTitle={test.title}
        studentEmail={studentEmail}
        teacherName={teacherName}
        testType={test.test_type}
      />

      {/* Test Info Card - Issue 4: separate skill score from total engagement */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">{test.title}</CardTitle>
              <p className="text-muted-foreground">{test.description}</p>
            </div>
            <Badge className={`${statusConfig.bgColor} ${statusConfig.color}`}>
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className={`grid ${isWelcomeTest ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-4'} gap-4`}>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold">{answeredQuestions.length}/{questions.length}</div>
              <div className="text-sm text-muted-foreground">Answered</div>
            </div>
            {isWelcomeTest ? (
              <>
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{skillScorePercent}%</div>
                  <div className="text-sm text-muted-foreground">Skill Score</div>
                </div>
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold">{correctSkillQuestions.length}/{skillQuestions.length}</div>
                  <div className="text-sm text-muted-foreground">Skill Questions Correct</div>
                </div>
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold">{questions.length - skillQuestions.length}</div>
                  <div className="text-sm text-muted-foreground">Profile Questions</div>
                </div>
              </>
            ) : (
              <>
                {test.score_percentage !== null && (
                  <>
                    <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{Math.round(test.score_percentage)}%</div>
                      <div className="text-sm text-muted-foreground">Score</div>
                    </div>
                    <div className="text-center p-4 bg-muted/30 rounded-lg">
                      <div className="text-2xl font-bold">{questions.filter(q => q.is_correct === true).length}/{questions.length}</div>
                      <div className="text-sm text-muted-foreground">Correct</div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
          {(isWelcomeTest ? skillScorePercent > 0 : test.score_percentage !== null) && (
            <div className="mt-4">
              <Progress value={isWelcomeTest ? skillScorePercent : (test.score_percentage || 0)} className="h-3" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Welcome Test Learning Profile - FIX 2.2: always show, even before completion */}
      {isWelcomeTest && (
        <WelcomeTestResults testId={testId} studentId={studentId} teacherId={teacherId} />
      )}

      {/* Actions for completed tests */}
      {test.status === 'completed' && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Apply Results to Progress</p>
                  <p className="text-sm text-muted-foreground">Update student's skill ratings based on test performance</p>
                </div>
              </div>
              <Button onClick={handleApplyResults}>Apply to Progress</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* In-progress test - calculate results button */}
      {test.status === 'in_progress' && answeredQuestions.length === questions.length && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-medium">All Questions Answered</p>
                  <p className="text-sm text-muted-foreground">Calculate final results and mark test as completed</p>
                </div>
              </div>
              <Button onClick={handleCalculateResults}>Calculate Results</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Skill Results - FIX 2.1: Hide for welcome tests (merged into WelcomeTestResults Skill Scores) */}
      {!isWelcomeTest && test.skill_results && test.skill_results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Results by Skill
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {test.skill_results.map((result) => {
                const elementLabel = ELEMENT_TYPES.find(e => e.value === result.element_type)?.label;
                const scorePercent = result.score_percentage || 0;
                return (
                  <div key={result.id} className="flex items-center gap-4">
                    <div className="w-32">
                      <Badge variant="outline">{elementLabel || result.element_type}</Badge>
                    </div>
                    <div className="flex-1">
                      <Progress value={scorePercent} className="h-2" />
                    </div>
                    <div className="w-24 text-right">
                      <span className="font-medium">{Math.round(scorePercent)}%</span>
                      <span className="text-muted-foreground text-sm ml-2">({result.correct_answers}/{result.total_questions})</span>
                    </div>
                    {result.applied_at && (
                      <Badge variant="secondary" className="text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />Applied
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Questions List */}
      <Card>
        <CardHeader>
          <CardTitle>Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {questions.map((question, index) => {
              return (
                <QuestionCard 
                  key={question.id} 
                  question={question} 
                  index={index} 
                  isWelcomeTest={isWelcomeTest}
                  testId={testId}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Enhanced QuestionCard with teacher notes and audio player
function QuestionCard({ question, index, isWelcomeTest, testId }: { 
  question: TestQuestion; 
  index: number; 
  isWelcomeTest: boolean;
  testId: string;
}) {
  const hasAnswer = question.student_answer !== null;
  const answerStr = String(question.student_answer || '');
  const isAudioAnswer = typeof question.student_answer === 'string' && (
    (answerStr.startsWith('https://pub-') || answerStr.includes('r2.dev')) ||
    (answerStr.startsWith('http') && (answerStr.includes('.webm') || answerStr.includes('.mp4') || answerStr.includes('.ogg')))
  );
  const isFailedRecording = typeof question.student_answer === 'string' && 
    /^recording_\d+/.test(answerStr) && !answerStr.startsWith('http');
  
  const [teacherNote, setTeacherNote] = useState<string>('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);
  const audioPlayerRef = useState<HTMLAudioElement | null>(null);

  // Load teacher note and transcription from question_data
  useEffect(() => {
    const qData = question.question_data as any;
    if (qData?.teacher_note) {
      setTeacherNote(qData.teacher_note);
    }
    // PROBLEM 1: Auto-load transcription saved by process-welcome-test
    if (qData?.transcription) {
      setTranscription(qData.transcription);
    }
  }, [question.question_data]);

  // Save teacher note on blur
  const saveTeacherNote = useCallback(async () => {
    if (!testId) return;
    setNoteLoading(true);
    try {
      const currentData = (question.question_data || {}) as any;
      await supabase
        .from('student_test_questions')
        .update({
          question_data: { ...currentData, teacher_note: teacherNote } as any,
        })
        .eq('id', question.id);
    } catch (err) {
      console.error('Error saving teacher note:', err);
    } finally {
      setNoteLoading(false);
    }
  }, [teacherNote, testId, question.id, question.question_data]);

  // Play audio answer
  const toggleAudio = () => {
    if (isPlayingAudio && audioPlayerRef[0]) {
      audioPlayerRef[0].pause();
      setIsPlayingAudio(false);
      return;
    }
    const audio = new Audio(String(question.student_answer));
    audioPlayerRef[0] = audio;
    audio.onended = () => setIsPlayingAudio(false);
    audio.play();
    setIsPlayingAudio(true);
  };

  // For welcome test: don't show ✓/✗ for profile questions (no correct_answer)
  const hasCorrectAnswer = question.correct_answer && question.correct_answer !== '' && question.correct_answer !== '""';
  const showCorrectness = isWelcomeTest ? hasCorrectAnswer : true;
  
  return (
    <div className={`p-4 rounded-lg border ${
      showCorrectness && question.is_correct === true 
        ? 'border-green-200 bg-green-50/50 dark:bg-green-900/10' 
        : showCorrectness && question.is_correct === false
        ? 'border-red-200 bg-red-50/50 dark:bg-red-900/10'
        : 'bg-muted/30'
    }`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {question.question_type.replace(/_/g, ' ')}
            </Badge>
            {question.element_type && (
              <Badge variant="secondary" className="text-xs">{question.element_type}</Badge>
            )}
            {showCorrectness && question.is_correct !== null && (
              question.is_correct ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )
            )}
          </div>
          <p className="mb-2 text-sm">{question.question_text}</p>
          
            {hasAnswer && (
            <div className="text-sm space-y-1">
              {isFailedRecording ? (
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Recording was not uploaded (saved as: {answerStr})</span>
                </div>
              ) : isAudioAnswer ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-muted-foreground">Student's answer:</span>
                     <Button variant="outline" size="sm" onClick={toggleAudio} className="gap-1.5 h-7">
                      {isPlayingAudio ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      {isPlayingAudio ? 'Pause' : 'Play Recording'}
                    </Button>
                  </div>
                  {transcription && (
                    <div className="p-2 bg-muted/50 rounded text-sm italic text-muted-foreground">
                      "{transcription}"
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground flex-shrink-0">Student's answer:</span>
                    <span className={showCorrectness && question.is_correct === true ? 'text-green-600 font-medium' : showCorrectness && question.is_correct === false ? 'text-red-600' : ''}>
                      {formatAnswer(question.student_answer)}
                    </span>
                  </div>
                  {showCorrectness && !question.is_correct && hasCorrectAnswer && (
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground flex-shrink-0">Correct answer:</span>
                      <span className="text-green-600 font-medium">{formatAnswer(question.correct_answer)}</span>
                    </div>
                  )}
                </>
              )}
              {question.explanation && (
                <p className="text-muted-foreground italic mt-2 text-xs">{question.explanation}</p>
              )}
            </div>
          )}

          {/* Teacher notes (Issue 10) */}
          <div className="mt-3 pt-2 border-t border-border/50">
            <div className="flex items-center gap-1.5 mb-1">
              <StickyNote className="h-3 w-3 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground font-medium">Teacher note</span>
              {noteLoading && <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground" />}
            </div>
            <Textarea
              value={teacherNote}
              onChange={(e) => setTeacherNote(e.target.value)}
              onBlur={saveTeacherNote}
              placeholder="Add a note about this answer..."
              className="min-h-[40px] text-xs resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function formatAnswer(answer: any): string {
  if (typeof answer === 'boolean') return answer ? 'True' : 'False';
  if (Array.isArray(answer)) return answer.join(', ');
  if (typeof answer === 'object' && answer !== null) return JSON.stringify(answer);
  return String(answer);
}
