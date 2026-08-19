import { describe, expect, it } from 'vitest';

import {
  ARENA_WALL_THICKNESS,
  ARCHER_RADIUS,
  SWORDSMAN_RADIUS,
} from '../content/tuning';
import { FIXED_STEP_SECONDS } from '../core/GameClock';
import { updateEnemies } from './enemies';
import { getEnemyRadius } from './enemyState';
import { createInitialGameState } from './GameState';
import { circleIntersectsTerrain } from './terrain';

describe('enemy updates', () => {
  it('separates overlapping living enemies after their movement', () => {
    const state = createInitialGameState();
    const [swordsman, archer] = state.enemies;
    if (swordsman === undefined || archer === undefined) {
      throw new Error('Expected the initial enemy pair');
    }
    swordsman.x = ARENA_WALL_THICKNESS + SWORDSMAN_RADIUS;
    swordsman.y = 270;
    archer.x = swordsman.x + 4;
    archer.y = swordsman.y;
    swordsman.hitStopFramesRemaining = 10;
    archer.hitStopFramesRemaining = 10;

    updateEnemies(state, FIXED_STEP_SECONDS);

    expect(
      Math.hypot(archer.x - swordsman.x, archer.y - swordsman.y),
    ).toBeCloseTo(SWORDSMAN_RADIUS + ARCHER_RADIUS, 3);
    expect(
      circleIntersectsTerrain(swordsman.x, swordsman.y, SWORDSMAN_RADIUS),
    ).toBe(false);
    expect(
      circleIntersectsTerrain(archer.x, archer.y, ARCHER_RADIUS),
    ).toBe(false);
  });

  it('keeps complete enemy updates outside terrain and each other', () => {
    const state = createInitialGameState();
    state.player.x = 300;
    state.player.y = 400;
    state.formation.phase = 'engaged';

    for (let frame = 0; frame < 360; frame += 1) {
      updateEnemies(state, FIXED_STEP_SECONDS);

      for (const enemy of state.enemies) {
        expect(
          circleIntersectsTerrain(enemy.x, enemy.y, getEnemyRadius(enemy)),
        ).toBe(false);
      }

      const [first, second] = state.enemies;
      if (
        first !== undefined &&
        second !== undefined &&
        first.action !== 'dead' &&
        second.action !== 'dead'
      ) {
        expect(
          Math.hypot(second.x - first.x, second.y - first.y),
        ).toBeGreaterThanOrEqual(
          getEnemyRadius(first) + getEnemyRadius(second) - 0.001,
        );
      }
    }
  });
});
