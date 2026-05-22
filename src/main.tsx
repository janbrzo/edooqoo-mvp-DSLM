import React from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import './index.css';
import { installConsoleInterceptor } from './utils/consoleInterceptor';

// Disable console logs in production build
if (import.meta.env.PROD) {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
  // Keep console.error and console.warn for debugging production issues
}

// Install console interceptor BEFORE the app renders so we capture early errors.
// Must run AFTER the prod-disable block above.
installConsoleInterceptor();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>
);
