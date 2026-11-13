import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { ListeningPlayer } from '../ListeningPlayer';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type MockAudio = {
  url: string;
  paused: boolean;
  currentTime: number;
  duration: number;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
  onplay: (() => void) | null;
};

let audioInstances: MockAudio[];

class FakeAudio {
  url: string;
  paused = true;
  currentTime = 0;
  duration = 10;
  onended: (() => void) | null = null;
  onplay: (() => void) | null = null;
  play = vi.fn(() => {
    this.paused = false;
    this.onplay?.();
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  constructor(url: string) {
    this.url = url;
    audioInstances.push(this as unknown as MockAudio);
  }
}

let renderer: ReactTestRenderer | undefined;

const mount = (audioUrl: string) => {
  act(() => {
    const child = <ListeningPlayer audioUrl={audioUrl} transcript="Sample transcript" />;
    if (renderer) renderer.update(child);
    else renderer = create(child);
  });
};

const play = () => {
  const control = renderer?.root.findAllByType('button').find(b => b.children.includes('Play'));
  if (!control) throw new Error('Playback control unavailable');
  control.props.onClick();
};

beforeEach(() => {
  audioInstances = [];
  vi.stubGlobal('Audio', FakeAudio);
  vi.useFakeTimers();
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('ListeningPlayer audio reset', () => {
  it('creates the Audio instance lazily with the current audioUrl', () => {
    mount('https://cdn.example.com/q1.mp3');
    expect(audioInstances).toHaveLength(0);

    act(play);
    expect(audioInstances).toHaveLength(1);
    expect(audioInstances[0].url).toBe('https://cdn.example.com/q1.mp3');
    expect(audioInstances[0].play).toHaveBeenCalledTimes(1);
  });

  it('pauses and discards the previous Audio when audioUrl changes', () => {
    mount('https://cdn.example.com/q1.mp3');
    act(play);
    const first = audioInstances[0];

    mount('https://cdn.example.com/q2.mp3');

    expect(first.pause).toHaveBeenCalled();
    expect(first.paused).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('plays the new audioUrl after a question change, never the stale one', () => {
    mount('https://cdn.example.com/q1.mp3');
    act(play);

    mount('https://cdn.example.com/q2.mp3');
    act(play);

    expect(audioInstances).toHaveLength(2);
    expect(audioInstances[1].url).toBe('https://cdn.example.com/q2.mp3');
    expect(audioInstances[1].play).toHaveBeenCalledTimes(1);
    expect(audioInstances[0].play).toHaveBeenCalledTimes(1);
  });

  it('stops playback and progress updates on unmount', () => {
    mount('https://cdn.example.com/q1.mp3');
    act(play);
    const first = audioInstances[0];
    expect(vi.getTimerCount()).toBe(1);
    act(() => renderer?.unmount()); renderer = undefined;
    expect(first.paused).toBe(true);
    expect(first.onplay).toBeNull();
    expect(first.onended).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});
