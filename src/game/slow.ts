import {
  MP_RECOVERY_PER_SECOND,
  SLOW_MP_DRAIN_PER_SECOND,
  SLOW_WORLD_TIME_SCALE,
} from '../content/tuning';
import type { GameState } from './GameState';

export function updateSlow(
  state: GameState,
  slowHeld: boolean,
  dt: number,
): number {
  const mana = state.player.mana;
  state.slow.active = slowHeld && mana.current > 0;

  if (state.slow.active) {
    mana.current = Math.max(
      0,
      mana.current - SLOW_MP_DRAIN_PER_SECOND * dt,
    );
    return SLOW_WORLD_TIME_SCALE;
  }

  if (!slowHeld) {
    mana.current = Math.min(
      mana.maximum,
      mana.current + MP_RECOVERY_PER_SECOND * dt,
    );
  }

  return 1;
}
