export interface InputFrame {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  primaryPressed: boolean;
}

export interface InputSource {
  sample(frame: number): InputFrame;
}
