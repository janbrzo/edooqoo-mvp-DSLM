import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, ExternalLink, Check, Mail, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ShareAllFlashcardSetsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentEmail?: string;
  studentName: string;
  teacherName?: string;
  teacherCalendarToken?: string | null;
}

export function ShareAllFlashcardSetsModal({
  open,
  onOpenChange,
  studentEmail = '',
  studentName,
  teacherName = '',
  teacherCalendarToken,
}: ShareAllFlashcardSetsModalProps) {
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState(studentEmail || '');
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setEmail(studentEmail || '');
  }, [studentEmail, open]);

  const portalUrl = teacherCalendarToken
    ? `${window.location.origin}/my/${teacherCalendarToken}/flashcards`
    : '';

  const handleCopy = async () => {
    if (!portalUrl) return;

    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      toast({
        title: 'Link copied!',
        description: 'Student portal link has been copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy link',
        variant: 'destructive',
      });
    }
  };

  const handleOpenInNewTab = () => {
    if (!portalUrl) return;
    window.open(portalUrl, '_blank');
  };

  const handleSendEmail = async () => {
    if (!(email || '').trim() || !teacherCalendarToken) return;

    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-flashcard-email', {
        body: {
          shareToken: 'all-sets',
          recipientEmail: email,
          setTitle: `All Flashcard Sets for ${studentName}`,
          teacherName,
          isAllSets: true,
          portalUrl,
        },
      });

      if (error) throw error;

      toast({
        title: 'Email sent!',
        description: `Portal link sent to ${email}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to send email',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Share All Flashcard Sets</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Share this link with {studentName} to access all their flashcard sets
            </p>

            <div className="flex gap-2">
              <Input
                value={portalUrl || 'Calendar token not set'}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                title="Copy link"
                disabled={!teacherCalendarToken}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleOpenInNewTab}
                title="Open in new tab"
                disabled={!teacherCalendarToken}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <Label htmlFor="student-email">Send by Email (Optional)</Label>
            <div className="flex gap-2">
              <Input
                id="student-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@example.com"
              />
              <Button
                variant="outline"
                onClick={handleSendEmail}
                disabled={!(email || '').trim() || sending}
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="bg-muted/50 p-3 rounded-lg text-sm text-muted-foreground">
            <p className="font-medium mb-1">📌 Note:</p>
            <ul className="space-y-1 text-xs">
              <li>• This portal shows all flashcard sets for this student</li>
              <li>• Student can browse and study all sets in one place</li>
              <li>• Progress is tracked separately for each set</li>
            </ul>
          </div>

          <Button
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
