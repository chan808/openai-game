import {
  ARCHER_MAX_DISTANCE,
  ARCHER_MIN_DISTANCE,
  ARCHER_MOVE_SPEED,
  ARCHER_RADIUS,
  ARCHER_RECOVERY_FRAMES,
  ARCHER_WINDUP_FRAMES,
  BOW_PROJECTILE_RADIUS,
  PLAYER_RADIUS,
} from '../content/tuning';
import type { ArcherState, GameState } from './GameState';
import { getFormationAnchor, type FormationAnchor } from './formation';
import { spawnEnemyArrow } from './projectiles';
import {
  getTerrainRayDistance,
  moveCircleAgainstTerrain,
} from './terrain';

export function updateArcher(
  state: GameState,
  archer: ArcherState,
  dt: number,
  worldTimeScale: number,
): void {
  switch (archer.action) {
    case 'positioning':
      updatePosition(state, archer, dt * worldTimeScale);
      return;
    case 'windup':
      if (tickActionTimer(archer, worldTimeScale)) {
        spawnEnemyArrow(state, archer);
        archer.action = 'recovering';
        archer.actionFramesRemaining = ARCHER_RECOVERY_FRAMES;
      }
      return;
    case 'recovering':
      if (tickActionTimer(archer, worldTimeScale)) {
        archer.action = 'positioning';
      }
      return;
    case 'dead':
      return;
  }
}

function updatePosition(
  state: GameState,
  archer: ArcherState,
  worldDt: number,
): void {
  const formationAnchor = getFormationAnchor(
    archer,
    state.formation.phase,
  );
  if (formationAnchor !== null) {
    updateFormationPosition(state, archer, formationAnchor, worldDt);
    return;
  }

  const offsetX = state.player.x - archer.x;
  const offsetY = state.player.y - archer.y;
  const distance = Math.hypot(offsetX, offsetY);
  if (distance === 0) {
    return;
  }

  const directionX = offsetX / distance;
  const directionY = offsetY / distance;
  archer.aimX = directionX;
  archer.aimY = directionY;

  if (distance >= ARCHER_MIN_DISTANCE && distance <= ARCHER_MAX_DISTANCE) {
    archer.action = 'windup';
    archer.actionFramesRemaining = ARCHER_WINDUP_FRAMES;
    return;
  }

  const directionMultiplier = distance < ARCHER_MIN_DISTANCE ? -1 : 1;
  const targetDistance =
    distance < ARCHER_MIN_DISTANCE
      ? ARCHER_MIN_DISTANCE
      : ARCHER_MAX_DISTANCE;
  const movement = Math.min(
    ARCHER_MOVE_SPEED * worldDt,
    Math.abs(distance - targetDistance),
  );
  const nextPosition = moveCircleAgainstTerrain(
    archer.x,
    archer.y,
    archer.x + directionX * movement * directionMultiplier,
    archer.y + directionY * movement * directionMultiplier,
    ARCHER_RADIUS,
  );
  archer.x = nextPosition.x;
  archer.y = nextPosition.y;
}

function updateFormationPosition(
  state: GameState,
  archer: ArcherState,
  anchor: FormationAnchor,
  worldDt: number,
): void {
  const anchorOffsetX = anchor.x - archer.x;
  const anchorOffsetY = anchor.y - archer.y;
  const anchorDistance = Math.hypot(anchorOffsetX, anchorOffsetY);
  if (anchorDistance > 0) {
    const movement = Math.min(ARCHER_MOVE_SPEED * worldDt, anchorDistance);
    const nextPosition = moveCircleAgainstTerrain(
      archer.x,
      archer.y,
      archer.x + (anchorOffsetX / anchorDistance) * movement,
      archer.y + (anchorOffsetY / anchorDistance) * movement,
      ARCHER_RADIUS,
    );
    archer.x = nextPosition.x;
    archer.y = nextPosition.y;
    return;
  }

  const playerOffsetX = state.player.x - archer.x;
  const playerOffsetY = state.player.y - archer.y;
  const playerDistance = Math.hypot(playerOffsetX, playerOffsetY);
  if (playerDistance === 0) {
    return;
  }

  archer.aimX = playerOffsetX / playerDistance;
  archer.aimY = playerOffsetY / playerDistance;
  const clearDistance = getTerrainRayDistance(
    archer.x,
    archer.y,
    archer.aimX,
    archer.aimY,
    playerDistance,
    BOW_PROJECTILE_RADIUS,
  );
  if (clearDistance >= playerDistance - PLAYER_RADIUS) {
    archer.action = 'windup';
    archer.actionFramesRemaining = ARCHER_WINDUP_FRAMES;
  }
}

function tickActionTimer(
  archer: ArcherState,
  worldTimeScale: number,
): boolean {
  archer.actionFramesRemaining = Math.max(
    0,
    archer.actionFramesRemaining - worldTimeScale,
  );
  return archer.actionFramesRemaining === 0;
}
