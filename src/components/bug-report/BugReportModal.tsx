/**
 * BugReportModal — collects a bug report with title, description, optional
 * screenshots (paste, drag&drop, or file picker), and submits via the
 * `submit-bug-report` edge function.
 *
 * Auto-collected metadata: page URL, viewport size, user agent, recent
 * console errors (from consoleInterceptor). The user can review what is sent.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, X, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast as sonnerToast } from 'sonner';
import { useToast } from '@/hooks/use-toast';
import { getRecentConsoleErrors } from '@/utils/consoleInterceptor';

const MAX_FILES = 5;
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPTED = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const DRAFT_KEY = '__bug_report_draft__';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PendingFile {
  file: File;
  preview: string;
  id: string;
}

export const BugReportModal: React.FC<Props> = ({ open, onOpenChange }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Restore draft when opening; reset state on close (but keep draft in sessionStorage).
  useEffect(() => {
    if (open) {
      try {
        const raw = sessionStorage.getItem(DRAFT_KEY);
        if (raw) {
          const draft = JSON.parse(raw) as { title?: string; description?: string };
          if (draft.title && !title) setTitle(draft.title);
          if (draft.description && !description) setDescription(draft.description);
        }
      } catch {
        // ignore corrupted draft
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Reset transient state when closed.
  useEffect(() => {
    if (!open) {
      files.forEach((f) => URL.revokeObjectURL(f.preview));
      setFiles([]);
      setSubmitting(false);
      setErrorMessage(null);
      // Title/description are preserved via sessionStorage draft and cleared
      // explicitly on success or via Cancel button.
      setTitle('');
      setDescription('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const addFiles = useCallback((incoming: File[]) => {
    setFiles((prev) => {
      const remaining = MAX_FILES - prev.length;
      const valid = incoming
        .filter((f) => ACCEPTED.includes(f.type) && f.size <= MAX_SIZE)
        .slice(0, remaining)
        .map((f) => ({ file: f, preview: URL.createObjectURL(f), id: crypto.randomUUID() }));
      const rejected = incoming.length - valid.length;
      if (rejected > 0) {
        toast({
          title: 'Some files skipped',
          description: `${rejected} file(s) rejected (limit: ${MAX_FILES} files, 5MB each, images only).`,
          variant: 'destructive',
        });
      }
      return [...prev, ...valid];
    });
  }, [toast]);

  // --- paste handler (Cmd+V / Ctrl+V) ---
  useEffect(() => {
    if (!open) return;
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const pasted: File[] = [];
      for (const item of Array.from(e.clipboardData.items)) {
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f) pasted.push(f);
        }
      }
      if (pasted.length) {
        e.preventDefault();
        addFiles(pasted);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [open, addFiles]);

  // --- drag & drop ---
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast({ title: 'Missing fields', description: 'Title and description are required.', variant: 'destructive' });
      return;
    }
    setErrorMessage(null);
    setSubmitting(true);
    // Persist draft so the user doesn't lose input on network failure.
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ title: title.trim(), description: description.trim() }));
    } catch { /* sessionStorage may be disabled */ }
    let uploadFailed = false;
    try {
      // 1. get current user id
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData?.user) throw new Error('Please sign in first.');
      const userId = userData.user.id;

      // 2. upload files to bug-reports bucket under {uid}/{ts}-{name}.
      // Upload failures are NON-FATAL: we still send the text report so the
      // bug is not lost. The user is informed via banner.
      const uploadedPaths: string[] = [];
      for (const pf of files) {
        const safeName = pf.file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
        const path = `${userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;
        const { error: upErr } = await supabase.storage.from('bug-reports').upload(path, pf.file, {
          contentType: pf.file.type, upsert: false,
        });
        if (upErr) {
          console.error('[BugReportModal] upload failed', upErr);
          uploadFailed = true;
          continue;
        }
        uploadedPaths.push(path);
      }

      // 3. call edge function via direct fetch (v6.8.5).
      // We bypass supabase.functions.invoke() because it added extra
      // client headers that destabilized the CORS preflight in the
      // preview/published environment, manifesting as
      // "FunctionsFetchError: Failed to send a request to the Edge Function".
      const consoleErrors = getRecentConsoleErrors();
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('Please sign in first.');

      const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string;
      const anonKey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const response = await fetch(`${supabaseUrl}/functions/v1/submit-bug-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          page_url: window.location.href,
          user_agent: navigator.userAgent,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          console_errors: consoleErrors,
          attachment_paths: uploadedPaths,
        }),
      });

      if (!response.ok) {
        let serverMsg = `Function failed: HTTP ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson?.error) serverMsg = String(errJson.error);
        } catch { /* not JSON */ }
        throw new Error(serverMsg);
      }
      const data = await response.json().catch(() => ({}));
      if ((data as any)?.error) throw new Error((data as any).error);

      // Success — clear draft, close, toast.
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      onOpenChange(false);
      sonnerToast.success(
        uploadFailed
          ? 'Report sent (some screenshots failed to upload).'
          : 'Bug report sent — thanks! We\'ll take a look as soon as possible.',
      );
    } catch (err: any) {
      console.error('[BugReportModal] submit failed', err);
      // Close the modal so the toast is visible (Radix Portal can otherwise
      // stack above the toast). Draft is preserved in sessionStorage so the
      // user can retry without losing input.
      const msg = err?.message ?? 'Unknown error.';
      onOpenChange(false);
      sonnerToast.error('Could not send report', {
        description: `${msg} — your draft is saved. Email us at edooqoo@gmail.com if this persists.`,
        action: {
          label: 'Retry',
          onClick: () => onOpenChange(true),
        },
        duration: 10000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const consoleCount = open ? getRecentConsoleErrors().length : 0;

  const handleCancel = () => {
    // Cancel = explicit discard. Clear draft so it won't auto-restore next time.
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report a bug</DialogTitle>
          <DialogDescription>
            Tell us what went wrong. We auto-attach the page URL, your viewport size, and the last few console errors so you don't have to.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="bug-title">Title <span className="text-destructive">*</span></Label>
            <Input
              id="bug-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Save button does nothing on Student profile"
              maxLength={200}
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bug-desc">Description <span className="text-destructive">*</span></Label>
            <Textarea
              id="bug-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you do? What happened? What did you expect?"
              rows={5}
              maxLength={5000}
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Screenshots <span className="text-xs text-muted-foreground font-normal">(optional, up to {MAX_FILES})</span></Label>
            <div
              ref={dropRef}
              onDragOver={onDragOver}
              onDrop={onDrop}
              className="border-2 border-dashed border-muted rounded-md p-4 text-center text-sm text-muted-foreground hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-5 w-5 mx-auto mb-1.5 opacity-60" />
              <div>Click, drag & drop, or paste (Cmd/Ctrl+V) screenshots here</div>
              <div className="text-xs opacity-70 mt-1">PNG/JPG/GIF/WebP, max 5 MB each</div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED.join(',')}
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files?.length) addFiles(Array.from(e.target.files));
                  e.target.value = '';
                }}
              />
            </div>

            {files.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {files.map((f) => (
                  <div key={f.id} className="relative group border rounded-md overflow-hidden bg-muted/30">
                    <img src={f.preview} alt="" className="w-full h-24 object-cover" />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                      className="absolute top-1 right-1 bg-background/90 rounded-full p-0.5 shadow opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <div className="text-[10px] truncate px-1 py-0.5 bg-background/80">
                      <ImageIcon className="h-2.5 w-2.5 inline mr-1" />{f.file.name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-xs text-muted-foreground bg-muted/40 rounded-md p-2.5 leading-relaxed">
            <strong>Auto-attached:</strong> page URL, viewport size, browser info,
            and the last {consoleCount} console error{consoleCount === 1 ? '' : 's'}.
            <br />
            <em>We never include passwords, tokens, or cookies.</em>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">Could not send report</div>
                <div className="text-xs opacity-90 break-words">{errorMessage}</div>
                <div className="text-xs opacity-80 mt-1">Please try again, or email us at edooqoo@gmail.com if the problem persists.</div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending…</> : 'Send report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};