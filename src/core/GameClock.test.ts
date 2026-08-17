import { describe, expect, it, vi } from 'vitest';

import {
  FIXED_STEP_MILLISECONDS,
  FIXED_STEP_SECONDS,
  GameClock,
  MAX_CATCH_UP_TICKS,
} from './GameClock';

describe('GameClock', () => {
  it('runs one fixed step for a normal frame', () => {
    const clock = new GameClock();
    const runStep = vi.fn();

    clock.advance(FIXED_STEP_MILLISECONDS, runStep);

    expect(runStep).toHaveBeenCalledOnce();
    expect(runStep).toHaveBeenCalledWith({
      frame: 1,
      dt: FIXED_STEP_SECONDS,
    });
  });

  it('runs multiple fixed steps for a long frame', () => {
    const clock = new GameClock();
    const runStep = vi.fn();

    clock.advance(FIXED_STEP_MILLISECONDS * 3, runStep);

    expect(runStep).toHaveBeenCalledTimes(3);
    expect(runStep.mock.calls.map(([step]) => step.frame)).toEqual([1, 2, 3]);
  });

  it('limits catch-up and discards excessive accumulated time', () => {
    const clock = new GameClock();
    const runStep = vi.fn();

    clock.advance(
      FIXED_STEP_MILLISECONDS * (MAX_CATCH_UP_TICKS + 2.5),
      runStep,
    );

    expect(runStep).toHaveBeenCalledTimes(MAX_CATCH_UP_TICKS);

    runStep.mockClear();
    clock.advance(FIXED_STEP_MILLISECONDS / 2, runStep);
    expect(runStep).not.toHaveBeenCalled();

    clock.advance(FIXED_STEP_MILLISECONDS / 2, runStep);
    expect(runStep).toHaveBeenCalledOnce();
  });
});
