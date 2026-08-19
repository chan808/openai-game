import { PLAYER_RADIUS } from '../content/tuning';
import { getEnemyRadius } from './enemyState';
import type { EnemyState, GameState, PlayerState } from './GameState';
import { moveCircleAgainstTerrain } from './terrain';

const ACTOR_SEPARATION_PASSES = 8;
const ACTOR_SEPARATION_EPSILON = 0.001;

interface CollisionActor<State extends PlayerState | EnemyState> {
  state: State;
  radius: number;
}

export function separatePlayerAndLivingEnemies(state: GameState): void {
  const player: CollisionActor<PlayerState> = {
    state: state.player,
    radius: PLAYER_RADIUS,
  };
  const enemies = state.enemies
    .filter((enemy) => enemy.action !== 'dead')
    .map((enemy) => ({
      state: enemy,
      radius: getEnemyRadius(enemy),
    }));

  for (let pass = 0; pass < ACTOR_SEPARATION_PASSES; pass += 1) {
    let foundOverlap = false;

    for (const enemy of enemies) {
      const offsetX = enemy.state.x - player.state.x;
      const offsetY = enemy.state.y - player.state.y;
      const distance = Math.hypot(offsetX, offsetY);
      const minimumDistance = player.radius + enemy.radius;
      if (distance >= minimumDistance - ACTOR_SEPARATION_EPSILON) {
        continue;
      }

      foundOverlap = true;
      const direction = getSeparationDirection(
        player.state,
        offsetX,
        offsetY,
        distance,
      );
      separatePair(
        player,
        enemy,
        direction.x,
        direction.y,
        minimumDistance - distance,
      );
    }

    if (!foundOverlap) {
      return;
    }
  }
}

function getSeparationDirection(
  player: PlayerState,
  offsetX: number,
  offsetY: number,
  distance: number,
): { x: number; y: number } {
  if (distance > 0) {
    return { x: offsetX / distance, y: offsetY / distance };
  }

  const aimLength = Math.hypot(player.aimX, player.aimY);
  if (aimLength === 0) {
    return { x: 1, y: 0 };
  }
  return {
    x: player.aimX / aimLength,
    y: player.aimY / aimLength,
  };
}

function separatePair(
  first: CollisionActor<PlayerState>,
  second: CollisionActor<EnemyState>,
  directionX: number,
  directionY: number,
  overlap: number,
): void {
  moveActorBy(first, -directionX * overlap / 2, -directionY * overlap / 2);
  moveActorBy(second, directionX * overlap / 2, directionY * overlap / 2);

  let remainingOverlap = getRemainingOverlap(first, second);
  if (remainingOverlap > ACTOR_SEPARATION_EPSILON) {
    moveActorBy(
      first,
      -directionX * remainingOverlap,
      -directionY * remainingOverlap,
    );
  }

  remainingOverlap = getRemainingOverlap(first, second);
  if (remainingOverlap > ACTOR_SEPARATION_EPSILON) {
    moveActorBy(
      second,
      directionX * remainingOverlap,
      directionY * remainingOverlap,
    );
  }
}

function getRemainingOverlap(
  first: CollisionActor<PlayerState>,
  second: CollisionActor<EnemyState>,
): number {
  return Math.max(
    0,
    first.radius +
      second.radius -
      Math.hypot(
        second.state.x - first.state.x,
        second.state.y - first.state.y,
      ),
  );
}

function moveActorBy<State extends PlayerState | EnemyState>(
  actor: CollisionActor<State>,
  offsetX: number,
  offsetY: number,
): void {
  const position = moveCircleAgainstTerrain(
    actor.state.x,
    actor.state.y,
    actor.state.x + offsetX,
    actor.state.y + offsetY,
    actor.radius,
  );
  actor.state.x = position.x;
  actor.state.y = position.y;
}
