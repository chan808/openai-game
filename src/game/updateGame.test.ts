import { describe, expect, it } from 'vitest';

import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  HIT_FLASH_FRAMES,
  HIT_STOP_FRAMES,
  LONGSWORD_ACTIVE_FRAMES,
} from '../content/tuning';
import { FIXED_STEP_SECONDS } from '../core/GameClock';
import type { InputFrame, InputSource } from '../core/InputSource';
import { createInitialGameState } from './GameState';
import { updateGame } from './updateGame';

const IDLE_INPUT: InputFrame = {
  moveX: 0,
  moveY: 0,
  aimTargetX: ARENA_WIDTH,
  aimTargetY: ARENA_HEIGHT / 2,
  primaryPressed: false,
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

describe('updateGame longsword attack', () => {
  it('freezes the attacker and target for the configured simulation frames', () => {
    const state = createInitialGameState();
    const inputSource = new TestInputSource({
      ...IDLE_INPUT,
      primaryPressed: true,
    });
    state.player.x = state.dummy.x - 100;

    runFrame(state, inputSource, 1);
    inputSource.setInput(IDLE_INPUT);

    let hitFrame = 1;
    while (
      state.dummy.hitCount === 0 &&
      hitFrame <= LONGSWORD_ACTIVE_FRAMES
    ) {
      hitFrame += 1;
      runFrame(state, inputSource, hitFrame);
    }

    expect(state.dummy.hitCount).toBe(1);
    expect(state.player.hitStopFramesRemaining).toBe(HIT_STOP_FRAMES);
    expect(state.dummy.hitStopFramesRemaining).toBe(HIT_STOP_FRAMES);
    expect(state.dummy.hitFlashFramesRemaining).toBe(HIT_FLASH_FRAMES);

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
    expect(state.dummy.hitFlashFramesRemaining).toBe(HIT_FLASH_FRAMES);
    expect(state.player.hitStopFramesRemaining).toBe(0);
    expect(state.dummy.hitStopFramesRemaining).toBe(0);

    runFrame(state, inputSource, lastHitStopFrame + 1);

    expect(state.player.x).toBeLessThan(stoppedX);
    expect(state.longswordAttack.activeFramesRemaining).toBe(
      stoppedActiveFrames - 1,
    );
    expect(state.longswordAttack.cooldownFramesRemaining).toBe(
      stoppedCooldownFrames - 1,
    );
    expect(state.dummy.hitFlashFramesRemaining).toBe(HIT_FLASH_FRAMES - 1);
    expect(state.dummy.hitCount).toBe(1);
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

    expect(state.dummy.hitCount).toBe(0);
    expect(state.player.hitStopFramesRemaining).toBe(0);
    expect(state.dummy.hitStopFramesRemaining).toBe(0);
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
});

function runFrame(
  state: ReturnType<typeof createInitialGameState>,
  inputSource: InputSource,
  frame: number,
): void {
  updateGame(state, inputSource, { frame, dt: FIXED_STEP_SECONDS });
}
