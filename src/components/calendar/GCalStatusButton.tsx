import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuthFlow } from '@/hooks/useAuthFlow';
import { useCalendarNotifications } from '@/hooks/useCalendarNotifications';
import { Calendar } from 'lucide-react';

export function GCalStatusButton() {
  const { isRegisteredUser, user } = useAuthFlow();
  const { unreadCount } = useCalendarNotifications(isRegisteredUser ? user?.id : undefined);
  const navigate = useNavigate();

  if (!isRegisteredUser) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="sm" disabled className="opacity-50 text-xs h-8">
            <Calendar className="h-3.5 w-3.5 mr-1" /> Calendar
          </Button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p>Use the Calendar for teachers after logging in. You can also sync it with Google Calendar.</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button variant="outline" size="sm" className="text-xs h-8 relative" onClick={() => navigate('/calendar')}>
      🗓️ Calendar
      {unreadCount > 0 && (
        <Badge className="absolute -top-1.5 -right-1.5 h-4 min-w-4 p-0 flex items-center justify-center text-[10px] bg-destructive text-destructive-foreground border-0">
          {unreadCount}
        </Badge>
      )}
    </Button>
  );
}
