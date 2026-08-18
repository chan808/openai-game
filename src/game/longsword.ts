import {
  LONGSWORD_ACTIVE_FRAMES,
  LONGSWORD_BLADE_RADIUS,
  LONGSWORD_REACH,
  LONGSWORD_SWING_RADIANS,
} from '../content/tuning';
import type { LongswordAttackState } from './GameState';

export interface Direction {
  x: number;
  y: number;
}

export function getLongswordSwingAngle(
  attack: LongswordAttackState,
): number {
  const elapsedFrames = LONGSWORD_ACTIVE_FRAMES - attack.activeFramesRemaining;
  const progress = Math.min(
    1,
    Math.max(0, elapsedFrames / (LONGSWORD_ACTIVE_FRAMES - 1)),
  );
  const aimAngle = Math.atan2(attack.aimY, attack.aimX);

  return (
    aimAngle -
    LONGSWORD_SWING_RADIANS / 2 +
    LONGSWORD_SWING_RADIANS * progress
  );
}

export function getLongswordSwingDirection(
  attack: LongswordAttackState,
): Direction {
  const angle = getLongswordSwingAngle(attack);
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

export function longswordIntersectsCircle(
  originX: number,
  originY: number,
  attack: LongswordAttackState,
  targetX: number,
  targetY: number,
  targetRadius: number,
  reach = LONGSWORD_REACH,
): boolean {
  const direction = getLongswordSwingDirection(attack);
  const targetOffsetX = targetX - originX;
  const targetOffsetY = targetY - originY;
  const projectedDistance =
    targetOffsetX * direction.x + targetOffsetY * direction.y;
  const distanceAlongBlade = Math.min(
    reach,
    Math.max(0, projectedDistance),
  );
  const closestX = originX + direction.x * distanceAlongBlade;
  const closestY = originY + direction.y * distanceAlongBlade;
  const distanceX = targetX - closestX;
  const distanceY = targetY - closestY;
  const collisionRadius = targetRadius + LONGSWORD_BLADE_RADIUS;

  return (
    distanceX * distanceX + distanceY * distanceY <=
    collisionRadius * collisionRadius
  );
}
