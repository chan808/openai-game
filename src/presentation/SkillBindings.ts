export const SKILL_SLOT_IDS = [
  'q',
  'e',
  'r',
  'space',
  'mouseRight',
] as const;

export type SkillSlotId = (typeof SKILL_SLOT_IDS)[number];
export type PlaytestSkillId = 'slow' | 'teleport';

export const SKILL_SLOT_LABELS: Record<SkillSlotId, string> = {
  q: 'Q',
  e: 'E',
  r: 'R',
  space: 'SPACE',
  mouseRight: 'RMB',
};

export const PLAYTEST_SKILL_LABELS: Record<PlaytestSkillId, string> = {
  slow: 'SLOW',
  teleport: 'TELEPORT',
};

type SkillSlots = Record<SkillSlotId, PlaytestSkillId | null>;

export class SkillBindings {
  private readonly slots: SkillSlots = {
    q: null,
    e: null,
    r: null,
    space: 'slow',
    mouseRight: 'teleport',
  };

  getSkill(slotId: SkillSlotId): PlaytestSkillId | null {
    return this.slots[slotId];
  }

  getSlot(skillId: PlaytestSkillId): SkillSlotId | null {
    return (
      SKILL_SLOT_IDS.find((slotId) => this.slots[slotId] === skillId) ??
      null
    );
  }

  moveSkill(skillId: PlaytestSkillId, targetSlotId: SkillSlotId): void {
    const sourceSlotId = this.getSlot(skillId);
    if (sourceSlotId === targetSlotId) {
      return;
    }

    const displacedSkill = this.slots[targetSlotId];
    this.slots[targetSlotId] = skillId;

    if (sourceSlotId !== null) {
      this.slots[sourceSlotId] = displacedSkill;
    }
  }
}
