import type { SimulationStep } from '../core/GameClock';
import type {
  InputFrame,
  InputSource,
  WeaponSlotId,
} from '../core/InputSource';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BOW_COOLDOWN_FRAMES,
  DUMMY_RADIUS,
  HIT_FLASH_FRAMES,
  HIT_STOP_FRAMES,
  LONGSWORD_ACTIVE_FRAMES,
  LONGSWORD_COOLDOWN_FRAMES,
  MAGIC_COOLDOWN_FRAMES,
  PLAYER_MOVE_SPEED,
  PLAYER_RADIUS,
} from '../content/tuning';
import type { GameState, WeaponId } from './GameState';
import { longswordIntersectsCircle } from './longsword';
import {
  spawnArrow,
  spawnMagicProjectile,
  updateProjectiles,
} from './projectiles';
import { updateSlow } from './slow';

const PLAYTEST_WEAPON_SLOTS: Record<WeaponSlotId, WeaponId> = {
  0: 'longsword',
  1: 'bow',
  2: 'magic',
};

export function updateGame(
  state: GameState,
  inputSource: InputSource,
  step: SimulationStep,
): void {
  const input = inputSource.sample(step.frame);

  state.frame = step.frame;
  updateSelectedWeapon(state, input.weaponSlotPressed);
  const worldTimeScale = updateSlow(state, input.slowHeld, step.dt);

  const playerIsHitStopped = state.player.hitStopFramesRemaining > 0;
  const dummyIsHitStopped = state.dummy.hitStopFramesRemaining > 0;

  tickHitStopTimers(state, worldTimeScale);

  if (!dummyIsHitStopped) {
    tickDummyTimers(state, worldTimeScale);
  }

  if (!playerIsHitStopped) {
    tickWeaponAttackTimers(state);
    updatePlayer(state, input, step.dt);
    updateWeaponAttacks(state, input);
  }

  updateProjectiles(
    state,
    input.aimTargetX,
    input.aimTargetY,
    step.dt * worldTimeScale,
    worldTimeScale,
  );
}

function updateSelectedWeapon(
  state: GameState,
  weaponSlotPressed: WeaponSlotId | null,
): void {
  if (weaponSlotPressed !== null) {
    state.selectedWeapon = PLAYTEST_WEAPON_SLOTS[weaponSlotPressed];
  }
}

function tickHitStopTimers(
  state: GameState,
  worldTimeScale: number,
): void {
  state.player.hitStopFramesRemaining = Math.max(
    0,
    state.player.hitStopFramesRemaining - 1,
  );
  state.dummy.hitStopFramesRemaining = Math.max(
    0,
    state.dummy.hitStopFramesRemaining - worldTimeScale,
  );
}

function tickWeaponAttackTimers(state: GameState): void {
  state.longswordAttack.activeFramesRemaining = Math.max(
    0,
    state.longswordAttack.activeFramesRemaining - 1,
  );
  state.longswordAttack.cooldownFramesRemaining = Math.max(
    0,
    state.longswordAttack.cooldownFramesRemaining - 1,
  );
  state.bowAttack.cooldownFramesRemaining = Math.max(
    0,
    state.bowAttack.cooldownFramesRemaining - 1,
  );
  state.magicAttack.cooldownFramesRemaining = Math.max(
    0,
    state.magicAttack.cooldownFramesRemaining - 1,
  );
}

function tickDummyTimers(state: GameState, worldTimeScale: number): void {
  state.dummy.hitFlashFramesRemaining = Math.max(
    0,
    state.dummy.hitFlashFramesRemaining - worldTimeScale,
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

  const aim = normalize(
    input.aimTargetX - state.player.x,
    input.aimTargetY - state.player.y,
  );
  if (aim.x !== 0 || aim.y !== 0) {
    state.player.aimX = aim.x;
    state.player.aimY = aim.y;
  }
}

function normalize(x: number, y: number): { x: number; y: number } {
  const length = Math.hypot(x, y);
  if (length === 0) {
    return { x: 0, y: 0 };
  }
  return { x: x / length, y: y / length };
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

function updateWeaponAttacks(state: GameState, input: InputFrame): void {
  updateLongswordAttack(state, input);

  if (!input.primaryPressed) {
    return;
  }

  if (
    state.selectedWeapon === 'bow' &&
    state.bowAttack.cooldownFramesRemaining === 0
  ) {
    spawnArrow(state);
    state.bowAttack.cooldownFramesRemaining = BOW_COOLDOWN_FRAMES;
  }

  if (
    state.selectedWeapon === 'magic' &&
    state.magicAttack.cooldownFramesRemaining === 0 &&
    spawnMagicProjectile(state)
  ) {
    state.magicAttack.cooldownFramesRemaining = MAGIC_COOLDOWN_FRAMES;
  }
}

function updateLongswordAttack(state: GameState, input: InputFrame): void {
  const attack = state.longswordAttack;

  if (
    state.selectedWeapon === 'longsword' &&
    input.primaryPressed &&
    attack.cooldownFramesRemaining === 0
  ) {
    attack.activeFramesRemaining = LONGSWORD_ACTIVE_FRAMES;
    attack.cooldownFramesRemaining = LONGSWORD_COOLDOWN_FRAMES;
    attack.hitDummy = false;
    attack.aimX = state.player.aimX;
    attack.aimY = state.player.aimY;
  }

  if (
    attack.activeFramesRemaining > 0 &&
    !attack.hitDummy &&
    longswordIntersectsCircle(
      state.player.x,
      state.player.y,
      attack,
      state.dummy.x,
      state.dummy.y,
      DUMMY_RADIUS,
    )
  ) {
    attack.hitDummy = true;
    state.dummy.hitCount += 1;
    state.dummy.hitFlashFramesRemaining = HIT_FLASH_FRAMES;
    state.player.hitStopFramesRemaining = HIT_STOP_FRAMES;
    state.dummy.hitStopFramesRemaining = HIT_STOP_FRAMES;
  }
}
