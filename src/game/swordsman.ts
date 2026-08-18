import {
  HIT_STOP_FRAMES,
  PLAYER_RADIUS,
  SWORDSMAN_ACTIVE_FRAMES,
  SWORDSMAN_ATTACK_DAMAGE,
  SWORDSMAN_ATTACK_RADIUS,
  SWORDSMAN_ATTACK_REACH,
  SWORDSMAN_ATTACK_TRIGGER_DISTANCE,
  SWORDSMAN_MOVE_SPEED,
  SWORDSMAN_RADIUS,
  SWORDSMAN_RECOVERY_FRAMES,
  SWORDSMAN_WINDUP_FRAMES,
} from '../content/tuning';
import type { GameState, SwordsmanState } from './GameState';
import {
  getFormationAnchor,
  playerIsInsideGuardZone,
  type FormationAnchor,
} from './formation';
import { damagePlayer } from './playerDamage';
import { getTerrainRayDistance, moveCircleAgainstTerrain } from './terrain';

export function updateSwordsman(
  state: GameState,
  swordsman: SwordsmanState,
  dt: number,
  worldTimeScale: number,
): void {
  switch (swordsman.action) {
    case 'chasing':
      updateChase(state, swordsman, dt * worldTimeScale);
      return;
    case 'windup':
      if (tickActionTimer(swordsman, worldTimeScale)) {
        swordsman.action = 'attacking';
        swordsman.actionFramesRemaining = SWORDSMAN_ACTIVE_FRAMES;
        swordsman.hitPlayer = false;
      }
      return;
    case 'attacking':
      tryHitPlayer(state, swordsman);
      if (tickActionTimer(swordsman, worldTimeScale)) {
        swordsman.action = 'recovering';
        swordsman.actionFramesRemaining = SWORDSMAN_RECOVERY_FRAMES;
      }
      return;
    case 'recovering':
      if (tickActionTimer(swordsman, worldTimeScale)) {
        swordsman.action = 'chasing';
      }
      return;
    case 'dead':
      return;
  }
}

export function swordsmanAttackIntersectsPlayer(
  state: GameState,
  swordsman: SwordsmanState,
): boolean {
  const { player } = state;
  const attackReach = getSwordsmanAttackReach(swordsman);
  if (attackReach <= SWORDSMAN_RADIUS) {
    return false;
  }
  const startX = swordsman.x + swordsman.aimX * SWORDSMAN_RADIUS;
  const startY = swordsman.y + swordsman.aimY * SWORDSMAN_RADIUS;
  const endX = swordsman.x + swordsman.aimX * attackReach;
  const endY = swordsman.y + swordsman.aimY * attackReach;
  const lineX = endX - startX;
  const lineY = endY - startY;
  const lineLengthSquared = lineX * lineX + lineY * lineY;
  if (lineLengthSquared === 0) {
    return false;
  }
  const projection = Math.min(
    1,
    Math.max(
      0,
      ((player.x - startX) * lineX + (player.y - startY) * lineY) /
        lineLengthSquared,
    ),
  );
  const closestX = startX + lineX * projection;
  const closestY = startY + lineY * projection;
  const distanceX = player.x - closestX;
  const distanceY = player.y - closestY;
  const collisionRadius = PLAYER_RADIUS + SWORDSMAN_ATTACK_RADIUS;

  return (
    distanceX * distanceX + distanceY * distanceY <=
    collisionRadius * collisionRadius
  );
}

export function getSwordsmanAttackReach(
  swordsman: SwordsmanState,
): number {
  return getTerrainRayDistance(
    swordsman.x,
    swordsman.y,
    swordsman.aimX,
    swordsman.aimY,
    SWORDSMAN_ATTACK_REACH,
    SWORDSMAN_ATTACK_RADIUS,
  );
}

function updateChase(
  state: GameState,
  swordsman: SwordsmanState,
  worldDt: number,
): void {
  const formationAnchor = getFormationAnchor(
    swordsman,
    state.formation.phase,
  );
  if (
    formationAnchor !== null &&
    !playerIsInsideGuardZone(state, formationAnchor)
  ) {
    facePlayer(state, swordsman);
    moveTowardAnchor(swordsman, formationAnchor, worldDt);
    return;
  }

  const offsetX = state.player.x - swordsman.x;
  const offsetY = state.player.y - swordsman.y;
  const distance = Math.hypot(offsetX, offsetY);
  if (distance === 0) {
    return;
  }

  const directionX = offsetX / distance;
  const directionY = offsetY / distance;
  swordsman.aimX = directionX;
  swordsman.aimY = directionY;

  if (distance <= SWORDSMAN_ATTACK_TRIGGER_DISTANCE) {
    swordsman.action = 'windup';
    swordsman.actionFramesRemaining = SWORDSMAN_WINDUP_FRAMES;
    return;
  }

  const movement = Math.min(
    SWORDSMAN_MOVE_SPEED * worldDt,
    distance - SWORDSMAN_ATTACK_TRIGGER_DISTANCE,
  );
  const nextPosition = moveCircleAgainstTerrain(
    swordsman.x,
    swordsman.y,
    swordsman.x + directionX * movement,
    swordsman.y + directionY * movement,
    SWORDSMAN_RADIUS,
  );
  swordsman.x = nextPosition.x;
  swordsman.y = nextPosition.y;
}

function facePlayer(
  state: GameState,
  swordsman: SwordsmanState,
): void {
  const offsetX = state.player.x - swordsman.x;
  const offsetY = state.player.y - swordsman.y;
  const distance = Math.hypot(offsetX, offsetY);
  if (distance > 0) {
    swordsman.aimX = offsetX / distance;
    swordsman.aimY = offsetY / distance;
  }
}

function moveTowardAnchor(
  swordsman: SwordsmanState,
  anchor: FormationAnchor,
  worldDt: number,
): void {
  const offsetX = anchor.x - swordsman.x;
  const offsetY = anchor.y - swordsman.y;
  const distance = Math.hypot(offsetX, offsetY);
  if (distance === 0) {
    return;
  }

  const movement = Math.min(SWORDSMAN_MOVE_SPEED * worldDt, distance);
  const nextPosition = moveCircleAgainstTerrain(
    swordsman.x,
    swordsman.y,
    swordsman.x + (offsetX / distance) * movement,
    swordsman.y + (offsetY / distance) * movement,
    SWORDSMAN_RADIUS,
  );
  swordsman.x = nextPosition.x;
  swordsman.y = nextPosition.y;
}

function tryHitPlayer(state: GameState, swordsman: SwordsmanState): void {
  if (
    swordsman.hitPlayer ||
    !swordsmanAttackIntersectsPlayer(state, swordsman)
  ) {
    return;
  }

  swordsman.hitPlayer = true;
  if (damagePlayer(state, SWORDSMAN_ATTACK_DAMAGE)) {
    swordsman.hitStopFramesRemaining = Math.max(
      swordsman.hitStopFramesRemaining,
      HIT_STOP_FRAMES,
    );
  }
}

function tickActionTimer(
  swordsman: SwordsmanState,
  worldTimeScale: number,
): boolean {
  swordsman.actionFramesRemaining = Math.max(
    0,
    swordsman.actionFramesRemaining - worldTimeScale,
  );
  return swordsman.actionFramesRemaining === 0;
}
