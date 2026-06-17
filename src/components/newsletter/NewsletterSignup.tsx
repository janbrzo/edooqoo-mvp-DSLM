import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEventTracking } from '@/hooks/useEventTracking';

interface NewsletterSignupProps {
  source: string;
}

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

const NewsletterSignup = ({ source }: NewsletterSignupProps) => {
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [message, setMessage] = useState('');
  const { trackEvent } = useEventTracking();
  const fieldId = source.replace(/[^a-z0-9_-]/gi, '-');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!consent || submitState === 'submitting') return;

    setSubmitState('submitting');
    setMessage('');

    const { data, error } = await supabase.functions.invoke('newsletter-subscription', {
      body: { email, source, company, consent: true },
    });

    const succeeded = !error && data?.ok === true;
    trackEvent({
      eventType: 'newsletter_submit',
      eventData: { source, status: succeeded ? 'accepted' : 'failed' },
    });

    if (succeeded) {
      setSubmitState('success');
      setMessage('Check your inbox and confirm your subscription. No newsletter is sent before confirmation.');
      setEmail('');
      setConsent(false);
      return;
    }

    setSubmitState('error');
    setMessage(data?.error === 'rate_limited'
      ? 'Too many attempts. Try again later.'
      : 'The confirmation email could not be requested. Try again.');
  };

  return (
    <section className="rounded-2xl border bg-card p-6 md:p-8" aria-labelledby={`newsletter-${fieldId}`}>
      <div className="grid gap-6 md:grid-cols-[1fr_1.1fr] md:items-center">
        <div>
          <Mail className="h-7 w-7 text-primary" aria-hidden="true" />
          <h2 id={`newsletter-${fieldId}`} className="mt-4 text-2xl font-bold text-foreground">
            What Should I Teach Next?
          </h2>
          <p className="mt-3 leading-7 text-muted-foreground">
            Get Edooqoo updates about adult 1:1 teaching decisions. Each email links to the full article or worked example as the canonical source.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="sr-only" aria-hidden="true">
            <label htmlFor={`newsletter-company-${fieldId}`}>Company</label>
            <input
              id={`newsletter-company-${fieldId}`}
              name="company"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          <label htmlFor={`newsletter-email-${fieldId}`} className="block text-sm font-semibold text-foreground">
            Email address
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id={`newsletter-email-${fieldId}`}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              placeholder="tutor@example.com"
              className="min-h-11 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="submit"
              disabled={!consent || submitState === 'submitting'}
              className="min-h-11 rounded-lg bg-primary px-5 py-2 font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitState === 'submitting' ? 'Sending…' : 'Send confirmation'}
            </button>
          </div>

          <label className="flex items-start gap-3 text-sm leading-6 text-muted-foreground">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              required
              className="mt-1 h-4 w-4 rounded border-input"
            />
            <span>
              I want to receive Edooqoo email updates about adult 1:1 English teaching. I can unsubscribe in every email. See the{' '}
              <Link to="/privacy-policy" className="font-medium text-primary hover:underline">Privacy Policy</Link>.
            </span>
          </label>

          <p
            className={submitState === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}
            role="status"
            aria-live="polite"
          >
            {message || 'Double opt-in: entering an email does not activate the subscription.'}
          </p>
        </form>
      </div>
    </section>
  );
};

export default NewsletterSignup;

