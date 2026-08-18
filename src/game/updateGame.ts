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
  PLAYER_MOVE_SPEED,
  PLAYER_RADIUS,
} from '../content/tuning';
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
  tickPlayerHitStop(state);
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
    tryTeleport(state, input.teleportPressed);
    updateWeaponAttacks(state, input);
  }

  updateProjectiles(
    state,
    input.aimTargetX,
    input.aimTargetY,
    step.dt,
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

function tickPlayerHitStop(state: GameState): void {
  state.player.hitStopFramesRemaining = Math.max(
    0,
    state.player.hitStopFramesRemaining - 1,
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

  moveOutsideEnemies(state, movement.x, movement.y);

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

function moveOutsideEnemies(
  state: GameState,
  requestedX: number,
  requestedY: number,
): void {
  state.player.x = requestedX;
  state.player.y = requestedY;

  for (const enemy of state.enemies) {
    if (enemy.action === 'dead') {
      continue;
    }

    const dx = state.player.x - enemy.x;
    const dy = state.player.y - enemy.y;
    const distanceSquared = dx * dx + dy * dy;
    const minimumDistance = PLAYER_RADIUS + getEnemyRadius(enemy);
    if (
      distanceSquared === 0 ||
      distanceSquared >= minimumDistance * minimumDistance
    ) {
      continue;
    }

    const scale = minimumDistance / Math.sqrt(distanceSquared);
    const separatedPosition = moveCircleAgainstTerrain(
      state.player.x,
      state.player.y,
      enemy.x + dx * scale,
      enemy.y + dy * scale,
      PLAYER_RADIUS,
    );
    state.player.x = separatedPosition.x;
    state.player.y = separatedPosition.y;
  }
}

function updateWeaponAttacks(state: GameState, input: InputFrame): void {
  updateLongswordAttack(state, input);

  if (!input.primaryPressed) {
    return;
  }

  switch (state.selectedWeapon) {
    case 'longsword':
      return;
    case 'bow':
      if (state.bowAttack.cooldownFramesRemaining === 0) {
        spawnArrow(state);
        state.bowAttack.cooldownFramesRemaining = BOW_COOLDOWN_FRAMES;
      }
      return;
    case 'magic':
      if (
        state.magicAttack.cooldownFramesRemaining === 0 &&
        spawnMagicProjectile(state)
      ) {
        state.magicAttack.cooldownFramesRemaining = MAGIC_COOLDOWN_FRAMES;
      }
      return;
  }

  const exhaustiveWeapon: never = state.selectedWeapon;
  void exhaustiveWeapon;
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
    attack.hitEnemyIds = [];
    attack.aimX = state.player.aimX;
    attack.aimY = state.player.aimY;
  }

  if (attack.activeFramesRemaining === 0) {
    return;
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
}
