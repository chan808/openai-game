import {
  FORMATION_ARCHER_HOLD_X,
  FORMATION_ARCHER_HOLD_Y,
  FORMATION_ARCHER_PRESS_X,
  FORMATION_ARCHER_PRESS_Y,
  FORMATION_BREAK_TRIGGER_X,
  FORMATION_GUARD_RADIUS,
  FORMATION_PRESS_TRIGGER_X,
  FORMATION_SWORDSMAN_HOLD_X,
  FORMATION_SWORDSMAN_HOLD_Y,
  FORMATION_SWORDSMAN_PRESS_X,
  FORMATION_SWORDSMAN_PRESS_Y,
} from '../content/tuning';
import type {
  EnemyState,
  FormationPhase,
  GameState,
} from './GameState';

export interface FormationAnchor {
  x: number;
  y: number;
}

export function updateFormation(state: GameState): void {
  const enemyHitCount = state.enemies.reduce(
    (total, enemy) => total + enemy.hitCount,
    0,
  );

  if (state.formation.phase !== 'broken') {
    const swordsman = state.enemies.find(
      (enemy) => enemy.kind === 'swordsman',
    );
    if (
      swordsman === undefined ||
      swordsman.action === 'dead' ||
      state.player.x >= FORMATION_BREAK_TRIGGER_X
    ) {
      state.formation.phase = 'broken';
    } else if (
      state.formation.phase === 'holding' &&
      (state.player.x >= FORMATION_PRESS_TRIGGER_X ||
        enemyHitCount > state.formation.observedEnemyHitCount)
    ) {
      state.formation.phase = 'pressing';
    }
  }

  state.formation.observedEnemyHitCount = enemyHitCount;
}

export function getFormationAnchor(
  enemy: EnemyState,
  phase: FormationPhase,
): FormationAnchor | null {
  if (phase === 'broken') {
    return null;
  }

  switch (enemy.kind) {
    case 'swordsman':
      return phase === 'holding'
        ? {
            x: FORMATION_SWORDSMAN_HOLD_X,
            y: FORMATION_SWORDSMAN_HOLD_Y,
          }
        : {
            x: FORMATION_SWORDSMAN_PRESS_X,
            y: FORMATION_SWORDSMAN_PRESS_Y,
          };
    case 'archer':
      return phase === 'holding'
        ? { x: FORMATION_ARCHER_HOLD_X, y: FORMATION_ARCHER_HOLD_Y }
        : { x: FORMATION_ARCHER_PRESS_X, y: FORMATION_ARCHER_PRESS_Y };
  }
}

export function playerIsInsideGuardZone(
  state: GameState,
  anchor: FormationAnchor,
): boolean {
  return (
    Math.hypot(
      state.player.x - anchor.x,
      state.player.y - anchor.y,
    ) <= FORMATION_GUARD_RADIUS
  );
}
