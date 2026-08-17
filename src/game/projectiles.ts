import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BOW_PROJECTILE_LIFETIME_FRAMES,
  BOW_PROJECTILE_RADIUS,
  BOW_PROJECTILE_SPEED,
  DUMMY_RADIUS,
  HIT_FLASH_FRAMES,
  HIT_STOP_FRAMES,
  MAGIC_PROJECTILE_LIFETIME_FRAMES,
  MAGIC_PROJECTILE_RADIUS,
  MAGIC_PROJECTILE_SPEED,
  MAGIC_TURN_SPEED_RADIANS_PER_SECOND,
  PLAYER_RADIUS,
} from '../content/tuning';
import type {
  GameState,
  ProjectileKind,
  ProjectileState,
} from './GameState';

export function spawnArrow(state: GameState): void {
  state.projectiles.push(
    createProjectile(
      state,
      'arrow',
      BOW_PROJECTILE_RADIUS,
      BOW_PROJECTILE_SPEED,
      BOW_PROJECTILE_LIFETIME_FRAMES,
    ),
  );
}

export function spawnMagicProjectile(state: GameState): boolean {
  if (state.projectiles.some((projectile) => projectile.kind === 'magic')) {
    return false;
  }

  state.projectiles.push(
    createProjectile(
      state,
      'magic',
      MAGIC_PROJECTILE_RADIUS,
      MAGIC_PROJECTILE_SPEED,
      MAGIC_PROJECTILE_LIFETIME_FRAMES,
    ),
  );
  return true;
}

export function updateProjectiles(
  state: GameState,
  aimTargetX: number,
  aimTargetY: number,
  dt: number,
): void {
  const survivingProjectiles: ProjectileState[] = [];

  for (const projectile of state.projectiles) {
    if (projectile.kind === 'magic') {
      steerMagicProjectile(projectile, aimTargetX, aimTargetY, dt);
    }

    projectile.x += projectile.velocityX * dt;
    projectile.y += projectile.velocityY * dt;
    projectile.framesRemaining -= 1;

    if (projectileIntersectsDummy(state, projectile)) {
      state.dummy.hitCount += 1;
      state.dummy.hitFlashFramesRemaining = HIT_FLASH_FRAMES;
      state.dummy.hitStopFramesRemaining = Math.max(
        state.dummy.hitStopFramesRemaining,
        HIT_STOP_FRAMES,
      );
      continue;
    }

    if (
      projectile.framesRemaining > 0 &&
      projectileIsInsideArena(projectile)
    ) {
      survivingProjectiles.push(projectile);
    }
  }

  state.projectiles = survivingProjectiles;
}

export function getProjectileRadius(kind: ProjectileKind): number {
  return kind === 'arrow'
    ? BOW_PROJECTILE_RADIUS
    : MAGIC_PROJECTILE_RADIUS;
}

function createProjectile(
  state: GameState,
  kind: ProjectileKind,
  radius: number,
  speed: number,
  lifetimeFrames: number,
): ProjectileState {
  const spawnDistance = PLAYER_RADIUS + radius + 2;
  const projectile = {
    id: state.nextProjectileId,
    kind,
    x: state.player.x + state.player.aimX * spawnDistance,
    y: state.player.y + state.player.aimY * spawnDistance,
    velocityX: state.player.aimX * speed,
    velocityY: state.player.aimY * speed,
    framesRemaining: lifetimeFrames,
  };

  state.nextProjectileId += 1;
  return projectile;
}

function steerMagicProjectile(
  projectile: ProjectileState,
  targetX: number,
  targetY: number,
  dt: number,
): void {
  const targetOffsetX = targetX - projectile.x;
  const targetOffsetY = targetY - projectile.y;

  if (targetOffsetX === 0 && targetOffsetY === 0) {
    return;
  }

  const currentAngle = Math.atan2(
    projectile.velocityY,
    projectile.velocityX,
  );
  const targetAngle = Math.atan2(targetOffsetY, targetOffsetX);
  const angleDelta = normalizeAngle(targetAngle - currentAngle);
  const maximumTurn = MAGIC_TURN_SPEED_RADIANS_PER_SECOND * dt;
  const nextAngle =
    currentAngle + Math.min(maximumTurn, Math.max(-maximumTurn, angleDelta));

  projectile.velocityX = Math.cos(nextAngle) * MAGIC_PROJECTILE_SPEED;
  projectile.velocityY = Math.sin(nextAngle) * MAGIC_PROJECTILE_SPEED;
}

function normalizeAngle(angle: number): number {
  let normalized = angle;
  while (normalized > Math.PI) {
    normalized -= Math.PI * 2;
  }
  while (normalized < -Math.PI) {
    normalized += Math.PI * 2;
  }
  return normalized;
}

function projectileIntersectsDummy(
  state: GameState,
  projectile: ProjectileState,
): boolean {
  const distanceX = state.dummy.x - projectile.x;
  const distanceY = state.dummy.y - projectile.y;
  const collisionRadius =
    DUMMY_RADIUS + getProjectileRadius(projectile.kind);

  return (
    distanceX * distanceX + distanceY * distanceY <=
    collisionRadius * collisionRadius
  );
}

function projectileIsInsideArena(projectile: ProjectileState): boolean {
  const radius = getProjectileRadius(projectile.kind);
  return (
    projectile.x + radius >= 0 &&
    projectile.x - radius <= ARENA_WIDTH &&
    projectile.y + radius >= 0 &&
    projectile.y - radius <= ARENA_HEIGHT
  );
}
