import Phaser from 'phaser';

import type {
  InputFrame,
  InputSource,
  WeaponSlotId,
} from '../core/InputSource';
import {
  SKILL_SLOT_IDS,
  type PlaytestSkillId,
  type SkillBindings,
  type SkillSlotId,
} from './SkillBindings';

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
  private readonly skillQ: Phaser.Input.Keyboard.Key;
  private readonly skillE: Phaser.Input.Keyboard.Key;
  private readonly skillR: Phaser.Input.Keyboard.Key;
  private readonly skillSpace: Phaser.Input.Keyboard.Key;
  private primaryLatched = false;
  private teleportLatched = false;
  private weaponSlotLatched: WeaponSlotId | null = null;
  private gameplayEnabled = true;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly skillBindings: SkillBindings,
  ) {
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
    this.skillQ = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.skillE = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.skillR = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.skillSpace = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    scene.input.mouse?.disableContextMenu();

    scene.input.on('pointerdown', this.onPointerDown, this);
    this.weapon1.on('down', this.onWeapon1Down, this);
    this.weapon2.on('down', this.onWeapon2Down, this);
    this.weapon3.on('down', this.onWeapon3Down, this);
    this.skillQ.on('down', this.onSkillQDown, this);
    this.skillE.on('down', this.onSkillEDown, this);
    this.skillR.on('down', this.onSkillRDown, this);
    this.skillSpace.on('down', this.onSkillSpaceDown, this);
  }

  sample(): InputFrame {
    const pointer = this.scene.input.activePointer;
    const move = this.gameplayEnabled
      ? normalize(
          Number(this.right.isDown) - Number(this.left.isDown),
          Number(this.down.isDown) - Number(this.up.isDown),
        )
      : { x: 0, y: 0 };
    const primaryPressed = this.gameplayEnabled && this.primaryLatched;
    const teleportPressed = this.gameplayEnabled && this.teleportLatched;
    const weaponSlotPressed = this.gameplayEnabled
      ? this.weaponSlotLatched
      : null;

    this.primaryLatched = false;
    this.teleportLatched = false;
    this.weaponSlotLatched = null;

    return {
      moveX: move.x,
      moveY: move.y,
      aimTargetX: pointer.worldX,
      aimTargetY: pointer.worldY,
      primaryPressed,
      slowHeld:
        this.gameplayEnabled && this.skillIsHeld('slow'),
      teleportPressed,
      weaponSlotPressed,
    };
  }

  setGameplayEnabled(enabled: boolean): void {
    this.gameplayEnabled = enabled;
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.weapon1.off('down', this.onWeapon1Down, this);
    this.weapon2.off('down', this.onWeapon2Down, this);
    this.weapon3.off('down', this.onWeapon3Down, this);
    this.skillQ.off('down', this.onSkillQDown, this);
    this.skillE.off('down', this.onSkillEDown, this);
    this.skillR.off('down', this.onSkillRDown, this);
    this.skillSpace.off('down', this.onSkillSpaceDown, this);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.gameplayEnabled) {
      return;
    }
    if (pointer.leftButtonDown()) {
      this.primaryLatched = true;
    }
    if (pointer.rightButtonDown()) {
      this.activateSkillSlot('mouseRight');
    }
  }

  private onWeapon1Down(): void {
    if (this.gameplayEnabled) {
      this.weaponSlotLatched = 0;
    }
  }

  private onWeapon2Down(): void {
    if (this.gameplayEnabled) {
      this.weaponSlotLatched = 1;
    }
  }

  private onWeapon3Down(): void {
    if (this.gameplayEnabled) {
      this.weaponSlotLatched = 2;
    }
  }

  private onSkillQDown(): void {
    this.activateSkillSlot('q');
  }

  private onSkillEDown(): void {
    this.activateSkillSlot('e');
  }

  private onSkillRDown(): void {
    this.activateSkillSlot('r');
  }

  private onSkillSpaceDown(): void {
    this.activateSkillSlot('space');
  }

  private activateSkillSlot(slotId: SkillSlotId): void {
    if (
      this.gameplayEnabled &&
      this.skillBindings.getSkill(slotId) === 'teleport'
    ) {
      this.teleportLatched = true;
    }
  }

  private skillIsHeld(skillId: PlaytestSkillId): boolean {
    return SKILL_SLOT_IDS.some(
      (slotId) =>
        this.skillBindings.getSkill(slotId) === skillId &&
        this.slotIsHeld(slotId),
    );
  }

  private slotIsHeld(slotId: SkillSlotId): boolean {
    switch (slotId) {
      case 'q':
        return this.skillQ.isDown;
      case 'e':
        return this.skillE.isDown;
      case 'r':
        return this.skillR.isDown;
      case 'space':
        return this.skillSpace.isDown;
      case 'mouseRight':
        return this.scene.input.activePointer.rightButtonDown();
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
