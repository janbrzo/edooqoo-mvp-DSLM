import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { X } from 'lucide-react';
import { FlashcardDisplay } from '@/components/flashcards/FlashcardDisplay';
import { LearningProgress } from '@/components/flashcards/LearningProgress';
import { SessionSummary } from '@/components/flashcards/SessionSummary';
import { useFlashcardLearning } from '@/hooks/useFlashcardLearning';

export default function FlashcardsLearning() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'study';
  const emailFromUrl = searchParams.get('email');
  const returnTo = searchParams.get('returnTo');
  const [setData, setSetData] = useState<any>(null);
  const [learnerEmail, setLearnerEmail] = useState('');
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allCards, setAllCards] = useState<any[]>([]);

  const learning = useFlashcardLearning(
    setData?.id || '',
    learnerEmail
  );

  useEffect(() => {
    if (emailFromUrl) {
      setLearnerEmail(emailFromUrl);
      setEmailSubmitted(true);
      if (mode === 'study' && setData?.id) {
        learning.loadSession();
      }
    }
  }, [emailFromUrl, mode, setData?.id]);

  useEffect(() => {
    if (token) fetchSetData();
  }, [token]);

  const fetchSetData = async () => {
    try {
      const { data, error } = await supabase.rpc('get_flashcard_set_by_share_token', {
        p_share_token: token,
      });
      if (error) throw error;
      if (data && data.length > 0) {
        setSetData(data[0]);
        if (mode === 'browse') await fetchAllCards(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching flashcard set:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllCards = async (setId: string) => {
    try {
      const { data, error } = await supabase
        .from('flashcard_cards')
        .select('*')
        .eq('set_id', setId)
        .is('deleted_at', null)
        .order('card_position', { ascending: true });
      if (error) throw error;
      setAllCards(data || []);
    } catch (error) {
      console.error('Error fetching cards:', error);
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (learnerEmail.trim()) {
      setEmailSubmitted(true);
      if (mode === 'study') learning.loadSession();
    }
  };

  const handleQuit = () => {
    if (returnTo) {
      window.location.href = returnTo;
      return;
    }
    // Fallback
    window.location.href = '/';
  };

  const getDashboardUrl = () => {
    if (returnTo && returnTo.includes('/flashcards')) {
      return returnTo.replace(/\/flashcards$/, '');
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!setData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Flashcard set not found</h1>
          <p className="text-muted-foreground">This link may be invalid or expired</p>
        </div>
      </div>
    );
  }

  if (!emailSubmitted && !emailFromUrl) {
    return (
      <div className="min-h-screen relative">
        <div className="absolute inset-0 blur-sm opacity-40 pointer-events-none overflow-hidden">
          <div className="container mx-auto px-4 py-6">
            <h1 className="text-3xl font-bold mb-4">{setData.title}</h1>
            <p className="text-muted-foreground mb-8">{setData.description}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-32 bg-muted/50 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 p-4">
          <div className="bg-background rounded-lg shadow-xl p-6 w-full max-w-md space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-2">{setData.title}</h1>
              {setData.description && <p className="text-muted-foreground">{setData.description}</p>}
              <p className="text-sm text-muted-foreground mt-4">
                By {setData.teacher_first_name} {setData.teacher_last_name}
              </p>
            </div>
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Your Email</Label>
                <Input id="email" type="email" value={learnerEmail} onChange={(e) => setLearnerEmail(e.target.value)} placeholder="Enter your email to track progress" required className="mt-1.5" />
                <p className="text-xs text-muted-foreground mt-1">We'll save your progress using this email</p>
              </div>
              <Button type="submit" className="w-full" size="lg">
                Start Learning ({setData.cards_count} cards)
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Browse mode
  if (mode === 'browse' && emailSubmitted) {
    return (
      <div className="min-h-screen">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">{setData.title}</h1>
            <div className="flex items-center gap-2">
              {getDashboardUrl() && (
                <Button variant="outline" onClick={() => window.location.href = getDashboardUrl()!}>
                  <X className="w-4 h-4 mr-2" /> Back to Dashboard
                </Button>
              )}
              <Button variant="outline" onClick={handleQuit}>
                <X className="w-4 h-4 mr-2" /> {returnTo?.includes('/flashcards') ? 'Back to Flashcards' : 'Back to Dashboard'}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allCards.map((card) => (
              <Card key={card.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Front:</p>
                      <p className="text-lg font-semibold">{card.front_text}</p>
                      {card.front_example && <p className="text-sm text-muted-foreground italic mt-1">{card.front_example}</p>}
                    </div>
                    <div className="border-t pt-4">
                      <p className="text-sm text-muted-foreground mb-1">Back:</p>
                      <p className="text-lg">{card.back_text}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Study mode - session complete
  if (learning.isSessionComplete) {
    return (
      <SessionSummary
        stats={learning.sessionStats}
        onRestart={learning.restartSession}
        setTitle={setData.title}
        studentEmail={setData?.student_email || learnerEmail}
        returnTo={returnTo || undefined}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="container mx-auto px-4 py-6 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <LearningProgress
            current={learning.currentIndex + 1}
            total={learning.cards.length}
            stats={learning.sessionStats}
          />
          <Button variant="outline" size="sm" onClick={handleQuit}>
            <X className="w-4 h-4 mr-2" /> Quit
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center py-8">
          {learning.currentCard && (
            <FlashcardDisplay
              card={learning.currentCard}
              onReview={learning.submitReview}
              nativeLanguage={setData.student_native_language}
            />
          )}
        </div>
      </div>
    </div>
  );
}
