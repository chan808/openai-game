import Phaser from 'phaser';

import type {
  InputFrame,
  InputSource,
  WeaponSlotId,
} from '../core/InputSource';

interface Position {
  x: number;
  y: number;
}

export const WEAPON_SLOT_HINT = '1 longsword | 2 bow | 3 magic';

export class PhaserInputSource implements InputSource {
  private readonly up: Phaser.Input.Keyboard.Key;
  private readonly down: Phaser.Input.Keyboard.Key;
  private readonly left: Phaser.Input.Keyboard.Key;
  private readonly right: Phaser.Input.Keyboard.Key;
  private readonly weapon1: Phaser.Input.Keyboard.Key;
  private readonly weapon2: Phaser.Input.Keyboard.Key;
  private readonly weapon3: Phaser.Input.Keyboard.Key;
  private primaryLatched = false;
  private weaponSlotLatched: WeaponSlotId | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (keyboard === null) {
      throw new Error('Keyboard input is unavailable.');
    }

    this.up = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.down = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.left = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.right = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.weapon1 = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
    this.weapon2 = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
    this.weapon3 = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);

    scene.input.on('pointerdown', this.onPointerDown, this);
    this.weapon1.on('down', this.onWeapon1Down, this);
    this.weapon2.on('down', this.onWeapon2Down, this);
    this.weapon3.on('down', this.onWeapon3Down, this);
  }

  sample(): InputFrame {
    const move = normalize(
      Number(this.right.isDown) - Number(this.left.isDown),
      Number(this.down.isDown) - Number(this.up.isDown),
    );
    const pointer = this.scene.input.activePointer;
    const primaryPressed = this.primaryLatched;
    const weaponSlotPressed = this.weaponSlotLatched;

    this.primaryLatched = false;
    this.weaponSlotLatched = null;

    return {
      moveX: move.x,
      moveY: move.y,
      aimTargetX: pointer.worldX,
      aimTargetY: pointer.worldY,
      primaryPressed,
      weaponSlotPressed,
    };
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.weapon1.off('down', this.onWeapon1Down, this);
    this.weapon2.off('down', this.onWeapon2Down, this);
    this.weapon3.off('down', this.onWeapon3Down, this);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.leftButtonDown()) {
      this.primaryLatched = true;
    }
  }

  private onWeapon1Down(): void {
    this.weaponSlotLatched = 0;
  }

  private onWeapon2Down(): void {
    this.weaponSlotLatched = 1;
  }

  private onWeapon3Down(): void {
    this.weaponSlotLatched = 2;
  }
}

function normalize(x: number, y: number): Position {
  const length = Math.hypot(x, y);
  if (length === 0) {
    return { x: 0, y: 0 };
  }

  return { x: x / length, y: y / length };
}
