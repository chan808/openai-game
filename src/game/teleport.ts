import {
  PLAYER_RADIUS,
  TELEPORT_COOLDOWN_FRAMES,
  TELEPORT_ECHO_DURATION_FRAMES,
  TELEPORT_ECHO_ULTIMATE_CHARGE,
  TELEPORT_MAX_DISTANCE,
} from '../content/tuning';
import { getEnemyRadius } from './enemyState';
import type { GameState } from './GameState';
import { moveDestinationOutsideTerrain } from './terrain';

interface Position {
  x: number;
  y: number;
}

export interface CircleObstacle extends Position {
  radius: number;
}

export function updateTeleportDestination(
  state: GameState,
  targetX: number,
  targetY: number,
): void {
  const obstacles = state.enemies
    .filter((enemy) => enemy.action !== 'dead')
    .map((enemy) => ({
      x: enemy.x,
      y: enemy.y,
      radius: getEnemyRadius(enemy),
    }));
  const destination = getTeleportDestination(
    state.player.x,
    state.player.y,
    targetX,
    targetY,
    obstacles,
  );

  state.teleport.destinationX = destination.x;
  state.teleport.destinationY = destination.y;
}

export function tryTeleport(
  state: GameState,
  teleportPressed: boolean,
): boolean {
  if (!teleportPressed || state.teleport.cooldownFramesRemaining > 0) {
    return false;
  }

  const destination = state.teleport;
  if (
    destination.destinationX === state.player.x &&
    destination.destinationY === state.player.y
  ) {
    return false;
  }

  state.teleport.echo.x = state.player.x;
  state.teleport.echo.y = state.player.y;
  state.teleport.echo.framesRemaining = TELEPORT_ECHO_DURATION_FRAMES;
  state.player.x = destination.destinationX;
  state.player.y = destination.destinationY;
  state.teleport.cooldownFramesRemaining = TELEPORT_COOLDOWN_FRAMES;
  return true;
}

export function tickTeleportCooldown(state: GameState): void {
  state.teleport.cooldownFramesRemaining = Math.max(
    0,
    state.teleport.cooldownFramesRemaining - 1,
  );
}

export function tickTeleportEcho(state: GameState): void {
  state.teleport.echo.framesRemaining = Math.max(
    0,
    state.teleport.echo.framesRemaining - 1,
  );
}

export function consumeTeleportEcho(state: GameState): boolean {
  if (state.teleport.echo.framesRemaining === 0) {
    return false;
  }

  state.teleport.echo.framesRemaining = 0;
  state.ultimate.charge.current = Math.min(
    state.ultimate.charge.maximum,
    state.ultimate.charge.current + TELEPORT_ECHO_ULTIMATE_CHARGE,
  );
  return true;
}

export function getTeleportDestination(
  playerX: number,
  playerY: number,
  targetX: number,
  targetY: number,
  obstacles: readonly CircleObstacle[],
): Position {
  const targetOffsetX = targetX - playerX;
  const targetOffsetY = targetY - playerY;
  const targetDistance = Math.hypot(targetOffsetX, targetOffsetY);

  if (targetDistance === 0) {
    return { x: playerX, y: playerY };
  }

  const distance = Math.min(targetDistance, TELEPORT_MAX_DISTANCE);
  const directionX = targetOffsetX / targetDistance;
  const directionY = targetOffsetY / targetDistance;
  let destination = moveDestinationOutsideTerrain(
    playerX,
    playerY,
    playerX + directionX * distance,
    playerY + directionY * distance,
    PLAYER_RADIUS,
  );

  for (const obstacle of obstacles) {
    destination = moveOutsideObstacle(
      playerX,
      playerY,
      destination,
      obstacle,
    );
  }
  return moveDestinationOutsideTerrain(
    playerX,
    playerY,
    destination.x,
    destination.y,
    PLAYER_RADIUS,
  );
}

function moveOutsideObstacle(
  playerX: number,
  playerY: number,
  requested: Position,
  obstacle: CircleObstacle,
): Position {
  const destinationOffsetX = requested.x - obstacle.x;
  const destinationOffsetY = requested.y - obstacle.y;
  const minimumDistance = PLAYER_RADIUS + obstacle.radius;

  if (
    destinationOffsetX * destinationOffsetX +
      destinationOffsetY * destinationOffsetY >=
    minimumDistance * minimumDistance
  ) {
    return requested;
  }

  const playerOffsetX = playerX - obstacle.x;
  const playerOffsetY = playerY - obstacle.y;
  const playerDistance = Math.hypot(playerOffsetX, playerOffsetY);
  if (playerDistance === 0) {
    return requested;
  }

  return {
    x: obstacle.x + (playerOffsetX / playerDistance) * minimumDistance,
    y: obstacle.y + (playerOffsetY / playerDistance) * minimumDistance,
  };
}
