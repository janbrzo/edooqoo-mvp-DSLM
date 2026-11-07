import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import TeacherFilmPlayer from '../TeacherFilmPlayer';
import PlacementTestPreviewDialog from '../PlacementTestPreviewDialog';

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/', search: '' }),
  Link: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <a {...props}>{children}</a>,
}));
vi.mock('@/components/ui/dialog', () => {
  const Container = ({ children }: React.PropsWithChildren) => <div>{children}</div>;
  return { Dialog: Container, DialogContent: Container, DialogDescription: Container, DialogHeader: Container, DialogTitle: Container };
});

let renderer: ReactTestRenderer | undefined;
afterEach(() => { act(() => renderer?.unmount()); renderer = undefined; });

function mount(element: React.ReactElement) {
  act(() => { renderer = create(element); });
  if (!renderer) throw new Error('Preview not mounted');
  return renderer;
}

describe('public preview safety', () => {
  it('loads no film until explicit Play and then restricts the iframe to scripts only', () => {
    const view = mount(<TeacherFilmPlayer />);
    expect(view.root.findAllByType('iframe')).toHaveLength(0);
    act(() => view.root.findByProps({ 'aria-label': 'Play interactive teacher tour' }).props.onClick());
    const iframe = view.root.findByType('iframe');
    expect(iframe.props.src).toBe('/embeds/teacher-film-v3.html?autoplay=1');
    expect(iframe.props.sandbox).toBe('allow-scripts');
    expect(iframe.props.referrerPolicy).toBe('no-referrer');
  });

  it('keeps sample answers local and discards them on close', () => {
    const onOpenChange = vi.fn();
    const view = mount(<PlacementTestPreviewDialog open onOpenChange={onOpenChange} />);
    const tryButton = () => view.root.findAllByType('button').find((button) => button.children.includes('Try Placement Test as Student'));
    const start = tryButton();
    if (!start) throw new Error('Sample action missing');
    act(() => start.props.onClick());
    const option = view.root.findAllByType('button').find((button) => button.props['aria-pressed'] === false);
    if (!option) throw new Error('Sample options missing');
    act(() => option.props.onClick());
    expect(view.root.findAllByType('button').filter((button) => button.props['aria-pressed'] === true)).toHaveLength(1);
    const dialog = view.root.findAll((node) => typeof node.props.onOpenChange === 'function')[0];
    if (!dialog) throw new Error('Dialog boundary missing');
    act(() => dialog.props.onOpenChange(false));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    const restart = tryButton();
    if (!restart) throw new Error('Sample overview not restored');
    act(() => restart.props.onClick());
    expect(view.root.findAllByType('button').filter((button) => button.props['aria-pressed'] === true)).toHaveLength(0);
  });
});