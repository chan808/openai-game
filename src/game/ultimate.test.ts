import { describe, expect, it } from 'vitest';

import {
  ULTIMATE_MAX_CHARGE,
  ULTIMATE_RECORD_FRAMES,
  ULTIMATE_REPLAY_SPEED,
} from '../content/tuning';
import { createInitialGameState } from './GameState';
import {
  finishUltimateRecording,
  getUltimateReplayFrame,
  recordUltimateFrame,
  recordUltimateHit,
  tickUltimateReplay,
  tryActivateUltimate,
} from './ultimate';

describe('ultimate', () => {
  it('requires a full charge and consumes it on activation', () => {
    const state = createInitialGameState();
    state.ultimate.charge.current = ULTIMATE_MAX_CHARGE - 1;

    expect(tryActivateUltimate(state, true)).toBe(false);
    expect(state.ultimate.phase).toBe('inactive');

    state.ultimate.charge.current = ULTIMATE_MAX_CHARGE;

    expect(tryActivateUltimate(state, true)).toBe(true);
    expect(state.ultimate.charge.current).toBe(0);
    expect(state.ultimate.phase).toBe('recording');
    expect(state.ultimate.phaseFramesRemaining).toBe(
      ULTIMATE_RECORD_FRAMES,
    );
  });

  it('compresses the recorded path into the replay window', () => {
    const state = createInitialGameState();
    state.ultimate.charge.current = ULTIMATE_MAX_CHARGE;
    tryActivateUltimate(state, true);
    for (let frame = 0; frame < 10; frame += 1) {
      state.player.x = 100 + frame * 40;
      state.longswordAttack.activeFramesRemaining = frame === 9 ? 1 : 0;
      recordUltimateFrame(state);
    }

    finishUltimateRecording(state);

    expect(state.ultimate.phase).toBe('replaying');
    expect(state.ultimate.phaseFramesRemaining).toBe(
      Math.ceil(10 / ULTIMATE_REPLAY_SPEED),
    );
    expect(getUltimateReplayFrame(state)?.x).toBe(100);

    state.ultimate.phaseFramesRemaining = 1;

    expect(getUltimateReplayFrame(state)).toMatchObject({
      x: 460,
      longswordActive: true,
    });

    tickUltimateReplay(state);

    expect(state.ultimate.phase).toBe('inactive');
    expect(state.ultimate.recordedFrames).toHaveLength(0);
  });

  it('keeps an unfinished recorded projectile for normal time after replay', () => {
    const state = createInitialGameState();
    state.ultimate.charge.current = ULTIMATE_MAX_CHARGE;
    tryActivateUltimate(state, true);
    state.projectiles.push({
      id: 99,
      owner: 'player',
      kind: 'arrow',
      timeDomain: 'ultimate',
      x: 300,
      y: 200,
      velocityX: 100,
      velocityY: 0,
      framesRemaining: 20,
    });
    recordUltimateFrame(state);

    finishUltimateRecording(state);

    expect(state.projectiles).toHaveLength(0);
    expect(state.ultimate.pendingProjectiles).toHaveLength(1);

    tickUltimateReplay(state);

    expect(state.ultimate.phase).toBe('inactive');
    expect(state.projectiles).toEqual([
      expect.objectContaining({ id: 99, timeDomain: 'world' }),
    ]);
  });

  it('applies the last recorded hit while its replay frame is visible', () => {
    const state = createInitialGameState();
    const enemy = state.enemies[0]!;
    state.ultimate.charge.current = ULTIMATE_MAX_CHARGE;
    tryActivateUltimate(state, true);
    for (let frame = 0; frame < 9; frame += 1) {
      recordUltimateFrame(state);
    }
    recordUltimateHit(state, enemy.id, 20);
    recordUltimateFrame(state);
    finishUltimateRecording(state);

    tickUltimateReplay(state);

    expect(state.ultimate.phase).toBe('replaying');
    expect(state.ultimate.phaseFramesRemaining).toBe(1);
    expect(getUltimateReplayFrame(state)).toBe(
      state.ultimate.recordedFrames.at(-1),
    );
    expect(enemy.health.current).toBe(enemy.health.maximum - 20);
  });
});
