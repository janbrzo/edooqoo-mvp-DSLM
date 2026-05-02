import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { BookOpen, Eye, Brain } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FlashcardSet } from '@/types/flashcards';

export default function StudentPortal() {
  const { studentEmail } = useParams<{ studentEmail: string }>();
  const navigate = useNavigate();
  const [sets, setSets] = useState<FlashcardSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState('');

  useEffect(() => {
    if (studentEmail) {
      fetchStudentSets();
    }
  }, [studentEmail]);

  const fetchStudentSets = async () => {
    setLoading(true);
    try {
      // First get student info
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id, name, native_language')
        .eq('student_email', studentEmail)
        .is('deleted_at', null)
        .single();

      if (studentError) throw studentError;
      if (!studentData) {
        setLoading(false);
        return;
      }

      setStudentName(studentData.name);

      // Fetch all flashcard sets for this student
      const { data: setsData, error: setsError } = await supabase
        .from('flashcard_sets')
        .select(`
          *,
          student:students(name, native_language),
          teacher:profiles!flashcard_sets_teacher_id_fkey(first_name, last_name),
          cards:flashcard_cards(id)
        `)
        .eq('student_id', studentData.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (setsError) throw setsError;

      // Fetch progress for mastered count
      const { data: progressData } = await supabase
        .from('flashcard_progress')
        .select('set_id, repetition')
        .eq('learner_identifier', studentEmail || '')
        .gte('repetition', 4);  // Mastered = repetition >= 4

      // Calculate mastered count per set
      const masteredBySet: Record<string, number> = {};
      progressData?.forEach((p) => {
        masteredBySet[p.set_id] = (masteredBySet[p.set_id] || 0) + 1;
      });

      const formattedSets = setsData?.map((set: any) => ({
        ...set,
        student_name: set.student?.name,
        student_native_language: set.student?.native_language,
        teacher_name: set.teacher ? `${set.teacher.first_name || ''} ${set.teacher.last_name || ''}`.trim() : undefined,
        cards_count: set.cards?.length || 0,
        mastered_count: masteredBySet[set.id] || 0,  // NEW: Add mastered count
      })) || [];

      setSets(formattedSets);
    } catch (error) {
      console.error('Error fetching student sets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBrowseSet = (token: string | null, setId: string) => {
    if (!token) {
      console.error('No share token available');
      return;
    }
    navigate(`/flashcards/${token}?mode=browse&email=${encodeURIComponent(studentEmail || '')}`);
  };

  const handleStudySet = (token: string | null) => {
    if (!token) {
      console.error('No share token available');
      return;
    }
    navigate(`/flashcards/${token}?email=${encodeURIComponent(studentEmail || '')}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">Loading your flashcard sets...</div>
      </div>
    );
  }

  if (!studentName) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Student not found</h1>
          <p className="text-muted-foreground">
            The email <strong>{studentEmail}</strong> is not associated with any student account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold mb-2">
              Welcome, {studentName}! 👋
            </h1>
            <p className="text-lg text-muted-foreground">
              Your Flashcard Sets
            </p>
          </div>

          {/* Sets Grid */}
          {sets.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-lg border">
              <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">No flashcard sets yet</h2>
              <p className="text-muted-foreground">
                Your teacher hasn't shared any flashcard sets with you yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sets.map((set) => (
                <Card key={set.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg line-clamp-2">
                          {set.title}
                        </CardTitle>
                        {set.description && (
                          <CardDescription className="line-clamp-2 mt-1">
                            {set.description}
                          </CardDescription>
                        )}
                      </div>
                      <BookOpen className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">
                        {set.cards_count || 0} cards
                      </Badge>
                      {set.is_bidirectional && (
                        <Badge variant="outline">↔️ Bidirectional</Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {set.back_type === 'translation' ? '🌐 Native' : '📖 Definition'}
                      </Badge>
                      {/* NEW: Mastered badge */}
                      {set.mastered_count > 0 && (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                          ✅ {set.mastered_count}/{set.cards_count} mastered
                        </Badge>
                      )}
                    </div>

                    {set.teacher_name && (
                      <p className="text-xs text-muted-foreground">
                        By {set.teacher_name}
                      </p>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBrowseSet(set.share_token, set.id)}
                        className="flex-1"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Browse
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleStudySet(set.share_token)}
                        className="flex-1"
                      >
                        <Brain className="w-3 h-3 mr-1" />
                        Study
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}