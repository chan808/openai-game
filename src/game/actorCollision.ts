import { PLAYER_RADIUS } from '../content/tuning';
import { getEnemyRadius } from './enemyState';
import type { EnemyState, GameState, PlayerState } from './GameState';
import { moveCircleAgainstTerrain } from './terrain';

const ACTOR_SEPARATION_PASSES = 8;
const ACTOR_SEPARATION_EPSILON = 0.001;

interface PlayerCollisionActor {
  kind: 'player';
  state: PlayerState;
  radius: number;
}

interface EnemyCollisionActor {
  kind: 'enemy';
  state: EnemyState;
  radius: number;
}

type CollisionActor = PlayerCollisionActor | EnemyCollisionActor;

export function separateLivingEnemies(state: GameState): void {
  separateActors(
    state.enemies
      .filter((enemy) => enemy.action !== 'dead')
      .map((enemy) => createEnemyActor(enemy)),
  );
}

export function separatePlayerAndLivingEnemies(state: GameState): void {
  separateActors([
    {
      kind: 'player',
      state: state.player,
      radius: PLAYER_RADIUS,
    },
    ...state.enemies
      .filter((enemy) => enemy.action !== 'dead')
      .map((enemy) => createEnemyActor(enemy)),
  ]);
}

export function separatePlayerFromFrozenEnemies(state: GameState): void {
  const player = {
    kind: 'player' as const,
    state: state.player,
    radius: PLAYER_RADIUS,
  };

  for (let pass = 0; pass < ACTOR_SEPARATION_PASSES; pass += 1) {
    let foundOverlap = false;
    for (const enemy of state.enemies) {
      if (enemy.action === 'dead') {
        continue;
      }

      const offsetX = player.state.x - enemy.x;
      const offsetY = player.state.y - enemy.y;
      const distance = Math.hypot(offsetX, offsetY);
      const minimumDistance = player.radius + getEnemyRadius(enemy);
      if (distance >= minimumDistance - ACTOR_SEPARATION_EPSILON) {
        continue;
      }

      foundOverlap = true;
      const direction =
        distance > 0
          ? { x: offsetX / distance, y: offsetY / distance }
          : getAimDirection(player.state, -1);
      moveActorBy(
        player,
        direction.x * (minimumDistance - distance),
        direction.y * (minimumDistance - distance),
      );
    }

    if (!foundOverlap) {
      return;
    }
  }
}

function createEnemyActor(enemy: EnemyState): EnemyCollisionActor {
  return {
    kind: 'enemy',
    state: enemy,
    radius: getEnemyRadius(enemy),
  };
}

function separateActors(actors: CollisionActor[]): void {
  for (let pass = 0; pass < ACTOR_SEPARATION_PASSES; pass += 1) {
    let foundOverlap = false;

    for (let firstIndex = 0; firstIndex < actors.length; firstIndex += 1) {
      const first = actors[firstIndex]!;
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < actors.length;
        secondIndex += 1
      ) {
        const second = actors[secondIndex]!;
        const offsetX = second.state.x - first.state.x;
        const offsetY = second.state.y - first.state.y;
        const distance = Math.hypot(offsetX, offsetY);
        const minimumDistance = first.radius + second.radius;
        if (distance >= minimumDistance - ACTOR_SEPARATION_EPSILON) {
          continue;
        }

        foundOverlap = true;
        const direction = getSeparationDirection(
          first,
          second,
          offsetX,
          offsetY,
          distance,
        );
        separatePair(
          first,
          second,
          direction.x,
          direction.y,
          minimumDistance - distance,
        );
      }
    }

    if (!foundOverlap) {
      return;
    }
  }
}

function getSeparationDirection(
  first: CollisionActor,
  second: CollisionActor,
  offsetX: number,
  offsetY: number,
  distance: number,
): { x: number; y: number } {
  if (distance > 0) {
    return { x: offsetX / distance, y: offsetY / distance };
  }

  if (first.kind === 'player') {
    return getAimDirection(first.state, 1);
  }
  if (second.kind === 'player') {
    return getAimDirection(second.state, -1);
  }
  return { x: 1, y: 0 };
}

function getAimDirection(
  player: PlayerState,
  scale: 1 | -1,
): { x: number; y: number } {
  const length = Math.hypot(player.aimX, player.aimY);
  if (length === 0) {
    return { x: scale, y: 0 };
  }
  return {
    x: (player.aimX / length) * scale,
    y: (player.aimY / length) * scale,
  };
}

function separatePair(
  first: CollisionActor,
  second: CollisionActor,
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
  first: CollisionActor,
  second: CollisionActor,
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

function moveActorBy(
  actor: CollisionActor,
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
