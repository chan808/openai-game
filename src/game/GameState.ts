import {
  ARCHER_MAX_HP,
  ARENA_HEIGHT,
  ARENA_WIDTH,
  PLAYER_MAX_HP,
  PLAYER_MAX_MP,
  PLAYER_RADIUS,
  FORMATION_ARCHER_HOLD_X,
  FORMATION_ARCHER_HOLD_Y,
  FORMATION_SWORDSMAN_HOLD_X,
  FORMATION_SWORDSMAN_HOLD_Y,
  SWORDSMAN_MAX_HP,
} from '../content/tuning';

export interface ResourceState {
  current: number;
  maximum: number;
}

export interface PlayerState {
  x: number;
  y: number;
  aimX: number;
  aimY: number;
  health: ResourceState;
  mana: ResourceState;
  hitStopFramesRemaining: number;
  hitFlashFramesRemaining: number;
  invulnerabilityFramesRemaining: number;
  hitCount: number;
  defeatCount: number;
}

export type SwordsmanAction =
  | 'chasing'
  | 'windup'
  | 'attacking'
  | 'recovering'
  | 'dead';

export interface SwordsmanState {
  id: number;
  kind: 'swordsman';
  x: number;
  y: number;
  spawnX: number;
  spawnY: number;
  aimX: number;
  aimY: number;
  health: ResourceState;
  action: SwordsmanAction;
  actionFramesRemaining: number;
  hitPlayer: boolean;
  hitCount: number;
  hitStopFramesRemaining: number;
  hitFlashFramesRemaining: number;
  knockbackFramesRemaining: number;
  knockbackVelocityX: number;
  knockbackVelocityY: number;
}

export type ArcherAction =
  | 'positioning'
  | 'windup'
  | 'recovering'
  | 'dead';

export interface ArcherState {
  id: number;
  kind: 'archer';
  x: number;
  y: number;
  spawnX: number;
  spawnY: number;
  aimX: number;
  aimY: number;
  health: ResourceState;
  action: ArcherAction;
  actionFramesRemaining: number;
  hitCount: number;
  hitStopFramesRemaining: number;
  hitFlashFramesRemaining: number;
  knockbackFramesRemaining: number;
  knockbackVelocityX: number;
  knockbackVelocityY: number;
}

export type EnemyState = SwordsmanState | ArcherState;

export type FormationPhase = 'holding' | 'pressing' | 'broken';

export interface FormationState {
  phase: FormationPhase;
  observedEnemyHitCount: number;
}

export interface LongswordAttackState {
  activeFramesRemaining: number;
  cooldownFramesRemaining: number;
  hitEnemyIds: number[];
  aimX: number;
  aimY: number;
}

export type WeaponId = 'longsword' | 'bow' | 'magic';
export type ProjectileKind = 'arrow' | 'magic';
export type ProjectileOwner = 'player' | 'enemy';

export interface RangedAttackState {
  cooldownFramesRemaining: number;
}

export interface SlowState {
  active: boolean;
}

export interface TeleportState {
  cooldownFramesRemaining: number;
  destinationX: number;
  destinationY: number;
}

export interface ProjectileState {
  id: number;
  owner: ProjectileOwner;
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
  enemies: EnemyState[];
  formation: FormationState;
  selectedWeapon: WeaponId;
  longswordAttack: LongswordAttackState;
  bowAttack: RangedAttackState;
  magicAttack: RangedAttackState;
  slow: SlowState;
  teleport: TeleportState;
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
      health: {
        current: PLAYER_MAX_HP,
        maximum: PLAYER_MAX_HP,
      },
      mana: {
        current: PLAYER_MAX_MP,
        maximum: PLAYER_MAX_MP,
      },
      hitStopFramesRemaining: 0,
      hitFlashFramesRemaining: 0,
      invulnerabilityFramesRemaining: 0,
      hitCount: 0,
      defeatCount: 0,
    },
    enemies: [createSwordsman(), createArcher()],
    formation: {
      phase: 'holding',
      observedEnemyHitCount: 0,
    },
    selectedWeapon: 'longsword',
    longswordAttack: {
      activeFramesRemaining: 0,
      cooldownFramesRemaining: 0,
      hitEnemyIds: [],
      aimX: 1,
      aimY: 0,
    },
    bowAttack: {
      cooldownFramesRemaining: 0,
    },
    magicAttack: {
      cooldownFramesRemaining: 0,
    },
    slow: {
      active: false,
    },
    teleport: {
      cooldownFramesRemaining: 0,
      destinationX: Math.max(PLAYER_RADIUS, ARENA_WIDTH * 0.25),
      destinationY: ARENA_HEIGHT * 0.5,
    },
    nextProjectileId: 1,
    projectiles: [],
  };
}

function createSwordsman(): SwordsmanState {
  const x = FORMATION_SWORDSMAN_HOLD_X;
  const y = FORMATION_SWORDSMAN_HOLD_Y;
  return {
    id: 1,
    kind: 'swordsman',
    x,
    y,
    spawnX: x,
    spawnY: y,
    aimX: -1,
    aimY: 0,
    health: {
      current: SWORDSMAN_MAX_HP,
      maximum: SWORDSMAN_MAX_HP,
    },
    action: 'chasing',
    actionFramesRemaining: 0,
    hitPlayer: false,
    hitCount: 0,
    hitStopFramesRemaining: 0,
    hitFlashFramesRemaining: 0,
    knockbackFramesRemaining: 0,
    knockbackVelocityX: 0,
    knockbackVelocityY: 0,
  };
}

function createArcher(): ArcherState {
  const x = FORMATION_ARCHER_HOLD_X;
  const y = FORMATION_ARCHER_HOLD_Y;
  return {
    id: 2,
    kind: 'archer',
    x,
    y,
    spawnX: x,
    spawnY: y,
    aimX: -1,
    aimY: 0,
    health: {
      current: ARCHER_MAX_HP,
      maximum: ARCHER_MAX_HP,
    },
    action: 'positioning',
    actionFramesRemaining: 0,
    hitCount: 0,
    hitStopFramesRemaining: 0,
    hitFlashFramesRemaining: 0,
    knockbackFramesRemaining: 0,
    knockbackVelocityX: 0,
    knockbackVelocityY: 0,
  };
}
