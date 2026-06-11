import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import WorksheetDisplay from '@/components/WorksheetDisplay';
import { deepFixTextObjects } from '@/utils/textObjectFixer';
import { Loader2, GraduationCap, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTokenSystem } from '@/hooks/useTokenSystem';
import { useAuthFlow } from '@/hooks/useAuthFlow';
import { HomeworkNotificationBadge } from '@/components/homework/HomeworkNotificationBadge';
import { useDemoContext } from '@/contexts/DemoContext';
import AnonPostWorksheetLandingPage from '@/components/anon/AnonPostWorksheetLandingPage';
import AnonPreWorksheetBanner from '@/components/anon/AnonPreWorksheetBanner';
import StickyNav from '@/components/landing/StickyNav';
import { markWorksheetForClaim } from '@/hooks/useWorksheetClaim';
import { devLog } from '@/utils/logger';
import { useForceLightTheme } from '@/hooks/useForceLightTheme';

// PROBLEM 3 FIX: Calculate source count deterministically based on worksheet parameters
const calculateSourceCount = (formData: any): number => {
  if (!formData) return 65;
  
  const baseCount = 50;
  
  // Level bonus
  const levelBonuses: Record<string, number> = { 
    'A1': 5, 'A2': 10, 'B1': 15, 'B2': 20, 'C1': 25, 'C2': 30 
  };
  const levelBonus = levelBonuses[formData.englishLevel] || 15;
  
  // Exercise count bonus (3 per exercise)
  const exerciseCount = formData.selectedExercises?.length || 6;
  const exerciseBonus = exerciseCount * 2;
  
  // Topic complexity bonus (longer topic = more sources)
  const topicLength = Math.min(formData.lessonTopic?.length || 0, 100);
  const topicBonus = Math.floor(topicLength / 10);
  
  // Grammar bonus (if grammar focus selected)
  const grammarBonus = formData.teachingPreferences && formData.teachingPreferences.trim() ? 5 : 0;
  
  return Math.min(baseCount + levelBonus + exerciseBonus + topicBonus + grammarBonus, 95);
};

export default function WorksheetPage() {
  useForceLightTheme();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuthFlow();
  const { tokenLeft } = useTokenSystem(user?.id);
  const { isDemoMode, demoData } = useDemoContext();
  const [loading, setLoading] = useState(true);
  const [worksheetData, setWorksheetData] = useState<any>(null);
  const [parsedWorksheet, setParsedWorksheet] = useState<any>(null);
  const [studentName, setStudentName] = useState<string>('');
  const [editableWorksheet, setEditableWorksheet] = useState<any>(null);
  const [originalWorksheet, setOriginalWorksheet] = useState<any>(null);

  // Demo mode: load worksheet from demoData
  useEffect(() => {
    if (!isDemoMode || !demoData || !id) return;
    const demoWs = demoData.worksheets.find((w: any) => w.id === id);
    if (demoWs) {
      const parsed = demoWs.ai_response ? JSON.parse(demoWs.ai_response) : null;
      setWorksheetData(demoWs);
      setParsedWorksheet(parsed);
      setEditableWorksheet(parsed);
      setOriginalWorksheet(parsed);
      const student = demoData.students.find((s: any) => s.id === demoWs.student_id);
      if (student) setStudentName(student.name);
    }
    setLoading(false);
  }, [isDemoMode, demoData, id]);

  useEffect(() => {
    if (isDemoMode) return; // Demo data loaded in separate useEffect
    const fetchWorksheet = async () => {
      if (!id) {
        toast({
          variant: "destructive",
          title: "Invalid Worksheet",
          description: "No worksheet ID provided.",
        });
        navigate('/');
        return;
      }

      try {
        setLoading(true);

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();

        // Fetch worksheet
        const { data: worksheet, error } = await supabase
          .from('worksheets')
          .select('*')
          .eq('id', id)
          .is('deleted_at', null)
          .maybeSingle();

        if (error) {
          console.error('Error fetching worksheet:', error);
          throw error;
        }

        if (!worksheet) {
          toast({
            variant: "destructive",
            title: "Worksheet Not Found",
            description: "This worksheet does not exist or has been deleted.",
          });
          navigate('/');
          return;
        }

        // Check if user has access (must be the teacher who created it)
        if (user && worksheet.teacher_id !== user.id) {
          toast({
            variant: "destructive",
            title: "Access Denied",
            description: "You don't have permission to view this worksheet.",
          });
          navigate('/');
          return;
        }

        // If no user, check if worksheet is older than 24 hours
        if (!user) {
          const createdAt = new Date(worksheet.created_at);
          const now = new Date();
          const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
          
          if (hoursDiff > 24) {
            // Worksheet expired for anonymous users
            navigate('/worksheet-expired');
            return;
          }
          // Allow access for anonymous users within 24 hours
        }

        // Parse ai_response with fallback to html_content for corrupted data
        let parsed = null;
        const aiResponseLength = worksheet.ai_response?.length || 0;
        devLog(`📊 ai_response length: ${aiResponseLength} characters`);
        
        if (worksheet.ai_response) {
          try {
            parsed = JSON.parse(worksheet.ai_response);
            parsed = deepFixTextObjects(parsed, 'worksheetPage');
            devLog('✅ Successfully parsed and fixed worksheet data from ai_response');
          } catch (parseError) {
            console.error('❌ Error parsing ai_response:', parseError);
            devLog(`⚠️ ai_response was ${aiResponseLength} chars - likely truncated if near 50000 or 200000`);
            
            // FALLBACK: Try to parse from html_content (contains full JSON.stringify data)
            if (worksheet.html_content) {
              devLog('🔄 Attempting fallback to html_content...');
              const htmlContentLength = worksheet.html_content?.length || 0;
              devLog(`📊 html_content length: ${htmlContentLength} characters`);
              
              try {
                parsed = JSON.parse(worksheet.html_content);
                parsed = deepFixTextObjects(parsed, 'html_content_fallback');
                devLog('✅ Successfully parsed worksheet from html_content fallback');
                toast({
                  title: "Worksheet Loaded",
                  description: "Loaded from backup data (original was corrupted).",
                });
              } catch (htmlParseError) {
                console.error('❌ html_content fallback also failed:', htmlParseError);
              }
            }
            
            // If still no parsed data, show error but don't redirect - allow partial display
            if (!parsed) {
              console.error('🚨 CRITICAL: Both ai_response and html_content parsing failed');
              console.error('🚨 MONITORING: This worksheet needs manual review:', worksheet.id);
              toast({
                variant: "destructive",
                title: "Worksheet Data Corrupted",
                description: "This worksheet's data is corrupted. Please contact support.",
              });
              navigate('/');
              return;
            }
          }
        }

        setWorksheetData(worksheet);
        setParsedWorksheet(parsed);
        setEditableWorksheet(parsed);
        setOriginalWorksheet(parsed);

        // If anon viewer & worksheet has no owner yet, register it for claim
        // after they sign up.
        if (!user && worksheet.teacher_id == null) {
          markWorksheetForClaim(worksheet.id);
        }

        // Fetch student name if student_id exists
        if (worksheet.student_id) {
          const { data: student, error: studentError } = await supabase
            .from('students')
            .select('name')
            .eq('id', worksheet.student_id)
            .maybeSingle();

          if (!studentError && student) {
            setStudentName(student.name);
          }
        }

      } catch (error: any) {
        console.error('Error in fetchWorksheet:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Failed to load worksheet.",
        });
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    fetchWorksheet();
  }, [id, navigate, toast, isDemoMode]);

  const handleDiscardChanges = () => {
    if (originalWorksheet) {
      setEditableWorksheet(JSON.parse(JSON.stringify(originalWorksheet)));
      toast({
        title: "Changes Discarded",
        description: "Your edits have been reverted to the original worksheet.",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading worksheet...</p>
        </div>
      </div>
    );
  }

  if (!parsedWorksheet || !worksheetData) {
    return null;
  }

  // Anonymous nav "Pricing" should scroll to the in-page pricing section
  // rendered by AnonPostWorksheetLandingPage, not navigate to /pricing.
  const scrollToPricing = () => {
    const el = document.getElementById('post-worksheet-pricing');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      {!user && !isDemoMode && (
        <StickyNav
          isRegisteredUser={false}
          tokenLeft={0}
          user={null}
          nonSticky
          scrollToPricing={scrollToPricing}
        />
      )}
      {!user && !isDemoMode && <AnonPreWorksheetBanner />}
      <WorksheetDisplay
        worksheet={parsedWorksheet}
        inputParams={worksheetData.form_data}
        generationTime={worksheetData.generation_time_seconds || 0}
        sourceCount={calculateSourceCount(worksheetData.form_data)}
        onBack={() => navigate(-1)}
        worksheetId={worksheetData.id}
        editableWorksheet={editableWorksheet}
        setEditableWorksheet={setEditableWorksheet}
        onDiscardChanges={handleDiscardChanges}
        userId={worksheetData.teacher_id}
        studentName={studentName}
        studentId={worksheetData.student_id}
        selectedImage={worksheetData.selected_image}
        selectedAudio={worksheetData.selected_audio}
        audioUrl={worksheetData.audio_url}
        tokenLeft={tokenLeft}
        // PROBLEM 5: Pass database title (not ai_response title) for proper sync after rename
        worksheetTitle={worksheetData.title}
      />
      {!user && !isDemoMode && <AnonPostWorksheetLandingPage />}
    </>
  );
}
