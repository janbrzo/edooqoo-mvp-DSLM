// Side-effect module: must be the FIRST import of main.tsx. supabase-js captures
// the global `fetch` when the client is created, so the guard has to wrap it before that.
import { installDemoFetchGuard } from './demoFetchGuard';

installDemoFetchGuard();
