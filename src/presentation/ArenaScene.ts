import Phaser from 'phaser';

import { GameClock } from '../core/GameClock';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BOW_PROJECTILE_RADIUS,
  DUMMY_RADIUS,
  LONGSWORD_REACH,
  LONGSWORD_SWING_RADIANS,
  MAGIC_PROJECTILE_RADIUS,
  PLAYER_RADIUS,
  SLOW_WORLD_TIME_SCALE,
} from '../content/tuning';
import {
  createInitialGameState,
  type ProjectileState,
  type ResourceState,
} from '../game/GameState';
import {
  getLongswordSwingAngle,
  getLongswordSwingDirection,
} from '../game/longsword';
import { updateGame } from '../game/updateGame';
import {
  PhaserInputSource,
  SLOW_HINT,
  WEAPON_SLOT_HINT,
} from './PhaserInputSource';

const PLAYER_COLOR = 0x4f7cff;
const DUMMY_COLOR = 0xd65f5f;
const DUMMY_HIT_COLOR = 0xffffff;
const AIM_COLOR = 0xdde6ff;
const LONGSWORD_COLOR = 0x8ec5ff;
const ARROW_COLOR = 0xffd166;
const MAGIC_COLOR = 0x75f4c1;
const ARENA_BORDER_COLOR = 0x34405a;
const SLOW_COLOR = 0x8a9dff;
const RESOURCE_BACKGROUND_COLOR = 0x151a26;
const HEALTH_COLOR = 0x65d17a;
const MANA_COLOR = 0x598cff;
const RESOURCE_BAR_WIDTH = 180;
const RESOURCE_BAR_HEIGHT = 12;

export class ArenaScene extends Phaser.Scene {
  private readonly clock = new GameClock();
  private readonly state = createInitialGameState();
  private graphics!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;
  private inputSource!: PhaserInputSource;

  constructor() {
    super('arena');
  }

  create(): void {
    this.graphics = this.add.graphics();
    this.statusText = this.add.text(16, 58, '', {
      color: '#ffffff',
      fontFamily: 'monospace',
      fontSize: '18px',
    });
    this.inputSource = new PhaserInputSource(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.inputSource.destroy();
    });

    this.renderState();
  }

  update(_time: number, delta: number): void {
    this.clock.advance(delta, (step) => {
      updateGame(this.state, this.inputSource, step);
    });
    this.renderState();
  }

  private renderState(): void {
    const {
      player,
      dummy,
      selectedWeapon,
      longswordAttack,
      projectiles,
      slow,
    } = this.state;

    this.graphics.clear();
    if (slow.active) {
      this.graphics.fillStyle(SLOW_COLOR, 0.1);
      this.graphics.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    }
    this.graphics.lineStyle(
      2,
      slow.active ? SLOW_COLOR : ARENA_BORDER_COLOR,
      1,
    );
    this.graphics.strokeRect(1, 1, ARENA_WIDTH - 2, ARENA_HEIGHT - 2);

    if (longswordAttack.activeFramesRemaining > 0) {
      const aimAngle = Math.atan2(
        longswordAttack.aimY,
        longswordAttack.aimX,
      );
      const swingAngle = getLongswordSwingAngle(longswordAttack);
      const swingDirection = getLongswordSwingDirection(longswordAttack);

      this.graphics.fillStyle(LONGSWORD_COLOR, 0.18);
      this.graphics.beginPath();
      this.graphics.moveTo(player.x, player.y);
      this.graphics.arc(
        player.x,
        player.y,
        LONGSWORD_REACH,
        aimAngle - LONGSWORD_SWING_RADIANS / 2,
        swingAngle,
      );
      this.graphics.closePath();
      this.graphics.fillPath();

      this.graphics.lineStyle(5, LONGSWORD_COLOR, 1);
      this.graphics.lineBetween(
        player.x + swingDirection.x * PLAYER_RADIUS,
        player.y + swingDirection.y * PLAYER_RADIUS,
        player.x + swingDirection.x * LONGSWORD_REACH,
        player.y + swingDirection.y * LONGSWORD_REACH,
      );
    }

    for (const projectile of projectiles) {
      this.renderProjectile(projectile);
    }

    this.graphics.fillStyle(
      dummy.hitFlashFramesRemaining > 0 ? DUMMY_HIT_COLOR : DUMMY_COLOR,
      1,
    );
    this.graphics.fillCircle(dummy.x, dummy.y, DUMMY_RADIUS);

    this.graphics.fillStyle(PLAYER_COLOR, 1);
    this.graphics.fillCircle(player.x, player.y, PLAYER_RADIUS);

    const displayedAim =
      longswordAttack.activeFramesRemaining > 0
        ? longswordAttack
        : player;
    this.graphics.lineStyle(3, AIM_COLOR, 1);
    this.graphics.lineBetween(
      player.x,
      player.y,
      player.x + displayedAim.aimX * (PLAYER_RADIUS + 28),
      player.y + displayedAim.aimY * (PLAYER_RADIUS + 28),
    );

    this.renderResourceBar(16, 16, player.health, HEALTH_COLOR);
    this.renderResourceBar(16, 36, player.mana, MANA_COLOR);

    this.statusText.setText(
      `HP ${formatResource(player.health)} | MP ${formatResource(player.mana)}\n` +
        `weapon: ${selectedWeapon}\n${WEAPON_SLOT_HINT}\n${SLOW_HINT}\n` +
        `time: ${slow.active ? `SLOW x${SLOW_WORLD_TIME_SCALE}` : 'normal'}\n` +
        `hitCount: ${dummy.hitCount}`,
    );
  }

  private renderResourceBar(
    x: number,
    y: number,
    resource: ResourceState,
    color: number,
  ): void {
    const ratio = resource.current / resource.maximum;

    this.graphics.fillStyle(RESOURCE_BACKGROUND_COLOR, 0.9);
    this.graphics.fillRect(x, y, RESOURCE_BAR_WIDTH, RESOURCE_BAR_HEIGHT);
    this.graphics.fillStyle(color, 1);
    this.graphics.fillRect(
      x,
      y,
      RESOURCE_BAR_WIDTH * ratio,
      RESOURCE_BAR_HEIGHT,
    );
    this.graphics.lineStyle(1, 0xffffff, 0.5);
    this.graphics.strokeRect(x, y, RESOURCE_BAR_WIDTH, RESOURCE_BAR_HEIGHT);
  }

  private renderProjectile(projectile: ProjectileState): void {
    if (projectile.kind === 'arrow') {
      const speed = Math.hypot(
        projectile.velocityX,
        projectile.velocityY,
      );
      const directionX = projectile.velocityX / speed;
      const directionY = projectile.velocityY / speed;

      this.graphics.lineStyle(4, ARROW_COLOR, 1);
      this.graphics.lineBetween(
        projectile.x - directionX * 18,
        projectile.y - directionY * 18,
        projectile.x + directionX * 6,
        projectile.y + directionY * 6,
      );
      this.graphics.fillStyle(ARROW_COLOR, 1);
      this.graphics.fillCircle(
        projectile.x,
        projectile.y,
        BOW_PROJECTILE_RADIUS,
      );
      return;
    }

    this.graphics.fillStyle(MAGIC_COLOR, 0.35);
    this.graphics.fillCircle(
      projectile.x,
      projectile.y,
      MAGIC_PROJECTILE_RADIUS + 5,
    );
    this.graphics.fillStyle(MAGIC_COLOR, 1);
    this.graphics.fillCircle(
      projectile.x,
      projectile.y,
      MAGIC_PROJECTILE_RADIUS,
    );
  }
}

function formatResource(resource: ResourceState): string {
  return `${Math.ceil(resource.current)}/${resource.maximum}`;
}
