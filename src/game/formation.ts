import {
  FORMATION_ARCHER_HOLD_X,
  FORMATION_ARCHER_HOLD_Y,
  FORMATION_RETURN_ARRIVAL_RADIUS,
  FORMATION_SWORDSMAN_HOLD_X,
  FORMATION_SWORDSMAN_HOLD_Y,
  PLAYER_RADIUS,
  SQUAD_SEARCH_ARRIVAL_RADIUS,
  SQUAD_SEARCH_FRAMES,
} from '../content/tuning';
import type { EnemyState, GameState } from './GameState';
import { getTerrainRayDistance } from './terrain';

export interface FormationAnchor {
  x: number;
  y: number;
}

export function updateFormation(
  state: GameState,
  worldTimeScale = 1,
): void {
  const enemyHitCount = state.enemies.reduce(
    (total, enemy) => total + enemy.hitCount,
    0,
  );
  const playerWasLocated = state.enemies.some((enemy) =>
    enemyCanSeePlayer(state, enemy),
  );
  const squadWasAttacked =
    enemyHitCount > state.formation.observedEnemyHitCount;

  if (playerWasLocated || squadWasAttacked) {
    state.formation.phase = 'engaged';
    state.formation.lastKnownPlayerX = state.player.x;
    state.formation.lastKnownPlayerY = state.player.y;
    state.formation.searchFramesRemaining = SQUAD_SEARCH_FRAMES;
  } else {
    updateUnseenFormation(state, worldTimeScale);
  }

  state.formation.observedEnemyHitCount = enemyHitCount;
}

export function enemyCanSeePlayer(
  state: GameState,
  enemy: EnemyState,
): boolean {
  return (
    enemy.action !== 'dead' &&
    positionHasLineOfSight(
      enemy.x,
      enemy.y,
      state.player.x,
      state.player.y,
      0,
      PLAYER_RADIUS,
    )
  );
}

export function positionHasLineOfSight(
  originX: number,
  originY: number,
  targetX: number,
  targetY: number,
  clearanceRadius: number,
  targetRadius = 0,
): boolean {
  const offsetX = targetX - originX;
  const offsetY = targetY - originY;
  const distance = Math.hypot(offsetX, offsetY);
  if (distance === 0) {
    return true;
  }

  const clearDistance = getTerrainRayDistance(
    originX,
    originY,
    offsetX / distance,
    offsetY / distance,
    distance,
    clearanceRadius,
  );
  return clearDistance >= Math.max(0, distance - targetRadius);
}

export function getFormationAnchor(enemy: EnemyState): FormationAnchor {
  switch (enemy.kind) {
    case 'swordsman':
      return {
        x: FORMATION_SWORDSMAN_HOLD_X,
        y: FORMATION_SWORDSMAN_HOLD_Y,
      };
    case 'archer':
      return { x: FORMATION_ARCHER_HOLD_X, y: FORMATION_ARCHER_HOLD_Y };
  }
}

function updateUnseenFormation(
  state: GameState,
  worldTimeScale: number,
): void {
  switch (state.formation.phase) {
    case 'holding':
    case 'returning':
      if (
        state.formation.phase === 'returning' &&
        squadIsAtFormationAnchors(state)
      ) {
        state.formation.phase = 'holding';
      }
      return;
    case 'engaged':
      state.formation.phase = 'searching';
      state.formation.searchFramesRemaining = SQUAD_SEARCH_FRAMES;
      return;
    case 'searching':
      if (!searcherReachedLastKnownPosition(state)) {
        return;
      }
      state.formation.searchFramesRemaining = Math.max(
        0,
        state.formation.searchFramesRemaining - worldTimeScale,
      );
      if (state.formation.searchFramesRemaining === 0) {
        state.formation.phase = 'returning';
      }
      return;
  }
}

function searcherReachedLastKnownPosition(state: GameState): boolean {
  const swordsman = state.enemies.find(
    (enemy) => enemy.kind === 'swordsman' && enemy.action !== 'dead',
  );
  if (swordsman === undefined) {
    return true;
  }

  return (
    Math.hypot(
      swordsman.x - state.formation.lastKnownPlayerX,
      swordsman.y - state.formation.lastKnownPlayerY,
    ) <= SQUAD_SEARCH_ARRIVAL_RADIUS
  );
}

function squadIsAtFormationAnchors(state: GameState): boolean {
  return state.enemies.every((enemy) => {
    if (enemy.action === 'dead') {
      return true;
    }
    const anchor = getFormationAnchor(enemy);
    return (
      Math.hypot(enemy.x - anchor.x, enemy.y - anchor.y) <=
      FORMATION_RETURN_ARRIVAL_RADIUS
    );
  });
}
