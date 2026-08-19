import {
  BOW_COOLDOWN_FRAMES,
  MAGIC_COOLDOWN_FRAMES,
  ULTIMATE_RECORD_FRAMES,
  ULTIMATE_REPLAY_SPEED,
} from '../content/tuning';
import { damageEnemy, tickFrozenEnemyHitFlash } from './enemyState';
import type {
  GameState,
  ProjectileState,
  UltimateRecordFrame,
  UltimateRecordedProjectile,
} from './GameState';

export function tryActivateUltimate(
  state: GameState,
  ultimatePressed: boolean,
): boolean {
  const ultimate = state.ultimate;
  if (
    !ultimatePressed ||
    ultimate.phase !== 'inactive' ||
    ultimate.charge.current < ultimate.charge.maximum
  ) {
    return false;
  }

  ultimate.charge.current = 0;
  ultimate.phase = 'recording';
  ultimate.phaseFramesRemaining = ULTIMATE_RECORD_FRAMES;
  ultimate.replayFramesTotal = 0;
  ultimate.recordedFrames = [];
  ultimate.hitEvents = [];
  ultimate.nextHitEventIndex = 0;
  ultimate.projectedEnemyHealth = state.enemies.map((enemy) => ({
    enemyId: enemy.id,
    current: enemy.action === 'dead' ? 0 : enemy.health.current,
  }));
  ultimate.projectileLaunches = [];
  ultimate.pendingProjectiles = [];
  return true;
}

export function recordUltimateFrame(state: GameState): void {
  const attack = state.longswordAttack;
  state.ultimate.recordedFrames.push({
    x: state.player.x,
    y: state.player.y,
    aimX: state.player.aimX,
    aimY: state.player.aimY,
    longswordActive: attack.activeFramesRemaining > 0,
    longswordAimX: attack.aimX,
    longswordAimY: attack.aimY,
    rangedAttackFired: getRangedAttackFired(state),
    projectiles: state.projectiles
      .filter((projectile) => projectile.timeDomain === 'ultimate')
      .map(toRecordedProjectile),
  });
}

export function registerUltimateProjectileLaunch(
  state: GameState,
  projectile: ProjectileState,
): void {
  if (
    state.ultimate.phase !== 'recording' ||
    projectile.timeDomain !== 'ultimate'
  ) {
    return;
  }

  state.ultimate.projectileLaunches.push(toRecordedProjectile(projectile));
}

export function recordUltimateHit(
  state: GameState,
  enemyId: number,
  damage: number,
): boolean {
  if (state.ultimate.phase !== 'recording') {
    return false;
  }

  const projectedHealth = state.ultimate.projectedEnemyHealth.find(
    (entry) => entry.enemyId === enemyId,
  );
  if (projectedHealth === undefined || projectedHealth.current <= 0) {
    return false;
  }

  projectedHealth.current = Math.max(0, projectedHealth.current - damage);
  state.ultimate.hitEvents.push({
    recordFrame: state.ultimate.recordedFrames.length,
    enemyId,
    damage,
  });
  return true;
}

export function ultimateEnemyIsProjectedAlive(
  state: GameState,
  enemyId: number,
): boolean {
  if (state.ultimate.phase !== 'recording') {
    return true;
  }

  return (
    state.ultimate.projectedEnemyHealth.find(
      (entry) => entry.enemyId === enemyId,
    )?.current ?? 0
  ) > 0;
}

export function tickUltimateRecording(state: GameState): void {
  const ultimate = state.ultimate;
  if (ultimate.phase !== 'recording') {
    return;
  }

  ultimate.phaseFramesRemaining = Math.max(
    0,
    ultimate.phaseFramesRemaining - 1,
  );
  if (ultimate.phaseFramesRemaining === 0) {
    finishUltimateRecording(state);
  }
}

export function finishUltimateRecording(state: GameState): boolean {
  const ultimate = state.ultimate;
  if (ultimate.phase !== 'recording') {
    return false;
  }

  ultimate.pendingProjectiles = state.projectiles
    .filter((projectile) => projectile.timeDomain === 'ultimate')
    .map(cloneProjectile);
  state.projectiles = state.projectiles.filter(
    (projectile) => projectile.timeDomain === 'world',
  );

  ultimate.replayFramesTotal = Math.max(
    1,
    Math.ceil(ultimate.recordedFrames.length / ULTIMATE_REPLAY_SPEED),
  );
  ultimate.phase = 'replaying';
  ultimate.phaseFramesRemaining = ultimate.replayFramesTotal;
  ultimate.nextHitEventIndex = 0;
  return true;
}

export function tickUltimateReplay(state: GameState): void {
  const ultimate = state.ultimate;
  if (ultimate.phase !== 'replaying') {
    return;
  }

  for (const enemy of state.enemies) {
    tickFrozenEnemyHitFlash(enemy);
  }

  const elapsedFrames =
    ultimate.replayFramesTotal - ultimate.phaseFramesRemaining;
  const nextElapsedFrames = elapsedFrames + 1;
  const replayIntervals = Math.max(1, ultimate.replayFramesTotal - 1);
  const recordEndExclusive = Math.min(
    ultimate.recordedFrames.length,
    Math.floor(
      (nextElapsedFrames * (ultimate.recordedFrames.length - 1)) /
        replayIntervals,
    ) + 1,
  );
  applyUltimateHitsThrough(state, recordEndExclusive);

  ultimate.phaseFramesRemaining = Math.max(
    0,
    ultimate.phaseFramesRemaining - 1,
  );
  if (ultimate.phaseFramesRemaining === 0) {
    finishUltimateReplay(state);
  }
}

export function getUltimateReplayFrame(
  state: GameState,
): UltimateRecordFrame | null {
  const ultimate = state.ultimate;
  if (
    ultimate.phase !== 'replaying' ||
    ultimate.recordedFrames.length === 0
  ) {
    return null;
  }

  const elapsedFrames =
    ultimate.replayFramesTotal - ultimate.phaseFramesRemaining;
  if (ultimate.replayFramesTotal === 1) {
    return ultimate.recordedFrames.at(-1) ?? null;
  }
  const replayIntervals = Math.max(1, ultimate.replayFramesTotal - 1);
  const progress = Math.min(1, elapsedFrames / replayIntervals);
  const frameIndex = Math.min(
    ultimate.recordedFrames.length - 1,
    Math.floor(progress * (ultimate.recordedFrames.length - 1)),
  );
  return ultimate.recordedFrames[frameIndex] ?? null;
}

function getRangedAttackFired(
  state: GameState,
): 'bow' | 'magic' | null {
  if (
    state.selectedWeapon === 'bow' &&
    state.bowAttack.cooldownFramesRemaining === BOW_COOLDOWN_FRAMES
  ) {
    return 'bow';
  }
  if (
    state.selectedWeapon === 'magic' &&
    state.magicAttack.cooldownFramesRemaining === MAGIC_COOLDOWN_FRAMES
  ) {
    return 'magic';
  }
  return null;
}

function applyUltimateHitsThrough(
  state: GameState,
  recordEndExclusive: number,
): void {
  const ultimate = state.ultimate;
  while (ultimate.nextHitEventIndex < ultimate.hitEvents.length) {
    const hit = ultimate.hitEvents[ultimate.nextHitEventIndex];
    if (hit === undefined || hit.recordFrame >= recordEndExclusive) {
      return;
    }

    const enemy = state.enemies.find(
      (candidate) => candidate.id === hit.enemyId,
    );
    if (enemy !== undefined) {
      damageEnemy(enemy, hit.damage, false);
    }
    ultimate.nextHitEventIndex += 1;
  }
}

function finishUltimateReplay(state: GameState): void {
  const ultimate = state.ultimate;
  for (const projectile of ultimate.pendingProjectiles) {
    projectile.timeDomain = 'world';
    state.projectiles.push(projectile);
  }

  ultimate.phase = 'inactive';
  ultimate.phaseFramesRemaining = 0;
  ultimate.replayFramesTotal = 0;
  ultimate.recordedFrames = [];
  ultimate.hitEvents = [];
  ultimate.nextHitEventIndex = 0;
  ultimate.projectedEnemyHealth = [];
  ultimate.projectileLaunches = [];
  ultimate.pendingProjectiles = [];
}

function toRecordedProjectile(
  projectile: ProjectileState,
): UltimateRecordedProjectile {
  return {
    id: projectile.id,
    kind: projectile.kind,
    x: projectile.x,
    y: projectile.y,
    velocityX: projectile.velocityX,
    velocityY: projectile.velocityY,
  };
}

function cloneProjectile(projectile: ProjectileState): ProjectileState {
  return { ...projectile };
}
