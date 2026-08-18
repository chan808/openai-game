import {
  ARENA_HEIGHT,
  ARENA_WALL_THICKNESS,
  ARENA_WIDTH,
  NORTHWEST_PILLAR_HEIGHT,
  NORTHWEST_PILLAR_WIDTH,
  NORTHWEST_PILLAR_X,
  NORTHWEST_PILLAR_Y,
  SOUTHEAST_PILLAR_HEIGHT,
  SOUTHEAST_PILLAR_WIDTH,
  SOUTHEAST_PILLAR_X,
  SOUTHEAST_PILLAR_Y,
} from '../content/tuning';

export interface Position {
  x: number;
  y: number;
}

export interface TerrainObstacle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const TERRAIN_OBSTACLES: readonly TerrainObstacle[] = [
  {
    x: NORTHWEST_PILLAR_X,
    y: NORTHWEST_PILLAR_Y,
    width: NORTHWEST_PILLAR_WIDTH,
    height: NORTHWEST_PILLAR_HEIGHT,
  },
  {
    x: SOUTHEAST_PILLAR_X,
    y: SOUTHEAST_PILLAR_Y,
    width: SOUTHEAST_PILLAR_WIDTH,
    height: SOUTHEAST_PILLAR_HEIGHT,
  },
];

const COLLISION_SEARCH_STEPS = 16;

export function moveCircleAgainstTerrain(
  startX: number,
  startY: number,
  requestedX: number,
  requestedY: number,
  radius: number,
): Position {
  const boundedX = clampToPlayableArea(requestedX, radius, ARENA_WIDTH);
  const boundedY = clampToPlayableArea(requestedY, radius, ARENA_HEIGHT);
  const x = moveAxis(startX, boundedX, (candidateX) =>
    circleIsOutsideObstacles(candidateX, startY, radius),
  );
  const y = moveAxis(startY, boundedY, (candidateY) =>
    circleIsOutsideObstacles(x, candidateY, radius),
  );

  return { x, y };
}

export function moveDestinationOutsideTerrain(
  startX: number,
  startY: number,
  requestedX: number,
  requestedY: number,
  radius: number,
): Position {
  const bounded = {
    x: clampToPlayableArea(requestedX, radius, ARENA_WIDTH),
    y: clampToPlayableArea(requestedY, radius, ARENA_HEIGHT),
  };
  if (!circleIntersectsTerrain(bounded.x, bounded.y, radius)) {
    return bounded;
  }

  const offsetX = bounded.x - startX;
  const offsetY = bounded.y - startY;
  const distance = Math.hypot(offsetX, offsetY);
  if (distance === 0) {
    return { x: startX, y: startY };
  }

  const directionX = offsetX / distance;
  const directionY = offsetY / distance;
  const clearDistance = getTerrainRayDistance(
    startX,
    startY,
    directionX,
    directionY,
    distance,
    radius,
  );

  return {
    x: startX + directionX * clearDistance,
    y: startY + directionY * clearDistance,
  };
}

export function circleIntersectsTerrain(
  x: number,
  y: number,
  radius: number,
): boolean {
  const minimumX = ARENA_WALL_THICKNESS + radius;
  const maximumX = ARENA_WIDTH - ARENA_WALL_THICKNESS - radius;
  const minimumY = ARENA_WALL_THICKNESS + radius;
  const maximumY = ARENA_HEIGHT - ARENA_WALL_THICKNESS - radius;
  if (x < minimumX || x > maximumX || y < minimumY || y > maximumY) {
    return true;
  }

  return !circleIsOutsideObstacles(x, y, radius);
}

export function segmentIntersectsTerrain(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  radius: number,
): boolean {
  if (circleIntersectsTerrain(startX, startY, radius)) {
    return true;
  }

  const offsetX = endX - startX;
  const offsetY = endY - startY;
  const distance = Math.hypot(offsetX, offsetY);
  if (distance === 0) {
    return circleIntersectsTerrain(endX, endY, radius);
  }

  const clearDistance = getTerrainRayDistance(
    startX,
    startY,
    offsetX / distance,
    offsetY / distance,
    distance,
    radius,
  );
  return clearDistance < distance || circleIntersectsTerrain(endX, endY, radius);
}

export function getTerrainRayDistance(
  originX: number,
  originY: number,
  directionX: number,
  directionY: number,
  maximumDistance: number,
  radius: number,
): number {
  let distance = distanceToPlayableAreaEdge(
    originX,
    originY,
    directionX,
    directionY,
    radius,
    maximumDistance,
  );

  for (const obstacle of TERRAIN_OBSTACLES) {
    const intersectionDistance = rayIntersectsExpandedRectangle(
      originX,
      originY,
      directionX,
      directionY,
      obstacle,
      radius,
      distance,
    );
    if (intersectionDistance !== null) {
      distance = Math.min(distance, intersectionDistance);
    }
  }

  return Math.max(0, distance);
}

function moveAxis(
  start: number,
  requested: number,
  positionIsValid: (position: number) => boolean,
): number {
  if (positionIsValid(requested)) {
    return requested;
  }

  let valid = start;
  let invalid = requested;
  for (let step = 0; step < COLLISION_SEARCH_STEPS; step += 1) {
    const candidate = (valid + invalid) / 2;
    if (positionIsValid(candidate)) {
      valid = candidate;
    } else {
      invalid = candidate;
    }
  }
  return valid;
}

function circleIsOutsideObstacles(
  x: number,
  y: number,
  radius: number,
): boolean {
  return TERRAIN_OBSTACLES.every(
    (obstacle) => !circleIntersectsRectangle(x, y, radius, obstacle),
  );
}

function circleIntersectsRectangle(
  x: number,
  y: number,
  radius: number,
  obstacle: TerrainObstacle,
): boolean {
  const closestX = Math.min(
    obstacle.x + obstacle.width,
    Math.max(obstacle.x, x),
  );
  const closestY = Math.min(
    obstacle.y + obstacle.height,
    Math.max(obstacle.y, y),
  );
  const offsetX = x - closestX;
  const offsetY = y - closestY;
  return offsetX * offsetX + offsetY * offsetY < radius * radius;
}

function distanceToPlayableAreaEdge(
  x: number,
  y: number,
  directionX: number,
  directionY: number,
  radius: number,
  maximumDistance: number,
): number {
  const minimumX = ARENA_WALL_THICKNESS + radius;
  const maximumX = ARENA_WIDTH - ARENA_WALL_THICKNESS - radius;
  const minimumY = ARENA_WALL_THICKNESS + radius;
  const maximumY = ARENA_HEIGHT - ARENA_WALL_THICKNESS - radius;
  const distances = [maximumDistance];

  if (directionX > 0) {
    distances.push((maximumX - x) / directionX);
  } else if (directionX < 0) {
    distances.push((minimumX - x) / directionX);
  }
  if (directionY > 0) {
    distances.push((maximumY - y) / directionY);
  } else if (directionY < 0) {
    distances.push((minimumY - y) / directionY);
  }

  return Math.min(...distances.filter((distance) => distance >= 0));
}

function rayIntersectsExpandedRectangle(
  originX: number,
  originY: number,
  directionX: number,
  directionY: number,
  obstacle: TerrainObstacle,
  radius: number,
  maximumDistance: number,
): number | null {
  const minimumX = obstacle.x - radius;
  const maximumX = obstacle.x + obstacle.width + radius;
  const minimumY = obstacle.y - radius;
  const maximumY = obstacle.y + obstacle.height + radius;
  let entryDistance = 0;
  let exitDistance = maximumDistance;

  const xInterval = getRayAxisInterval(
    originX,
    directionX,
    minimumX,
    maximumX,
  );
  if (xInterval === null) {
    return null;
  }
  entryDistance = Math.max(entryDistance, xInterval.minimum);
  exitDistance = Math.min(exitDistance, xInterval.maximum);

  const yInterval = getRayAxisInterval(
    originY,
    directionY,
    minimumY,
    maximumY,
  );
  if (yInterval === null) {
    return null;
  }
  entryDistance = Math.max(entryDistance, yInterval.minimum);
  exitDistance = Math.min(exitDistance, yInterval.maximum);

  return entryDistance <= exitDistance && exitDistance >= 0
    ? entryDistance
    : null;
}

function getRayAxisInterval(
  origin: number,
  direction: number,
  minimum: number,
  maximum: number,
): { minimum: number; maximum: number } | null {
  if (direction === 0) {
    return origin >= minimum && origin <= maximum
      ? { minimum: Number.NEGATIVE_INFINITY, maximum: Number.POSITIVE_INFINITY }
      : null;
  }

  const first = (minimum - origin) / direction;
  const second = (maximum - origin) / direction;
  return {
    minimum: Math.min(first, second),
    maximum: Math.max(first, second),
  };
}

function clampToPlayableArea(
  value: number,
  radius: number,
  size: number,
): number {
  const minimum = ARENA_WALL_THICKNESS + radius;
  const maximum = size - ARENA_WALL_THICKNESS - radius;
  return Math.min(maximum, Math.max(minimum, value));
}
