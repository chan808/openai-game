import {
  ARCHER_ATTACK_DAMAGE,
  ARCHER_RADIUS,
  BOW_DAMAGE,
  BOW_PROJECTILE_LIFETIME_FRAMES,
  BOW_PROJECTILE_RADIUS,
  BOW_PROJECTILE_SPEED,
  MAGIC_DAMAGE,
  MAGIC_PROJECTILE_LIFETIME_FRAMES,
  MAGIC_PROJECTILE_RADIUS,
  MAGIC_PROJECTILE_SPEED,
  MAGIC_TURN_SPEED_RADIANS_PER_SECOND,
  PLAYER_RADIUS,
} from '../content/tuning';
import { damageEnemy, getEnemyRadius } from './enemyState';
import type {
  ArcherState,
  EnemyState,
  GameState,
  ProjectileKind,
  ProjectileOwner,
  ProjectileState,
} from './GameState';
import { damagePlayer } from './playerDamage';
import { resetTeleportCooldown } from './teleport';
import { segmentIntersectsTerrain } from './terrain';

export function spawnArrow(state: GameState): void {
  state.projectiles.push(
    createProjectile(
      state,
      'player',
      'arrow',
      state.player.x,
      state.player.y,
      state.player.aimX,
      state.player.aimY,
      PLAYER_RADIUS,
      BOW_PROJECTILE_RADIUS,
      BOW_PROJECTILE_SPEED,
      BOW_PROJECTILE_LIFETIME_FRAMES,
    ),
  );
}

export function spawnEnemyArrow(
  state: GameState,
  archer: ArcherState,
): void {
  state.projectiles.push(
    createProjectile(
      state,
      'enemy',
      'arrow',
      archer.x,
      archer.y,
      archer.aimX,
      archer.aimY,
      ARCHER_RADIUS,
      BOW_PROJECTILE_RADIUS,
      BOW_PROJECTILE_SPEED,
      BOW_PROJECTILE_LIFETIME_FRAMES,
    ),
  );
}

export function spawnMagicProjectile(state: GameState): boolean {
  if (
    state.projectiles.some(
      (projectile) =>
        projectile.owner === 'player' && projectile.kind === 'magic',
    )
  ) {
    return false;
  }

  state.projectiles.push(
    createProjectile(
      state,
      'player',
      'magic',
      state.player.x,
      state.player.y,
      state.player.aimX,
      state.player.aimY,
      PLAYER_RADIUS,
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
  worldTimeScale: number,
): void {
  const worldDt = dt * worldTimeScale;
  const survivingProjectiles: ProjectileState[] = [];

  for (const projectile of state.projectiles) {
    if (projectile.owner === 'player' && projectile.kind === 'magic') {
      steerMagicProjectile(projectile, aimTargetX, aimTargetY, worldDt);
    }

    const startX = projectile.x;
    const startY = projectile.y;
    projectile.x += projectile.velocityX * worldDt;
    projectile.y += projectile.velocityY * worldDt;
    projectile.framesRemaining -= worldTimeScale;

    if (
      segmentIntersectsTerrain(
        startX,
        startY,
        projectile.x,
        projectile.y,
        getProjectileRadius(projectile.kind),
      )
    ) {
      continue;
    }

    if (projectile.owner === 'player') {
      const enemy = findIntersectedEnemy(state, projectile);
      if (enemy !== null) {
        damageEnemy(
          enemy,
          projectile.kind === 'arrow' ? BOW_DAMAGE : MAGIC_DAMAGE,
        );
        resetTeleportCooldown(state);
        continue;
      }
    } else if (projectileIntersectsPlayer(state, projectile)) {
      damagePlayer(state, ARCHER_ATTACK_DAMAGE);
      continue;
    }

    if (projectile.framesRemaining > 0) {
      survivingProjectiles.push(projectile);
    }
  }

  state.projectiles = survivingProjectiles;
}

export function getProjectileRadius(kind: ProjectileKind): number {
  switch (kind) {
    case 'arrow':
      return BOW_PROJECTILE_RADIUS;
    case 'magic':
      return MAGIC_PROJECTILE_RADIUS;
  }
}

function createProjectile(
  state: GameState,
  owner: ProjectileOwner,
  kind: ProjectileKind,
  originX: number,
  originY: number,
  aimX: number,
  aimY: number,
  originRadius: number,
  projectileRadius: number,
  speed: number,
  lifetimeFrames: number,
): ProjectileState {
  const spawnDistance = originRadius + projectileRadius + 2;
  const projectile = {
    id: state.nextProjectileId,
    owner,
    kind,
    x: originX + aimX * spawnDistance,
    y: originY + aimY * spawnDistance,
    velocityX: aimX * speed,
    velocityY: aimY * speed,
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

function findIntersectedEnemy(
  state: GameState,
  projectile: ProjectileState,
): EnemyState | null {
  for (const enemy of state.enemies) {
    if (
      enemy.action !== 'dead' &&
      projectileIntersectsCircle(
        projectile,
        enemy.x,
        enemy.y,
        getEnemyRadius(enemy),
      )
    ) {
      return enemy;
    }
  }
  return null;
}

function projectileIntersectsPlayer(
  state: GameState,
  projectile: ProjectileState,
): boolean {
  return projectileIntersectsCircle(
    projectile,
    state.player.x,
    state.player.y,
    PLAYER_RADIUS,
  );
}

function projectileIntersectsCircle(
  projectile: ProjectileState,
  x: number,
  y: number,
  targetRadius: number,
): boolean {
  const distanceX = x - projectile.x;
  const distanceY = y - projectile.y;
  const collisionRadius = targetRadius + getProjectileRadius(projectile.kind);

  return (
    distanceX * distanceX + distanceY * distanceY <=
    collisionRadius * collisionRadius
  );
}
