import { describe, it, expect } from 'vitest';
import { FixedStep } from '@/systems/gamestate';

/**
 * The simulation must advance with real time, not with frames. These tests pin
 * the property that actually matters: a given stretch of wall-clock time
 * produces the same amount of simulated time whatever the frame rate.
 */

/** Runs `seconds` of wall time at a frame rate and returns simulated seconds. */
function simulate(fs: FixedStep, seconds: number, fps: number): number {
  const frame = 1000 / fps;
  let steps = 0;
  let now = 0;
  fs.tick(now);
  for (let t = frame; t <= seconds * 1000 + 1e-9; t += frame) {
    now = t;
    steps += fs.tick(now);
  }
  return steps * fs.step;
}

describe('the fixed step', () => {
  it('simulates the same time at 144, 60, 30 and 12 FPS', () => {
    const results = [144, 60, 30, 12].map((fps) => simulate(new FixedStep(60), 5, fps));
    for (const r of results) expect(r).toBeGreaterThan(4.9);
    for (const r of results) expect(r).toBeLessThan(5.1);
    // And they agree with each other, not merely with the target.
    expect(Math.max(...results) - Math.min(...results)).toBeLessThan(0.05);
  });

  it('keeps real-time pace at frame rates well below the target', () => {
    // 7 FPS is a 143 ms frame: under the 250 ms clamp, so no time is lost.
    expect(simulate(new FixedStep(60), 5, 7)).toBeGreaterThan(4.9);
  });

  it('ignores the reported frame delta in favour of the clock', () => {
    // This is the defect this guards: an engine that smooths its delta towards
    // the target frame time reports ~16.7 ms however long the frame took.
    const honest = new FixedStep(60);
    const lying = new FixedStep(60);
    honest.tick(0);
    lying.tick(0);
    let honestSteps = 0;
    let lyingSteps = 0;
    for (let i = 1; i <= 20; i++) {
      honestSteps += honest.tick(i * 300);   // real clock: 300 ms frames
      lyingSteps += lying.advance(16.7);     // what the engine claims
    }
    expect(honestSteps * honest.step).toBeGreaterThan(4.5);
    expect(lyingSteps * lying.step).toBeLessThan(0.5);
  });

  it('clamps a very long stall instead of replaying it', () => {
    const fs = new FixedStep(60, 250);
    fs.tick(0);
    // A ten-second stall (a hidden tab) must not produce ten seconds of steps.
    const steps = fs.tick(10_000);
    expect(steps * fs.step).toBeLessThanOrEqual(0.25 + 1e-9);
  });

  it('caps catch-up at the frame clamp, not below it', () => {
    // The step cap and the frame clamp have to agree: a 250 ms clamp at 60 Hz
    // is 15 steps, and a cap lower than that would lose time on every slow
    // frame even though the clamp said it was allowed.
    const fs = new FixedStep(60, 250);
    fs.tick(0);
    expect(fs.tick(250)).toBe(15);
  });

  it('does not simulate the gap across a reset', () => {
    const fs = new FixedStep(60);
    fs.tick(0);
    fs.tick(100);
    fs.reset();
    // First tick after a reset establishes the baseline and simulates nothing.
    expect(fs.tick(60_000)).toBe(0);
    expect(fs.tick(60_016.7)).toBe(1);
  });

  it('never returns a negative or absurd step count', () => {
    const fs = new FixedStep(60);
    fs.tick(1000);
    expect(fs.tick(500)).toBe(0);
    expect(fs.advance(-50)).toBe(0);
    expect(fs.advance(Number.NaN)).toBe(0);
  });
});
