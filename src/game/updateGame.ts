import type { SimulationStep } from '../core/GameClock';
import type { InputFrame, InputSource } from '../core/InputSource';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  ATTACK_ACTIVE_FRAMES,
  ATTACK_ARC_RADIANS,
  ATTACK_COOLDOWN_FRAMES,
  ATTACK_RANGE,
  DUMMY_RADIUS,
  HIT_FLASH_FRAMES,
  PLAYER_MOVE_SPEED,
  PLAYER_RADIUS,
} from '../content/tuning';
import type { GameState } from './GameState';

export function updateGame(
  state: GameState,
  inputSource: InputSource,
  step: SimulationStep,
): void {
  const input = inputSource.sample(step.frame);

  state.frame = step.frame;
  tickTimers(state);
  updatePlayer(state, input, step.dt);
  updateAttack(state, input);
}

function tickTimers(state: GameState): void {
  state.attack.activeFramesRemaining = Math.max(
    0,
    state.attack.activeFramesRemaining - 1,
  );
  state.attack.cooldownFramesRemaining = Math.max(
    0,
    state.attack.cooldownFramesRemaining - 1,
  );
  state.dummy.hitFlashFramesRemaining = Math.max(
    0,
    state.dummy.hitFlashFramesRemaining - 1,
  );
}

function updatePlayer(
  state: GameState,
  input: InputFrame,
  dt: number,
): void {
  const nextX = clampToArena(
    state.player.x + input.moveX * PLAYER_MOVE_SPEED * dt,
    PLAYER_RADIUS,
    ARENA_WIDTH,
  );
  const nextY = clampToArena(
    state.player.y + input.moveY * PLAYER_MOVE_SPEED * dt,
    PLAYER_RADIUS,
    ARENA_HEIGHT,
  );

  moveOutsideDummy(state, nextX, nextY);

  if (input.aimX !== 0 || input.aimY !== 0) {
    state.player.aimX = input.aimX;
    state.player.aimY = input.aimY;
  }
}

function clampToArena(value: number, radius: number, size: number): number {
  return Math.min(size - radius, Math.max(radius, value));
}

function moveOutsideDummy(
  state: GameState,
  requestedX: number,
  requestedY: number,
): void {
  const dx = requestedX - state.dummy.x;
  const dy = requestedY - state.dummy.y;
  const distanceSquared = dx * dx + dy * dy;
  const minimumDistance = PLAYER_RADIUS + DUMMY_RADIUS;

  if (distanceSquared >= minimumDistance * minimumDistance) {
    state.player.x = requestedX;
    state.player.y = requestedY;
    return;
  }

  if (distanceSquared === 0) {
    return;
  }

  const scale = minimumDistance / Math.sqrt(distanceSquared);
  state.player.x = clampToArena(
    state.dummy.x + dx * scale,
    PLAYER_RADIUS,
    ARENA_WIDTH,
  );
  state.player.y = clampToArena(
    state.dummy.y + dy * scale,
    PLAYER_RADIUS,
    ARENA_HEIGHT,
  );
}

function updateAttack(state: GameState, input: InputFrame): void {
  if (input.primaryPressed && state.attack.cooldownFramesRemaining === 0) {
    state.attack.activeFramesRemaining = ATTACK_ACTIVE_FRAMES;
    state.attack.cooldownFramesRemaining = ATTACK_COOLDOWN_FRAMES;
    state.attack.hitDummy = false;
  }

  if (
    state.attack.activeFramesRemaining > 0 &&
    !state.attack.hitDummy &&
    attackIntersectsDummy(state)
  ) {
    state.attack.hitDummy = true;
    state.dummy.hitCount += 1;
    state.dummy.hitFlashFramesRemaining = HIT_FLASH_FRAMES;
  }
}

function attackIntersectsDummy(state: GameState): boolean {
  const dx = state.dummy.x - state.player.x;
  const dy = state.dummy.y - state.player.y;
  const distanceSquared = dx * dx + dy * dy;
  const maximumDistance = ATTACK_RANGE + DUMMY_RADIUS;

  if (distanceSquared > maximumDistance * maximumDistance) {
    return false;
  }

  const distance = Math.sqrt(distanceSquared);
  if (distance === 0) {
    return true;
  }

  const directionDot =
    (dx * state.player.aimX + dy * state.player.aimY) / distance;
  return directionDot >= Math.cos(ATTACK_ARC_RADIANS / 2);
}
