import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StudentHubLayout } from '@/components/student-hub/StudentHubLayout';
import { StudentHubStats } from '@/components/student-hub/StudentHubStats';
import { useStudentHubData, getSavedHubEmail } from '@/hooks/useStudentHubData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, ClipboardList, FileText, Calendar, Clock, ArrowRight, Eye, Brain, Video, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const StudentHubDashboard = () => {
  const { teacherToken } = useParams<{ teacherToken: string }>();
  const navigate = useNavigate();
  const email = getSavedHubEmail();

  useEffect(() => {
    if (!email) navigate('/my');
  }, [email, navigate]);

  const { data, loading, error } = useStudentHubData(teacherToken, email || undefined);

  if (!email) return null;

  if (loading) {
    return (
      <StudentHubLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </StudentHubLayout>
    );
  }

  if (error || !data) {
    return (
      <StudentHubLayout>
        <div className="text-center py-20">
          <p className="text-destructive mb-4">{error || 'Failed to load data'}</p>
          <Button variant="outline" onClick={() => navigate('/my')}>Back</Button>
        </div>
      </StudentHubLayout>
    );
  }

  const nextLesson = data.upcomingLessons[0] || null;

  return (
    <StudentHubLayout studentName={data.studentName} teacherName={data.teacherName}>
      <div className="space-y-8">
        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold">Welcome, {data.studentName}! 👋</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Teacher: {data.teacherName} {data.englishLevel ? `· Level: ${data.englishLevel}` : ''}
          </p>
        </div>

        {/* Stats */}
        <StudentHubStats stats={data.stats} nextLesson={nextLesson} teacherToken={teacherToken!} worksheetsCount={data.sharedWorksheets?.length || 0} />

        {/* Next Lesson */}
        {nextLesson ? (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Calendar className="h-4 w-4" /> Next Lesson</h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate(`/my/${teacherToken}/lessons`)}>
                  Book <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate(`/my/${teacherToken}/lessons`)}>
                  View all <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
            <Card>
              <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="text-center min-w-[50px]">
                    <p className="text-xs text-muted-foreground">{format(parseISO(nextLesson.slot_date), 'EEE')}</p>
                    <p className="text-xl font-bold">{format(parseISO(nextLesson.slot_date), 'd')}</p>
                    <p className="text-xs text-muted-foreground">{format(parseISO(nextLesson.slot_date), 'MMM')}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium text-sm">{nextLesson.start_time.slice(0, 5)} – {nextLesson.end_time.slice(0, 5)}</span>
                      {nextLesson.confirmed_at && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-xs">Confirmed</Badge>
                      )}
                    </div>
                    {nextLesson.title && <p className="text-xs text-muted-foreground mt-1">{nextLesson.title}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  {((data as any).defaultMeetingLink || nextLesson.meeting_link) && (
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => window.open((data as any).defaultMeetingLink || nextLesson.meeting_link, '_blank')}>
                      <Video className="h-3 w-3 mr-1" /> Join
                    </Button>
                  )}
                  {nextLesson.worksheet_share_token && (
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => window.open(`/shared/${nextLesson.worksheet_share_token}`, '_blank')}>
                      <FileText className="h-3 w-3 mr-1" /> Worksheet
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => {
                    const title = encodeURIComponent(`English Lesson`);
                    const startDt = `${nextLesson.slot_date.replace(/-/g, '')}T${nextLesson.start_time.slice(0, 5).replace(':', '')}00`;
                    const endDt = `${nextLesson.slot_date.replace(/-/g, '')}T${nextLesson.end_time.slice(0, 5).replace(':', '')}00`;
                    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDt}/${endDt}&ctz=Europe/Warsaw`, '_blank');
                  }}>
                    📅 Add to GCal
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        ) : (
          <section>
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-3"><Calendar className="h-4 w-4" /> Next Lesson</h2>
            <Card>
              <CardContent className="p-6 text-center space-y-3">
                <p className="text-sm text-muted-foreground">None scheduled</p>
                <Button onClick={() => navigate(`/my/${teacherToken}/lessons`)}>
                  Book Your First Lesson
                </Button>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Flashcards */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2"><BookOpen className="h-4 w-4" /> Flashcards</h2>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate(`/my/${teacherToken}/flashcards`)}>
              View all ({data.flashcardSets.length}) <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
          {data.flashcardSets.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No flashcard sets shared yet.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {data.flashcardSets.slice(0, 3).map(set => (
                <Card key={set.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm line-clamp-2">{set.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex gap-1.5 flex-wrap">
                      <Badge variant="secondary" className="text-xs">{set.cards_count} cards</Badge>
                      {set.mastered_count > 0 && (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                          ✅ {set.mastered_count}/{set.cards_count}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 text-xs h-7"
                        onClick={() => navigate(`/flashcards/${set.share_token}?mode=browse&email=${encodeURIComponent(email)}&returnTo=${encodeURIComponent(`/my/${teacherToken}/flashcards`)}`)}>
                        <Eye className="h-3 w-3 mr-1" /> Browse
                      </Button>
                      <Button size="sm" className="flex-1 text-xs h-7"
                        onClick={() => navigate(`/flashcards/${set.share_token}?email=${encodeURIComponent(email)}&returnTo=${encodeURIComponent(`/my/${teacherToken}/flashcards`)}`)}>
                        <Brain className="h-3 w-3 mr-1" /> Study
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Homework */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Homework</h2>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate(`/my/${teacherToken}/homework`)}>
              View all ({data.homeworks.length}) <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
          {data.homeworks.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No homework assigned yet.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {data.homeworks.slice(0, 3).map(hw => (
                <Card key={hw.id} className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => window.open(`/homework/${hw.share_token}`, '_blank')}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{hw.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {hw.deadline && (
                          <span className="text-xs text-muted-foreground">
                            Due: {format(parseISO(hw.deadline), 'MMM d, yyyy')}
                          </span>
                        )}
                        <Badge variant={hw.completed_at ? 'default' : 'secondary'} className="text-xs">
                          {hw.completed_at ? '✓ Completed' : `${hw.completed_exercises_count}/${hw.exercises_count} done`}
                        </Badge>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Shared Worksheets */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2"><FileText className="h-4 w-4" /> Shared Worksheets</h2>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate(`/my/${teacherToken}/worksheets`)}>
              View all ({data.sharedWorksheets.length}) <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
          {data.sharedWorksheets.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No worksheets shared yet.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {data.sharedWorksheets.slice(0, 3).map(ws => (
                <Card key={ws.id} className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => window.open(`/shared/${ws.share_token}`, '_blank')}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{ws.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {ws.english_level && <Badge variant="outline" className="text-xs">{ws.english_level}</Badge>}
                        <span className="text-xs text-muted-foreground">{ws.exercises_count} exercises</span>
                        {ws.linked_slot_date && (
                          <span className="text-xs text-muted-foreground">📅 {format(parseISO(ws.linked_slot_date), 'MMM d')}</span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </StudentHubLayout>
  );
};

export default StudentHubDashboard;
