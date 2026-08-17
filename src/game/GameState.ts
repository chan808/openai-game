import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  DUMMY_RADIUS,
  PLAYER_RADIUS,
} from '../content/tuning';

export interface PlayerState {
  x: number;
  y: number;
  aimX: number;
  aimY: number;
}

export interface DummyState {
  x: number;
  y: number;
  hitCount: number;
  hitFlashFramesRemaining: number;
}

export interface AttackState {
  activeFramesRemaining: number;
  cooldownFramesRemaining: number;
  hitDummy: boolean;
}

export interface GameState {
  frame: number;
  player: PlayerState;
  dummy: DummyState;
  attack: AttackState;
}

export function createInitialGameState(): GameState {
  return {
    frame: 0,
    player: {
      x: Math.max(PLAYER_RADIUS, ARENA_WIDTH * 0.25),
      y: ARENA_HEIGHT * 0.5,
      aimX: 1,
      aimY: 0,
    },
    dummy: {
      x: Math.min(ARENA_WIDTH - DUMMY_RADIUS, ARENA_WIDTH * 0.67),
      y: ARENA_HEIGHT * 0.5,
      hitCount: 0,
      hitFlashFramesRemaining: 0,
    },
    attack: {
      activeFramesRemaining: 0,
      cooldownFramesRemaining: 0,
      hitDummy: false,
    },
  };
}
