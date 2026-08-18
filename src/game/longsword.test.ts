import { describe, expect, it } from 'vitest';

import {
  LONGSWORD_ACTIVE_FRAMES,
  LONGSWORD_BLADE_RADIUS,
  LONGSWORD_REACH,
  LONGSWORD_SWING_RADIANS,
  SWORDSMAN_RADIUS,
} from '../content/tuning';
import type { LongswordAttackState } from './GameState';
import {
  getLongswordSwingDirection,
  longswordIntersectsCircle,
} from './longsword';

describe('longsword', () => {
  it('sweeps across the configured arc around the locked aim', () => {
    const attack = createAttack(LONGSWORD_ACTIVE_FRAMES);
    const start = getLongswordSwingDirection(attack);

    attack.activeFramesRemaining = 1;
    const end = getLongswordSwingDirection(attack);

    expect(Math.atan2(start.y, start.x)).toBeCloseTo(
      -LONGSWORD_SWING_RADIANS / 2,
    );
    expect(Math.atan2(end.y, end.x)).toBeCloseTo(
      LONGSWORD_SWING_RADIANS / 2,
    );
  });

  it('uses the visible blade segment for collision', () => {
    const middleFrame = (LONGSWORD_ACTIVE_FRAMES + 1) / 2;
    const attack = createAttack(middleFrame);
    const furthestHit =
      LONGSWORD_REACH + SWORDSMAN_RADIUS + LONGSWORD_BLADE_RADIUS;

    expect(
      longswordIntersectsCircle(
        0,
        0,
        attack,
        furthestHit,
        0,
        SWORDSMAN_RADIUS,
      ),
    ).toBe(true);
    expect(
      longswordIntersectsCircle(
        0,
        0,
        attack,
        furthestHit + 0.1,
        0,
        SWORDSMAN_RADIUS,
      ),
    ).toBe(false);
  });
});

function createAttack(
  activeFramesRemaining: number,
): LongswordAttackState {
  return {
    activeFramesRemaining,
    cooldownFramesRemaining: 0,
    hitEnemyIds: [],
    aimX: 1,
    aimY: 0,
  };
}
