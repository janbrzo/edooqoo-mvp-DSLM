import React from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { BookOpen, ClipboardList, FileText, Calendar, LayoutDashboard, LogOut, Settings, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clearHubEmail, getSavedHubEmail } from '@/hooks/useStudentHubData';
import { AppBackground } from '@/components/ui/AppBackground';
import { BackgroundPatternSwitcher } from '@/components/ui/BackgroundPatternSwitcher';

interface StudentHubLayoutProps {
  children: React.ReactNode;
  studentName?: string;
  teacherName?: string;
}

const NAV_ITEMS = [
  { key: '', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'flashcards', label: 'Flashcards', icon: BookOpen },
  { key: 'homework', label: 'Homework', icon: ClipboardList },
  { key: 'worksheets', label: 'Worksheets', icon: FileText },
  { key: 'lessons', label: 'Lessons & Booking', icon: Calendar },
  { key: 'profile', label: 'My Profile', icon: User },
  { key: 'settings', label: 'Settings', icon: Settings },
];

export function StudentHubLayout({ children, studentName, teacherName }: StudentHubLayoutProps) {
  const navigate = useNavigate();
  const { teacherToken } = useParams<{ teacherToken: string }>();
  const location = useLocation();

  const currentPath = location.pathname.split('/').pop() || '';
  const activeKey = NAV_ITEMS.find(n => n.key && location.pathname.endsWith(`/${n.key}`))?.key || '';

  const handleLogout = () => {
    clearHubEmail();
    navigate('/my');
  };

  return (
    <AppBackground className="min-h-screen flex flex-col">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/my/${teacherToken}`)} className="font-bold text-lg text-primary hover:opacity-80 transition-opacity">
              edooqoo
            </button>
            {studentName && (
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {studentName} {teacherName ? `· ${teacherName}` : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">{getSavedHubEmail()}</span>
            <Button variant="ghost" size="sm" className="text-xs" onClick={handleLogout}>
              <LogOut className="h-3.5 w-3.5 mr-1" /> Log out
            </Button>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="max-w-5xl mx-auto px-4">
          <nav className="flex gap-1 overflow-x-auto pb-1 -mb-px">
            {NAV_ITEMS.map(item => {
              const isActive = item.key === activeKey;
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => navigate(item.key ? `/my/${teacherToken}/${item.key}` : `/my/${teacherToken}`)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-6">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        Powered by edooqoo
      </footer>
      <BackgroundPatternSwitcher />
    </AppBackground>
  );
}
