import { describe, expect, it } from 'vitest';

import {
  PLAYER_HIT_KNOCKBACK_FRAMES,
  PLAYER_INVULNERABILITY_FRAMES,
} from '../content/tuning';
import { updateEnemyHitState } from './enemyState';
import { createInitialGameState } from './GameState';
import { damagePlayer } from './playerDamage';

describe('player damage response', () => {
  it('ignores repeated damage during the invulnerability window', () => {
    const state = createInitialGameState();

    expect(damagePlayer(state, 20)).toBe(true);
    expect(damagePlayer(state, 20)).toBe(false);

    expect(state.player.health.current).toBe(80);
    expect(state.player.hitCount).toBe(1);
    expect(state.player.invulnerabilityFramesRemaining).toBe(
      PLAYER_INVULNERABILITY_FRAMES,
    );
  });

  it('briefly pushes nearby living enemies away from the player', () => {
    const state = createInitialGameState();
    const [nearbyEnemy, distantEnemy] = state.enemies;
    if (nearbyEnemy === undefined || distantEnemy === undefined) {
      throw new Error('Expected the initial enemy pair');
    }

    state.player.x = 300;
    state.player.y = 270;
    nearbyEnemy.x = 350;
    nearbyEnemy.y = 270;
    distantEnemy.x = 700;
    distantEnemy.y = 270;

    damagePlayer(state, 20);

    expect(nearbyEnemy.knockbackFramesRemaining).toBe(
      PLAYER_HIT_KNOCKBACK_FRAMES,
    );
    expect(distantEnemy.knockbackFramesRemaining).toBe(0);

    const startX = nearbyEnemy.x;
    expect(updateEnemyHitState(nearbyEnemy)).toBe(true);
    expect(nearbyEnemy.x).toBeGreaterThan(startX);
    expect(nearbyEnemy.knockbackFramesRemaining).toBe(
      PLAYER_HIT_KNOCKBACK_FRAMES - 1,
    );
  });

});
