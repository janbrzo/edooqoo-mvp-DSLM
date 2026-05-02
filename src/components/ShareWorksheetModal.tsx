
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Copy, Share2, ExternalLink, Loader2, Mail, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';

interface ShareWorksheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  worksheetId: string;
  worksheetTitle: string;
  studentEmail?: string;
}

const ShareWorksheetModal = ({ 
  isOpen, 
  onClose, 
  worksheetId, 
  worksheetTitle,
  studentEmail: initialStudentEmail 
}: ShareWorksheetModalProps) => {
  const [shareUrl, setShareUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState(initialStudentEmail || '');
  const [saveEmailForVerification, setSaveEmailForVerification] = useState(true);
  const { toast } = useToast();
  const { refreshProgress } = useOnboardingProgress();

  useEffect(() => {
    if (initialStudentEmail) {
      setRecipientEmail(initialStudentEmail);
    }
  }, [initialStudentEmail]);

  useEffect(() => {
    if (isOpen) {
      loadShareUrl();
    } else {
      setShareUrl('');
      setIsSendingEmail(false);
    }
  }, [isOpen]);

  const loadShareUrl = async () => {
    setIsLoading(true);
    try {
      // Check for existing share token
      const { data, error } = await supabase
        .from('worksheets')
        .select('share_token')
        .eq('id', worksheetId)
        .single();
      
      if (error) throw error;
      
      if (data?.share_token) {
        setShareUrl(`${window.location.origin}/shared/${data.share_token}`);
      } else {
        // Fallback for old worksheets without token — auto-generate
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        
        const { data: token, error: rpcError } = await supabase.rpc('generate_worksheet_share_token', {
          p_worksheet_id: worksheetId,
          p_teacher_id: user.id,
          p_expires_hours: 240
        });
        
        if (rpcError) {
          console.error('[ShareWorksheet] RPC error details:', rpcError);
        }
        
        if (rpcError) throw rpcError;
        if (token) {
          setShareUrl(`${window.location.origin}/shared/${token}`);
        }
      }

      // Trigger onboarding refresh
      refreshProgress();
      setTimeout(refreshProgress, 500);
    } catch (error) {
      console.error('[ShareWorksheet] Error loading share URL:', error);
      toast({
        title: "Failed to load share link",
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Link copied!",
        description: "Share link has been copied to clipboard",
        className: "bg-green-50 border-green-200"
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Please copy the link manually",
        variant: "destructive"
      });
    }
  };

  const openInNewTab = () => {
    window.open(shareUrl, '_blank');
  };

  const sendEmail = async () => {
    if (!recipientEmail) {
      toast({ title: "Email required", description: "Please enter a recipient email address", variant: "destructive" });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address", variant: "destructive" });
      return;
    }

    setIsSendingEmail(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('You must be logged in to send emails');

      const response = await supabase.functions.invoke('send-worksheet-email', {
        body: {
          worksheetId,
          studentEmail: recipientEmail.toLowerCase(),
          updateShareRecipientEmail: saveEmailForVerification
        }
      });

      if (response.error) throw new Error(response.error.message || 'Failed to send email');

      toast({
        title: "Email sent!",
        description: `Worksheet link sent to ${recipientEmail}`,
        className: "bg-green-50 border-green-200"
      });
    } catch (error) {
      console.error('Failed to send email:', error);
      toast({
        title: "Failed to send email",
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: "destructive"
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Worksheet
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">Worksheet:</p>
            <p className="font-medium">{worksheetTitle}</p>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">Loading share link...</span>
            </div>
          )}

          {shareUrl && !isLoading && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Share this link:</p>
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded border">
                  <input 
                    type="text" 
                    value={shareUrl}
                    readOnly
                    className="flex-1 bg-transparent text-sm outline-none"
                  />
                  <Button size="sm" variant="outline" onClick={copyToClipboard}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={openInNewTab} variant="outline" className="flex-1">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Preview
                </Button>
                <Button onClick={copyToClipboard} className="flex-1 bg-worksheet-purple hover:bg-worksheet-purpleDark">
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Link
                </Button>
              </div>

              {/* Email Section */}
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <p className="text-sm font-medium">Send via Email</p>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="recipientEmail" className="text-sm">Student Email</Label>
                    <Input
                      id="recipientEmail"
                      type="email"
                      placeholder="student@example.com"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="saveEmail" 
                      checked={saveEmailForVerification}
                      onCheckedChange={(checked) => setSaveEmailForVerification(checked as boolean)}
                    />
                    <Label htmlFor="saveEmail" className="text-xs text-gray-600">
                      Save this email for student verification access
                    </Label>
                  </div>

                  <Button
                    onClick={sendEmail}
                    disabled={isSendingEmail || !recipientEmail}
                    variant="outline"
                    className="w-full border-worksheet-purple text-worksheet-purple hover:bg-worksheet-purple/5"
                  >
                    {isSendingEmail ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Send Email
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <p className="text-xs text-gray-500 text-center">
                Share link is permanent • Student will verify email to access
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareWorksheetModal;
