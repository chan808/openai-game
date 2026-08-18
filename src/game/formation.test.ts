import { describe, expect, it } from 'vitest';

import {
  FORMATION_ARCHER_HOLD_X,
  FORMATION_ARCHER_HOLD_Y,
  FORMATION_SWORDSMAN_HOLD_X,
  SQUAD_SEARCH_FRAMES,
} from '../content/tuning';
import { FIXED_STEP_SECONDS } from '../core/GameClock';
import { damageEnemy } from './enemyState';
import { updateEnemies } from './enemies';
import { enemyCanSeePlayer, updateFormation } from './formation';
import {
  createInitialGameState,
  type ArcherState,
  type GameState,
  type SwordsmanState,
} from './GameState';
import { updateSwordsman } from './swordsman';

describe('enemy formation awareness', () => {
  it('holds prepared positions while the entrance is out of sight', () => {
    const state = createInitialGameState();
    const swordsman = getSwordsman(state);
    const archer = getArcher(state);

    updateEnemies(state, FIXED_STEP_SECONDS, 1);

    expect(state.formation.phase).toBe('holding');
    expect(swordsman.x).toBe(FORMATION_SWORDSMAN_HOLD_X);
    expect(archer.x).toBe(FORMATION_ARCHER_HOLD_X);
    expect(archer.y).toBe(FORMATION_ARCHER_HOLD_Y);
    expect(archer.action).toBe('positioning');
  });

  it('shares the player position when either enemy gains sight', () => {
    const state = createInitialGameState();
    const archer = getArcher(state);
    state.player.x = 390;
    state.player.y = 270;

    expect(enemyCanSeePlayer(state, archer)).toBe(true);
    updateFormation(state);

    expect(state.formation.phase).toBe('engaged');
    expect(state.formation.lastKnownPlayerX).toBe(390);
    expect(state.formation.lastKnownPlayerY).toBe(270);
  });

  it('treats a hit from outside sight as a revealed threat', () => {
    const state = createInitialGameState();

    damageEnemy(getArcher(state), 1);
    updateFormation(state);

    expect(state.formation.phase).toBe('engaged');
    expect(state.formation.lastKnownPlayerX).toBe(state.player.x);
    expect(state.formation.lastKnownPlayerY).toBe(state.player.y);
  });

  it('searches the last seen position after losing sight', () => {
    const state = createInitialGameState();
    state.player.x = 390;
    state.player.y = 270;
    updateFormation(state);

    state.player.x = 240;
    updateFormation(state);

    expect(state.formation.phase).toBe('searching');
    expect(state.formation.lastKnownPlayerX).toBe(390);
    expect(state.formation.lastKnownPlayerY).toBe(270);
  });

  it('returns to formation after checking an empty last seen position', () => {
    const state = createInitialGameState();
    const swordsman = getSwordsman(state);
    state.formation.phase = 'searching';
    state.formation.lastKnownPlayerX = 500;
    state.formation.lastKnownPlayerY = 135;
    state.formation.searchFramesRemaining = SQUAD_SEARCH_FRAMES;
    swordsman.x = 500;
    swordsman.y = 135;
    state.player.x = 300;
    state.player.y = 135;

    for (let frame = 0; frame < SQUAD_SEARCH_FRAMES; frame += 1) {
      updateFormation(state);
    }

    expect(state.formation.phase).toBe('returning');
  });

  it('settles back into holding after the squad reaches its anchors', () => {
    const state = createInitialGameState();
    state.formation.phase = 'returning';

    updateFormation(state);

    expect(state.formation.phase).toBe('holding');
  });

  it('routes the swordsman around terrain to the last seen position', () => {
    const state = createInitialGameState();
    const swordsman = getSwordsman(state);
    state.formation.phase = 'searching';
    state.formation.lastKnownPlayerX = 300;
    state.formation.lastKnownPlayerY = 400;

    for (let frame = 0; frame < 240; frame += 1) {
      updateSwordsman(state, swordsman, FIXED_STEP_SECONDS, 1);
    }

    expect(swordsman.x).toBeCloseTo(300);
    expect(swordsman.y).toBeCloseTo(400);
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
