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
  hitStopFramesRemaining: number;
}

export interface DummyState {
  x: number;
  y: number;
  hitCount: number;
  hitStopFramesRemaining: number;
  hitFlashFramesRemaining: number;
}

export interface LongswordAttackState {
  activeFramesRemaining: number;
  cooldownFramesRemaining: number;
  hitDummy: boolean;
  aimX: number;
  aimY: number;
}

export type WeaponId = 'longsword' | 'bow' | 'magic';
export type ProjectileKind = 'arrow' | 'magic';

export interface RangedAttackState {
  cooldownFramesRemaining: number;
}

export interface ProjectileState {
  id: number;
  kind: ProjectileKind;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  framesRemaining: number;
}

export interface GameState {
  frame: number;
  player: PlayerState;
  dummy: DummyState;
  selectedWeapon: WeaponId;
  longswordAttack: LongswordAttackState;
  bowAttack: RangedAttackState;
  magicAttack: RangedAttackState;
  nextProjectileId: number;
  projectiles: ProjectileState[];
}

export function createInitialGameState(): GameState {
  return {
    frame: 0,
    player: {
      x: Math.max(PLAYER_RADIUS, ARENA_WIDTH * 0.25),
      y: ARENA_HEIGHT * 0.5,
      aimX: 1,
      aimY: 0,
      hitStopFramesRemaining: 0,
    },
    dummy: {
      x: Math.min(ARENA_WIDTH - DUMMY_RADIUS, ARENA_WIDTH * 0.67),
      y: ARENA_HEIGHT * 0.5,
      hitCount: 0,
      hitStopFramesRemaining: 0,
      hitFlashFramesRemaining: 0,
    },
    selectedWeapon: 'longsword',
    longswordAttack: {
      activeFramesRemaining: 0,
      cooldownFramesRemaining: 0,
      hitDummy: false,
      aimX: 1,
      aimY: 0,
    },
    bowAttack: {
      cooldownFramesRemaining: 0,
    },
    magicAttack: {
      cooldownFramesRemaining: 0,
    },
    nextProjectileId: 1,
    projectiles: [],
  };
}
