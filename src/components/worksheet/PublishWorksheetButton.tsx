import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Globe, Loader2, Copy, Check } from 'lucide-react';

interface Props {
  worksheetId: string;
  isPublic?: boolean;
  publicSlug?: string | null;
}

const APP_BASE_URL = 'https://edooqoo.com';

/**
 * PublishWorksheetButton — teacher toolbar action that toggles a worksheet's
 * `is_public` flag via the publish-worksheet / unpublish-worksheet edge
 * functions. Shows the public URL after publish for one-click copy.
 */
export const PublishWorksheetButton: React.FC<Props> = ({ worksheetId, isPublic = false, publicSlug = null }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [slug, setSlug] = useState<string | null>(publicSlug);
  const [pub, setPub] = useState(isPublic);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // v6.9.23 — Hydrate publish state from DB so the button stays "Public"
  // after page reload (sessionStorage doesn't persist is_public/public_slug).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!worksheetId) return;
      const { data, error } = await supabase
        .from('worksheets')
        .select('is_public, public_slug')
        .eq('id', worksheetId)
        .maybeSingle();
      if (cancelled || error || !data) return;
      setPub(Boolean(data.is_public));
      setSlug(data.public_slug ?? null);
    })();
    return () => { cancelled = true; };
  }, [worksheetId]);

  // Re-sync if parent ever passes hydrated props.
  useEffect(() => { setPub(isPublic); }, [isPublic]);
  useEffect(() => { setSlug(publicSlug); }, [publicSlug]);

  const publicUrl = slug ? `${APP_BASE_URL}/gallery/${slug}` : null;

  const doPublish = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('publish-worksheet', {
        body: { worksheet_id: worksheetId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSlug(data.slug);
      setPub(true);
      toast({ title: 'Worksheet published', description: 'Now visible in the public gallery.' });
    } catch (e: any) {
      toast({ title: 'Publish failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const doUnpublish = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('unpublish-worksheet', {
        body: { worksheet_id: worksheetId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPub(false);
      toast({ title: 'Worksheet unpublished', description: 'Removed from public gallery.' });
      setOpen(false);
    } catch (e: any) {
      toast({ title: 'Unpublish failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Globe className="mr-2 h-4 w-4" />
        {pub ? 'Public' : 'Publish'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pub ? 'Worksheet is public' : 'Publish to public gallery'}</DialogTitle>
            <DialogDescription>
              {pub
                ? 'Anyone with the link can view this worksheet. You can unpublish at any time.'
                : 'Share this worksheet in the Edooqoo public gallery. Requires ≥6 exercises, a real title, and no personal info (emails/phone numbers).'}
            </DialogDescription>
          </DialogHeader>
          {pub && publicUrl && (
            <div className="flex gap-2 items-center rounded border bg-muted/40 p-2">
              <input readOnly value={publicUrl} className="flex-1 bg-transparent text-sm outline-none" />
              <Button variant="ghost" size="sm" onClick={copy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          )}
          <DialogFooter>
            {pub ? (
              <Button variant="destructive" onClick={doUnpublish} disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Unpublish
              </Button>
            ) : (
              <Button onClick={doPublish} disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Publish now
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PublishWorksheetButton;