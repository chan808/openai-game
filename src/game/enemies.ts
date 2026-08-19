import { separateLivingEnemies } from './actorCollision';
import type { GameState } from './GameState';
import { updateArcher } from './archer';
import { updateEnemyHitState } from './enemyState';
import { updateFormation } from './formation';
import { updateSwordsman } from './swordsman';

export function updateEnemies(
  state: GameState,
  dt: number,
): void {
  updateFormation(state);

  for (const enemy of state.enemies) {
    if (updateEnemyHitState(enemy)) {
      continue;
    }

    switch (enemy.kind) {
      case 'swordsman':
        updateSwordsman(state, enemy, dt);
        break;
      case 'archer':
        updateArcher(state, enemy, dt);
        break;
    }
  }

  separateLivingEnemies(state);
}
