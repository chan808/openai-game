import Phaser from 'phaser';

import {
  ARENA_WIDTH,
  ULTIMATE_RECORD_FRAMES,
  ULTIMATE_REPLAY_SPEED,
} from '../content/tuning';
import { FIXED_STEP_SECONDS } from '../core/GameClock';
import type { UltimatePhase } from '../game/GameState';
import {
  PLAYTEST_SKILL_LABELS,
  SKILL_SLOT_IDS,
  SKILL_SLOT_LABELS,
  type PlaytestSkillId,
  type SkillBindings,
  type SkillSlotId,
} from './SkillBindings';
import type { PhaserInputSource } from './PhaserInputSource';
import { VISUAL_PALETTE } from './visualTheme';

const PLAYTEST_SKILLS: PlaytestSkillId[] = ['teleport', 'ultimate'];
const SLOT_WIDTH = 116;
const SLOT_HEIGHT = 54;
const SLOT_GAP = 8;
const SLOT_Y = 503;
const EMPTY_SLOT_COLOR = VISUAL_PALETTE.softInk;
const TELEPORT_SLOT_COLOR = 0x4d5680;
const ULTIMATE_SLOT_COLOR = 0x654482;
const ACTIVE_SLOT_COLOR = VISUAL_PALETTE.ultimateRecord;
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

  render(
    teleportCooldownFrames: number,
    ultimateCharge: number,
    ultimateMaximumCharge: number,
    ultimatePhase: UltimatePhase,
    ultimatePhaseFrames: number,
  ): void {
    for (const slotId of SKILL_SLOT_IDS) {
      const view = this.slotViews.get(slotId)!;
      const skillId = this.skillBindings.getSkill(slotId);
      const skillStatus = formatSkillStatus(
        skillId,
        teleportCooldownFrames,
        ultimateCharge,
        ultimateMaximumCharge,
        ultimatePhase,
        ultimatePhaseFrames,
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
        color: '#96a5bd',
        fontFamily: 'monospace',
        fontSize: '13px',
      })
      .setOrigin(1, 0.5)
      .setDepth(WINDOW_DEPTH);

    SKILL_SLOT_IDS.forEach((slotId, index) => {
      const x = startX + index * (SLOT_WIDTH + SLOT_GAP);
      const rectangle = this.scene.add
        .rectangle(x, SLOT_Y, SLOT_WIDTH, SLOT_HEIGHT, EMPTY_SLOT_COLOR, 0.94)
        .setStrokeStyle(2, VISUAL_PALETTE.wallEdge, 0.9)
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
      .rectangle(480, 270, 500, 270, VISUAL_PALETTE.floor, 0.98)
      .setStrokeStyle(3, VISUAL_PALETTE.wallEdge, 1)
      .setInteractive()
      .setDepth(WINDOW_DEPTH + 10);
    const title = this.scene.add
      .text(480, 170, 'SKILL LOADOUT', {
        color: '#e7edf7',
        fontFamily: 'monospace',
        fontSize: '24px',
      })
      .setOrigin(0.5)
      .setDepth(WINDOW_DEPTH + 11);
    const instruction = this.scene.add
      .text(480, 205, 'Drag a skill onto Q / E / R / SPACE / RMB\nTAB: close', {
        align: 'center',
        color: '#96a5bd',
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
        .setStrokeStyle(2, VISUAL_PALETTE.text, 0.9);
      const tileTitle = this.scene.add
        .text(0, -14, PLAYTEST_SKILL_LABELS[skillId], {
          color: '#e7edf7',
          fontFamily: 'monospace',
          fontSize: '18px',
        })
        .setOrigin(0.5);
      const tileDescription = this.scene.add
        .text(0, 15, skillDescription(skillId), {
          align: 'center',
          color: '#c6d1e3',
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
  teleportCooldownFrames: number,
  ultimateCharge: number,
  ultimateMaximumCharge: number,
  ultimatePhase: UltimatePhase,
  ultimatePhaseFrames: number,
): { color: number; label: string } {
  if (skillId === null) {
    return { color: EMPTY_SLOT_COLOR, label: 'EMPTY' };
  }
  if (skillId === 'ultimate') {
    if (ultimatePhase === 'recording') {
      return {
        color: ACTIVE_SLOT_COLOR,
        label: `STOP ${(ultimatePhaseFrames * FIXED_STEP_SECONDS).toFixed(1)}s`,
      };
    }
    if (ultimatePhase === 'replaying') {
      return { color: ACTIVE_SLOT_COLOR, label: 'ECHO REPLAY' };
    }
    const chargePercent = Math.floor(
      (ultimateCharge / ultimateMaximumCharge) * 100,
    );
    return {
      color:
        ultimateCharge >= ultimateMaximumCharge
          ? ACTIVE_SLOT_COLOR
          : ULTIMATE_SLOT_COLOR,
      label:
        ultimateCharge >= ultimateMaximumCharge
          ? 'TIME STOP READY'
          : `TIME STOP ${chargePercent}%`,
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
  return skillId === 'ultimate'
    ? ULTIMATE_SLOT_COLOR
    : TELEPORT_SLOT_COLOR;
}

function skillDescription(skillId: PlaytestSkillId): string {
  return skillId === 'ultimate'
    ? `Up to ${ULTIMATE_RECORD_FRAMES * FIXED_STEP_SECONDS}s\n` +
        `Press again: ${ULTIMATE_REPLAY_SPEED}x replay`
    : 'Blink toward the cursor';
}
