import { describe, expect, it } from 'vitest';

import { SWORDSMAN_RADIUS } from '../content/tuning';
import { circleIntersectsTerrain } from './terrain';
import { moveCircleTowardTarget } from './navigation';

describe('enemy navigation', () => {
  it('uses the arena corridor to move around a blocking pillar', () => {
    let position = { x: 614, y: 324 };

    for (let step = 0; step < 240; step += 1) {
      position = moveCircleTowardTarget(
        position.x,
        position.y,
        300,
        400,
        2,
        SWORDSMAN_RADIUS,
      );
      expect(
        circleIntersectsTerrain(
          position.x,
          position.y,
          SWORDSMAN_RADIUS,
        ),
      ).toBe(false);
    }

    expect(position.x).toBeCloseTo(300);
    expect(position.y).toBeCloseTo(400);
  });
});
