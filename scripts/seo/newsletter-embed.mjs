const NEWSLETTER_ENDPOINT = 'https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/newsletter-subscription';
const TRACKING_ENDPOINT = 'https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/track-user-event';
const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2ZnJremRsa2x5dm5obHBsZWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUyNDYyMzQsImV4cCI6MjA2MDgyMjIzNH0.RXlVKVPO4WTD6c4sA9fZIYAQe6zKPqoMoVE6Ilit9ls';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const NEWSLETTER_EMBED_CSS = `
    .newsletter-signup{margin:48px 0;padding:28px;border:1px solid #ddd6fe;border-radius:18px;background:#f5f3ff}
    .newsletter-signup h2{margin-top:0}.newsletter-signup form{display:grid;gap:14px}
    .newsletter-row{display:flex;gap:10px}.newsletter-row input{min-width:0;flex:1;padding:11px 12px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;font:inherit}
    .newsletter-row button{padding:11px 18px;border:0;border-radius:8px;background:#6d28d9;color:#fff;font:inherit;font-weight:700;cursor:pointer}
    .newsletter-row button:disabled{cursor:not-allowed;opacity:.55}.newsletter-consent{display:flex;align-items:flex-start;gap:10px;font-size:.9rem;line-height:1.55;color:#4b5563}
    .newsletter-consent input{margin-top:4px}.newsletter-status{min-height:1.5em;margin:0;font-size:.9rem;color:#4b5563}
    .newsletter-hp{position:absolute!important;left:-10000px!important;width:1px!important;height:1px!important;overflow:hidden!important}
    @media(max-width:640px){.newsletter-row{flex-direction:column}.newsletter-row button{width:100%}}
`;

export function renderNewsletterEmbed(source) {
  const safeSource = String(source).toLowerCase().replace(/[^a-z0-9:_-]/g, '-').slice(0, 80);
  const id = `newsletter-${safeSource}`;
  return `
    <section class="newsletter-signup" aria-labelledby="${escapeHtml(id)}">
      <p class="eyebrow">Weekly decision support</p>
      <h2 id="${escapeHtml(id)}">What Should I Teach Next?</h2>
      <p>Receive one weekly adult 1:1 teaching decision. The email is a summary and links to the full article or worked example as the canonical source.</p>
      <form data-newsletter-form data-source="${escapeHtml(safeSource)}">
        <div class="newsletter-hp" aria-hidden="true">
          <label>Company <input name="company" tabindex="-1" autocomplete="off"></label>
        </div>
        <label for="${escapeHtml(id)}-email"><strong>Email address</strong></label>
        <div class="newsletter-row">
          <input id="${escapeHtml(id)}-email" name="email" type="email" autocomplete="email" placeholder="tutor@example.com" required>
          <button type="submit">Send confirmation</button>
        </div>
        <label class="newsletter-consent">
          <input name="consent" type="checkbox" required>
          <span>I want to receive the weekly Edooqoo newsletter. I can unsubscribe in every email. See the <a href="/privacy-policy">Privacy Policy</a>.</span>
        </label>
        <p class="newsletter-status" role="status" aria-live="polite">Double opt-in: entering an email does not activate the subscription.</p>
      </form>
    </section>
    <script>
      (() => {
        const form = document.querySelector('[data-newsletter-form][data-source="${escapeHtml(safeSource)}"]');
        if (!form || form.dataset.bound === 'true') return;
        form.dataset.bound = 'true';
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const button = form.querySelector('button[type="submit"]');
          const status = form.querySelector('.newsletter-status');
          const data = new FormData(form);
          button.disabled = true;
          button.textContent = 'Sending...';
          status.textContent = '';
          try {
            const response = await fetch('${NEWSLETTER_ENDPOINT}', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: data.get('email'),
                company: data.get('company'),
                consent: data.get('consent') === 'on',
                source: form.dataset.source
              })
            });
            const result = await response.json().catch(() => ({}));
            const succeeded = response.ok && result.ok === true;
            const sessionKey = 'edooqoo-newsletter-session';
            const sessionId = sessionStorage.getItem(sessionKey)
              || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
            sessionStorage.setItem(sessionKey, sessionId);
            fetch('${TRACKING_ENDPOINT}', {
              method: 'POST',
              headers: {
                Authorization: 'Bearer ${SUPABASE_PUBLISHABLE_KEY}',
                apikey: '${SUPABASE_PUBLISHABLE_KEY}',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                eventType: 'newsletter_submit',
                eventData: {
                  source: form.dataset.source,
                  status: succeeded ? 'accepted' : 'failed'
                },
                sessionId
              })
            }).catch(() => {});
            if (!response.ok || result.ok !== true) throw new Error(result.error || 'request_failed');
            form.reset();
            status.textContent = 'Check your inbox and confirm your subscription. No newsletter is sent before confirmation.';
          } catch (error) {
            status.textContent = error.message === 'rate_limited'
              ? 'Too many attempts. Try again later.'
              : 'The confirmation email could not be requested. Try again.';
          } finally {
            button.disabled = false;
            button.textContent = 'Send confirmation';
          }
        });
      })();
    </script>`;
}

