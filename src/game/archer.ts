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
import {
  enemyCanSeePlayer,
  getFormationAnchor,
  positionHasLineOfSight,
  type FormationAnchor,
} from './formation';
import { moveCircleTowardTarget } from './navigation';
import { spawnEnemyArrow } from './projectiles';
import { circleIntersectsTerrain } from './terrain';

const TACTICAL_POSITION_COUNT = 12;
const TACTICAL_POSITION_DISTANCE =
  (ARCHER_MIN_DISTANCE + ARCHER_MAX_DISTANCE) / 2;

export function updateArcher(
  state: GameState,
  archer: ArcherState,
  dt: number,
): void {
  switch (archer.action) {
    case 'positioning':
      updatePosition(state, archer, dt);
      return;
    case 'windup':
      if (tickActionTimer(archer)) {
        spawnEnemyArrow(state, archer);
        archer.action = 'recovering';
        archer.actionFramesRemaining = ARCHER_RECOVERY_FRAMES;
      }
      return;
    case 'recovering':
      if (tickActionTimer(archer)) {
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
  if (
    state.formation.phase === 'holding' ||
    state.formation.phase === 'returning'
  ) {
    archer.tacticalAngle = null;
    const anchor = getFormationAnchor(archer);
    faceTarget(
      archer,
      state.formation.lastKnownPlayerX,
      state.formation.lastKnownPlayerY,
    );
    moveTowardPosition(archer, anchor, worldDt);
    return;
  }

  const playerDistance = Math.hypot(
    state.player.x - archer.x,
    state.player.y - archer.y,
  );
  const playerVisible =
    state.formation.phase === 'engaged' &&
    enemyCanSeePlayer(state, archer);
  if (
    playerVisible &&
    playerDistance >= ARCHER_MIN_DISTANCE &&
    playerDistance <= ARCHER_MAX_DISTANCE &&
    positionHasLineOfSight(
      archer.x,
      archer.y,
      state.player.x,
      state.player.y,
      BOW_PROJECTILE_RADIUS,
      PLAYER_RADIUS,
    )
  ) {
    faceTarget(archer, state.player.x, state.player.y);
    archer.action = 'windup';
    archer.actionFramesRemaining = ARCHER_WINDUP_FRAMES;
    return;
  }

  const tacticalTarget = chooseTacticalPosition(
    archer,
    state.formation.lastKnownPlayerX,
    state.formation.lastKnownPlayerY,
  );
  faceTarget(
    archer,
    state.formation.lastKnownPlayerX,
    state.formation.lastKnownPlayerY,
  );
  moveTowardPosition(archer, tacticalTarget, worldDt);
}

function chooseTacticalPosition(
  archer: ArcherState,
  targetX: number,
  targetY: number,
): FormationAnchor {
  if (archer.tacticalAngle !== null) {
    const retainedPosition = getTacticalPosition(
      targetX,
      targetY,
      archer.tacticalAngle,
    );
    if (tacticalPositionIsValid(retainedPosition, targetX, targetY)) {
      return retainedPosition;
    }
  }

  const baseAngle = Math.atan2(archer.y - targetY, archer.x - targetX);

  for (let index = 0; index < TACTICAL_POSITION_COUNT; index += 1) {
    const angle = baseAngle + getTacticalAngleOffset(index);
    const candidate = getTacticalPosition(targetX, targetY, angle);
    if (!tacticalPositionIsValid(candidate, targetX, targetY)) {
      continue;
    }

    archer.tacticalAngle = angle;
    return candidate;
  }

  archer.tacticalAngle = null;
  return getFormationAnchor(archer);
}

function getTacticalAngleOffset(index: number): number {
  if (index === 0) {
    return 0;
  }

  const step = Math.ceil(index / 2);
  const direction = index % 2 === 1 ? 1 : -1;
  return (
    direction * step * ((Math.PI * 2) / TACTICAL_POSITION_COUNT)
  );
}

function getTacticalPosition(
  targetX: number,
  targetY: number,
  angle: number,
): FormationAnchor {
  return {
    x: targetX + Math.cos(angle) * TACTICAL_POSITION_DISTANCE,
    y: targetY + Math.sin(angle) * TACTICAL_POSITION_DISTANCE,
  };
}

function tacticalPositionIsValid(
  candidate: FormationAnchor,
  targetX: number,
  targetY: number,
): boolean {
  return (
    !circleIntersectsTerrain(candidate.x, candidate.y, ARCHER_RADIUS) &&
    positionHasLineOfSight(
      candidate.x,
      candidate.y,
      targetX,
      targetY,
      BOW_PROJECTILE_RADIUS,
    )
  );
}

function moveTowardPosition(
  archer: ArcherState,
  target: FormationAnchor,
  worldDt: number,
): void {
  const nextPosition = moveCircleTowardTarget(
    archer.x,
    archer.y,
    target.x,
    target.y,
    ARCHER_MOVE_SPEED * worldDt,
    ARCHER_RADIUS,
  );
  archer.x = nextPosition.x;
  archer.y = nextPosition.y;
}

function faceTarget(
  archer: ArcherState,
  targetX: number,
  targetY: number,
): void {
  const offsetX = targetX - archer.x;
  const offsetY = targetY - archer.y;
  const distance = Math.hypot(offsetX, offsetY);
  if (distance > 0) {
    archer.aimX = offsetX / distance;
    archer.aimY = offsetY / distance;
  }
}

function tickActionTimer(archer: ArcherState): boolean {
  archer.actionFramesRemaining = Math.max(
    0,
    archer.actionFramesRemaining - 1,
  );
  return archer.actionFramesRemaining === 0;
}
