import { describe, expect, it } from 'vitest';

import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BOW_DAMAGE,
  BOW_PROJECTILE_RADIUS,
  BOW_PROJECTILE_SPEED,
  HIT_STOP_FRAMES,
  MAGIC_PROJECTILE_SPEED,
  NORTHWEST_PILLAR_X,
  NORTHWEST_PILLAR_Y,
  PLAYER_RADIUS,
  TELEPORT_ECHO_ULTIMATE_CHARGE,
  ULTIMATE_MAX_CHARGE,
} from '../content/tuning';
import { FIXED_STEP_SECONDS } from '../core/GameClock';
import { createInitialGameState } from './GameState';
import {
  spawnArrow,
  spawnEnemyArrow,
  spawnMagicProjectile,
  updateProjectiles,
} from './projectiles';
import { tryTeleport } from './teleport';
import { tryActivateUltimate } from './ultimate';

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

  it('can freeze an enemy projectile without advancing its lifetime', () => {
    const state = createInitialGameState();
    const archer = state.enemies.find((enemy) => enemy.kind === 'archer');
    if (archer?.kind !== 'archer') {
      throw new Error('Expected an archer in the initial state');
    }

    spawnEnemyArrow(state, archer);
    const arrow = state.projectiles[0]!;
    const startX = arrow.x;
    const startFramesRemaining = arrow.framesRemaining;

    updateProjectiles(
      state,
      ARENA_WIDTH,
      ARENA_HEIGHT / 2,
      FIXED_STEP_SECONDS,
      false,
    );

    expect(arrow.x).toBe(startX);
    expect(arrow.framesRemaining).toBe(startFramesRemaining);
  });

  it('freezes an existing player projectile during ultimate recording', () => {
    const state = createInitialGameState();
    spawnArrow(state);
    const arrow = state.projectiles[0]!;
    const startX = arrow.x;
    const startFramesRemaining = arrow.framesRemaining;
    state.ultimate.charge.current = ULTIMATE_MAX_CHARGE;
    tryActivateUltimate(state, true);

    updateProjectiles(
      state,
      ARENA_WIDTH,
      ARENA_HEIGHT / 2,
      FIXED_STEP_SECONDS,
    );

    expect(arrow.timeDomain).toBe('world');
    expect(arrow.x).toBe(startX);
    expect(arrow.framesRemaining).toBe(startFramesRemaining);
  });

  it('plans one lethal hit and lets later projectiles pass through the target', () => {
    const state = createInitialGameState();
    const swordsman = state.enemies[0]!;
    const archer = state.enemies[1]!;
    archer.action = 'dead';
    archer.actionFramesRemaining = 1_000;
    swordsman.x =
      state.player.x +
      PLAYER_RADIUS +
      BOW_PROJECTILE_RADIUS +
      2 +
      BOW_PROJECTILE_SPEED * FIXED_STEP_SECONDS;
    swordsman.y = state.player.y;
    swordsman.health.current = BOW_DAMAGE;
    state.ultimate.charge.current = ULTIMATE_MAX_CHARGE;
    tryActivateUltimate(state, true);
    spawnArrow(state);
    spawnArrow(state);

    updateProjectiles(
      state,
      ARENA_WIDTH,
      ARENA_HEIGHT / 2,
      FIXED_STEP_SECONDS,
    );

    expect(swordsman.health.current).toBe(BOW_DAMAGE);
    expect(swordsman.hitCount).toBe(0);
    expect(state.ultimate.hitEvents).toHaveLength(1);
    expect(state.ultimate.projectileLaunches).toHaveLength(2);
    expect(state.projectiles).toHaveLength(1);
    expect(state.projectiles[0]).toMatchObject({
      id: 2,
      timeDomain: 'ultimate',
    });
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
      );
    }

    expect(state.projectiles).toHaveLength(0);
    expect(swordsman.hitCount).toBe(1);
    expect(swordsman.hitStopFramesRemaining).toBe(HIT_STOP_FRAMES);
    expect(state.player.hitStopFramesRemaining).toBe(0);
    expect(state.teleport.cooldownFramesRemaining).toBe(30);
  });

  it('spends an enemy arrow on a teleport echo and charges the ultimate', () => {
    const state = createInitialGameState();
    const archer = state.enemies.find((enemy) => enemy.kind === 'archer');
    if (archer?.kind !== 'archer') {
      throw new Error('Expected an archer in the initial state');
    }
    const echoX = state.player.x;
    const echoY = state.player.y;
    archer.x = echoX + 100;
    archer.y = echoY;
    archer.aimX = -1;
    archer.aimY = 0;
    state.teleport.destinationX = echoX;
    state.teleport.destinationY = echoY + 100;
    tryTeleport(state, true);
    spawnEnemyArrow(state, archer);

    for (let frame = 0; frame < 10 && state.projectiles.length > 0; frame += 1) {
      updateProjectiles(
        state,
        ARENA_WIDTH,
        ARENA_HEIGHT / 2,
        FIXED_STEP_SECONDS,
      );
    }

    expect(state.projectiles).toHaveLength(0);
    expect(state.player.hitCount).toBe(0);
    expect(state.teleport.echo.framesRemaining).toBe(0);
    expect(state.ultimate.charge.current).toBe(
      TELEPORT_ECHO_ULTIMATE_CHARGE,
    );
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
    );

    expect(state.projectiles).toHaveLength(0);
  });
});
