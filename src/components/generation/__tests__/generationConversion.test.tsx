import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import GenerationContextPanel from '../GenerationContextPanel';
import GeneratingModal from '@/components/GeneratingModal';
import { GENERATION_SLIDE_INTERVAL_MS } from '../generationModalSlides';
import { resolveModelSegment, resolveTab } from '@/lib/students/workspaceTabs';

vi.mock('react-dom', () => ({ createPortal: (child: React.ReactNode) => child }));

let renderer: ReactTestRenderer | undefined;
let preference: MediaQueryList;
let events: string[];

beforeEach(() => {
  vi.useFakeTimers();
  events = [];
  preference = {
    matches: false,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  };
  vi.stubGlobal('document', { body: {} });
  vi.stubGlobal('window', {
    matchMedia: () => preference,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
    dispatchEvent: (event: Event) => { events.push(event.type); },
  });
  vi.stubGlobal('CustomEvent', class {
    type: string;
    detail: unknown;
    constructor(type: string, options: { detail?: unknown } = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  });
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function mount(child: React.ReactElement) {
  act(() => { renderer = create(child); });
}

function root() {
  if (!renderer) throw new Error('Mount the panel first');
  return renderer.root;
}

function currentSlide() {
  return root().findAllByType('button').find(button => button.props['aria-current'] === 'true')?.props['aria-label'];
}

function click(label: string) {
  act(() => root().findByProps({ 'aria-label': label }).props.onClick());
}

function advance(ms: number) {
  act(() => vi.advanceTimersByTime(ms));
}

describe('Generation modal conversion', () => {
  it('rotates after exactly eight seconds and wraps through three slides', () => {
    mount(<GenerationContextPanel variant="anonymous" />);
    expect(GENERATION_SLIDE_INTERVAL_MS).toBe(8000);
    advance(7999);
    expect(currentSlide()).toBe('Show slide 1');
    advance(1);
    expect(currentSlide()).toBe('Show slide 2');
    advance(8000);
    expect(currentSlide()).toBe('Show slide 3');
    advance(8000);
    expect(currentSlide()).toBe('Show slide 1');
  });

  it('pauses while hovered and resumes after pointer leave', () => {
    mount(<GenerationContextPanel variant="anonymous" />);
    act(() => root().findByType('aside').props.onMouseEnter());
    advance(16000);
    expect(currentSlide()).toBe('Show slide 1');
    act(() => root().findByType('aside').props.onMouseLeave());
    advance(8000);
    expect(currentSlide()).toBe('Show slide 2');
  });

  it('keeps focus pause when the pointer leaves and when focus moves inside the panel', () => {
    mount(<GenerationContextPanel variant="anonymous" />);
    act(() => {
      const aside = root().findByType('aside');
      aside.props.onMouseEnter();
      aside.props.onFocusCapture();
      aside.props.onMouseLeave();
      aside.props.onBlurCapture({ currentTarget: { contains: () => true }, relatedTarget: {} });
    });
    advance(16000);
    expect(currentSlide()).toBe('Show slide 1');
    act(() => root().findByType('aside').props.onBlurCapture({ currentTarget: { contains: () => false }, relatedTarget: null }));
    advance(8000);
    expect(currentSlide()).toBe('Show slide 2');
  });

  it('supports manual next, previous, dots and explicit pause', () => {
    mount(<GenerationContextPanel variant="anonymous" />);
    click('Show previous generation context slide');
    expect(currentSlide()).toBe('Show slide 3');
    click('Show next generation context slide');
    expect(currentSlide()).toBe('Show slide 1');
    click('Show slide 2');
    expect(currentSlide()).toBe('Show slide 2');
    click('Pause slides');
    advance(24000);
    expect(currentSlide()).toBe('Show slide 2');
    click('Resume slides');
    advance(8000);
    expect(currentSlide()).toBe('Show slide 3');
  });

  it('disables automatic rotation with reduced motion but retains manual navigation', () => {
    preference.matches = true;
    mount(<GenerationContextPanel variant="anonymous" />);
    advance(24000);
    expect(currentSlide()).toBe('Show slide 1');
    click('Show next generation context slide');
    expect(currentSlide()).toBe('Show slide 2');
  });

  it('opens signup in a protected new tab for anonymous visitors without a learner link', () => {
    mount(<GenerationContextPanel variant="anonymous" studentId="learner-1" studentName="Julia" />);
    for (let index = 1; index <= 3; index++) {
      click(`Show slide ${index}`);
      const links = root().findAllByType('a');
      expect(links).toHaveLength(1);
      expect(links[0]?.props).toMatchObject({ href: '/signup', target: '_blank', rel: 'noopener noreferrer' });
    }
  });

  it('opens the selected learner Learning Plan, not the default Prep tab', () => {
    mount(<GenerationContextPanel variant="authenticated" studentId="learner-1" studentName="Julia" />);
    const link = root().findByType('a');
    expect(link.props).toMatchObject({ href: '/student/learner-1?tab=model&view=pathway', target: '_blank', rel: 'noopener noreferrer' });
    const url = new URL(link.props.href, 'https://edooqoo.com');
    expect(resolveTab(url.searchParams.get('tab')).tab).toBe('model');
    expect(resolveModelSegment(url.searchParams.get('view')).segment).toBe('plan');
    expect(root().findAllByType('a').some(anchor => anchor.props.href === '/signup')).toBe(false);
  });

  it('never constructs a learner link from missing or blank IDs', () => {
    mount(<GenerationContextPanel variant="authenticated" studentId=" " />);
    expect(root().findAllByType('a')).toHaveLength(0);
  });

  it('resets the slide and updates the destination when the selected learner changes', () => {
    mount(<GenerationContextPanel variant="authenticated" studentId="learner-1" studentName="Julia" />);
    click('Show slide 3');
    act(() => renderer?.update(<GenerationContextPanel variant="authenticated" studentId="learner-2" studentName="Alex" />));
    expect(currentSlide()).toBe('Show slide 1');
    expect(root().findByType('a').props.href).toBe('/student/learner-2?tab=model&view=pathway');
  });

  it('cleans up its rotation timer on unmount', () => {
    mount(<GenerationContextPanel variant="anonymous" />);
    expect(vi.getTimerCount()).toBe(1);
    act(() => renderer?.unmount());
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves modal job mount/unmount notifications and stops timers when closed', () => {
    mount(<GeneratingModal isOpen jobId="job-1" isAnonymous />);
    expect(events).toEqual(['generation-modal:mount']);
    expect(vi.getTimerCount()).toBe(2);
    act(() => renderer?.update(<GeneratingModal isOpen={false} jobId="job-1" isAnonymous />));
    expect(events).toEqual(['generation-modal:mount', 'generation-modal:unmount']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops slide rotation in error or recovery states without changing retry handling', () => {
    const retry = vi.fn();
    mount(<GeneratingModal isOpen isAnonymous onRetry={retry} />);
    act(() => renderer?.update(<GeneratingModal isOpen isAnonymous errorMessage="Network failure" onRetry={retry} />));
    expect(root().findAllByType('aside')).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(1);
    const retryButton = root().findAllByType('button').find(button => button.children.includes('Try Again'));
    act(() => retryButton?.props.onClick());
    expect(retry).toHaveBeenCalledTimes(1);
    act(() => renderer?.update(<GeneratingModal isOpen recovering />));
    expect(root().findAllByType('aside')).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(1);
  });
});