import { ENEMY_NAVIGATION_WAYPOINTS } from '../content/tuning';
import {
  moveCircleAgainstTerrain,
  segmentIntersectsTerrain,
  type Position,
} from './terrain';

export function moveCircleTowardTarget(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  maximumMovement: number,
  radius: number,
): Position {
  const navigationTarget = getNextNavigationTarget(
    startX,
    startY,
    targetX,
    targetY,
    radius,
  );
  const offsetX = navigationTarget.x - startX;
  const offsetY = navigationTarget.y - startY;
  const distance = Math.hypot(offsetX, offsetY);
  if (distance === 0) {
    return { x: startX, y: startY };
  }

  const movement = Math.min(maximumMovement, distance);
  return moveCircleAgainstTerrain(
    startX,
    startY,
    startX + (offsetX / distance) * movement,
    startY + (offsetY / distance) * movement,
    radius,
  );
}

function getNextNavigationTarget(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  radius: number,
): Position {
  const nodes: Position[] = [
    { x: startX, y: startY },
    { x: targetX, y: targetY },
    ...ENEMY_NAVIGATION_WAYPOINTS,
  ];
  const distances = nodes.map(() => Number.POSITIVE_INFINITY);
  const previous = nodes.map(() => -1);
  const visited = nodes.map(() => false);
  distances[0] = 0;

  for (let iteration = 0; iteration < nodes.length; iteration += 1) {
    const current = getClosestUnvisitedNode(distances, visited);
    if (current === -1 || current === 1) {
      break;
    }
    visited[current] = true;

    for (let candidate = 0; candidate < nodes.length; candidate += 1) {
      if (
        candidate === current ||
        visited[candidate] ||
        segmentIntersectsTerrain(
          nodes[current]!.x,
          nodes[current]!.y,
          nodes[candidate]!.x,
          nodes[candidate]!.y,
          radius,
        )
      ) {
        continue;
      }

      const edgeDistance = Math.hypot(
        nodes[candidate]!.x - nodes[current]!.x,
        nodes[candidate]!.y - nodes[current]!.y,
      );
      const totalDistance = distances[current]! + edgeDistance;
      if (totalDistance < distances[candidate]!) {
        distances[candidate] = totalDistance;
        previous[candidate] = current;
      }
    }
  }

  if (!Number.isFinite(distances[1]!)) {
    return nodes[1]!;
  }

  let nextNode = 1;
  while (previous[nextNode]! > 0) {
    nextNode = previous[nextNode]!;
  }
  return nodes[nextNode]!;
}

function getClosestUnvisitedNode(
  distances: number[],
  visited: boolean[],
): number {
  let closest = -1;
  for (let index = 0; index < distances.length; index += 1) {
    if (
      !visited[index] &&
      Number.isFinite(distances[index]!) &&
      (closest === -1 || distances[index]! < distances[closest]!)
    ) {
      closest = index;
    }
  }
  return closest;
}
