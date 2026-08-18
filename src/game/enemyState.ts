import {
  ARCHER_RADIUS,
  ARCHER_RESPAWN_FRAMES,
  HIT_FLASH_FRAMES,
  HIT_STOP_FRAMES,
  SWORDSMAN_RADIUS,
  SWORDSMAN_RESPAWN_FRAMES,
} from '../content/tuning';
import type { EnemyState } from './GameState';

export function updateEnemyHitState(
  enemy: EnemyState,
  worldTimeScale: number,
): boolean {
  if (enemy.action === 'dead') {
    enemy.actionFramesRemaining -= worldTimeScale;
    if (enemy.actionFramesRemaining <= 0) {
      respawnEnemy(enemy);
    }
    return true;
  }

  const wasHitStopped = enemy.hitStopFramesRemaining > 0;
  enemy.hitStopFramesRemaining = Math.max(
    0,
    enemy.hitStopFramesRemaining - worldTimeScale,
  );
  if (wasHitStopped) {
    return true;
  }

  enemy.hitFlashFramesRemaining = Math.max(
    0,
    enemy.hitFlashFramesRemaining - worldTimeScale,
  );
  return false;
}

export function damageEnemy(enemy: EnemyState, damage: number): boolean {
  if (enemy.action === 'dead') {
    return false;
  }

  enemy.health.current = Math.max(0, enemy.health.current - damage);
  enemy.hitCount += 1;
  enemy.hitFlashFramesRemaining = HIT_FLASH_FRAMES;

  if (enemy.health.current === 0) {
    enemy.action = 'dead';
    enemy.actionFramesRemaining = getEnemyRespawnFrames(enemy);
    enemy.hitStopFramesRemaining = 0;
    return true;
  }

  enemy.hitStopFramesRemaining = Math.max(
    enemy.hitStopFramesRemaining,
    HIT_STOP_FRAMES,
  );
  return true;
}

export function getEnemyRadius(enemy: EnemyState): number {
  switch (enemy.kind) {
    case 'swordsman':
      return SWORDSMAN_RADIUS;
    case 'archer':
      return ARCHER_RADIUS;
  }
}

export function getEnemyRespawnFrames(enemy: EnemyState): number {
  switch (enemy.kind) {
    case 'swordsman':
      return SWORDSMAN_RESPAWN_FRAMES;
    case 'archer':
      return ARCHER_RESPAWN_FRAMES;
  }
}

function respawnEnemy(enemy: EnemyState): void {
  enemy.x = enemy.spawnX;
  enemy.y = enemy.spawnY;
  enemy.aimX = -1;
  enemy.aimY = 0;
  enemy.health.current = enemy.health.maximum;
  enemy.actionFramesRemaining = 0;
  enemy.hitStopFramesRemaining = 0;
  enemy.hitFlashFramesRemaining = 0;

  switch (enemy.kind) {
    case 'swordsman':
      enemy.action = 'chasing';
      enemy.hitPlayer = false;
      return;
    case 'archer':
      enemy.action = 'positioning';
      return;
  }
}
