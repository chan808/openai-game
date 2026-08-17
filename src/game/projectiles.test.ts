import { describe, expect, it } from 'vitest';

import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BOW_PROJECTILE_SPEED,
  HIT_STOP_FRAMES,
  MAGIC_PROJECTILE_SPEED,
} from '../content/tuning';
import { FIXED_STEP_SECONDS } from '../core/GameClock';
import { createInitialGameState } from './GameState';
import {
  spawnArrow,
  spawnMagicProjectile,
  updateProjectiles,
} from './projectiles';

describe('projectiles', () => {
  it('moves an arrow quickly along its launch direction', () => {
    const state = createInitialGameState();

    spawnArrow(state);
    const arrow = state.projectiles[0]!;
    const startX = arrow.x;

    updateProjectiles(
      state,
      ARENA_WIDTH,
      ARENA_HEIGHT / 2,
      FIXED_STEP_SECONDS,
    );

    expect(arrow.id).toBe(1);
    expect(arrow.kind).toBe('arrow');
    expect(arrow.x).toBeCloseTo(
      startX + BOW_PROJECTILE_SPEED * FIXED_STEP_SECONDS,
    );
    expect(arrow.y).toBeCloseTo(ARENA_HEIGHT / 2);
  });

  it('curves a slower magic projectile toward the current cursor target', () => {
    const state = createInitialGameState();

    expect(spawnMagicProjectile(state)).toBe(true);
    const magic = state.projectiles[0]!;
    const startY = magic.y;

    updateProjectiles(
      state,
      magic.x,
      0,
      FIXED_STEP_SECONDS,
    );

    expect(Math.hypot(magic.velocityX, magic.velocityY)).toBeCloseTo(
      MAGIC_PROJECTILE_SPEED,
    );
    expect(magic.velocityY).toBeLessThan(0);
    expect(magic.y).toBeLessThan(startY);
  });

  it('keeps one guided magic projectile active at a time', () => {
    const state = createInitialGameState();

    expect(spawnMagicProjectile(state)).toBe(true);
    expect(spawnMagicProjectile(state)).toBe(false);
    expect(state.projectiles).toHaveLength(1);
  });

  it('removes a ranged projectile on hit without freezing the shooter', () => {
    const state = createInitialGameState();
    state.dummy.x = state.player.x + 100;
    state.dummy.y = state.player.y;
    spawnArrow(state);

    for (let frame = 0; frame < 10 && state.projectiles.length > 0; frame += 1) {
      updateProjectiles(
        state,
        ARENA_WIDTH,
        ARENA_HEIGHT / 2,
        FIXED_STEP_SECONDS,
      );
    }

    expect(state.projectiles).toHaveLength(0);
    expect(state.dummy.hitCount).toBe(1);
    expect(state.dummy.hitStopFramesRemaining).toBe(HIT_STOP_FRAMES);
    expect(state.player.hitStopFramesRemaining).toBe(0);
  });
});
