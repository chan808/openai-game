import Phaser from 'phaser';

import { ARENA_WIDTH } from '../content/tuning';
import { FIXED_STEP_SECONDS } from '../core/GameClock';
import {
  PLAYTEST_SKILL_LABELS,
  SKILL_SLOT_IDS,
  SKILL_SLOT_LABELS,
  type PlaytestSkillId,
  type SkillBindings,
  type SkillSlotId,
} from './SkillBindings';
import type { PhaserInputSource } from './PhaserInputSource';

const PLAYTEST_SKILLS: PlaytestSkillId[] = ['slow', 'teleport'];
const SLOT_WIDTH = 116;
const SLOT_HEIGHT = 54;
const SLOT_GAP = 8;
const SLOT_Y = 503;
const EMPTY_SLOT_COLOR = 0x20283a;
const SLOW_SLOT_COLOR = 0x4d5f9f;
const TELEPORT_SLOT_COLOR = 0x52648f;
const ACTIVE_SLOT_COLOR = 0x7188e8;
const WINDOW_DEPTH = 100;

interface SlotView {
  rectangle: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
}

type WindowObject =
  | Phaser.GameObjects.Container
  | Phaser.GameObjects.Rectangle
  | Phaser.GameObjects.Text;

export class SkillLoadoutUi {
  private readonly tabKey: Phaser.Input.Keyboard.Key;
  private readonly slotViews = new Map<SkillSlotId, SlotView>();
  private readonly windowObjects: WindowObject[] = [];
  private open = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly skillBindings: SkillBindings,
    private readonly inputSource: PhaserInputSource,
  ) {
    const keyboard = scene.input.keyboard;
    if (keyboard === null) {
      throw new Error('Keyboard input is unavailable.');
    }

    this.tabKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.tabKey.on('down', this.toggle, this);
    this.createSkillBar();
    this.createSkillWindow();

    scene.input.on('drag', this.onDrag, this);
    scene.input.on('drop', this.onDrop, this);
    scene.input.on('dragend', this.onDragEnd, this);
  }

  render(slowActive: boolean, teleportCooldownFrames: number): void {
    for (const slotId of SKILL_SLOT_IDS) {
      const view = this.slotViews.get(slotId)!;
      const skillId = this.skillBindings.getSkill(slotId);
      const skillStatus = formatSkillStatus(
        skillId,
        slowActive,
        teleportCooldownFrames,
      );

      view.text.setText(
        `${SKILL_SLOT_LABELS[slotId]}\n${skillStatus.label}`,
      );
      view.rectangle.setFillStyle(skillStatus.color, 0.94);
    }
  }

  isOpen(): boolean {
    return this.open;
  }

  destroy(): void {
    this.tabKey.off('down', this.toggle, this);
    this.scene.input.off('drag', this.onDrag, this);
    this.scene.input.off('drop', this.onDrop, this);
    this.scene.input.off('dragend', this.onDragEnd, this);
  }

  private createSkillBar(): void {
    const totalWidth =
      SKILL_SLOT_IDS.length * SLOT_WIDTH +
      (SKILL_SLOT_IDS.length - 1) * SLOT_GAP;
    const startX = (ARENA_WIDTH - totalWidth) / 2 + SLOT_WIDTH / 2;

    this.scene.add
      .text(startX - SLOT_WIDTH / 2 - 12, SLOT_Y, 'TAB\nSKILLS', {
        align: 'right',
        color: '#aeb9d6',
        fontFamily: 'monospace',
        fontSize: '13px',
      })
      .setOrigin(1, 0.5)
      .setDepth(WINDOW_DEPTH);

    SKILL_SLOT_IDS.forEach((slotId, index) => {
      const x = startX + index * (SLOT_WIDTH + SLOT_GAP);
      const rectangle = this.scene.add
        .rectangle(x, SLOT_Y, SLOT_WIDTH, SLOT_HEIGHT, EMPTY_SLOT_COLOR, 0.94)
        .setStrokeStyle(2, 0x7d8aa8, 0.9)
        .setInteractive({ dropZone: true })
        .setDepth(WINDOW_DEPTH);
      rectangle.setData('skillSlotId', slotId);

      const text = this.scene.add
        .text(x, SLOT_Y, '', {
          align: 'center',
          color: '#ffffff',
          fontFamily: 'monospace',
          fontSize: '14px',
        })
        .setOrigin(0.5)
        .setDepth(WINDOW_DEPTH + 1);

      this.slotViews.set(slotId, { rectangle, text });
    });
  }

  private createSkillWindow(): void {
    const background = this.scene.add
      .rectangle(480, 270, 500, 270, 0x111827, 0.98)
      .setStrokeStyle(3, 0x8093c9, 1)
      .setInteractive()
      .setDepth(WINDOW_DEPTH + 10);
    const title = this.scene.add
      .text(480, 170, 'SKILL LOADOUT', {
        color: '#ffffff',
        fontFamily: 'monospace',
        fontSize: '24px',
      })
      .setOrigin(0.5)
      .setDepth(WINDOW_DEPTH + 11);
    const instruction = this.scene.add
      .text(480, 205, 'Drag a skill onto Q / E / R / SPACE / RMB\nTAB: close', {
        align: 'center',
        color: '#b8c4df',
        fontFamily: 'monospace',
        fontSize: '14px',
      })
      .setOrigin(0.5)
      .setDepth(WINDOW_DEPTH + 11);

    this.windowObjects.push(background, title, instruction);

    PLAYTEST_SKILLS.forEach((skillId, index) => {
      const x = 370 + index * 220;
      const y = 290;
      const tileBackground = this.scene.add
        .rectangle(0, 0, 180, 82, skillColor(skillId), 1)
        .setStrokeStyle(2, 0xd9e2ff, 0.9);
      const tileTitle = this.scene.add
        .text(0, -14, PLAYTEST_SKILL_LABELS[skillId], {
          color: '#ffffff',
          fontFamily: 'monospace',
          fontSize: '18px',
        })
        .setOrigin(0.5);
      const tileDescription = this.scene.add
        .text(0, 15, skillDescription(skillId), {
          align: 'center',
          color: '#dbe4ff',
          fontFamily: 'monospace',
          fontSize: '11px',
        })
        .setOrigin(0.5);
      const tile = this.scene.add
        .container(x, y, [tileBackground, tileTitle, tileDescription])
        .setSize(180, 82)
        .setInteractive({ useHandCursor: true })
        .setDepth(WINDOW_DEPTH + 12);

      tile.setData('playtestSkillId', skillId);
      tile.setData('homeX', x);
      tile.setData('homeY', y);
      this.scene.input.setDraggable(tile);
      this.windowObjects.push(tile);
    });

    this.setWindowVisible(false);
  }

  private toggle(): void {
    this.open = !this.open;
    this.setWindowVisible(this.open);
    this.inputSource.setGameplayEnabled(!this.open);
  }

  private setWindowVisible(visible: boolean): void {
    for (const object of this.windowObjects) {
      object.setVisible(visible);
    }
  }

  private onDrag(
    _pointer: Phaser.Input.Pointer,
    gameObject: Phaser.GameObjects.Container,
    dragX: number,
    dragY: number,
  ): void {
    gameObject.setPosition(dragX, dragY);
  }

  private onDrop(
    _pointer: Phaser.Input.Pointer,
    gameObject: Phaser.GameObjects.Container,
    dropZone: Phaser.GameObjects.GameObject,
  ): void {
    const skillId = gameObject.getData('playtestSkillId') as
      | PlaytestSkillId
      | undefined;
    const slotId = dropZone.getData('skillSlotId') as
      | SkillSlotId
      | undefined;

    if (skillId !== undefined && slotId !== undefined) {
      this.skillBindings.moveSkill(skillId, slotId);
    }

    this.returnTileHome(gameObject);
  }

  private onDragEnd(
    _pointer: Phaser.Input.Pointer,
    gameObject: Phaser.GameObjects.Container,
  ): void {
    this.returnTileHome(gameObject);
  }

  private returnTileHome(gameObject: Phaser.GameObjects.Container): void {
    gameObject.setPosition(
      gameObject.getData('homeX') as number,
      gameObject.getData('homeY') as number,
    );
  }
}

function formatSkillStatus(
  skillId: PlaytestSkillId | null,
  slowActive: boolean,
  teleportCooldownFrames: number,
): { color: number; label: string } {
  if (skillId === null) {
    return { color: EMPTY_SLOT_COLOR, label: 'EMPTY' };
  }
  if (skillId === 'slow') {
    return {
      color: slowActive ? ACTIVE_SLOT_COLOR : SLOW_SLOT_COLOR,
      label: PLAYTEST_SKILL_LABELS.slow,
    };
  }
  if (teleportCooldownFrames === 0) {
    return {
      color: ACTIVE_SLOT_COLOR,
      label: PLAYTEST_SKILL_LABELS.teleport,
    };
  }
  return {
    color: TELEPORT_SLOT_COLOR,
    label: `TELEPORT ${(teleportCooldownFrames * FIXED_STEP_SECONDS).toFixed(1)}s`,
  };
}

function skillColor(skillId: PlaytestSkillId): number {
  return skillId === 'slow' ? SLOW_SLOT_COLOR : TELEPORT_SLOT_COLOR;
}

function skillDescription(skillId: PlaytestSkillId): string {
  return skillId === 'slow'
    ? 'Hold to slow world time'
    : 'Blink toward the cursor';
}
