import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StudentHubLayout } from '@/components/student-hub/StudentHubLayout';
import { useStudentHubData, getSavedHubEmail } from '@/hooks/useStudentHubData';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Eye, Brain, Loader2 } from 'lucide-react';

const StudentHubFlashcards = () => {
  const { teacherToken } = useParams<{ teacherToken: string }>();
  const navigate = useNavigate();
  const email = getSavedHubEmail();

  useEffect(() => { if (!email) navigate('/my'); }, [email, navigate]);

  const { data, loading } = useStudentHubData(teacherToken, email || undefined);

  if (!email) return null;

  const returnToPath = `/my/${teacherToken}/flashcards`;

  return (
    <StudentHubLayout studentName={data?.studentName} teacherName={data?.teacherName}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="h-5 w-5" /> Flashcards</h1>
          <p className="text-sm text-muted-foreground mt-1">All your flashcard sets</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !data || data.flashcardSets.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No flashcard sets shared yet.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.flashcardSets.map(set => (
              <Card key={set.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg line-clamp-2">{set.title}</CardTitle>
                  {set.description && <CardDescription className="line-clamp-2">{set.description}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{set.cards_count} cards</Badge>
                    {set.is_bidirectional && <Badge variant="outline">↔️ Bidirectional</Badge>}
                    <Badge variant="outline" className="text-xs">
                      {set.back_type === 'translation' ? '🌐 Native' : '📖 Definition'}
                    </Badge>
                    {set.mastered_count > 0 && (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                        ✅ {set.mastered_count}/{set.cards_count} mastered
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1"
                      onClick={() => navigate(`/flashcards/${set.share_token}?mode=browse&email=${encodeURIComponent(email)}&returnTo=${encodeURIComponent(returnToPath)}`)}>
                      <Eye className="w-3 h-3 mr-1" /> Browse
                    </Button>
                    <Button size="sm" className="flex-1"
                      onClick={() => navigate(`/flashcards/${set.share_token}?email=${encodeURIComponent(email)}&returnTo=${encodeURIComponent(returnToPath)}`)}>
                      <Brain className="w-3 h-3 mr-1" /> Study
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </StudentHubLayout>
  );
};

export default StudentHubFlashcards;
