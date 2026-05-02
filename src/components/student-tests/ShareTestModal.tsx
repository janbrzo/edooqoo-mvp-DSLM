/**
 * ShareTestModal - Modal for sharing test with students
 * Allows copying link and sending via email
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, ExternalLink, Check, Mail, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ShareTestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareToken: string | null;
  testTitle: string;
  studentEmail?: string;
  teacherName?: string;
  testType?: string;
}

export function ShareTestModal({
  open,
  onOpenChange,
  shareToken,
  testTitle,
  studentEmail = '',
  teacherName = '',
  testType = '',
}: ShareTestModalProps) {
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState(studentEmail);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setEmail(studentEmail);
  }, [studentEmail, open]);

  const shareUrl = shareToken 
    ? `${window.location.origin}/${testType === 'welcome' ? 'welcome-test' : 'test'}/${shareToken}`
    : '';

  const handleCopy = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: 'Link copied!',
        description: 'Share link has been copied to clipboard',
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
    if (!shareUrl) return;
    window.open(shareUrl, '_blank');
  };

  const handleSendEmail = async () => {
    if (!email.trim() || !shareToken) return;

    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-test-email', {
        body: {
          shareToken,
          recipientEmail: email,
          testTitle,
          teacherName,
          testType,
        },
      });

      if (error) throw error;

      toast({
        title: 'Email sent!',
        description: `Test link sent to ${email}`,
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
          <DialogTitle>Share Test</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Share this link with your student to take "{testTitle}"
            </p>

            <div className="flex gap-2">
              <Input
                value={shareUrl}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                title="Copy link"
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
                disabled={!email.trim() || sending}
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
              <li>• Link is valid for 30 days</li>
              <li>• Student will need to enter their email before starting</li>
              <li>• Time spent is tracked automatically</li>
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
