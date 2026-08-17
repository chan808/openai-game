import Phaser from 'phaser';

import { GameClock } from '../core/GameClock';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  ATTACK_ARC_RADIANS,
  ATTACK_RANGE,
  DUMMY_RADIUS,
  PLAYER_RADIUS,
} from '../content/tuning';
import { createInitialGameState } from '../game/GameState';
import { updateGame } from '../game/updateGame';
import { PhaserInputSource } from './PhaserInputSource';

const PLAYER_COLOR = 0x4f7cff;
const DUMMY_COLOR = 0xd65f5f;
const DUMMY_HIT_COLOR = 0xffffff;
const AIM_COLOR = 0xdde6ff;
const ATTACK_COLOR = 0x6fb2ff;
const ARENA_BORDER_COLOR = 0x34405a;

export class ArenaScene extends Phaser.Scene {
  private readonly clock = new GameClock();
  private readonly state = createInitialGameState();
  private graphics!: Phaser.GameObjects.Graphics;
  private hitCountText!: Phaser.GameObjects.Text;
  private inputSource!: PhaserInputSource;

  constructor() {
    super('arena');
  }

  create(): void {
    this.graphics = this.add.graphics();
    this.hitCountText = this.add.text(16, 16, '', {
      color: '#ffffff',
      fontFamily: 'monospace',
      fontSize: '18px',
    });
    this.inputSource = new PhaserInputSource(this, () => this.state.player);
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
    const { player, dummy, attack } = this.state;

    this.graphics.clear();
    this.graphics.lineStyle(2, ARENA_BORDER_COLOR, 1);
    this.graphics.strokeRect(1, 1, ARENA_WIDTH - 2, ARENA_HEIGHT - 2);

    if (attack.activeFramesRemaining > 0) {
      const aimAngle = Math.atan2(player.aimY, player.aimX);
      this.graphics.fillStyle(ATTACK_COLOR, 0.24);
      this.graphics.lineStyle(2, ATTACK_COLOR, 0.8);
      this.graphics.beginPath();
      this.graphics.moveTo(player.x, player.y);
      this.graphics.arc(
        player.x,
        player.y,
        ATTACK_RANGE,
        aimAngle - ATTACK_ARC_RADIANS / 2,
        aimAngle + ATTACK_ARC_RADIANS / 2,
      );
      this.graphics.closePath();
      this.graphics.fillPath();
      this.graphics.strokePath();
    }

    this.graphics.fillStyle(
      dummy.hitFlashFramesRemaining > 0 ? DUMMY_HIT_COLOR : DUMMY_COLOR,
      1,
    );
    this.graphics.fillCircle(dummy.x, dummy.y, DUMMY_RADIUS);

    this.graphics.fillStyle(PLAYER_COLOR, 1);
    this.graphics.fillCircle(player.x, player.y, PLAYER_RADIUS);

    this.graphics.lineStyle(3, AIM_COLOR, 1);
    this.graphics.lineBetween(
      player.x,
      player.y,
      player.x + player.aimX * (PLAYER_RADIUS + 28),
      player.y + player.aimY * (PLAYER_RADIUS + 28),
    );

    this.hitCountText.setText(`hitCount: ${dummy.hitCount}`);
  }
}
