import { describe, expect, it } from 'vitest';

import {
  HIT_STOP_FRAMES,
  NORTHWEST_PILLAR_HEIGHT,
  NORTHWEST_PILLAR_WIDTH,
  NORTHWEST_PILLAR_X,
  NORTHWEST_PILLAR_Y,
  PLAYER_RADIUS,
  SLOW_WORLD_TIME_SCALE,
  SWORDSMAN_ATTACK_DAMAGE,
  SWORDSMAN_MAX_HP,
  SWORDSMAN_MOVE_SPEED,
  SWORDSMAN_RADIUS,
  SWORDSMAN_RESPAWN_FRAMES,
  SWORDSMAN_WINDUP_FRAMES,
} from '../content/tuning';
import { FIXED_STEP_SECONDS } from '../core/GameClock';
import { damageEnemy } from './enemyState';
import { updateEnemies } from './enemies';
import {
  createInitialGameState,
  type GameState,
  type SwordsmanState,
} from './GameState';
import {
  swordsmanAttackIntersectsPlayer,
  updateSwordsman,
} from './swordsman';

describe('swordsman', () => {
  it('chases the player using world-scaled fixed-step movement', () => {
    const normalState = createInitialGameState();
    const slowedState = createInitialGameState();
    normalState.formation.phase = 'broken';
    slowedState.formation.phase = 'broken';
    const normalSwordsman = getSwordsman(normalState);
    const slowedSwordsman = getSwordsman(slowedState);
    normalSwordsman.y = normalState.player.y;
    slowedSwordsman.y = slowedState.player.y;
    const normalStartX = normalSwordsman.x;
    const slowedStartX = slowedSwordsman.x;

    updateSwordsman(normalState, normalSwordsman, FIXED_STEP_SECONDS, 1);
    updateSwordsman(
      slowedState,
      slowedSwordsman,
      FIXED_STEP_SECONDS,
      SLOW_WORLD_TIME_SCALE,
    );

    expect(normalSwordsman.x).toBeCloseTo(
      normalStartX - SWORDSMAN_MOVE_SPEED * FIXED_STEP_SECONDS,
    );
    expect(slowedSwordsman.x).toBeCloseTo(
      slowedStartX -
        SWORDSMAN_MOVE_SPEED *
          FIXED_STEP_SECONDS *
          SLOW_WORLD_TIME_SCALE,
    );
  });

  it('locks its attack direction during the telegraphed windup', () => {
    const state = createInitialGameState();
    state.formation.phase = 'broken';
    const swordsman = getSwordsman(state);
    swordsman.x = state.player.x + 70;
    swordsman.y = state.player.y;

    updateSwordsman(state, swordsman, FIXED_STEP_SECONDS, 1);

    expect(swordsman.action).toBe('windup');
    expect(swordsman.actionFramesRemaining).toBe(SWORDSMAN_WINDUP_FRAMES);
    expect(swordsman.aimX).toBe(-1);
    expect(swordsman.aimY).toBe(0);

    state.player.y += 100;
    updateSwordsman(state, swordsman, FIXED_STEP_SECONDS, 1);

    expect(swordsman.aimX).toBe(-1);
    expect(swordsman.aimY).toBe(0);
  });

  it('hits the player only once during one active attack', () => {
    const state = createInitialGameState();
    const swordsman = getSwordsman(state);
    swordsman.x = state.player.x + 70;
    swordsman.y = state.player.y;
    swordsman.aimX = -1;
    swordsman.aimY = 0;
    swordsman.action = 'attacking';
    swordsman.actionFramesRemaining = 3;
    const startHealth = state.player.health.current;

    updateSwordsman(state, swordsman, FIXED_STEP_SECONDS, 1);
    updateSwordsman(state, swordsman, FIXED_STEP_SECONDS, 1);

    expect(state.player.health.current).toBe(
      startHealth - SWORDSMAN_ATTACK_DAMAGE,
    );
    expect(state.player.hitStopFramesRemaining).toBe(HIT_STOP_FRAMES);
  });

  it('does not hit the player through a pillar', () => {
    const state = createInitialGameState();
    const swordsman = getSwordsman(state);
    const attackY = NORTHWEST_PILLAR_Y + NORTHWEST_PILLAR_HEIGHT / 2;
    swordsman.x = NORTHWEST_PILLAR_X - SWORDSMAN_RADIUS;
    swordsman.y = attackY;
    swordsman.aimX = 1;
    swordsman.aimY = 0;
    state.player.x =
      NORTHWEST_PILLAR_X + NORTHWEST_PILLAR_WIDTH + PLAYER_RADIUS;
    state.player.y = attackY;

    expect(swordsmanAttackIntersectsPlayer(state, swordsman)).toBe(false);
  });

  it('dies from damage and respawns after the configured world time', () => {
    const state = createInitialGameState();
    const swordsman = getSwordsman(state);

    expect(damageEnemy(swordsman, SWORDSMAN_MAX_HP)).toBe(true);
    expect(swordsman.action).toBe('dead');
    expect(swordsman.health.current).toBe(0);

    for (let frame = 0; frame < SWORDSMAN_RESPAWN_FRAMES; frame += 1) {
      updateEnemies(state, FIXED_STEP_SECONDS, 1);
    }

    expect(swordsman.action).toBe('chasing');
    expect(swordsman.health.current).toBe(SWORDSMAN_MAX_HP);
  });
});

function getSwordsman(state: GameState): SwordsmanState {
  const enemy = state.enemies.find((candidate) => candidate.kind === 'swordsman');
  if (enemy?.kind !== 'swordsman') {
    throw new Error('Expected swordsman in initial state');
  }
  return enemy;
}
