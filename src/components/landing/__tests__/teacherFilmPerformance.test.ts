import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

// Execute the embed's actual vision code without a native canvas dependency.
function createVisionHarness() {
  const html = readFileSync(resolve(process.cwd(), 'public/embeds/teacher-film-v3.html'), 'utf8');
  const start = html.indexOf('/* ---------- vision (canvas) ---------- */');
  const end = html.indexOf('/* ---------- main render ---------- */', start);
  if (start < 0 || end < 0) throw new Error('Film vision section missing');
  const calls = { gradients: 0, clears: 0, hitReads: [] as number[] };
  const elements = new Map<string, { style: Record<string, unknown>; getContext: () => unknown }>();
  const noop = () => undefined;
  const canvas = {
    setTransform: noop, clearRect: () => { calls.clears += 1; },
    beginPath: noop, arc: noop, fill: noop, stroke: noop, setLineDash: noop,
    moveTo: noop, lineTo: noop, fillText: noop, bezierCurveTo: noop,
    roundRect: noop, closePath: noop,
    createRadialGradient: () => { calls.gradients += 1; return { addColorStop: noop }; },
  };
  const context = createContext({
    window: {},
    $: (id: string) => {
      if (!elements.has(id)) elements.set(id, { style: {}, getContext: () => canvas });
      return elements.get(id);
    },
    O: noop, X: noop, ST: noop, calls,
  });
  runInContext(`
    const clamp=x=>Math.max(0,Math.min(1,x));
    const lerp=(a,b,u)=>a+(b-a)*u;
    const io=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
    const out=x=>1-Math.pow(1-x,3);
    const sg=(t,a,b,e=io)=>e(clamp((t-a)/(b-a)));
    const show=(t,a,b,f=.35)=>sg(t,a,a+f)*(1-sg(t,b,b+f));
    ${html.slice(start, end)}
    initVision();
    HITS=new Proxy(HITS,{get(target,key){
      if(typeof key==='string'&&/^\\d+$/.test(key))calls.hitReads.push(Number(key));
      return Reflect.get(target,key);
    }});
  `, context);
  return {
    calls,
    draw: (time: number) => {
      calls.gradients = 0;
      calls.clears = 0;
      calls.hitReads = [];
      runInContext(`drawVision(${time})`, context);
    },
  };
}

describe('teacher film vision work budget', () => {
  it('does no canvas or evidence work outside the visible chapter', () => {
    const vision = createVisionHarness();
    for (const time of [0, 54, 74, 92, 109]) {
      vision.draw(time);
      expect(vision.calls.clears).toBe(0);
      expect(vision.calls.gradients).toBe(0);
      expect(vision.calls.hitReads).toEqual([]);
    }
  });

  it('avoids the 54 nano-point gradients and culls offscreen glows during the zoom', () => {
    const vision = createVisionHarness();
    vision.draw(83);
    expect(vision.calls.clears).toBe(1);
    expect(vision.calls.gradients).toBeLessThanOrEqual(12);
    expect(vision.calls.hitReads.length).toBeGreaterThan(0);
  });

  it('reads each atomic hit list at most once per frame and recomputes after seeking', () => {
    const vision = createVisionHarness();
    for (const time of [78, 81.6, 83, 85.5, 88, 78]) {
      vision.draw(time);
      const reads = vision.calls.hitReads;
      expect(reads.length).toBeGreaterThan(0);
      expect(reads.length).toBeLessThanOrEqual(54);
      expect(new Set(reads).size).toBe(reads.length);
    }
  });
});