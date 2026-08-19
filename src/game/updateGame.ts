import type { SimulationStep } from '../core/GameClock';
import type {
  InputFrame,
  InputSource,
  WeaponSlotId,
} from '../core/InputSource';
import {
  BOW_COOLDOWN_FRAMES,
  HIT_STOP_FRAMES,
  LONGSWORD_BLADE_RADIUS,
  LONGSWORD_ACTIVE_FRAMES,
  LONGSWORD_COOLDOWN_FRAMES,
  LONGSWORD_DAMAGE,
  LONGSWORD_REACH,
  MAGIC_COOLDOWN_FRAMES,
  PLAYER_INPUT_BUFFER_FRAMES,
  PLAYER_MOVE_SPEED,
  PLAYER_RADIUS,
} from '../content/tuning';
import { separatePlayerAndLivingEnemies } from './actorCollision';
import { damageEnemy, getEnemyRadius } from './enemyState';
import { updateEnemies } from './enemies';
import type { GameState, WeaponId } from './GameState';
import {
  getLongswordSwingDirection,
  longswordIntersectsCircle,
} from './longsword';
import {
  spawnArrow,
  spawnMagicProjectile,
  updateProjectiles,
} from './projectiles';
import { updateSlow } from './slow';
import { getTerrainRayDistance, moveCircleAgainstTerrain } from './terrain';
import {
  resetTeleportCooldown,
  tickTeleportCooldown,
  tryTeleport,
  updateTeleportDestination,
} from './teleport';

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

  // Capture the start-of-tick state so the final remaining frame still freezes
  // the actor even though its timer reaches zero during this update.
  const playerIsHitStopped = state.player.hitStopFramesRemaining > 0;
  bufferHitStopInputs(state, input, playerIsHitStopped);
  tickPlayerHitStop(state);
  tickPlayerInvulnerability(state);
  if (!playerIsHitStopped) {
    tickPlayerHitFlash(state);
  }

  updateEnemies(state, step.dt, worldTimeScale);

  if (!playerIsHitStopped) {
    tickWeaponAttackTimers(state);
    tickTeleportCooldown(state);
    updatePlayer(state, input, step.dt);
    updateTeleportDestination(
      state,
      input.aimTargetX,
      input.aimTargetY,
    );
    const teleportPressed =
      input.teleportPressed ||
      state.inputBuffer.teleportFramesRemaining > 0;
    if (tryTeleport(state, teleportPressed)) {
      state.inputBuffer.teleportFramesRemaining = 0;
    }

    const primaryPressed =
      input.primaryPressed || state.inputBuffer.primaryFramesRemaining > 0;
    if (updateWeaponAttacks(state, primaryPressed)) {
      state.inputBuffer.primaryFramesRemaining = 0;
    }
  }

  updateProjectiles(
    state,
    input.aimTargetX,
    input.aimTargetY,
    step.dt,
    worldTimeScale,
  );
  separatePlayerAndLivingEnemies(state);
  tickInputBuffer(state);
}

function bufferHitStopInputs(
  state: GameState,
  input: InputFrame,
  playerIsHitStopped: boolean,
): void {
  if (!playerIsHitStopped) {
    return;
  }

  if (input.primaryPressed) {
    state.inputBuffer.primaryFramesRemaining = PLAYER_INPUT_BUFFER_FRAMES;
  }
  if (input.teleportPressed) {
    state.inputBuffer.teleportFramesRemaining = PLAYER_INPUT_BUFFER_FRAMES;
  }
}

function tickInputBuffer(state: GameState): void {
  state.inputBuffer.primaryFramesRemaining = Math.max(
    0,
    state.inputBuffer.primaryFramesRemaining - 1,
  );
  state.inputBuffer.teleportFramesRemaining = Math.max(
    0,
    state.inputBuffer.teleportFramesRemaining - 1,
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

function tickPlayerHitStop(state: GameState): void {
  state.player.hitStopFramesRemaining = Math.max(
    0,
    state.player.hitStopFramesRemaining - 1,
  );
}

function tickPlayerInvulnerability(state: GameState): void {
  state.player.invulnerabilityFramesRemaining = Math.max(
    0,
    state.player.invulnerabilityFramesRemaining - 1,
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

function tickPlayerHitFlash(state: GameState): void {
  state.player.hitFlashFramesRemaining = Math.max(
    0,
    state.player.hitFlashFramesRemaining - 1,
  );
}

function updatePlayer(
  state: GameState,
  input: InputFrame,
  dt: number,
): void {
  const movement = moveCircleAgainstTerrain(
    state.player.x,
    state.player.y,
    state.player.x + input.moveX * PLAYER_MOVE_SPEED * dt,
    state.player.y + input.moveY * PLAYER_MOVE_SPEED * dt,
    PLAYER_RADIUS,
  );

  state.player.x = movement.x;
  state.player.y = movement.y;
  separatePlayerAndLivingEnemies(state);

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

function updateWeaponAttacks(
  state: GameState,
  primaryPressed: boolean,
): boolean {
  const longswordAttackStarted = updateLongswordAttack(
    state,
    primaryPressed,
  );

  if (!primaryPressed) {
    return false;
  }

  switch (state.selectedWeapon) {
    case 'longsword':
      return longswordAttackStarted;
    case 'bow':
      if (state.bowAttack.cooldownFramesRemaining === 0) {
        spawnArrow(state);
        state.bowAttack.cooldownFramesRemaining = BOW_COOLDOWN_FRAMES;
        return true;
      }
      return false;
    case 'magic':
      if (
        state.magicAttack.cooldownFramesRemaining === 0 &&
        spawnMagicProjectile(state)
      ) {
        state.magicAttack.cooldownFramesRemaining = MAGIC_COOLDOWN_FRAMES;
        return true;
      }
      return false;
  }

  const exhaustiveWeapon: never = state.selectedWeapon;
  void exhaustiveWeapon;
  return false;
}

function updateLongswordAttack(
  state: GameState,
  primaryPressed: boolean,
): boolean {
  const attack = state.longswordAttack;
  let attackStarted = false;

  if (
    state.selectedWeapon === 'longsword' &&
    primaryPressed &&
    attack.cooldownFramesRemaining === 0
  ) {
    attack.activeFramesRemaining = LONGSWORD_ACTIVE_FRAMES;
    attack.cooldownFramesRemaining = LONGSWORD_COOLDOWN_FRAMES;
    attack.hitEnemyIds = [];
    attack.aimX = state.player.aimX;
    attack.aimY = state.player.aimY;
    attackStarted = true;
  }

  if (attack.activeFramesRemaining === 0) {
    return attackStarted;
  }

  const swingDirection = getLongswordSwingDirection(attack);
  const unobstructedReach = getTerrainRayDistance(
    state.player.x,
    state.player.y,
    swingDirection.x,
    swingDirection.y,
    LONGSWORD_REACH,
    LONGSWORD_BLADE_RADIUS,
  );
  let hitEnemy = false;
  for (const enemy of state.enemies) {
    if (
      enemy.action === 'dead' ||
      attack.hitEnemyIds.includes(enemy.id) ||
      !longswordIntersectsCircle(
        state.player.x,
        state.player.y,
        attack,
        enemy.x,
        enemy.y,
        getEnemyRadius(enemy),
        unobstructedReach,
      )
    ) {
      continue;
    }

    attack.hitEnemyIds.push(enemy.id);
    damageEnemy(enemy, LONGSWORD_DAMAGE);
    hitEnemy = true;
  }

  if (hitEnemy) {
    state.player.hitStopFramesRemaining = Math.max(
      state.player.hitStopFramesRemaining,
      HIT_STOP_FRAMES,
    );
    resetTeleportCooldown(state);
  }
  return attackStarted;
}
