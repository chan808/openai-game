import { describe, expect, it } from 'vitest';

import {
  FORMATION_ARCHER_HOLD_X,
  FORMATION_ARCHER_HOLD_Y,
  FORMATION_PRESS_TRIGGER_X,
  FORMATION_SWORDSMAN_HOLD_X,
  FORMATION_SWORDSMAN_PRESS_X,
} from '../content/tuning';
import { FIXED_STEP_SECONDS } from '../core/GameClock';
import { damageEnemy } from './enemyState';
import { updateEnemies } from './enemies';
import { updateFormation } from './formation';
import {
  createInitialGameState,
  type ArcherState,
  type GameState,
  type SwordsmanState,
} from './GameState';

describe('enemy formation', () => {
  it('holds prepared positions instead of chasing on stage entry', () => {
    const state = createInitialGameState();
    const swordsman = getSwordsman(state);
    const archer = getArcher(state);

    updateEnemies(state, FIXED_STEP_SECONDS, 1);

    expect(state.formation.phase).toBe('holding');
    expect(swordsman.x).toBe(FORMATION_SWORDSMAN_HOLD_X);
    expect(archer.x).toBe(FORMATION_ARCHER_HOLD_X);
    expect(archer.y).toBe(FORMATION_ARCHER_HOLD_Y);
    expect(archer.action).toBe('windup');
  });

  it('advances the formation without breaking when attacked from range', () => {
    const state = createInitialGameState();
    const swordsman = getSwordsman(state);

    damageEnemy(getArcher(state), 1);
    updateFormation(state);
    updateEnemies(state, FIXED_STEP_SECONDS, 1);

    expect(state.formation.phase).toBe('pressing');
    expect(swordsman.x).toBeLessThan(FORMATION_SWORDSMAN_HOLD_X);
    expect(swordsman.x).toBeGreaterThan(FORMATION_SWORDSMAN_PRESS_X);
  });

  it('presses when the player enters the arena combat line', () => {
    const state = createInitialGameState();
    state.player.x = FORMATION_PRESS_TRIGGER_X;

    updateFormation(state);

    expect(state.formation.phase).toBe('pressing');
  });

  it('breaks only after the guard dies', () => {
    const state = createInitialGameState();

    damageEnemy(getSwordsman(state), getSwordsman(state).health.maximum);
    updateFormation(state);

    expect(state.formation.phase).toBe('broken');
  });
});

function getSwordsman(state: GameState): SwordsmanState {
  const enemy = state.enemies.find((candidate) => candidate.kind === 'swordsman');
  if (enemy?.kind !== 'swordsman') {
    throw new Error('Expected swordsman in initial state');
  }
  return enemy;
}

function getArcher(state: GameState): ArcherState {
  const enemy = state.enemies.find((candidate) => candidate.kind === 'archer');
  if (enemy?.kind !== 'archer') {
    throw new Error('Expected archer in initial state');
  }
  return enemy;
}
