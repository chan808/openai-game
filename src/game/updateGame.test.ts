import { describe, expect, it } from 'vitest';

import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BOW_COOLDOWN_FRAMES,
  BOW_PROJECTILE_RADIUS,
  BOW_PROJECTILE_SPEED,
  HIT_FLASH_FRAMES,
  HIT_STOP_FRAMES,
  LONGSWORD_ACTIVE_FRAMES,
  MAGIC_COOLDOWN_FRAMES,
  NORTHWEST_PILLAR_HEIGHT,
  NORTHWEST_PILLAR_WIDTH,
  NORTHWEST_PILLAR_X,
  NORTHWEST_PILLAR_Y,
  PLAYER_MOVE_SPEED,
  PLAYER_RADIUS,
  SLOW_MP_DRAIN_PER_SECOND,
  SLOW_WORLD_TIME_SCALE,
  SWORDSMAN_RADIUS,
  TELEPORT_COOLDOWN_FRAMES,
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
  slowHeld: false,
  teleportPressed: false,
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
    expect(state.teleport.cooldownFramesRemaining).toBe(0);

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

  it('keeps the player responsive while slowing world projectiles', () => {
    const state = createInitialGameState();
    const inputSource = new TestInputSource({
      ...IDLE_INPUT,
      moveX: 1,
      primaryPressed: true,
      slowHeld: true,
      weaponSlotPressed: 1,
    });
    const startPlayerX = state.player.x;

    runFrame(state, inputSource, 1);

    const arrow = state.projectiles[0]!;
    const arrowSpawnX =
      startPlayerX +
      PLAYER_MOVE_SPEED * FIXED_STEP_SECONDS +
      PLAYER_RADIUS +
      BOW_PROJECTILE_RADIUS +
      2;

    expect(state.slow.active).toBe(true);
    expect(state.player.x).toBeCloseTo(
      startPlayerX + PLAYER_MOVE_SPEED * FIXED_STEP_SECONDS,
    );
    expect(arrow.x).toBeCloseTo(
      arrowSpawnX +
        BOW_PROJECTILE_SPEED * FIXED_STEP_SECONDS * SLOW_WORLD_TIME_SCALE,
    );
  });

  it('teleports toward the cursor without requiring slow', () => {
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
  });

  it('slows target hit stop without slowing player timers or mana drain', () => {
    const state = createInitialGameState();
    const inputSource = new TestInputSource({
      ...IDLE_INPUT,
      slowHeld: true,
    });
    getSwordsman(state).hitStopFramesRemaining = HIT_STOP_FRAMES;
    state.bowAttack.cooldownFramesRemaining = 2;
    const startMana = state.player.mana.current;

    runFrame(state, inputSource, 1);

    expect(getSwordsman(state).hitStopFramesRemaining).toBe(
      HIT_STOP_FRAMES - SLOW_WORLD_TIME_SCALE,
    );
    expect(state.bowAttack.cooldownFramesRemaining).toBe(1);
    expect(state.player.mana.current).toBeCloseTo(
      startMana - SLOW_MP_DRAIN_PER_SECOND * FIXED_STEP_SECONDS,
    );
  });

  it('slows the target hit-flash timer', () => {
    const state = createInitialGameState();
    const inputSource = new TestInputSource({
      ...IDLE_INPUT,
      slowHeld: true,
    });
    getSwordsman(state).hitFlashFramesRemaining = HIT_FLASH_FRAMES;

    runFrame(state, inputSource, 1);

    expect(getSwordsman(state).hitFlashFramesRemaining).toBe(
      HIT_FLASH_FRAMES - SLOW_WORLD_TIME_SCALE,
    );
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
