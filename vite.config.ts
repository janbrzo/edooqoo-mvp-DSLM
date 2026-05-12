import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    // v6.8.6 — disable production source maps so the worksheet engine and
    // DSLM logic in edge functions cannot be reverse-engineered from the
    // browser bundle. Dev builds still get inline maps from Vite by default.
    sourcemap: mode === 'development',
    // v6.9.0 — raise target from default es2017 to es2020. Removes ~12 KiB of
    // @babel polyfills (Array.prototype.{concat,join,map,slice}, Object.assign,
    // class transforms, spread). All evergreen browsers (Chrome 80+, Safari
    // 13.1+, Firefox 74+, Edge 80+) support ES2020 natively.
    target: 'es2020',
    // v6.9.1 — split vendor chunks so the browser can download them in
    // parallel on mobile 4G. Single 663 KiB bundle becomes ~4 chunks loaded
    // concurrently, cutting LCP critical chain duration. React + Router stay
    // together because Router pulls React internals.
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // v6.9.7 — isolate demo + mock content into lazy chunks. They are
          // only required by /demo and dev tooling; keeping them out of the
          // main bundle reduces what plagiarists can scrape from a casual
          // bundle inspection and improves LCP for real users.
          if (id.includes('demoWorksheetContent')) return 'demo-content';
          if (id.includes('mockWorksheetData') || id.includes('mockNewExercisesData')) return 'mock-data';
          if (id.includes('react-router-dom') || id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'react-vendor';
          if (id.includes('@supabase/supabase-js')) return 'supabase';
          if (id.includes('lucide-react')) return 'lucide';
        },
      },
    },
    // v6.9.7 — strip debugger statements from production output. Combined
    // with sourcemap=false this denies casual reverse-engineering through
    // DevTools breakpoints on minified symbols.
    esbuild: { drop: ['debugger'] },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
