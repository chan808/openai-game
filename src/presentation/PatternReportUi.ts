import Phaser from 'phaser';

import { ARENA_HEIGHT, ARENA_WIDTH } from '../content/tuning';
import type { PhaserInputSource } from './PhaserInputSource';

const REPORT_DEPTH = 1_000;
const PAPER_WIDTH = 600;
const PAPER_HEIGHT = 390;
const PAPER_COLOR = 0xf1e3bd;
const PAPER_EDGE_COLOR = 0x67563f;
const INK_COLOR = '#29241e';
const MARK_COLOR = 0xb33a32;

export class PatternReportUi {
  private readonly previewKey: Phaser.Input.Keyboard.Key;
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly paper: Phaser.GameObjects.Container;
  private open = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly inputSource: PhaserInputSource,
    private readonly canOpen: () => boolean,
  ) {
    const keyboard = scene.input.keyboard;
    if (keyboard === null) {
      throw new Error('Keyboard input is unavailable.');
    }

    this.previewKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.previewKey.on('down', this.show, this);

    this.backdrop = scene.add
      .rectangle(
        ARENA_WIDTH / 2,
        ARENA_HEIGHT / 2,
        ARENA_WIDTH,
        ARENA_HEIGHT,
        0x090b11,
        0.76,
      )
      .setInteractive()
      .setDepth(REPORT_DEPTH)
      .setVisible(false);
    this.paper = this.createPaper();
  }

  isOpen(): boolean {
    return this.open;
  }

  destroy(): void {
    this.previewKey.off('down', this.show, this);
    this.scene.tweens.killTweensOf(this.backdrop);
    this.scene.tweens.killTweensOf(this.paper);
    if (this.open && this.scene.input.keyboard !== null) {
      this.scene.input.keyboard.enabled = true;
      this.inputSource.setGameplayEnabled(true);
    }
    this.backdrop.destroy();
    this.paper.destroy(true);
  }

  private createPaper(): Phaser.GameObjects.Container {
    const shadow = this.scene.add.rectangle(
      10,
      12,
      PAPER_WIDTH,
      PAPER_HEIGHT,
      0x000000,
      0.3,
    );
    const sheet = this.scene.add
      .rectangle(0, 0, PAPER_WIDTH, PAPER_HEIGHT, PAPER_COLOR, 1)
      .setStrokeStyle(4, PAPER_EDGE_COLOR, 1);

    const mark = this.scene.add.graphics();
    mark.lineStyle(6, MARK_COLOR, 0.92);
    mark.strokeEllipse(0, 4, 430, 185);
    mark.lineStyle(3, MARK_COLOR, 0.58);
    mark.strokeEllipse(-5, 7, 442, 176);

    const pattern = this.scene.add
      .text(0, 0, '순간이동 후\n등 뒤에서 공격', {
        align: 'center',
        color: INK_COLOR,
        fontFamily: 'sans-serif',
        fontSize: '42px',
        fontStyle: 'bold',
        lineSpacing: 12,
      })
      .setOrigin(0.5)
      .setRotation(-0.025);

    const closeBackground = this.scene.add
      .rectangle(
        PAPER_WIDTH / 2 - 34,
        -PAPER_HEIGHT / 2 + 34,
        46,
        46,
        0x3b3025,
        0.12,
      )
      .setStrokeStyle(2, PAPER_EDGE_COLOR, 0.65)
      .setInteractive({ useHandCursor: true });
    const closeLabel = this.scene.add
      .text(
        PAPER_WIDTH / 2 - 34,
        -PAPER_HEIGHT / 2 + 32,
        'X',
        {
          color: '#3b3025',
          fontFamily: 'sans-serif',
          fontSize: '26px',
          fontStyle: 'bold',
        },
      )
      .setOrigin(0.5);

    closeBackground.on('pointerover', () => {
      closeBackground.setFillStyle(0xb33a32, 0.18);
    });
    closeBackground.on('pointerout', () => {
      closeBackground.setFillStyle(0x3b3025, 0.12);
    });
    closeBackground.on('pointerdown', this.close, this);

    return this.scene.add
      .container(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, [
        shadow,
        sheet,
        mark,
        pattern,
        closeBackground,
        closeLabel,
      ])
      .setDepth(REPORT_DEPTH + 1)
      .setVisible(false);
  }

  private show(): void {
    if (this.open || !this.canOpen()) {
      return;
    }

    this.open = true;
    this.inputSource.setGameplayEnabled(false);
    if (this.scene.input.keyboard !== null) {
      this.scene.input.keyboard.enabled = false;
    }

    this.backdrop.setVisible(true).setAlpha(0);
    this.paper
      .setVisible(true)
      .setPosition(ARENA_WIDTH + 150, 52)
      .setScale(0.18)
      .setRotation(0.4)
      .setAlpha(0.35);

    this.scene.tweens.add({
      targets: this.backdrop,
      alpha: 1,
      duration: 180,
      ease: 'Quad.Out',
    });
    this.scene.tweens.add({
      targets: this.paper,
      x: ARENA_WIDTH / 2,
      y: ARENA_HEIGHT / 2,
      scaleX: 1,
      scaleY: 1,
      rotation: -0.018,
      alpha: 1,
      duration: 420,
      ease: 'Cubic.Out',
    });
  }

  private close(): void {
    if (!this.open) {
      return;
    }

    this.open = false;
    this.scene.tweens.killTweensOf(this.backdrop);
    this.scene.tweens.killTweensOf(this.paper);
    this.backdrop.setVisible(false);
    this.paper.setVisible(false);
    if (this.scene.input.keyboard !== null) {
      this.scene.input.keyboard.enabled = true;
    }
    this.inputSource.setGameplayEnabled(true);
  }
}
