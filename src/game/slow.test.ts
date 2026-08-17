import { describe, expect, it } from 'vitest';

import {
  MP_RECOVERY_PER_SECOND,
  PLAYER_MAX_MP,
  SLOW_MP_DRAIN_PER_SECOND,
  SLOW_WORLD_TIME_SCALE,
} from '../content/tuning';
import { FIXED_STEP_SECONDS } from '../core/GameClock';
import { createInitialGameState } from './GameState';
import { updateSlow } from './slow';

describe('slow', () => {
  it('drains mana while held and returns the world time scale', () => {
    const state = createInitialGameState();

    let worldTimeScale = 1;
    for (let frame = 0; frame < 60; frame += 1) {
      worldTimeScale = updateSlow(state, true, FIXED_STEP_SECONDS);
    }

    expect(worldTimeScale).toBe(SLOW_WORLD_TIME_SCALE);
    expect(state.slow.active).toBe(true);
    expect(state.player.mana.current).toBeCloseTo(
      PLAYER_MAX_MP - SLOW_MP_DRAIN_PER_SECOND,
    );
  });

  it('stays inactive at zero mana until the key is released', () => {
    const state = createInitialGameState();
    state.player.mana.current = 0;

    expect(updateSlow(state, true, FIXED_STEP_SECONDS)).toBe(1);
    expect(state.slow.active).toBe(false);
    expect(state.player.mana.current).toBe(0);

    updateSlow(state, false, FIXED_STEP_SECONDS);

    expect(state.player.mana.current).toBeCloseTo(
      MP_RECOVERY_PER_SECOND * FIXED_STEP_SECONDS,
    );
  });

  it('does not recover mana beyond its maximum', () => {
    const state = createInitialGameState();

    updateSlow(state, false, FIXED_STEP_SECONDS);

    expect(state.player.mana.current).toBe(PLAYER_MAX_MP);
  });
});
