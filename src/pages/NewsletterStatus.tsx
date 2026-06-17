import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, CircleX } from 'lucide-react';
import { PageSeo } from '@/components/seo/PageSeo';
import { useEventTracking } from '@/hooks/useEventTracking';

interface NewsletterStatusProps {
  mode: 'confirmed' | 'unsubscribed';
}

const confirmationMessages: Record<string, { title: string; description: string; valid: boolean }> = {
  confirmed: {
    title: 'Subscription confirmed',
    description: 'You can now receive Edooqoo email updates about What Should I Teach Next? resources.',
    valid: true,
  },
  'already-active': {
    title: 'Subscription already active',
    description: 'This email address was already confirmed. No duplicate subscription was created.',
    valid: true,
  },
  expired: {
    title: 'Confirmation link expired',
    description: 'Return to a newsletter form and request a new confirmation email.',
    valid: false,
  },
  invalid: {
    title: 'Confirmation link is invalid',
    description: 'Return to a newsletter form and request a new confirmation email.',
    valid: false,
  },
};

const unsubscribeMessages: Record<string, { title: string; description: string; valid: boolean }> = {
  unsubscribed: {
    title: 'You are unsubscribed',
    description: 'No further Edooqoo email updates will be sent to this subscription.',
    valid: true,
  },
  'already-unsubscribed': {
    title: 'Subscription already inactive',
    description: 'The unsubscribe request had already been applied.',
    valid: true,
  },
  invalid: {
    title: 'Unsubscribe link is invalid',
    description: 'Use the unsubscribe link from the most recent Edooqoo email.',
    valid: false,
  },
};

const NewsletterStatus = ({ mode }: NewsletterStatusProps) => {
  const [searchParams] = useSearchParams();
  const { trackEvent } = useEventTracking();
  const trackedConfirmation = useRef(false);
  const status = searchParams.get('status') || 'invalid';
  const messages = mode === 'confirmed' ? confirmationMessages : unsubscribeMessages;
  const message = messages[status] || messages.invalid;

  useEffect(() => {
    if (
      !trackedConfirmation.current
      && mode === 'confirmed'
      && (status === 'confirmed' || status === 'already-active')
    ) {
      trackedConfirmation.current = true;
      trackEvent({
        eventType: 'newsletter_confirm',
        eventData: { status },
      });
    }
  }, [mode, status, trackEvent]);

  const path = mode === 'confirmed' ? '/newsletter/confirmed' : '/newsletter/unsubscribed';

  return (
    <div className="min-h-screen bg-background">
      <PageSeo
        title={`${message.title} | Edooqoo`}
        description={message.description}
        path={path}
        robots="noindex,follow"
      />
      <main className="container mx-auto flex max-w-2xl flex-col items-center px-4 py-20 text-center">
        {message.valid
          ? <CheckCircle2 className="h-12 w-12 text-primary" aria-hidden="true" />
          : <CircleX className="h-12 w-12 text-destructive" aria-hidden="true" />}
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground">{message.title}</h1>
        <p className="mt-4 max-w-xl text-lg leading-8 text-muted-foreground">{message.description}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/what-to-teach-next"
            className="rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground hover:opacity-90"
          >
            Open the decision library
          </Link>
          <Link
            to="/tools/what-should-i-teach-next"
            className="rounded-lg border border-input px-5 py-3 font-semibold hover:bg-accent"
          >
            Use the decision tool
          </Link>
        </div>
      </main>
    </div>
  );
};

export default NewsletterStatus;

