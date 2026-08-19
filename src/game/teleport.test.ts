import { describe, expect, it } from 'vitest';

import {
  ARENA_WIDTH,
  ARENA_WALL_THICKNESS,
  PLAYER_RADIUS,
  TELEPORT_COOLDOWN_FRAMES,
  TELEPORT_ECHO_DURATION_FRAMES,
  TELEPORT_ECHO_ULTIMATE_CHARGE,
  TELEPORT_MAX_DISTANCE,
  SWORDSMAN_RADIUS,
  ULTIMATE_MAX_CHARGE,
} from '../content/tuning';
import { createInitialGameState } from './GameState';
import {
  consumeTeleportEcho,
  getTeleportDestination,
  tickTeleportCooldown,
  tryTeleport,
} from './teleport';

describe('teleport', () => {
  it('caps the destination by range and arena bounds', () => {
    const rangedDestination = getTeleportDestination(
      100,
      100,
      ARENA_WIDTH,
      100,
      [{ x: 700, y: 400, radius: SWORDSMAN_RADIUS }],
    );
    const boundedDestination = getTeleportDestination(
      ARENA_WIDTH - 100,
      100,
      ARENA_WIDTH * 2,
      100,
      [{ x: 700, y: 400, radius: SWORDSMAN_RADIUS }],
    );

    expect(rangedDestination.x).toBe(100 + TELEPORT_MAX_DISTANCE);
    expect(rangedDestination.y).toBe(100);
    expect(boundedDestination.x).toBe(
      ARENA_WIDTH - ARENA_WALL_THICKNESS - PLAYER_RADIUS,
    );
  });

  it('places the player before a living swordsman when the destination overlaps it', () => {
    const destination = getTeleportDestination(
      240,
      270,
      400,
      270,
      [{ x: 400, y: 270, radius: SWORDSMAN_RADIUS }],
    );

    expect(destination.x).toBe(400 - PLAYER_RADIUS - SWORDSMAN_RADIUS);
    expect(destination.y).toBe(270);
  });

  it('requires a ready cooldown', () => {
    const state = createInitialGameState();
    state.teleport.destinationX = state.player.x + 100;

    expect(tryTeleport(state, true)).toBe(true);
    expect(state.teleport.cooldownFramesRemaining).toBe(
      TELEPORT_COOLDOWN_FRAMES,
    );
    expect(state.teleport.echo).toEqual({
      x: state.player.x - 100,
      y: state.player.y,
      framesRemaining: TELEPORT_ECHO_DURATION_FRAMES,
    });

    state.teleport.destinationX = state.player.x + 100;
    expect(tryTeleport(state, true)).toBe(false);

    tickTeleportCooldown(state);
    expect(state.teleport.cooldownFramesRemaining).toBe(
      TELEPORT_COOLDOWN_FRAMES - 1,
    );

  });

  it('charges the ultimate once when the active echo is consumed', () => {
    const state = createInitialGameState();
    state.teleport.echo.framesRemaining = TELEPORT_ECHO_DURATION_FRAMES;

    expect(consumeTeleportEcho(state)).toBe(true);
    expect(state.ultimate.charge.current).toBe(
      TELEPORT_ECHO_ULTIMATE_CHARGE,
    );
    expect(state.teleport.echo.framesRemaining).toBe(0);
    expect(consumeTeleportEcho(state)).toBe(false);
    expect(state.ultimate.charge.current).toBe(
      TELEPORT_ECHO_ULTIMATE_CHARGE,
    );

    state.teleport.echo.framesRemaining = 1;
    state.ultimate.charge.current = ULTIMATE_MAX_CHARGE - 1;
    consumeTeleportEcho(state);

    expect(state.ultimate.charge.current).toBe(ULTIMATE_MAX_CHARGE);
  });
});
