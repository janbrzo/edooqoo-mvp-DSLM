/**
 * EventLogPanel - Panel debugowy pokazujący eventy ucznia
 * Używany do testowania i weryfikacji systemu DSLM
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudentEvents } from '@/hooks/dslm/useStudentEvents';
import { 
  Activity, 
  RefreshCw, 
  Filter, 
  BookOpen, 
  GraduationCap, 
  ClipboardCheck, 
  Eye,
  MessageSquare,
  Brain
} from 'lucide-react';
import { format } from 'date-fns';
import type { EventSource, StudentEventType } from '@/types/dslm/events';

interface EventLogPanelProps {
  studentId: string;
  teacherId: string;
}

const EVENT_SOURCE_ICONS: Record<EventSource, React.ReactNode> = {
  homework: <BookOpen className="h-3 w-3" />,
  flashcard: <GraduationCap className="h-3 w-3" />,
  test: <ClipboardCheck className="h-3 w-3" />,
  worksheet: <Eye className="h-3 w-3" />,
  teacher: <MessageSquare className="h-3 w-3" />,
  welcome_test: <ClipboardCheck className="h-3 w-3" />,
  system: <Brain className="h-3 w-3" />
};

const EVENT_SOURCE_COLORS: Record<EventSource, string> = {
  homework: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  flashcard: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  test: 'bg-green-500/10 text-green-600 border-green-500/20',
  worksheet: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  teacher: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  welcome_test: 'bg-teal-500/10 text-teal-600 border-teal-500/20',
  system: 'bg-gray-500/10 text-gray-600 border-gray-500/20'
};

export const EventLogPanel: React.FC<EventLogPanelProps> = ({ studentId, teacherId }) => {
  const { 
    events, 
    loading, 
    stats,
    fetchEvents, 
    getEventStats,
    refetch 
  } = useStudentEvents({ studentId, teacherId });

  const [sourceFilter, setSourceFilter] = useState<EventSource | 'all'>('all');

  useEffect(() => {
    fetchEvents({ limit: 50 });
    getEventStats();
  }, [fetchEvents, getEventStats]);

  const handleRefresh = async () => {
    await refetch();
  };

  const filteredEvents = sourceFilter === 'all' 
    ? events 
    : events.filter(e => e.event_source === sourceFilter);

  const formatEventType = (type: StudentEventType): string => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="space-y-4">
      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="text-sm text-muted-foreground">Total Events</div>
            <div className="text-2xl font-bold">{stats.total_events}</div>
          </Card>
          <Card className="p-3">
            <div className="text-sm text-muted-foreground">Last 7 Days</div>
            <div className="text-2xl font-bold">{stats.events_last_7_days}</div>
          </Card>
          <Card className="p-3">
            <div className="text-sm text-muted-foreground">Last 30 Days</div>
            <div className="text-2xl font-bold">{stats.events_last_30_days}</div>
          </Card>
          <Card className="p-3">
            <div className="text-sm text-muted-foreground">Last Activity</div>
            <div className="text-sm font-medium">
              {stats.last_event_at 
                ? format(new Date(stats.last_event_at), 'MMM dd, HH:mm')
                : 'No events'
              }
            </div>
          </Card>
        </div>
      )}

      {/* Main Panel */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5" />
              Event Log
              <Badge variant="outline" className="ml-2">
                DSLM Layer A
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as EventSource | 'all')}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="homework">Homework</SelectItem>
                <SelectItem value="flashcard">Flashcards</SelectItem>
                <SelectItem value="test">Tests</SelectItem>
                <SelectItem value="worksheet">Worksheets</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground ml-2">
              Showing {filteredEvents.length} events
            </span>
          </div>

          {/* Events List */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {loading && events.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading events...
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>No events recorded yet</p>
                <p className="text-sm">Events will appear here as the student interacts with homework, flashcards, and tests</p>
              </div>
            ) : (
              filteredEvents.map((event) => (
                <div 
                  key={event.id}
                  className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                >
                  {/* Source Icon */}
                  <div className={`p-2 rounded-full ${EVENT_SOURCE_COLORS[event.event_source as EventSource]}`}>
                    {EVENT_SOURCE_ICONS[event.event_source as EventSource]}
                  </div>
                  
                  {/* Event Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        {formatEventType(event.event_type as StudentEventType)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {event.event_source}
                      </Badge>
                      {event.element_type && (
                        <Badge variant="secondary" className="text-xs">
                          {event.element_type}
                        </Badge>
                      )}
                    </div>
                    
                    {/* Payload Preview */}
                    {event.event_payload && Object.keys(event.event_payload).length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1 font-mono bg-muted/50 px-2 py-1 rounded">
                        {JSON.stringify(event.event_payload).slice(0, 100)}
                        {JSON.stringify(event.event_payload).length > 100 && '...'}
                      </div>
                    )}
                  </div>
                  
                  {/* Timestamp */}
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(event.created_at), 'MMM dd, HH:mm')}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};