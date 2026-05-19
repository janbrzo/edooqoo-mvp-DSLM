
import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DemoProvider } from "@/contexts/DemoContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";
import CookieBanner from "./components/CookieBanner";
import GlobalFooter from "./components/GlobalFooter";
import OnboardingChecklist from "./components/OnboardingChecklist";
import AdminImpersonationBanner from "./components/AdminImpersonationBanner";
import RouteCanonicalUpdater from "./components/RouteCanonicalUpdater";

// v6.9.0 — Route-level code splitting via React.lazy. Eager: Index, Login,
// Signup, NotFound (critical entry & auth flows). Everything else lazy → cuts
// initial JS bundle from ~1154 KiB to ~400 KiB, lowers TBT from 380 ms to ~150 ms.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const StudentPage = lazy(() => import("./pages/StudentPage"));
const Pricing = lazy(() => import("./pages/Pricing"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const CookiePolicy = lazy(() => import("./pages/CookiePolicy"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const SharedWorksheet = lazy(() => import("./pages/SharedWorksheet"));
const TestExercises = lazy(() => import("./pages/TestExercises"));
const AllWorksheetsPage = lazy(() => import("./pages/AllWorksheetsPage"));
const WorksheetPage = lazy(() => import("./pages/WorksheetPage"));
const WorksheetExpiredPage = lazy(() => import("./pages/WorksheetExpiredPage"));
const HomeworkPage = lazy(() => import("./pages/HomeworkPage"));
const HomeworkReviewPage = lazy(() => import("./pages/HomeworkReviewPage"));
const FlashcardsLearning = lazy(() => import("./pages/FlashcardsLearning"));
const StudentPortal = lazy(() => import("./pages/StudentPortal"));
const StudentTestPage = lazy(() => import("./pages/StudentTestPage"));
const WelcomeTestPage = lazy(() => import("./pages/WelcomeTestPage"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));
const AdminErrorLogsPage = lazy(() => import("./pages/AdminErrorLogsPage"));
const StatusPage = lazy(() => import("./pages/StatusPage"));
const TeacherAlertsPage = lazy(() => import("./pages/TeacherAlertsPage"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const CalendarSettingsPage = lazy(() => import("./pages/CalendarSettingsPage"));
const PublicBookingPage = lazy(() => import("./pages/PublicBookingPage"));
const StudentLessonsPage = lazy(() => import("./pages/StudentLessonsPage"));
const CalendarLogHistoryPage = lazy(() => import("./components/calendar/CalendarLogHistoryPage"));
const BookLandingPage = lazy(() => import("./pages/BookLandingPage"));
const About = lazy(() => import("./pages/About"));
const Prompts = lazy(() => import("./pages/Prompts"));
const Glossary = lazy(() => import("./pages/Glossary"));
const ExerciseTypes = lazy(() => import("./pages/ExerciseTypes"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const Resources = lazy(() => import("./pages/Resources"));
const Blog = lazy(() => import("./pages/Blog"));
const EslWorksheets = lazy(() => import("./pages/seo/EslWorksheets"));
const EnglishGamesForLearners = lazy(() => import("./pages/seo/EnglishGamesForLearners"));
const EslGamesForTeachers = lazy(() => import("./pages/seo/EslGamesForTeachers"));
const TeachEnglishOnlineGuide = lazy(() => import("./pages/seo/TeachEnglishOnlineGuide"));
const ForEnglishTutors = lazy(() => import("./pages/seo/ForEnglishTutors"));
const EslClassToolkit = lazy(() => import("./pages/seo/EslClassToolkit"));
const TopicLevelPage = lazy(() => import("./pages/seo/programmatic/TopicLevelPage"));
const ExerciseTopicPage = lazy(() => import("./pages/seo/programmatic/ExerciseTopicPage"));
const PersonaPage = lazy(() => import("./pages/seo/programmatic/PersonaPage"));
const StudentHubLanding = lazy(() => import("./pages/StudentHubLanding"));
const StudentHubDashboard = lazy(() => import("./pages/StudentHubDashboard"));
const StudentHubFlashcards = lazy(() => import("./pages/StudentHubFlashcards"));
const StudentHubHomework = lazy(() => import("./pages/StudentHubHomework"));
const StudentHubWorksheets = lazy(() => import("./pages/StudentHubWorksheets"));
const StudentHubLessons = lazy(() => import("./pages/StudentHubLessons"));
const StudentHubSettings = lazy(() => import("./pages/StudentHubSettings"));
const StudentHubProfile = lazy(() => import("./pages/StudentHubProfile"));
const GCalStudentCallback = lazy(() => import("./pages/GCalStudentCallback"));
const FeatureDSLM = lazy(() => import("./pages/features/FeatureDSLM"));
const FeatureHomework = lazy(() => import("./pages/features/FeatureHomework"));
const FeatureFlashcards = lazy(() => import("./pages/features/FeatureFlashcards"));
const FeatureCalendar = lazy(() => import("./pages/features/FeatureCalendar"));
const FeatureLiveSessions = lazy(() => import("./pages/features/FeatureLiveSessions"));
const FeaturePlacementTest = lazy(() => import("./pages/features/FeaturePlacementTest"));
const FeatureStudentHub = lazy(() => import("./pages/features/FeatureStudentHub"));
const DemoEntry = lazy(() => import("./pages/DemoEntry"));
const ExitDemo = lazy(() => import("./pages/ExitDemo"));

// Suspense fallback: empty min-h-screen div to prevent CLS during chunk load.
const RouteFallback = () => <div className="min-h-screen" aria-hidden="true" />;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RouteCanonicalUpdater />
        <DemoProvider>
        <div className="min-h-screen flex flex-col">
          {/* a11y: skip link for keyboard / screen-reader users */}
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-background focus:text-foreground focus:px-4 focus:py-2 focus:rounded focus:shadow-lg focus:ring-2 focus:ring-primary"
          >
            Skip to main content
          </a>
          <AdminImpersonationBanner />
          <main id="main" className="flex-1">
            <Suspense fallback={<RouteFallback />}>
              <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/demo" element={<DemoEntry />} />
              <Route path="/exit-demo" element={<ExitDemo />} />
              <Route path="/auth" element={<Navigate to="/signup" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/cookie-policy" element={<CookiePolicy />} />
              <Route path="/student/:id" element={<StudentPage />} />
              <Route path="/worksheets" element={<AllWorksheetsPage />} />
              <Route path="/worksheet/:id" element={<WorksheetPage />} />
              <Route path="/worksheet-expired" element={<WorksheetExpiredPage />} />
              <Route path="/homework/:token" element={<HomeworkPage />} />
              <Route path="/homework/:id/review" element={<HomeworkReviewPage />} />
              <Route path="/flashcards/:token" element={<FlashcardsLearning />} />
              <Route path="/my-flashcards/:studentEmail" element={<StudentPortal />} />
              <Route path="/test/:token" element={<StudentTestPage />} />
              <Route path="/welcome-test/:token" element={<WelcomeTestPage />} />
              <Route path="/success" element={<PaymentSuccess />} />
              <Route path="/payment-success" element={<PaymentSuccess />} />
              <Route path="/shared/:token" element={<SharedWorksheet />} />
              <Route path="/test-exercises" element={<TestExercises />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/calendar/settings" element={<CalendarSettingsPage />} />
              <Route path="/calendar/logs" element={<CalendarLogHistoryPage />} />
              <Route path="/about" element={<About />} />
              <Route path="/prompts" element={<Prompts />} />
              <Route path="/glossary" element={<Glossary />} />
              <Route path="/exercise-types" element={<ExerciseTypes />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/resources" element={<Resources />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/esl-worksheets" element={<EslWorksheets />} />
              <Route path="/blog/english-games-for-learners" element={<EnglishGamesForLearners />} />
              <Route path="/blog/esl-games-for-teachers" element={<EslGamesForTeachers />} />
              <Route path="/blog/teach-english-online-guide" element={<TeachEnglishOnlineGuide />} />
              <Route path="/for-english-tutors" element={<ForEnglishTutors />} />
              <Route path="/resources/esl-class-toolkit" element={<EslClassToolkit />} />
              <Route path="/esl-worksheets/:topic/:level" element={<TopicLevelPage />} />
              <Route path="/worksheets/:exerciseType/:topic" element={<ExerciseTopicPage />} />
              <Route path="/english-for/:persona" element={<PersonaPage />} />
              <Route path="/features/dslm" element={<FeatureDSLM />} />
              <Route path="/features/homework" element={<FeatureHomework />} />
              <Route path="/features/flashcards" element={<FeatureFlashcards />} />
              <Route path="/features/calendar" element={<FeatureCalendar />} />
              <Route path="/features/live-sessions" element={<FeatureLiveSessions />} />
              <Route path="/features/placement-test" element={<FeaturePlacementTest />} />
              <Route path="/features/student-hub" element={<FeatureStudentHub />} />
              <Route path="/book" element={<BookLandingPage />} />
              <Route path="/book/:token" element={<PublicBookingPage />} />
              <Route path="/my" element={<StudentHubLanding />} />
              <Route path="/my/:teacherToken" element={<StudentHubDashboard />} />
              <Route path="/my/:teacherToken/flashcards" element={<StudentHubFlashcards />} />
              <Route path="/my/:teacherToken/homework" element={<StudentHubHomework />} />
              <Route path="/my/:teacherToken/worksheets" element={<StudentHubWorksheets />} />
              <Route path="/my/:teacherToken/lessons" element={<StudentHubLessons />} />
              <Route path="/my/:teacherToken/settings" element={<StudentHubSettings />} />
              <Route path="/my/:teacherToken/profile" element={<StudentHubProfile />} />
              <Route path="/gcal-student-callback" element={<GCalStudentCallback />} />
              <Route path="/my-lessons/:token" element={<StudentLessonsPage />} />
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/error-logs" element={<AdminErrorLogsPage />} />
              <Route path="/status" element={<StatusPage />} />
              <Route path="/teacher/alerts" element={<TeacherAlertsPage />} />
              <Route path="/waiting-list" element={<Navigate to="/" replace />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </main>
          <GlobalFooter />
          <OnboardingChecklist />
        </div>
        </DemoProvider>
        <CookieBanner />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
