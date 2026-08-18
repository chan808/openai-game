import { describe, expect, it } from 'vitest';

import {
  ARCHER_ATTACK_DAMAGE,
  ARCHER_MAX_DISTANCE,
  ARCHER_MIN_DISTANCE,
  ARCHER_MOVE_SPEED,
  ARCHER_RECOVERY_FRAMES,
  ARCHER_WINDUP_FRAMES,
  BOW_PROJECTILE_SPEED,
  SLOW_WORLD_TIME_SCALE,
} from '../content/tuning';
import { FIXED_STEP_SECONDS } from '../core/GameClock';
import { updateArcher } from './archer';
import {
  createInitialGameState,
  type ArcherState,
  type GameState,
} from './GameState';
import { updateProjectiles } from './projectiles';

describe('archer', () => {
  it('approaches or retreats to enter its preferred range band', () => {
    const farState = createInitialGameState();
    const farArcher = getArcher(farState);
    farArcher.x = farState.player.x + ARCHER_MAX_DISTANCE + 100;
    farArcher.y = farState.player.y;
    const farStartX = farArcher.x;

    updateArcher(farState, farArcher, FIXED_STEP_SECONDS, 1);

    expect(farArcher.x).toBeCloseTo(
      farStartX - ARCHER_MOVE_SPEED * FIXED_STEP_SECONDS,
    );

    const nearState = createInitialGameState();
    const nearArcher = getArcher(nearState);
    nearArcher.x = nearState.player.x + ARCHER_MIN_DISTANCE - 20;
    nearArcher.y = nearState.player.y;
    const nearStartX = nearArcher.x;

    updateArcher(nearState, nearArcher, FIXED_STEP_SECONDS, 1);

    expect(nearArcher.x).toBeGreaterThan(nearStartX);
  });

  it('locks its aim during windup and fires a player-style straight arrow', () => {
    const state = createInitialGameState();
    const archer = getArcher(state);
    archer.x = state.player.x + 300;
    archer.y = state.player.y;

    updateArcher(state, archer, FIXED_STEP_SECONDS, 1);
    expect(archer.action).toBe('windup');
    expect(archer.actionFramesRemaining).toBe(ARCHER_WINDUP_FRAMES);
    expect(archer.aimX).toBe(-1);

    state.player.y += 100;
    for (let frame = 0; frame < ARCHER_WINDUP_FRAMES; frame += 1) {
      updateArcher(state, archer, FIXED_STEP_SECONDS, 1);
    }

    expect(archer.action).toBe('recovering');
    expect(archer.actionFramesRemaining).toBe(ARCHER_RECOVERY_FRAMES);
    expect(archer.aimX).toBe(-1);
    expect(archer.aimY).toBe(0);
    expect(state.projectiles).toHaveLength(1);
    expect(state.projectiles[0]).toMatchObject({
      owner: 'enemy',
      kind: 'arrow',
      velocityX: -BOW_PROJECTILE_SPEED,
      velocityY: 0,
    });
  });

  it('gives the player time to dodge, then deals damage on arrow contact', () => {
    const state = createInitialGameState();
    const archer = getArcher(state);
    archer.x = state.player.x + 100;
    archer.y = state.player.y;
    archer.aimX = -1;
    archer.aimY = 0;
    archer.action = 'windup';
    archer.actionFramesRemaining = ARCHER_WINDUP_FRAMES;
    const startHealth = state.player.health.current;

    updateArcher(state, archer, FIXED_STEP_SECONDS, 1);
    expect(state.projectiles).toHaveLength(0);

    archer.actionFramesRemaining = 1;
    updateArcher(state, archer, FIXED_STEP_SECONDS, 1);
    for (let frame = 0; frame < 10 && state.projectiles.length > 0; frame += 1) {
      updateProjectiles(
        state,
        state.player.x,
        state.player.y,
        FIXED_STEP_SECONDS,
        1,
      );
    }

    expect(state.projectiles).toHaveLength(0);
    expect(state.player.health.current).toBe(
      startHealth - ARCHER_ATTACK_DAMAGE,
    );
  });

  it('slows the archer windup with the rest of the world', () => {
    const state = createInitialGameState();
    const archer = getArcher(state);
    archer.action = 'windup';
    archer.actionFramesRemaining = ARCHER_WINDUP_FRAMES;

    updateArcher(
      state,
      archer,
      FIXED_STEP_SECONDS,
      SLOW_WORLD_TIME_SCALE,
    );

    expect(archer.actionFramesRemaining).toBe(
      ARCHER_WINDUP_FRAMES - SLOW_WORLD_TIME_SCALE,
    );
  });
});

function getArcher(state: GameState): ArcherState {
  const enemy = state.enemies.find((candidate) => candidate.kind === 'archer');
  if (enemy?.kind !== 'archer') {
    throw new Error('Expected archer in initial state');
  }
  return enemy;
}
