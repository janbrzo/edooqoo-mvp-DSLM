import { useEffect, useCallback, useRef } from 'react';

interface Props {
  onEmailResolved: (email: string) => void;
}

interface GoogleCredentialResponse {
  credential: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement | null, config: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

let gisScriptPromise: Promise<void> | null = null;
let gisInitialized = false;

const loadGoogleIdentityScript = () => {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (gisScriptPromise) {
    return gisScriptPromise;
  }

  gisScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });

  return gisScriptPromise;
};

export function HubGoogleSignInButton({ onEmailResolved }: Props) {
  const clientId = '37984924905-bbva45frsj5n8l95rhfp2i76em11mihf.apps.googleusercontent.com';
  const containerRef = useRef<HTMLDivElement>(null);
  const onEmailResolvedRef = useRef(onEmailResolved);

  useEffect(() => {
    onEmailResolvedRef.current = onEmailResolved;
  }, [onEmailResolved]);

  const handleCredentialResponse = useCallback((response: GoogleCredentialResponse) => {
    try {
      const payload = JSON.parse(atob(response.credential.split('.')[1]));
      if (payload.email) {
        onEmailResolvedRef.current(payload.email);
      }
    } catch (e) {
      console.error('Failed to decode Google credential:', e);
    }
  }, []);

  useEffect(() => {
    if (!clientId) return;

    let isCancelled = false;

    loadGoogleIdentityScript()
      .then(() => {
        if (isCancelled || !containerRef.current || !window.google?.accounts?.id) return;

        if (!gisInitialized) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
            auto_select: false,
          });
          gisInitialized = true;
        }

        containerRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(
          containerRef.current,
          { theme: 'outline', size: 'large', width: 350, text: 'continue_with' }
        );
      })
      .catch((error) => {
        console.error('Failed to initialize Google Sign-In:', error);
      });

    return () => {
      isCancelled = true;
    };
  }, [clientId, handleCredentialResponse]);

  if (!clientId) return null;

  return (
    <>
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">or</span>
        </div>
      </div>
      <div className="w-full min-h-[44px] flex items-center justify-center">
        <div ref={containerRef} className="w-full flex justify-center" />
      </div>
    </>
  );
}
