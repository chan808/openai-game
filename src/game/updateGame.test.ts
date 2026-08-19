import { describe, expect, it } from 'vitest';

import {
  ARCHER_RADIUS,
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BOW_COOLDOWN_FRAMES,
  HIT_FLASH_FRAMES,
  HIT_STOP_FRAMES,
  LONGSWORD_ACTIVE_FRAMES,
  LONGSWORD_COOLDOWN_FRAMES,
  LONGSWORD_DAMAGE,
  MAGIC_COOLDOWN_FRAMES,
  NORTHWEST_PILLAR_HEIGHT,
  NORTHWEST_PILLAR_WIDTH,
  NORTHWEST_PILLAR_X,
  NORTHWEST_PILLAR_Y,
  PLAYER_MOVE_SPEED,
  PLAYER_RADIUS,
  SWORDSMAN_RADIUS,
  TELEPORT_COOLDOWN_FRAMES,
  ULTIMATE_MAX_CHARGE,
  ULTIMATE_RECORD_FRAMES,
  ULTIMATE_REPLAY_FRAMES,
  ULTIMATE_REPLAY_SPEED,
} from '../content/tuning';
import { FIXED_STEP_SECONDS } from '../core/GameClock';
import type { InputFrame, InputSource } from '../core/InputSource';
import {
  createInitialGameState,
  type GameState,
  type SwordsmanState,
} from './GameState';
import { spawnMagicProjectile } from './projectiles';
import { updateGame } from './updateGame';

const IDLE_INPUT: InputFrame = {
  moveX: 0,
  moveY: 0,
  aimTargetX: ARENA_WIDTH,
  aimTargetY: ARENA_HEIGHT / 2,
  primaryPressed: false,
  teleportPressed: false,
  ultimatePressed: false,
  weaponSlotPressed: null,
};

class TestInputSource implements InputSource {
  readonly sampledFrames: number[] = [];

  constructor(private input: InputFrame = IDLE_INPUT) {}

  setInput(input: InputFrame): void {
    this.input = input;
  }

  sample(frame: number): InputFrame {
    this.sampledFrames.push(frame);
    return this.input;
  }
}

describe('updateGame', () => {
  it('freezes the attacker and target for the configured simulation frames', () => {
    const state = createInitialGameState();
    const inputSource = new TestInputSource({
      ...IDLE_INPUT,
      primaryPressed: true,
    });
    state.player.x = getSwordsman(state).x - 100;
    state.teleport.cooldownFramesRemaining = TELEPORT_COOLDOWN_FRAMES;

    runFrame(state, inputSource, 1);
    inputSource.setInput(IDLE_INPUT);

    let hitFrame = 1;
    while (
      getSwordsman(state).hitCount === 0 &&
      hitFrame <= LONGSWORD_ACTIVE_FRAMES
    ) {
      hitFrame += 1;
      runFrame(state, inputSource, hitFrame);
    }

    expect(getSwordsman(state).hitCount).toBe(1);
    expect(state.player.hitStopFramesRemaining).toBe(HIT_STOP_FRAMES);
    expect(getSwordsman(state).hitStopFramesRemaining).toBe(HIT_STOP_FRAMES);
    expect(getSwordsman(state).hitFlashFramesRemaining).toBe(HIT_FLASH_FRAMES);
    expect(state.teleport.cooldownFramesRemaining).toBe(
      TELEPORT_COOLDOWN_FRAMES - hitFrame,
    );

    const stoppedX = state.player.x;
    const stoppedActiveFrames =
      state.longswordAttack.activeFramesRemaining;
    const stoppedCooldownFrames =
      state.longswordAttack.cooldownFramesRemaining;
    inputSource.setInput({ ...IDLE_INPUT, moveX: -1 });

    const lastHitStopFrame = hitFrame + HIT_STOP_FRAMES;
    for (
      let frame = hitFrame + 1;
      frame <= lastHitStopFrame;
      frame += 1
    ) {
      runFrame(state, inputSource, frame);
    }

    expect(state.frame).toBe(lastHitStopFrame);
    expect(inputSource.sampledFrames).toEqual(
      Array.from({ length: lastHitStopFrame }, (_, index) => index + 1),
    );
    expect(state.player.x).toBe(stoppedX);
    expect(state.longswordAttack.activeFramesRemaining).toBe(
      stoppedActiveFrames,
    );
    expect(state.longswordAttack.cooldownFramesRemaining).toBe(
      stoppedCooldownFrames,
    );
    expect(getSwordsman(state).hitFlashFramesRemaining).toBe(HIT_FLASH_FRAMES);
    expect(state.player.hitStopFramesRemaining).toBe(0);
    expect(getSwordsman(state).hitStopFramesRemaining).toBe(0);

    runFrame(state, inputSource, lastHitStopFrame + 1);

    expect(state.player.x).toBeLessThan(stoppedX);
    expect(state.longswordAttack.activeFramesRemaining).toBe(
      stoppedActiveFrames - 1,
    );
    expect(state.longswordAttack.cooldownFramesRemaining).toBe(
      stoppedCooldownFrames - 1,
    );
    expect(getSwordsman(state).hitFlashFramesRemaining).toBe(
      HIT_FLASH_FRAMES - 1,
    );
    expect(getSwordsman(state).hitCount).toBe(1);
  });

  it('does not start hit stop when the attack misses', () => {
    const state = createInitialGameState();
    const inputSource = new TestInputSource({
      ...IDLE_INPUT,
      aimTargetX: 0,
      primaryPressed: true,
    });

    runFrame(state, inputSource, 1);
    inputSource.setInput(IDLE_INPUT);

    for (let frame = 2; frame <= LONGSWORD_ACTIVE_FRAMES + 1; frame += 1) {
      runFrame(state, inputSource, frame);
    }

    expect(getSwordsman(state).hitCount).toBe(0);
    expect(state.player.hitStopFramesRemaining).toBe(0);
    expect(getSwordsman(state).hitStopFramesRemaining).toBe(0);
  });

  it('does not shorten a longer target hit stop on longsword hit', () => {
    const state = createInitialGameState();
    const inputSource = new TestInputSource();
    const previousHitStop = HIT_STOP_FRAMES + 4;
    const swordsman = getSwordsman(state);
    swordsman.x = 350;
    swordsman.y = ARENA_HEIGHT / 2;
    state.player.x = swordsman.x - 100;
    state.player.y = swordsman.y;
    swordsman.hitStopFramesRemaining = previousHitStop;
    state.longswordAttack.activeFramesRemaining = 5;

    runFrame(state, inputSource, 1);

    expect(getSwordsman(state).hitCount).toBe(1);
    expect(getSwordsman(state).hitStopFramesRemaining).toBe(
      previousHitStop - 1,
    );
  });

  it('does not hit an enemy through a pillar with the longsword', () => {
    const state = createInitialGameState();
    const swordsman = getSwordsman(state);
    const inputSource = new TestInputSource();
    const attackY = NORTHWEST_PILLAR_Y + NORTHWEST_PILLAR_HEIGHT / 2;
    state.player.x = NORTHWEST_PILLAR_X - PLAYER_RADIUS;
    state.player.y = attackY;
    swordsman.x =
      NORTHWEST_PILLAR_X + NORTHWEST_PILLAR_WIDTH + SWORDSMAN_RADIUS;
    swordsman.y = attackY;
    swordsman.action = 'recovering';
    swordsman.actionFramesRemaining = 30;
    state.longswordAttack.activeFramesRemaining = 5;
    state.longswordAttack.aimX = 1;
    state.longswordAttack.aimY = 0;

    runFrame(state, inputSource, 1);

    expect(swordsman.hitCount).toBe(0);
  });

  it('locks the swing direction when the attack starts', () => {
    const state = createInitialGameState();
    const inputSource = new TestInputSource({
      ...IDLE_INPUT,
      primaryPressed: true,
    });

    runFrame(state, inputSource, 1);
    inputSource.setInput({
      ...IDLE_INPUT,
      aimTargetX: state.player.x,
      aimTargetY: ARENA_HEIGHT,
    });
    runFrame(state, inputSource, 2);

    expect(state.player.aimX).toBe(0);
    expect(state.player.aimY).toBe(1);
    expect(state.longswordAttack.aimX).toBe(1);
    expect(state.longswordAttack.aimY).toBe(0);
  });

  it('selects weapons through semantic playtest slots', () => {
    const state = createInitialGameState();
    const inputSource = new TestInputSource({
      ...IDLE_INPUT,
      weaponSlotPressed: 2,
    });

    runFrame(state, inputSource, 1);

    expect(state.selectedWeapon).toBe('magic');
  });

  it('fires the selected ranged weapon on primary press', () => {
    const state = createInitialGameState();
    const inputSource = new TestInputSource({
      ...IDLE_INPUT,
      primaryPressed: true,
      weaponSlotPressed: 1,
    });

    runFrame(state, inputSource, 1);

    expect(state.selectedWeapon).toBe('bow');
    expect(state.projectiles).toHaveLength(1);
    expect(state.projectiles[0]!.kind).toBe('arrow');
  });

  it('enforces the configured cooldown for each ranged weapon', () => {
    const bowState = createInitialGameState();
    const bowInput = new TestInputSource({
      ...IDLE_INPUT,
      primaryPressed: true,
      weaponSlotPressed: 1,
    });

    runFrame(bowState, bowInput, 1);
    runFrame(bowState, bowInput, 2);

    expect(bowState.projectiles).toHaveLength(1);
    expect(bowState.bowAttack.cooldownFramesRemaining).toBe(
      BOW_COOLDOWN_FRAMES - 1,
    );

    bowInput.setInput(IDLE_INPUT);
    for (let frame = 3; frame <= BOW_COOLDOWN_FRAMES; frame += 1) {
      runFrame(bowState, bowInput, frame);
    }
    bowInput.setInput({ ...IDLE_INPUT, primaryPressed: true });
    runFrame(bowState, bowInput, BOW_COOLDOWN_FRAMES + 1);

    expect(bowState.projectiles).toHaveLength(2);
    expect(bowState.bowAttack.cooldownFramesRemaining).toBe(
      BOW_COOLDOWN_FRAMES,
    );

    const magicState = createInitialGameState();
    const magicInput = new TestInputSource({
      ...IDLE_INPUT,
      primaryPressed: true,
      weaponSlotPressed: 2,
    });

    runFrame(magicState, magicInput, 1);
    magicState.projectiles = [];
    runFrame(magicState, magicInput, 2);

    expect(magicState.projectiles).toHaveLength(0);
    expect(magicState.magicAttack.cooldownFramesRemaining).toBe(
      MAGIC_COOLDOWN_FRAMES - 1,
    );

    magicInput.setInput(IDLE_INPUT);
    for (let frame = 3; frame <= MAGIC_COOLDOWN_FRAMES; frame += 1) {
      runFrame(magicState, magicInput, frame);
    }
    magicInput.setInput({ ...IDLE_INPUT, primaryPressed: true });
    runFrame(magicState, magicInput, MAGIC_COOLDOWN_FRAMES + 1);

    expect(magicState.projectiles).toHaveLength(1);
    expect(magicState.magicAttack.cooldownFramesRemaining).toBe(
      MAGIC_COOLDOWN_FRAMES,
    );
  });

  it('does not consume magic cooldown when its projectile already exists', () => {
    const state = createInitialGameState();
    const inputSource = new TestInputSource({
      ...IDLE_INPUT,
      primaryPressed: true,
      weaponSlotPressed: 2,
    });
    spawnMagicProjectile(state);

    runFrame(state, inputSource, 1);

    expect(state.projectiles).toHaveLength(1);
    expect(state.magicAttack.cooldownFramesRemaining).toBe(0);
  });

  it('freezes the world for ten seconds and replays the record for two seconds', () => {
    const state = createInitialGameState();
    const swordsman = getSwordsman(state);
    swordsman.action = 'recovering';
    swordsman.actionFramesRemaining = 30;
    state.ultimate.charge.current = ULTIMATE_MAX_CHARGE;
    const startPlayerX = state.player.x;
    const inputSource = new TestInputSource({
      ...IDLE_INPUT,
      moveX: 1,
      ultimatePressed: true,
    });

    runFrame(state, inputSource, 1);

    expect(state.ultimate.phase).toBe('recording');
    expect(state.ultimate.charge.current).toBe(0);
    expect(state.player.x).toBeCloseTo(
      startPlayerX + PLAYER_MOVE_SPEED * FIXED_STEP_SECONDS,
    );
    expect(swordsman.actionFramesRemaining).toBe(30);
    expect(state.ultimate.recordedFrames).toHaveLength(1);

    inputSource.setInput(IDLE_INPUT);
    for (let frame = 2; frame <= ULTIMATE_RECORD_FRAMES; frame += 1) {
      runFrame(state, inputSource, frame);
    }

    expect(state.ultimate.phase).toBe('replaying');
    expect(state.ultimate.recordedFrames).toHaveLength(
      ULTIMATE_RECORD_FRAMES,
    );
    expect(swordsman.actionFramesRemaining).toBe(30);

    inputSource.setInput({ ...IDLE_INPUT, moveX: -1 });
    const replayPlayerX = state.player.x;
    for (
      let frame = ULTIMATE_RECORD_FRAMES + 1;
      frame <= ULTIMATE_RECORD_FRAMES + ULTIMATE_REPLAY_FRAMES;
      frame += 1
    ) {
      runFrame(state, inputSource, frame);
    }

    expect(state.ultimate.phase).toBe('inactive');
    expect(state.ultimate.recordedFrames).toHaveLength(0);
    expect(state.player.x).toBe(replayPlayerX);
    expect(swordsman.actionFramesRemaining).toBe(30);
  });

  it('ends recording on a second ultimate press and replays at five times speed', () => {
    const state = createInitialGameState();
    const swordsman = getSwordsman(state);
    swordsman.action = 'recovering';
    swordsman.actionFramesRemaining = 30;
    state.ultimate.charge.current = ULTIMATE_MAX_CHARGE;
    const inputSource = new TestInputSource({
      ...IDLE_INPUT,
      ultimatePressed: true,
    });

    runFrame(state, inputSource, 1);
    inputSource.setInput(IDLE_INPUT);
    for (let frame = 2; frame <= 10; frame += 1) {
      runFrame(state, inputSource, frame);
    }

    inputSource.setInput({ ...IDLE_INPUT, ultimatePressed: true });
    runFrame(state, inputSource, 11);

    expect(state.ultimate.phase).toBe('replaying');
    expect(state.ultimate.recordedFrames).toHaveLength(10);
    expect(state.ultimate.replayFramesTotal).toBe(
      Math.ceil(10 / ULTIMATE_REPLAY_SPEED),
    );
    expect(swordsman.actionFramesRemaining).toBe(30);

    inputSource.setInput({ ...IDLE_INPUT, moveX: 1 });
    const stoppedPlayerX = state.player.x;
    runFrame(state, inputSource, 12);

    expect(state.ultimate.phase).toBe('replaying');
    expect(state.player.x).toBe(stoppedPlayerX);
    expect(swordsman.actionFramesRemaining).toBe(30);

    runFrame(state, inputSource, 13);

    expect(state.ultimate.phase).toBe('inactive');
    expect(state.player.x).toBe(stoppedPlayerX);
    expect(swordsman.actionFramesRemaining).toBe(30);
  });

  it('defers longsword damage, hit feedback, and death until replay', () => {
    const state = createInitialGameState();
    const swordsman = getSwordsman(state);
    state.player.x = 300;
    state.player.y = ARENA_HEIGHT / 2;
    swordsman.x = state.player.x + 100;
    swordsman.y = state.player.y;
    swordsman.health.current = LONGSWORD_DAMAGE;
    swordsman.action = 'recovering';
    swordsman.actionFramesRemaining = 30;
    state.ultimate.charge.current = ULTIMATE_MAX_CHARGE;
    const inputSource = new TestInputSource({
      ...IDLE_INPUT,
      primaryPressed: true,
      ultimatePressed: true,
    });

    let frame = 1;
    runFrame(state, inputSource, frame);
    inputSource.setInput(IDLE_INPUT);
    while (
      state.ultimate.hitEvents.length === 0 &&
      frame < LONGSWORD_ACTIVE_FRAMES
    ) {
      frame += 1;
      runFrame(state, inputSource, frame);
    }

    expect(state.ultimate.hitEvents).toHaveLength(1);
    expect(swordsman.health.current).toBe(LONGSWORD_DAMAGE);
    expect(swordsman.action).toBe('recovering');
    expect(swordsman.hitCount).toBe(0);
    expect(swordsman.hitFlashFramesRemaining).toBe(0);
    expect(state.player.hitStopFramesRemaining).toBe(0);

    frame += 1;
    inputSource.setInput({ ...IDLE_INPUT, ultimatePressed: true });
    runFrame(state, inputSource, frame);

    expect(state.ultimate.phase).toBe('replaying');
    expect(swordsman.health.current).toBe(LONGSWORD_DAMAGE);

    frame += 1;
    inputSource.setInput(IDLE_INPUT);
    runFrame(state, inputSource, frame);

    expect(state.ultimate.phase).toBe('inactive');
    expect(swordsman.health.current).toBe(0);
    expect(swordsman.action).toBe('dead');
    expect(swordsman.hitCount).toBe(1);
    expect(swordsman.hitStopFramesRemaining).toBe(0);
  });

  it('does not push frozen enemies while the player moves during time stop', () => {
    const state = createInitialGameState();
    const swordsman = getSwordsman(state);
    swordsman.x = state.player.x + PLAYER_RADIUS + SWORDSMAN_RADIUS;
    swordsman.y = state.player.y;
    const swordsmanX = swordsman.x;
    state.ultimate.charge.current = ULTIMATE_MAX_CHARGE;
    const inputSource = new TestInputSource({
      ...IDLE_INPUT,
      moveX: 1,
      ultimatePressed: true,
    });

    runFrame(state, inputSource, 1);

    expect(swordsman.x).toBe(swordsmanX);
    expect(
      Math.hypot(
        swordsman.x - state.player.x,
        swordsman.y - state.player.y,
      ),
    ).toBeGreaterThanOrEqual(PLAYER_RADIUS + SWORDSMAN_RADIUS - 0.001);
  });

  it('teleports toward the cursor', () => {
    const state = createInitialGameState();
    const startX = state.player.x;
    const inputSource = new TestInputSource({
      ...IDLE_INPUT,
      aimTargetX: startX + 100,
      aimTargetY: state.player.y,
      teleportPressed: true,
    });

    runFrame(state, inputSource, 1);

    expect(state.player.x).toBe(startX + 100);
    expect(state.teleport.cooldownFramesRemaining).toBe(
      TELEPORT_COOLDOWN_FRAMES,
    );
    expect(state.teleport.echo.x).toBe(startX);
    expect(state.teleport.echo.framesRemaining).toBeGreaterThan(0);
  });

  it('buffers a primary press made during player hit stop', () => {
    const state = createInitialGameState();
    const inputSource = new TestInputSource({
      ...IDLE_INPUT,
      primaryPressed: true,
    });
    state.player.hitStopFramesRemaining = HIT_STOP_FRAMES;
    state.longswordAttack.cooldownFramesRemaining =
      LONGSWORD_COOLDOWN_FRAMES;
    for (const enemy of state.enemies) {
      enemy.action = 'dead';
      enemy.actionFramesRemaining = 1_000;
    }

    runFrame(state, inputSource, 1);
    inputSource.setInput(IDLE_INPUT);
    for (
      let frame = 2;
      frame <= HIT_STOP_FRAMES + LONGSWORD_COOLDOWN_FRAMES;
      frame += 1
    ) {
      runFrame(state, inputSource, frame);
    }

    expect(state.longswordAttack.activeFramesRemaining).toBe(
      LONGSWORD_ACTIVE_FRAMES,
    );
    expect(state.longswordAttack.cooldownFramesRemaining).toBe(
      LONGSWORD_COOLDOWN_FRAMES,
    );
    expect(state.inputBuffer.primaryFramesRemaining).toBe(0);
  });

  it('buffers a teleport press made during player hit stop', () => {
    const state = createInitialGameState();
    const startX = state.player.x;
    const inputSource = new TestInputSource({
      ...IDLE_INPUT,
      aimTargetX: startX + 100,
      aimTargetY: state.player.y,
      teleportPressed: true,
    });
    state.player.hitStopFramesRemaining = HIT_STOP_FRAMES;

    runFrame(state, inputSource, 1);
    inputSource.setInput({
      ...IDLE_INPUT,
      aimTargetX: startX + 100,
      aimTargetY: state.player.y,
    });
    for (let frame = 2; frame <= HIT_STOP_FRAMES; frame += 1) {
      runFrame(state, inputSource, frame);
    }

    expect(state.player.x).toBe(startX);
    runFrame(state, inputSource, HIT_STOP_FRAMES + 1);

    expect(state.player.x).toBe(startX + 100);
    expect(state.teleport.cooldownFramesRemaining).toBe(
      TELEPORT_COOLDOWN_FRAMES,
    );
    expect(state.inputBuffer.teleportFramesRemaining).toBe(0);
  });

  it('separates overlapping actors while the player is hit-stopped', () => {
    const state = createInitialGameState();
    const swordsman = getSwordsman(state);
    state.player.hitStopFramesRemaining = HIT_STOP_FRAMES;
    swordsman.hitStopFramesRemaining = HIT_STOP_FRAMES;
    swordsman.x = state.player.x + 1;
    swordsman.y = state.player.y;

    runFrame(state, new TestInputSource(), 1);

    expect(
      Math.hypot(
        swordsman.x - state.player.x,
        swordsman.y - state.player.y,
      ),
    ).toBeGreaterThanOrEqual(PLAYER_RADIUS + SWORDSMAN_RADIUS - 0.001);
  });

  it('separates an enemy that respawns on the player', () => {
    const state = createInitialGameState();
    const swordsman = getSwordsman(state);
    swordsman.action = 'dead';
    swordsman.actionFramesRemaining = 1;
    swordsman.spawnX = state.player.x;
    swordsman.spawnY = state.player.y;

    runFrame(state, new TestInputSource(), 1);

    expect(swordsman.action).not.toBe('dead');
    expect(
      Math.hypot(
        swordsman.x - state.player.x,
        swordsman.y - state.player.y,
      ),
    ).toBeGreaterThanOrEqual(PLAYER_RADIUS + SWORDSMAN_RADIUS - 0.001);
  });

  it('restores non-overlap after teleport correction reaches another enemy', () => {
    const state = createInitialGameState();
    const [swordsman, archer] = state.enemies;
    if (swordsman === undefined || archer === undefined) {
      throw new Error('Expected the initial enemy pair');
    }
    state.player.x = 240;
    state.player.y = 270;
    swordsman.x = 370;
    swordsman.y = 255;
    swordsman.hitStopFramesRemaining = HIT_STOP_FRAMES;
    archer.x = 445;
    archer.y = 260;
    archer.hitStopFramesRemaining = HIT_STOP_FRAMES;
    const inputSource = new TestInputSource({
      ...IDLE_INPUT,
      aimTargetX: 480,
      aimTargetY: 270,
      teleportPressed: true,
    });

    runFrame(state, inputSource, 1);

    for (const enemy of state.enemies) {
      expect(
        Math.hypot(
          enemy.x - state.player.x,
          enemy.y - state.player.y,
        ),
      ).toBeGreaterThanOrEqual(
        PLAYER_RADIUS +
          (enemy.kind === 'swordsman' ? SWORDSMAN_RADIUS : ARCHER_RADIUS) -
          0.001,
      );
    }
  });

});

function runFrame(
  state: ReturnType<typeof createInitialGameState>,
  inputSource: InputSource,
  frame: number,
): void {
  updateGame(state, inputSource, { frame, dt: FIXED_STEP_SECONDS });
}

function getSwordsman(state: GameState): SwordsmanState {
  const enemy = state.enemies.find((candidate) => candidate.kind === 'swordsman');
  if (enemy?.kind !== 'swordsman') {
    throw new Error('Expected swordsman in initial state');
  }
  return enemy;
}
