import { describe, expect, it } from 'vitest';

import {
  ARCHER_ATTACK_DAMAGE,
  ARCHER_MAX_DISTANCE,
  ARCHER_MIN_DISTANCE,
  ARCHER_MOVE_SPEED,
  ARCHER_RECOVERY_FRAMES,
  ARCHER_WINDUP_FRAMES,
  BOW_PROJECTILE_SPEED,
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
    farState.formation.phase = 'engaged';
    const farArcher = getArcher(farState);
    farArcher.x = farState.player.x + ARCHER_MAX_DISTANCE + 100;
    farArcher.y = farState.player.y;
    farState.formation.lastKnownPlayerX = farState.player.x;
    farState.formation.lastKnownPlayerY = farState.player.y;
    const farStartX = farArcher.x;

    updateArcher(farState, farArcher, FIXED_STEP_SECONDS);

    expect(farArcher.x).toBeCloseTo(
      farStartX - ARCHER_MOVE_SPEED * FIXED_STEP_SECONDS,
    );

    const nearState = createInitialGameState();
    nearState.formation.phase = 'engaged';
    const nearArcher = getArcher(nearState);
    nearArcher.x = nearState.player.x + ARCHER_MIN_DISTANCE - 20;
    nearArcher.y = nearState.player.y;
    nearState.formation.lastKnownPlayerX = nearState.player.x;
    nearState.formation.lastKnownPlayerY = nearState.player.y;
    const nearStartX = nearArcher.x;

    updateArcher(nearState, nearArcher, FIXED_STEP_SECONDS);

    expect(nearArcher.x).toBeGreaterThan(nearStartX);
  });

  it('locks its aim during windup and fires a player-style straight arrow', () => {
    const state = createInitialGameState();
    state.formation.phase = 'engaged';
    const archer = getArcher(state);
    archer.x = state.player.x + 300;
    archer.y = state.player.y;
    state.formation.lastKnownPlayerX = state.player.x;
    state.formation.lastKnownPlayerY = state.player.y;

    updateArcher(state, archer, FIXED_STEP_SECONDS);
    expect(archer.action).toBe('windup');
    expect(archer.actionFramesRemaining).toBe(ARCHER_WINDUP_FRAMES);
    expect(archer.aimX).toBe(-1);

    state.player.y += 100;
    for (let frame = 0; frame < ARCHER_WINDUP_FRAMES; frame += 1) {
      updateArcher(state, archer, FIXED_STEP_SECONDS);
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

    updateArcher(state, archer, FIXED_STEP_SECONDS);
    expect(state.projectiles).toHaveLength(0);

    archer.actionFramesRemaining = 1;
    updateArcher(state, archer, FIXED_STEP_SECONDS);
    for (let frame = 0; frame < 10 && state.projectiles.length > 0; frame += 1) {
      updateProjectiles(
        state,
        state.player.x,
        state.player.y,
        FIXED_STEP_SECONDS,
      );
    }

    expect(state.projectiles).toHaveLength(0);
    expect(state.player.health.current).toBe(
      startHealth - ARCHER_ATTACK_DAMAGE,
    );
  });

  it('retains a valid tactical angle while the shared target moves', () => {
    const state = createInitialGameState();
    state.formation.phase = 'searching';
    state.formation.lastKnownPlayerX = 700;
    state.formation.lastKnownPlayerY = 270;
    const archer = getArcher(state);
    archer.x = 526;
    archer.y = 270;

    updateArcher(state, archer, FIXED_STEP_SECONDS);
    const selectedAngle = archer.tacticalAngle;

    expect(selectedAngle).not.toBeNull();

    state.formation.lastKnownPlayerX += 2;
    state.formation.lastKnownPlayerY += 2;
    updateArcher(state, archer, FIXED_STEP_SECONDS);

    expect(archer.tacticalAngle).toBe(selectedAngle);
  });

  it('reselects its tactical angle when the retained position is blocked', () => {
    const state = createInitialGameState();
    state.formation.phase = 'searching';
    state.formation.lastKnownPlayerX = 700;
    state.formation.lastKnownPlayerY = 270;
    const archer = getArcher(state);
    archer.x = 526;
    archer.y = 270;

    updateArcher(state, archer, FIXED_STEP_SECONDS);
    const selectedAngle = archer.tacticalAngle;

    state.formation.lastKnownPlayerY = 200;
    updateArcher(state, archer, FIXED_STEP_SECONDS);

    expect(archer.tacticalAngle).not.toBeNull();
    expect(archer.tacticalAngle).not.toBe(selectedAngle);
  });

  it('converges into firing range without reversing between tactical slots', () => {
    const state = createInitialGameState();
    state.formation.phase = 'engaged';
    const archer = getArcher(state);
    archer.x = 526;
    archer.y = 270;
    let previousDirection: { x: number; y: number } | null = null;
    let reversalCount = 0;

    for (let frame = 0; frame < 360; frame += 1) {
      const angle = (frame / 360) * Math.PI * 2;
      state.player.x = 700 + Math.cos(angle) * 20;
      state.player.y = 270 + Math.sin(angle) * 20;
      state.formation.lastKnownPlayerX = state.player.x;
      state.formation.lastKnownPlayerY = state.player.y;
      const startX = archer.x;
      const startY = archer.y;

      updateArcher(state, archer, FIXED_STEP_SECONDS);

      const movementX = archer.x - startX;
      const movementY = archer.y - startY;
      const movementDistance = Math.hypot(movementX, movementY);
      if (movementDistance === 0) {
        continue;
      }
      const direction = {
        x: movementX / movementDistance,
        y: movementY / movementDistance,
      };
      if (
        previousDirection !== null &&
        direction.x * previousDirection.x +
          direction.y * previousDirection.y <
          -0.9
      ) {
        reversalCount += 1;
      }
      previousDirection = direction;
    }

    expect(reversalCount).toBeLessThanOrEqual(1);
    expect(state.projectiles.length).toBeGreaterThan(0);
  });
});

function getArcher(state: GameState): ArcherState {
  const enemy = state.enemies.find((candidate) => candidate.kind === 'archer');
  if (enemy?.kind !== 'archer') {
    throw new Error('Expected archer in initial state');
  }
  return enemy;
}
