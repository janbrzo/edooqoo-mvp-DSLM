// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

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

let container: HTMLDivElement;
let root: Root;

const mount = (audioUrl: string) => {
  act(() => {
    root.render(<ListeningPlayer audioUrl={audioUrl} transcript="Sample transcript" />);
  });
};

const playButton = () =>
  Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Play') && !b.textContent?.includes('Played')) as HTMLButtonElement;

beforeEach(() => {
  audioInstances = [];
  vi.stubGlobal('Audio', FakeAudio);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('ListeningPlayer audio reset', () => {
  it('creates the Audio instance lazily with the current audioUrl', () => {
    mount('https://cdn.example.com/q1.mp3');
    expect(audioInstances).toHaveLength(0);

    act(() => playButton().click());
    expect(audioInstances).toHaveLength(1);
    expect(audioInstances[0].url).toBe('https://cdn.example.com/q1.mp3');
    expect(audioInstances[0].play).toHaveBeenCalledTimes(1);
  });

  it('pauses and discards the previous Audio when audioUrl changes', () => {
    mount('https://cdn.example.com/q1.mp3');
    act(() => playButton().click());
    const first = audioInstances[0];
    expect(container.textContent).toContain('Played 1');

    mount('https://cdn.example.com/q2.mp3');

    expect(first.pause).toHaveBeenCalled();
    expect(container.textContent).not.toContain('Played');
  });

  it('plays the new audioUrl after a question change, never the stale one', () => {
    mount('https://cdn.example.com/q1.mp3');
    act(() => playButton().click());

    mount('https://cdn.example.com/q2.mp3');
    act(() => playButton().click());

    expect(audioInstances).toHaveLength(2);
    expect(audioInstances[1].url).toBe('https://cdn.example.com/q2.mp3');
    expect(audioInstances[1].play).toHaveBeenCalledTimes(1);
    expect(audioInstances[0].play).toHaveBeenCalledTimes(1);
  });

  it('resets progress to zero when audioUrl changes', () => {
    mount('https://cdn.example.com/q1.mp3');
    act(() => playButton().click());
    const first = audioInstances[0];
    first.currentTime = 5;
    act(() => {
      first.onplay?.();
    });

    mount('https://cdn.example.com/q2.mp3');

    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar?.getAttribute('aria-valuenow')).toBe('0');
  });
});
