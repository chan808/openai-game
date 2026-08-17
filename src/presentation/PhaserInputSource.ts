import Phaser from 'phaser';

import type { InputFrame, InputSource } from '../core/InputSource';

interface Position {
  x: number;
  y: number;
}

export class PhaserInputSource implements InputSource {
  private readonly up: Phaser.Input.Keyboard.Key;
  private readonly down: Phaser.Input.Keyboard.Key;
  private readonly left: Phaser.Input.Keyboard.Key;
  private readonly right: Phaser.Input.Keyboard.Key;
  private primaryLatched = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly getPlayerPosition: () => Position,
  ) {
    const keyboard = scene.input.keyboard;
    if (keyboard === null) {
      throw new Error('Keyboard input is unavailable.');
    }

    this.up = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.down = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.left = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.right = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);

    scene.input.on('pointerdown', this.onPointerDown, this);
  }

  sample(): InputFrame {
    const move = normalize(
      Number(this.right.isDown) - Number(this.left.isDown),
      Number(this.down.isDown) - Number(this.up.isDown),
    );
    const player = this.getPlayerPosition();
    const pointer = this.scene.input.activePointer;
    const aim = normalize(pointer.worldX - player.x, pointer.worldY - player.y);
    const primaryPressed = this.primaryLatched;

    this.primaryLatched = false;

    return {
      moveX: move.x,
      moveY: move.y,
      aimX: aim.x,
      aimY: aim.y,
      primaryPressed,
    };
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.leftButtonDown()) {
      this.primaryLatched = true;
    }
  }
}

function normalize(x: number, y: number): Position {
  const length = Math.hypot(x, y);
  if (length === 0) {
    return { x: 0, y: 0 };
  }

  return { x: x / length, y: y / length };
}
