import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import TeacherFilmPlayer from '../TeacherFilmPlayer';
import PlacementTestPreviewDialog from '../PlacementTestPreviewDialog';

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: React.PropsWithChildren<{ to: string }>) => <a href={to} {...props}>{children}</a>,
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
  it('keeps student setup primary and opens the full placement test in a new tab', () => {
    const onOpenChange = vi.fn();
    const view = mount(<PlacementTestPreviewDialog open onOpenChange={onOpenChange} />);
    const sendLink = view.root.findAllByType('a').find((link) => link.props.href === '/dashboard?action=add-student');
    if (!sendLink) throw new Error('Send Placement action missing');
    expect(sendLink.children).toContain('Send Placement to Student');
    const tryLink = view.root.findAllByType('a').find((link) => link.props.href === '/welcome-test/demo');
    expect(tryLink?.props.target).toBe('_blank');
    expect(tryLink?.props.rel).toBe('noreferrer');
    expect(tryLink?.children).toContain('Try Placement Test as Student');
    expect(view.root.findAllByType('a').some((link) => link.props.href === '/signup')).toBe(false);
    act(() => sendLink.props.onClick());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('loads no film until explicit Play and then restricts the iframe to scripts only', () => {
    const view = mount(<TeacherFilmPlayer />);
    expect(view.root.findAllByType('iframe')).toHaveLength(0);
    act(() => view.root.findByProps({ 'aria-label': 'Play interactive teacher tour' }).props.onClick());
    const iframe = view.root.findByType('iframe');
    expect(iframe.props.src).toBe('/embeds/teacher-film-v3.html?autoplay=1');
    expect(iframe.props.sandbox).toBe('allow-scripts');
    expect(iframe.props.referrerPolicy).toBe('no-referrer');
  });

  it('describes local 48-hour retention instead of presenting a four-question sample', () => {
    const view = mount(<PlacementTestPreviewDialog open onOpenChange={() => {}} />);
    const text = JSON.stringify(view.toJSON());
    expect(text).toContain('answers and recordings stay on that device for 48 hours');
    expect(text).not.toContain('Student sample');
    expect(view.root.findAllByType('textarea')).toHaveLength(0);
  });
});
