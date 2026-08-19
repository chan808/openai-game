import { describe, expect, it } from 'vitest';

import { PLAYER_RADIUS } from '../content/tuning';
import { separatePlayerAndLivingEnemies } from './actorCollision';
import { getEnemyRadius } from './enemyState';
import { createInitialGameState } from './GameState';

const COLLISION_EPSILON = 0.001;

describe('actor collision', () => {
  it('separates a player exactly centered on a living enemy', () => {
    const state = createInitialGameState();
    const enemy = state.enemies[0]!;
    enemy.x = state.player.x;
    enemy.y = state.player.y;

    separatePlayerAndLivingEnemies(state);

    expect(
      Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y),
    ).toBeGreaterThanOrEqual(
      PLAYER_RADIUS + getEnemyRadius(enemy) - COLLISION_EPSILON,
    );
  });

  it('separates a player trapped between two living enemies', () => {
    const state = createInitialGameState();
    const [swordsman, archer] = state.enemies;
    if (swordsman === undefined || archer === undefined) {
      throw new Error('Expected the initial enemy pair');
    }

    state.player.x = 480;
    state.player.y = 270;
    swordsman.x = 450;
    swordsman.y = 270;
    archer.x = 510;
    archer.y = 270;

    separatePlayerAndLivingEnemies(state);

    expectActorsNotToOverlap(state);
  });
});

function expectActorsNotToOverlap(
  state: ReturnType<typeof createInitialGameState>,
): void {
  const actors = [
    { x: state.player.x, y: state.player.y, radius: PLAYER_RADIUS },
    ...state.enemies
      .filter((enemy) => enemy.action !== 'dead')
      .map((enemy) => ({
        x: enemy.x,
        y: enemy.y,
        radius: getEnemyRadius(enemy),
      })),
  ];

  for (let firstIndex = 0; firstIndex < actors.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < actors.length;
      secondIndex += 1
    ) {
      const first = actors[firstIndex]!;
      const second = actors[secondIndex]!;
      expect(
        Math.hypot(second.x - first.x, second.y - first.y),
      ).toBeGreaterThanOrEqual(
        first.radius + second.radius - COLLISION_EPSILON,
      );
    }
  }
}
