export type WeaponSlotId = 0 | 1 | 2;

export interface InputFrame {
  moveX: number;
  moveY: number;
  aimTargetX: number;
  aimTargetY: number;
  primaryPressed: boolean;
  teleportPressed: boolean;
  ultimatePressed: boolean;
  weaponSlotPressed: WeaponSlotId | null;
}

export interface InputSource {
  sample(frame: number): InputFrame;
}
