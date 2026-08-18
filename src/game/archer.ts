import {
  ARCHER_MAX_DISTANCE,
  ARCHER_MIN_DISTANCE,
  ARCHER_MOVE_SPEED,
  ARCHER_RADIUS,
  ARCHER_RECOVERY_FRAMES,
  ARCHER_WINDUP_FRAMES,
  ARENA_HEIGHT,
  ARENA_WIDTH,
} from '../content/tuning';
import type { ArcherState, GameState } from './GameState';
import { spawnEnemyArrow } from './projectiles';

export function updateArcher(
  state: GameState,
  archer: ArcherState,
  dt: number,
  worldTimeScale: number,
): void {
  switch (archer.action) {
    case 'positioning':
      updatePosition(state, archer, dt * worldTimeScale);
      return;
    case 'windup':
      if (tickActionTimer(archer, worldTimeScale)) {
        spawnEnemyArrow(state, archer);
        archer.action = 'recovering';
        archer.actionFramesRemaining = ARCHER_RECOVERY_FRAMES;
      }
      return;
    case 'recovering':
      if (tickActionTimer(archer, worldTimeScale)) {
        archer.action = 'positioning';
      }
      return;
    case 'dead':
      return;
  }
}

function updatePosition(
  state: GameState,
  archer: ArcherState,
  worldDt: number,
): void {
  const offsetX = state.player.x - archer.x;
  const offsetY = state.player.y - archer.y;
  const distance = Math.hypot(offsetX, offsetY);
  if (distance === 0) {
    return;
  }

  const directionX = offsetX / distance;
  const directionY = offsetY / distance;
  archer.aimX = directionX;
  archer.aimY = directionY;

  if (distance >= ARCHER_MIN_DISTANCE && distance <= ARCHER_MAX_DISTANCE) {
    archer.action = 'windup';
    archer.actionFramesRemaining = ARCHER_WINDUP_FRAMES;
    return;
  }

  const directionMultiplier = distance < ARCHER_MIN_DISTANCE ? -1 : 1;
  const targetDistance =
    distance < ARCHER_MIN_DISTANCE
      ? ARCHER_MIN_DISTANCE
      : ARCHER_MAX_DISTANCE;
  const movement = Math.min(
    ARCHER_MOVE_SPEED * worldDt,
    Math.abs(distance - targetDistance),
  );
  archer.x = clampToArena(
    archer.x + directionX * movement * directionMultiplier,
    ARCHER_RADIUS,
    ARENA_WIDTH,
  );
  archer.y = clampToArena(
    archer.y + directionY * movement * directionMultiplier,
    ARCHER_RADIUS,
    ARENA_HEIGHT,
  );
}

function tickActionTimer(
  archer: ArcherState,
  worldTimeScale: number,
): boolean {
  archer.actionFramesRemaining = Math.max(
    0,
    archer.actionFramesRemaining - worldTimeScale,
  );
  return archer.actionFramesRemaining === 0;
}

function clampToArena(value: number, radius: number, size: number): number {
  return Math.min(size - radius, Math.max(radius, value));
}
