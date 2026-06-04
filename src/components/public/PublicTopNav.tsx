import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/**
 * v6.9.35 — Lightweight sticky header for public, unauthenticated routes
 * (gallery index + worksheet preview). Does NOT depend on auth hooks so it
 * is safe to mount on routes accessed by anonymous visitors and crawlers.
 */
export const PublicTopNav: React.FC = () => (
  <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
    <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
      <Link to="/" className="text-lg font-bold text-primary">Edooqoo</Link>
      <nav className="flex items-center gap-1 text-sm">
        <Link to="/gallery" className="text-muted-foreground hover:text-foreground px-2">Gallery</Link>
        <Link to="/exercise-types" className="text-muted-foreground hover:text-foreground px-2 hidden sm:inline">Exercises</Link>
        <Link to="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
        <Link to="/signup"><Button size="sm">Get started</Button></Link>
      </nav>
    </div>
  </header>
);

export default PublicTopNav;