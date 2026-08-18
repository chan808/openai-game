import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  HIT_FLASH_FRAMES,
  HIT_STOP_FRAMES,
  PLAYER_MAX_HP,
  PLAYER_RADIUS,
} from '../content/tuning';
import type { GameState } from './GameState';

export function damagePlayer(state: GameState, damage: number): void {
  state.player.health.current = Math.max(
    0,
    state.player.health.current - damage,
  );
  state.player.hitFlashFramesRemaining = HIT_FLASH_FRAMES;
  state.player.hitStopFramesRemaining = Math.max(
    state.player.hitStopFramesRemaining,
    HIT_STOP_FRAMES,
  );

  if (state.player.health.current === 0) {
    state.player.defeatCount += 1;
    state.player.health.current = PLAYER_MAX_HP;
    state.player.x = Math.max(PLAYER_RADIUS, ARENA_WIDTH * 0.25);
    state.player.y = ARENA_HEIGHT * 0.5;
  }
}
