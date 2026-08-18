import { describe, expect, it } from 'vitest';

import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BOW_PROJECTILE_RADIUS,
  BOW_PROJECTILE_SPEED,
  HIT_STOP_FRAMES,
  MAGIC_PROJECTILE_SPEED,
  NORTHWEST_PILLAR_X,
  NORTHWEST_PILLAR_Y,
  SLOW_WORLD_TIME_SCALE,
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
      1,
    );

    expect(arrow.id).toBe(1);
    expect(arrow.kind).toBe('arrow');
    expect(arrow.x).toBeCloseTo(
      startX + BOW_PROJECTILE_SPEED * FIXED_STEP_SECONDS,
    );
    expect(arrow.y).toBeCloseTo(ARENA_HEIGHT / 2);
  });

  it('uses one world scale for projectile movement and lifetime', () => {
    const state = createInitialGameState();

    spawnArrow(state);
    const arrow = state.projectiles[0]!;
    const startX = arrow.x;
    const startFramesRemaining = arrow.framesRemaining;

    updateProjectiles(
      state,
      ARENA_WIDTH,
      ARENA_HEIGHT / 2,
      FIXED_STEP_SECONDS,
      SLOW_WORLD_TIME_SCALE,
    );

    expect(arrow.x).toBeCloseTo(
      startX +
        BOW_PROJECTILE_SPEED * FIXED_STEP_SECONDS * SLOW_WORLD_TIME_SCALE,
    );
    expect(arrow.framesRemaining).toBe(
      startFramesRemaining - SLOW_WORLD_TIME_SCALE,
    );
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
      1,
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
    const swordsman = state.enemies[0]!;
    swordsman.x = state.player.x + 100;
    swordsman.y = state.player.y;
    state.teleport.cooldownFramesRemaining = 30;
    spawnArrow(state);

    for (let frame = 0; frame < 10 && state.projectiles.length > 0; frame += 1) {
      updateProjectiles(
        state,
        ARENA_WIDTH,
        ARENA_HEIGHT / 2,
        FIXED_STEP_SECONDS,
        1,
      );
    }

    expect(state.projectiles).toHaveLength(0);
    expect(swordsman.hitCount).toBe(1);
    expect(swordsman.hitStopFramesRemaining).toBe(HIT_STOP_FRAMES);
    expect(state.player.hitStopFramesRemaining).toBe(0);
    expect(state.teleport.cooldownFramesRemaining).toBe(0);
  });

  it('removes a projectile when its lifetime expires', () => {
    const state = createInitialGameState();
    spawnArrow(state);
    state.projectiles[0]!.framesRemaining = 1;

    updateProjectiles(
      state,
      ARENA_WIDTH,
      ARENA_HEIGHT / 2,
      FIXED_STEP_SECONDS,
      1,
    );

    expect(state.projectiles).toHaveLength(0);
  });

  it('removes a projectile after it leaves the arena', () => {
    const state = createInitialGameState();
    spawnArrow(state);
    const arrow = state.projectiles[0]!;
    arrow.x = ARENA_WIDTH + BOW_PROJECTILE_RADIUS + 1;
    arrow.velocityX = 0;

    updateProjectiles(
      state,
      ARENA_WIDTH,
      ARENA_HEIGHT / 2,
      FIXED_STEP_SECONDS,
      1,
    );

    expect(state.projectiles).toHaveLength(0);
  });

  it('removes a projectile when it crosses a pillar', () => {
    const state = createInitialGameState();
    spawnArrow(state);
    const arrow = state.projectiles[0]!;
    arrow.x = NORTHWEST_PILLAR_X - 20;
    arrow.y = NORTHWEST_PILLAR_Y + 50;
    arrow.velocityX = BOW_PROJECTILE_SPEED;
    arrow.velocityY = 0;

    updateProjectiles(
      state,
      ARENA_WIDTH,
      arrow.y,
      FIXED_STEP_SECONDS * 2,
      1,
    );

    expect(state.projectiles).toHaveLength(0);
  });
});
