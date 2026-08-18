import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  HIT_FLASH_FRAMES,
  HIT_STOP_FRAMES,
  PLAYER_HIT_KNOCKBACK_DISTANCE,
  PLAYER_HIT_KNOCKBACK_FRAMES,
  PLAYER_HIT_KNOCKBACK_RADIUS,
  PLAYER_INVULNERABILITY_FRAMES,
  PLAYER_MAX_HP,
  PLAYER_RADIUS,
} from '../content/tuning';
import type { GameState } from './GameState';

export function damagePlayer(state: GameState, damage: number): boolean {
  if (state.player.invulnerabilityFramesRemaining > 0) {
    return false;
  }

  state.player.health.current = Math.max(
    0,
    state.player.health.current - damage,
  );
  state.player.invulnerabilityFramesRemaining =
    PLAYER_INVULNERABILITY_FRAMES;
  state.player.hitFlashFramesRemaining = HIT_FLASH_FRAMES;
  state.player.hitStopFramesRemaining = Math.max(
    state.player.hitStopFramesRemaining,
    HIT_STOP_FRAMES,
  );
  state.player.hitCount += 1;
  knockBackNearbyEnemies(state);

  if (state.player.health.current === 0) {
    state.player.defeatCount += 1;
    state.player.health.current = PLAYER_MAX_HP;
    state.player.x = Math.max(PLAYER_RADIUS, ARENA_WIDTH * 0.25);
    state.player.y = ARENA_HEIGHT * 0.5;
  }

  return true;
}

function knockBackNearbyEnemies(state: GameState): void {
  for (const enemy of state.enemies) {
    if (enemy.action === 'dead') {
      continue;
    }

    const offsetX = enemy.x - state.player.x;
    const offsetY = enemy.y - state.player.y;
    const distance = Math.hypot(offsetX, offsetY);
    if (distance > PLAYER_HIT_KNOCKBACK_RADIUS) {
      continue;
    }

    const direction = getKnockbackDirection(
      offsetX,
      offsetY,
      enemy.aimX,
      enemy.aimY,
    );
    const proximity = 1 - distance / PLAYER_HIT_KNOCKBACK_RADIUS;
    const distancePerFrame =
      (PLAYER_HIT_KNOCKBACK_DISTANCE * (0.5 + proximity * 0.5)) /
      PLAYER_HIT_KNOCKBACK_FRAMES;

    enemy.knockbackFramesRemaining = PLAYER_HIT_KNOCKBACK_FRAMES;
    enemy.knockbackVelocityX = direction.x * distancePerFrame;
    enemy.knockbackVelocityY = direction.y * distancePerFrame;
  }
}

function getKnockbackDirection(
  offsetX: number,
  offsetY: number,
  enemyAimX: number,
  enemyAimY: number,
): { x: number; y: number } {
  const distance = Math.hypot(offsetX, offsetY);
  if (distance > 0) {
    return { x: offsetX / distance, y: offsetY / distance };
  }

  const aimLength = Math.hypot(enemyAimX, enemyAimY);
  if (aimLength > 0) {
    return { x: -enemyAimX / aimLength, y: -enemyAimY / aimLength };
  }

  return { x: 1, y: 0 };
}
