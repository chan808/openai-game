import type { GameState } from './GameState';
import { updateArcher } from './archer';
import { updateEnemyHitState } from './enemyState';
import { updateSwordsman } from './swordsman';

export function updateEnemies(
  state: GameState,
  dt: number,
  worldTimeScale: number,
): void {
  for (const enemy of state.enemies) {
    if (updateEnemyHitState(enemy, worldTimeScale)) {
      continue;
    }

    switch (enemy.kind) {
      case 'swordsman':
        updateSwordsman(state, enemy, dt, worldTimeScale);
        break;
      case 'archer':
        updateArcher(state, enemy, dt, worldTimeScale);
        break;
    }
  }
}
