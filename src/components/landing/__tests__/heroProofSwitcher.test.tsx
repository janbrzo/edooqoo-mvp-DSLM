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

vi.mock('@/components/ui/tabs', () => {
  const TabsContext = React.createContext<{ value: string; setValue: (value: string) => void }>({ value: '', setValue: () => undefined });
  return {
    Tabs: ({ children, defaultValue }: React.PropsWithChildren<{ defaultValue: string }>) => {
      const [value, setValue] = React.useState(defaultValue);
      return <TabsContext.Provider value={{ value, setValue }}>{children}</TabsContext.Provider>;
    },
    TabsList: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
    TabsTrigger: ({ children, value, ...props }: React.PropsWithChildren<{ value: string }>) => {
      const tabs = React.useContext(TabsContext);
      return <button type="button" onClick={() => tabs.setValue(value)} {...props}>{children}</button>;
    },
    TabsContent: ({ children, value }: React.PropsWithChildren<{ value: string }>) => {
      const tabs = React.useContext(TabsContext);
      return tabs.value === value ? <div>{children}</div> : null;
    },
  };
});

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
  if (button.props.role === 'tab') {
    act(() => button.props.onMouseDown({ button: 0, ctrlKey: false, preventDefault: vi.fn() }));
    return;
  }
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
