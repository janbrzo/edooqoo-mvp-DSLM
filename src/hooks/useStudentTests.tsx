/**
 * Hook for managing student tests
 * Provides CRUD operations and integration with Progress module
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  StudentTest, 
  TestQuestion, 
  TestSkillResult, 
  NewTestData, 
  NewQuestionData,
  TestStatus,
  QuestionData,
  CorrectAnswer 
} from '@/types/studentTests';
import type { Json } from '@/integrations/supabase/types';
import { toast } from 'sonner';

interface UseStudentTestsProps {
  studentId?: string;
  teacherId?: string;
}

export function useStudentTests({ studentId, teacherId }: UseStudentTestsProps) {
  const [tests, setTests] = useState<StudentTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all tests for a student
  const fetchTests = useCallback(async () => {
    if (!studentId || !teacherId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('student_tests')
        .select('*')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setTests((data as StudentTest[]) || []);
    } catch (err) {
      console.error('Error fetching tests:', err);
      setError('Failed to load tests');
    } finally {
      setLoading(false);
    }
  }, [studentId, teacherId]);

  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  // Create a new test
  const createTest = useCallback(async (testData: NewTestData): Promise<StudentTest | null> => {
    if (!teacherId) return null;

    try {
      const { data, error: createError } = await supabase
        .from('student_tests')
        .insert({
          ...testData,
          teacher_id: teacherId,
          linked_element_ids: testData.linked_element_ids || [],
          // Plan v6.0 — attempt tracking
          attempt_number: testData.attempt_number ?? 1,
          previous_attempt_id: testData.previous_attempt_id ?? null,
        })
        .select()
        .single();

      if (createError) throw createError;

      const newTest = data as StudentTest;
      setTests(prev => [newTest, ...prev]);
      toast.success('Test created successfully');
      return newTest;
    } catch (err) {
      console.error('Error creating test:', err);
      toast.error('Failed to create test');
      return null;
    }
  }, [teacherId]);

  // Update test
  const updateTest = useCallback(async (
    testId: string, 
    updates: Partial<Omit<StudentTest, 'generation_params'>> & { generation_params?: Json }
  ): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('student_tests')
        .update(updates as Record<string, unknown>)
        .eq('id', testId);

      if (updateError) throw updateError;

      setTests(prev => prev.map(t => t.id === testId ? { ...t, ...updates } as StudentTest : t));
      return true;
    } catch (err) {
      console.error('Error updating test:', err);
      toast.error('Failed to update test');
      return false;
    }
  }, []);

  // Soft delete test
  const deleteTest = useCallback(async (testId: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from('student_tests')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', testId);

      if (deleteError) throw deleteError;

      setTests(prev => prev.filter(t => t.id !== testId));
      toast.success('Test deleted');
      return true;
    } catch (err) {
      console.error('Error deleting test:', err);
      toast.error('Failed to delete test');
      return false;
    }
  }, []);

  // Fetch test with questions
  const fetchTestWithQuestions = useCallback(async (testId: string): Promise<StudentTest | null> => {
    try {
      const { data: testData, error: testError } = await supabase
        .from('student_tests')
        .select('*')
        .eq('id', testId)
        .single();

      if (testError) throw testError;

      const { data: questionsData, error: questionsError } = await supabase
        .from('student_test_questions')
        .select('*')
        .eq('test_id', testId)
        .order('question_index', { ascending: true });

      if (questionsError) throw questionsError;

      const { data: resultsData } = await supabase
        .from('test_skill_results')
        .select('*')
        .eq('test_id', testId);

      return {
        ...testData,
        questions: questionsData as TestQuestion[],
        skill_results: resultsData as TestSkillResult[],
      } as StudentTest;
    } catch (err) {
      console.error('Error fetching test with questions:', err);
      return null;
    }
  }, []);

  // Add questions to test
  const addQuestions = useCallback(async (
    testId: string, 
    questions: NewQuestionData[]
  ): Promise<TestQuestion[]> => {
    try {
      // Get current max index
      const { data: existing } = await supabase
        .from('student_test_questions')
        .select('question_index')
        .eq('test_id', testId)
        .order('question_index', { ascending: false })
        .limit(1);

      const startIndex = existing && existing.length > 0 ? existing[0].question_index + 1 : 0;

      const questionsToInsert = questions.map((q, i) => ({
        test_id: testId,
        question_index: startIndex + i,
        question_type: q.question_type,
        question_text: q.question_text,
        question_data: (q.question_data || {}) as Json,
        correct_answer: q.correct_answer as Json,
        explanation: q.explanation || null,
        element_type: q.element_type || null,
        difficulty_level: q.difficulty_level || 3,
        skill_tags: q.skill_tags || [],
      }));

      const { data, error: insertError } = await supabase
        .from('student_test_questions')
        .insert(questionsToInsert)
        .select();

      if (insertError) throw insertError;

      // Update total_questions count
      await supabase
        .from('student_tests')
        .update({ total_questions: startIndex + questions.length })
        .eq('id', testId);

      return data as TestQuestion[];
    } catch (err) {
      console.error('Error adding questions:', err);
      toast.error('Failed to add questions');
      return [];
    }
  }, []);


  // Delete question
  const deleteQuestion = useCallback(async (questionId: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from('student_test_questions')
        .delete()
        .eq('id', questionId);

      if (deleteError) throw deleteError;
      return true;
    } catch (err) {
      console.error('Error deleting question:', err);
      return false;
    }
  }, []);

  // Generate share token. For welcome tests we use a 90-day TTL because they
  // are profiling assessments often sent days/weeks before the student starts.
  // All other test types keep the legacy 30-day TTL.
  const generateShareToken = useCallback(async (testId: string, testType?: string): Promise<string | null> => {
    if (!teacherId) return null;

    // Resolve test_type from local state if caller did not pass it.
    const resolvedType = testType ?? tests.find(t => t.id === testId)?.test_type;
    const expiresHours = resolvedType === 'welcome' ? 90 * 24 : 30 * 24;

    try {
      const { data, error: rpcError } = await supabase
        .rpc('generate_test_share_token', {
          p_test_id: testId,
          p_teacher_id: teacherId,
          p_expires_hours: expiresHours
        });

      if (rpcError) throw rpcError;

      // Update local state
      setTests(prev => prev.map(t => 
        t.id === testId ? { ...t, share_token: data, status: 'assigned' as TestStatus } : t
      ));

      // Also update status to assigned
      await supabase
        .from('student_tests')
        .update({ status: 'assigned', assigned_at: new Date().toISOString() })
        .eq('id', testId);

      toast.success('Share link generated');
      return data;
    } catch (err) {
      console.error('Error generating share token:', err);
      toast.error('Failed to generate share link');
      return null;
    }
  }, [teacherId, tests]);

  // Calculate and finalize test results
  const calculateResults = useCallback(async (testId: string): Promise<boolean> => {
    try {
      const { data, error: rpcError } = await supabase
        .rpc('calculate_test_results', { p_test_id: testId });

      if (rpcError) throw rpcError;

      // Refresh the test data
      await fetchTests();
      toast.success('Test results calculated');
      return true;
    } catch (err) {
      console.error('Error calculating results:', err);
      toast.error('Failed to calculate results');
      return false;
    }
  }, [fetchTests]);

  // Apply skill results to Progress (Learning Elements)
  const applyResultsToProgress = useCallback(async (
    testId: string,
    results: TestSkillResult[]
  ): Promise<boolean> => {
    try {
      // For each result with a suggested_rating, update or create learning element
      for (const result of results) {
        if (result.applied_to_element_id) {
          // Update existing element
          await supabase
            .from('student_learning_elements')
            .update({
              current_rating: result.suggested_rating,
              last_rated_at: new Date().toISOString(),
            })
            .eq('id', result.applied_to_element_id);
        }

        // Mark as applied
        await supabase
          .from('test_skill_results')
          .update({ applied_at: new Date().toISOString() })
          .eq('id', result.id);
      }

      // Mark test as reviewed
      await updateTest(testId, { 
        status: 'reviewed', 
        reviewed_at: new Date().toISOString() 
      });

      toast.success('Results applied to Progress');
      return true;
    } catch (err) {
      console.error('Error applying results:', err);
      toast.error('Failed to apply results');
      return false;
    }
  }, [updateTest]);

  // Get test statistics
  const getTestStats = useCallback(() => {
    const total = tests.length;
    const completed = tests.filter(t => t.status === 'completed' || t.status === 'reviewed').length;
    const avgScore = tests
      .filter(t => t.score_percentage !== null)
      .reduce((sum, t) => sum + (t.score_percentage || 0), 0) / (completed || 1);

    return { total, completed, avgScore };
  }, [tests]);

  return {
    tests,
    loading,
    error,
    refetch: fetchTests,
    createTest,
    updateTest,
    deleteTest,
    fetchTestWithQuestions,
    addQuestions,
    deleteQuestion,
    generateShareToken,
    calculateResults,
    applyResultsToProgress,
    getTestStats,
  };
}

// Hook for students taking tests (via share token)
export function useStudentTestSession(shareToken: string | null) {
  const [test, setTest] = useState<StudentTest | null>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!shareToken) {
      setLoading(false);
      return;
    }

    const fetchTest = async () => {
      try {
        setLoading(true);

        // Get test by share token
        const { data: testData, error: testError } = await supabase
          .rpc('get_test_by_share_token', { p_share_token: shareToken });

        if (testError) throw testError;
        if (!testData || testData.length === 0) {
          setError('Test not found or expired');
          return;
        }

        const testInfo = testData[0];

        // Get questions
        const { data: questionsData, error: questionsError } = await supabase
          .from('student_test_questions')
          .select('*')
          .eq('test_id', testInfo.id)
          .order('question_index', { ascending: true });

        if (questionsError) throw questionsError;

        setTest(testInfo as unknown as StudentTest);
        setQuestions(questionsData as TestQuestion[]);

        // Update test status if not started
        if (testInfo.status === 'assigned') {
          await supabase
            .from('student_tests')
            .update({ status: 'in_progress', started_at: new Date().toISOString() })
            .eq('id', testInfo.id);
        }
      } catch (err) {
        console.error('Error fetching test:', err);
        setError('Failed to load test');
      } finally {
        setLoading(false);
      }
    };

    fetchTest();
  }, [shareToken]);

  // Submit answer for current question
  const submitAnswer = useCallback(async (
    questionId: string, 
    answer: unknown,
    timeSpent: number
  ): Promise<boolean> => {
    try {
      const question = questions.find(q => q.id === questionId);
      if (!question) return false;

      // Check if answer is correct
      const isCorrect = checkAnswer(question, answer);

      const { error: updateError } = await supabase
        .from('student_test_questions')
        .update({
          student_answer: answer as Json,
          is_correct: isCorrect,
          answered_at: new Date().toISOString(),
          time_spent_seconds: timeSpent,
        })
        .eq('id', questionId);

      if (updateError) throw updateError;

      // Update local state
      setQuestions(prev => prev.map(q => 
        q.id === questionId 
          ? { ...q, student_answer: answer as typeof q.student_answer, is_correct: isCorrect }
          : q
      ));

      return true;
    } catch (err) {
      console.error('Error submitting answer:', err);
      return false;
    }
  }, [questions]);

  // Complete the test
  const completeTest = useCallback(async (): Promise<boolean> => {
    if (!test) return false;

    try {
      const { error: rpcError } = await supabase
        .rpc('calculate_test_results', { p_test_id: test.id });

      if (rpcError) throw rpcError;
      return true;
    } catch (err) {
      console.error('Error completing test:', err);
      return false;
    }
  }, [test]);

  return {
    test,
    questions,
    loading,
    error,
    currentIndex,
    setCurrentIndex,
    submitAnswer,
    completeTest,
    progress: questions.length > 0 
      ? questions.filter(q => q.student_answer !== null).length / questions.length * 100 
      : 0,
  };
}

// Helper function to check if answer is correct
function checkAnswer(question: TestQuestion, studentAnswer: unknown): boolean {
  const correct = question.correct_answer;

  switch (question.question_type) {
    case 'multiple_choice':
      if (Array.isArray(correct)) {
        const answerArray = Array.isArray(studentAnswer) ? studentAnswer : [studentAnswer];
        return JSON.stringify(correct.sort()) === JSON.stringify(answerArray.sort());
      }
      return correct === studentAnswer;

    case 'true_false':
      return correct === studentAnswer;

    case 'fill_blank':
      if (typeof correct === 'string' && typeof studentAnswer === 'string') {
        return correct.toLowerCase().trim() === studentAnswer.toLowerCase().trim();
      }
      if (Array.isArray(correct) && Array.isArray(studentAnswer)) {
        return correct.every((c, i) => 
          typeof c === 'string' && typeof studentAnswer[i] === 'string' &&
          c.toLowerCase().trim() === studentAnswer[i].toLowerCase().trim()
        );
      }
      return false;

    case 'matching':
      return JSON.stringify(correct) === JSON.stringify(studentAnswer);

    case 'sentence_order':
      if (Array.isArray(correct) && Array.isArray(studentAnswer)) {
        return JSON.stringify(correct) === JSON.stringify(studentAnswer);
      }
      return false;

    case 'open_ended':
      // Open-ended requires AI grading, default to needs review
      return false;

    default:
      return false;
  }
}
