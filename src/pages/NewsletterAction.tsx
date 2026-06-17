import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, CircleX } from 'lucide-react';
import { PageSeo } from '@/components/seo/PageSeo';

interface NewsletterActionProps {
  mode: 'confirm' | 'unsubscribe';
}

const NEWSLETTER_ENDPOINT = 'https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/newsletter-subscription';

const uuidPattern = /^[0-9a-f-]{36}$/i;

const NewsletterAction = ({ mode }: NewsletterActionProps) => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const id = searchParams.get('id') || '';
  const signature = searchParams.get('signature') || '';
  const isConfirm = mode === 'confirm';
  const isValid = isConfirm
    ? token.length >= 32
    : uuidPattern.test(id) && signature.length === 64;

  const actionUrl = new URL(NEWSLETTER_ENDPOINT);
  actionUrl.searchParams.set('action', isConfirm ? 'confirm' : 'unsubscribe');
  if (isConfirm) {
    actionUrl.searchParams.set('token', token);
  } else {
    actionUrl.searchParams.set('id', id);
    actionUrl.searchParams.set('signature', signature);
  }

  const title = isConfirm ? 'Confirm your subscription' : 'Unsubscribe from Edooqoo emails';
  const description = isConfirm
    ? 'Confirm that you want to receive Edooqoo email updates about What Should I Teach Next? resources.'
    : 'Confirm that you no longer want Edooqoo email updates.';
  const path = isConfirm ? '/newsletter/confirm' : '/newsletter/unsubscribe';
  const buttonLabel = isConfirm ? 'Confirm subscription' : 'Unsubscribe';
  const invalidTitle = isConfirm ? 'Confirmation link is invalid' : 'Unsubscribe link is invalid';
  const invalidDescription = isConfirm
    ? 'Return to a newsletter form and request a new confirmation email.'
    : 'Use the unsubscribe link from the most recent Edooqoo email.';

  return (
    <div className="min-h-screen bg-background">
      <PageSeo
        title={`${isValid ? title : invalidTitle} | Edooqoo`}
        description={isValid ? description : invalidDescription}
        path={path}
        robots="noindex,follow"
      />
      <main className="container mx-auto flex max-w-2xl flex-col items-center px-4 py-20 text-center">
        {isValid
          ? <CheckCircle2 className="h-12 w-12 text-primary" aria-hidden="true" />
          : <CircleX className="h-12 w-12 text-destructive" aria-hidden="true" />}
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          What Should I Teach Next?
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground">
          {isValid ? title : invalidTitle}
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-8 text-muted-foreground">
          {isValid ? description : invalidDescription}
        </p>

        {isValid ? (
          <form method="post" action={actionUrl.toString()} className="mt-8">
            <button
              type="submit"
              className="rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground hover:opacity-90"
            >
              {buttonLabel}
            </button>
          </form>
        ) : (
          <Link
            to="/what-to-teach-next"
            className="mt-8 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground hover:opacity-90"
          >
            Open the decision library
          </Link>
        )}
      </main>
    </div>
  );
};

export default NewsletterAction;
