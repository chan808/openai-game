import { describe, expect, it } from 'vitest';

import {
  ARENA_WALL_THICKNESS,
  NORTHWEST_PILLAR_X,
  NORTHWEST_PILLAR_Y,
  PLAYER_RADIUS,
} from '../content/tuning';
import {
  circleIntersectsTerrain,
  getTerrainRayDistance,
  moveCircleAgainstTerrain,
  moveDestinationOutsideTerrain,
  segmentIntersectsTerrain,
} from './terrain';

describe('terrain', () => {
  it('keeps a moving circle inside the four arena walls', () => {
    const position = moveCircleAgainstTerrain(
      100,
      100,
      0,
      0,
      PLAYER_RADIUS,
    );

    expect(position).toEqual({
      x: ARENA_WALL_THICKNESS + PLAYER_RADIUS,
      y: ARENA_WALL_THICKNESS + PLAYER_RADIUS,
    });
  });

  it('blocks movement into a pillar while preserving tangential movement', () => {
    const startX = NORTHWEST_PILLAR_X - PLAYER_RADIUS;
    const startY = NORTHWEST_PILLAR_Y + 40;
    const position = moveCircleAgainstTerrain(
      startX,
      startY,
      startX + 10,
      startY + 10,
      PLAYER_RADIUS,
    );

    expect(position.x).toBeCloseTo(startX);
    expect(position.y).toBe(startY + 10);
  });

  it('lets teleport cross a pillar but prevents landing inside it', () => {
    const startX = NORTHWEST_PILLAR_X - 100;
    const y = NORTHWEST_PILLAR_Y + 50;
    const crossed = moveDestinationOutsideTerrain(
      startX,
      y,
      NORTHWEST_PILLAR_X + 100,
      y,
      PLAYER_RADIUS,
    );
    const blocked = moveDestinationOutsideTerrain(
      startX,
      y,
      NORTHWEST_PILLAR_X + 20,
      y,
      PLAYER_RADIUS,
    );

    expect(crossed.x).toBe(NORTHWEST_PILLAR_X + 100);
    expect(blocked.x).toBeCloseTo(NORTHWEST_PILLAR_X - PLAYER_RADIUS);
    expect(circleIntersectsTerrain(blocked.x, blocked.y, PLAYER_RADIUS)).toBe(
      false,
    );
  });

  it('returns the first wall or pillar distance along an attack ray', () => {
    const distance = getTerrainRayDistance(
      NORTHWEST_PILLAR_X - 100,
      NORTHWEST_PILLAR_Y + 50,
      1,
      0,
      500,
      0,
    );

    expect(distance).toBe(100);
  });

  it('detects a fast segment crossing a pillar', () => {
    expect(
      segmentIntersectsTerrain(
        NORTHWEST_PILLAR_X - 50,
        NORTHWEST_PILLAR_Y + 50,
        NORTHWEST_PILLAR_X + 100,
        NORTHWEST_PILLAR_Y + 50,
        5,
      ),
    ).toBe(true);
  });
});
