import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import OneMinutePrepHeroProofSwitcher from '../OneMinutePrepHeroProofSwitcher';

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: React.PropsWithChildren<{ to: string }>) => <a href={to} {...props}>{children}</a>,
}));

vi.mock('../TeacherFilmPlayer', () => ({
  default: () => <div>Teacher tour preview</div>,
}));

vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
  callback(0);
  return 1;
});
vi.stubGlobal('cancelAnimationFrame', vi.fn());

let renderer: ReactTestRenderer | undefined;

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
});

function mount(overrides: Partial<React.ComponentProps<typeof OneMinutePrepHeroProofSwitcher>> = {}) {
  const props = {
    onGenerateWorksheet: vi.fn(),
    onPreviewPlacementTest: vi.fn(),
    ...overrides,
  };
  act(() => { renderer = create(<OneMinutePrepHeroProofSwitcher {...props} />); });
  if (!renderer) throw new Error('Proof switcher not mounted');
  return { view: renderer, props };
}

function textOf(node: ReturnType<ReactTestRenderer['root']['find']>): string {
  return node.children.map((child) => typeof child === 'string' ? child : '').join('');
}

function clickButton(view: ReactTestRenderer, label: string) {
  const button = view.root.findAllByType('button').find((candidate) => textOf(candidate).includes(label));
  if (!button) throw new Error(`Button not found: ${label}`);
  act(() => button.props.onClick({ preventDefault: vi.fn() }));
}

describe('landing product proof actions', () => {
  it('hands the example worksheet topic to the existing reviewed form flow', () => {
    const { view, props } = mount();
    clickButton(view, 'Generate Worksheet on this Topic');
    expect(props.onGenerateWorksheet).toHaveBeenCalledWith('Cross-Cultural Negotiations in Tech');
  });

  it('connects placement actions to student setup and the local preview', () => {
    const { view, props } = mount();
    clickButton(view, 'Placement Test');
    const sendLink = view.root.findAllByType('a').find((link) => link.props.href === '/dashboard?action=add-student');
    expect(sendLink).toBeDefined();
    clickButton(view, 'Preview Placement Test');
    expect(props.onPreviewPlacementTest).toHaveBeenCalledTimes(1);
  });

  it('keeps homework, flashcards and the full tour on their existing destinations', () => {
    const { view } = mount();
    clickButton(view, 'Homework');
    expect(view.root.findAllByType('a').some((link) => link.props.href === '/features/homework')).toBe(true);
    clickButton(view, 'Flashcards');
    expect(view.root.findAllByType('a').some((link) => link.props.href === '/features/flashcards')).toBe(true);
    const flashcard = view.root.findByProps({ 'aria-label': 'Reveal flashcard meaning' });
    act(() => flashcard.props.onClick());
    expect(view.root.findByProps({ 'aria-pressed': true })).toBeDefined();
    clickButton(view, '1-Minute Loop');
    expect(view.root.findAllByType('a').some((link) => link.props.href === '/one-minute-prep#interactive-tour')).toBe(true);
  });
});
